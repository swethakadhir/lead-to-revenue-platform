-- Supabase remembers durable journey state and work; n8n will execute claimed jobs later.
create table public.lead_journeys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null,
  conversation_id uuid,
  stage text not null check (stage in ('requirement_understanding','qualification','follow_up','booking_ready','booking_in_progress','converted','disqualified','dormant')),
  last_completed_stage text,
  next_expected_action text,
  next_action_due_at timestamptz,
  follow_up_required boolean not null default false,
  blocked_by_human_intervention boolean not null default false,
  converted_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (lead_id, tenant_id),
  foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade,
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete set null
);
create index lead_journeys_tenant_stage_idx on public.lead_journeys(tenant_id, stage, next_action_due_at);
create index lead_journeys_blocked_idx on public.lead_journeys(tenant_id, blocked_by_human_intervention) where blocked_by_human_intervention;

create table public.journey_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid not null, conversation_id uuid, event_type text not null check (event_type ~ '^[a-z0-9]+(_[a-z0-9]+)*$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'), created_at timestamptz not null default now(),
  foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade,
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete set null
);
create index journey_events_tenant_lead_created_idx on public.journey_events(tenant_id, lead_id, created_at desc);

create table public.action_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid, conversation_id uuid, job_type text not null check (job_type ~ '^[a-z0-9]+(_[a-z0-9]+)*$'), journey_stage text,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'), due_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0), max_attempts integer not null default 5 check (max_attempts between 1 and 20),
  last_attempt_at timestamptz, next_retry_at timestamptz, completed_at timestamptz, failed_at timestamptz,
  last_error_category text, last_error_message text, idempotency_key text not null check (char_length(btrim(idempotency_key)) between 1 and 200),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key),
  foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete cascade,
  foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete set null
);
create index action_jobs_recovery_idx on public.action_jobs(status, due_at, next_retry_at) where status in ('pending','failed');
create index action_jobs_tenant_status_idx on public.action_jobs(tenant_id, status, due_at);

create trigger lead_journeys_set_updated_at before update on public.lead_journeys for each row execute function private.set_updated_at();
create trigger action_jobs_set_updated_at before update on public.action_jobs for each row execute function private.set_updated_at();

create function private.journey_stage_for_lead_status(p_status text) returns text language sql immutable set search_path = '' as $$
  select case p_status when 'qualified' then 'booking_ready' when 'booking_ready' then 'booking_ready' when 'booking_in_progress' then 'booking_in_progress' when 'converted' then 'converted' when 'disqualified' then 'disqualified' when 'dormant' then 'dormant' when 'qualifying' then 'qualification' else 'requirement_understanding' end;
$$;
create function private.sync_lead_journey() returns trigger language plpgsql security definer set search_path = '' as $$
declare target_stage text := private.journey_stage_for_lead_status(new.status); event_name text;
begin
  insert into public.lead_journeys(tenant_id, lead_id, stage, last_completed_stage, next_expected_action, next_action_due_at, follow_up_required, converted_at)
  values (new.tenant_id, new.id, target_stage, null, case when target_stage = 'qualification' then 'collect_required_information' when target_stage = 'booking_ready' then 'begin_booking' when target_stage = 'converted' then null else 'understand_requirement' end, new.next_followup_at, new.next_followup_at is not null, case when target_stage = 'converted' then now() else null end)
  on conflict (lead_id, tenant_id) do update set
    last_completed_stage = case when public.lead_journeys.stage is distinct from excluded.stage then public.lead_journeys.stage else public.lead_journeys.last_completed_stage end,
    stage = excluded.stage, next_expected_action = excluded.next_expected_action, next_action_due_at = excluded.next_action_due_at,
    follow_up_required = excluded.follow_up_required, converted_at = coalesce(public.lead_journeys.converted_at, excluded.converted_at);
  if tg_op = 'INSERT' then event_name := 'journey_created';
  elsif old.status is distinct from new.status then event_name := case when new.status = 'converted' then 'lead_converted' else 'journey_stage_changed' end;
  elsif old.qualification_status is distinct from new.qualification_status then event_name := 'qualification_updated';
  elsif old.next_followup_at is distinct from new.next_followup_at then event_name := 'follow_up_scheduled'; end if;
  if event_name is not null then insert into public.journey_events(tenant_id, lead_id, event_type, metadata) values (new.tenant_id, new.id, event_name, jsonb_build_object('lead_status', new.status, 'qualification_status', new.qualification_status)); end if;
  return new;
end;
$$;
create trigger leads_sync_journey after insert or update of status, qualification_status, next_followup_at on public.leads for each row execute function private.sync_lead_journey();

create function private.sync_intervention_block() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.lead_id is not null then
    update public.lead_journeys set blocked_by_human_intervention = new.status in ('open','in_progress') where tenant_id = new.tenant_id and lead_id = new.lead_id;
    insert into public.journey_events(tenant_id, lead_id, conversation_id, event_type, metadata) values (new.tenant_id, new.lead_id, new.conversation_id, case when new.status = 'resolved' then 'intervention_resolved' else 'intervention_opened' end, jsonb_build_object('intervention_id', new.id));
  end if; return new;
end;
$$;
create trigger human_interventions_sync_journey after insert or update of status on public.human_interventions for each row execute function private.sync_intervention_block();

create function public.claim_due_action_jobs(p_limit integer default 20)
returns setof public.action_jobs language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_operator() then raise exception 'Platform operator access required' using errcode = '42501'; end if;
  return query with candidates as (
    select id from public.action_jobs where (status = 'pending' and due_at <= now()) or (status = 'failed' and next_retry_at <= now() and attempt_count < max_attempts)
    order by coalesce(next_retry_at, due_at), created_at for update skip locked limit greatest(1, least(p_limit, 100))
  ) update public.action_jobs job set status = 'processing', attempt_count = job.attempt_count + 1, last_attempt_at = now(), next_retry_at = null, failed_at = null
  from candidates where job.id = candidates.id returning job.*;
end;
$$;
create function public.complete_action_job(p_job_id uuid, p_success boolean, p_error_category text default null, p_error_message text default null)
returns public.action_jobs language plpgsql security definer set search_path = '' as $$
declare updated public.action_jobs;
begin
  if not private.is_platform_operator() then raise exception 'Platform operator access required' using errcode = '42501'; end if;
  update public.action_jobs set status = case when p_success then 'completed' when attempt_count >= max_attempts then 'failed' else 'pending' end,
    completed_at = case when p_success then now() else null end, failed_at = case when not p_success and attempt_count >= max_attempts then now() else null end,
    next_retry_at = case when not p_success and attempt_count < max_attempts then now() + make_interval(secs => least(3600, 60 * power(2, greatest(attempt_count - 1, 0))::integer)) else null end,
    last_error_category = case when p_success then null else left(coalesce(p_error_category, 'execution_failed'), 80) end,
    last_error_message = case when p_success then null else left(coalesce(p_error_message, 'Action execution failed.'), 500) end
  where id = p_job_id and status = 'processing' returning * into updated;
  if updated.id is null then raise exception 'Action job is not claimed' using errcode = 'P0002'; end if;
  insert into public.journey_events(tenant_id, lead_id, conversation_id, event_type, metadata) values (updated.tenant_id, updated.lead_id, updated.conversation_id, case when p_success then 'action_job_completed' else 'action_job_failed' end, jsonb_build_object('job_id', updated.id, 'job_type', updated.job_type));
  return updated;
end;
$$;

alter table public.lead_journeys enable row level security; alter table public.journey_events enable row level security; alter table public.action_jobs enable row level security;
create policy platform_operators_read_journeys on public.lead_journeys for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_journey_events on public.journey_events for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_action_jobs on public.action_jobs for select to authenticated using (private.is_platform_operator());
revoke all on public.lead_journeys, public.journey_events, public.action_jobs from anon, authenticated;
grant select on public.lead_journeys, public.journey_events, public.action_jobs to authenticated;
grant execute on function public.claim_due_action_jobs(integer), public.complete_action_job(uuid, boolean, text, text) to authenticated;
revoke all on function private.journey_stage_for_lead_status(text), private.sync_lead_journey(), private.sync_intervention_block() from public, anon, authenticated;

-- Backfill durable journey projections for existing leads.
insert into public.lead_journeys(tenant_id, lead_id, stage, next_expected_action, next_action_due_at, follow_up_required, converted_at)
select tenant_id, id, private.journey_stage_for_lead_status(status),
  case when status = 'qualifying' then 'collect_required_information' when status in ('qualified','booking_ready') then 'begin_booking' when status = 'converted' then null else 'understand_requirement' end,
  next_followup_at, next_followup_at is not null, case when status = 'converted' then updated_at else null end
from public.leads on conflict (lead_id, tenant_id) do nothing;

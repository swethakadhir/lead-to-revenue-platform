alter table public.action_jobs add column claimed_at timestamptz, add column lease_expires_at timestamptz;
create index action_jobs_lease_idx on public.action_jobs(status, lease_expires_at) where status = 'processing';

create function public.claim_due_action_jobs_worker(p_limit integer default 20)
returns setof public.action_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query with candidates as (
    select id from public.action_jobs where
      (status = 'pending' and due_at <= now()) or
      (status = 'failed' and next_retry_at <= now() and attempt_count < max_attempts) or
      (status = 'processing' and lease_expires_at <= now() and attempt_count < max_attempts)
    order by coalesce(next_retry_at, due_at), created_at for update skip locked limit greatest(1, least(p_limit, 50))
  ) update public.action_jobs job set status = 'processing', attempt_count = job.attempt_count + 1, last_attempt_at = now(), claimed_at = now(), lease_expires_at = now() + interval '10 minutes', next_retry_at = null
  from candidates where job.id = candidates.id returning job.*;
end;
$$;
create function public.complete_action_job_worker(p_job_id uuid, p_success boolean, p_retryable boolean default false, p_error_category text default null, p_error_message text default null)
returns public.action_jobs language plpgsql security definer set search_path = '' as $$
declare updated public.action_jobs;
begin
  update public.action_jobs set status = case when p_success then 'completed' when p_retryable and attempt_count < max_attempts then 'pending' else 'failed' end,
    completed_at = case when p_success then now() else null end, failed_at = case when not p_success and (not p_retryable or attempt_count >= max_attempts) then now() else null end,
    next_retry_at = case when not p_success and p_retryable and attempt_count < max_attempts then now() + make_interval(secs => least(3600, 60 * power(2, greatest(attempt_count - 1, 0))::integer)) else null end,
    lease_expires_at = null, last_error_category = case when p_success then null else left(coalesce(p_error_category, 'execution_failed'),80) end,
    last_error_message = case when p_success then null else left(coalesce(p_error_message, 'Action execution failed.'),500) end
  where id = p_job_id and status = 'processing' returning * into updated;
  if updated.id is null then select * into updated from public.action_jobs where id = p_job_id and status = 'completed'; if updated.id is null then raise exception 'Action job is not claimable' using errcode = 'P0002'; end if; return updated; end if;
  insert into public.journey_events(tenant_id,lead_id,conversation_id,event_type,metadata) values(updated.tenant_id,updated.lead_id,updated.conversation_id,case when p_success then 'action_job_completed' else 'action_job_failed' end,jsonb_build_object('job_id',updated.id,'job_type',updated.job_type));
  return updated;
end;
$$;
create function private.enqueue_followup_job() returns trigger language plpgsql security definer set search_path = '' as $$ begin
  if new.lead_id is not null and new.status = 'pending' then insert into public.action_jobs(tenant_id,lead_id,job_type,due_at,idempotency_key,payload) values(new.tenant_id,new.lead_id,'lead_follow_up',new.due_at,'lead:'||new.lead_id||':followup:'||new.id,jsonb_build_object('followup_id',new.id,'type',new.type)) on conflict (tenant_id,idempotency_key) do nothing; end if; return new; end; $$;
create trigger followups_enqueue_action_job after insert on public.followups for each row execute function private.enqueue_followup_job();
create function private.enqueue_intervention_job() returns trigger language plpgsql security definer set search_path = '' as $$ begin
  if new.status in ('open','in_progress') then insert into public.action_jobs(tenant_id,lead_id,conversation_id,job_type,due_at,idempotency_key,payload) values(new.tenant_id,new.lead_id,new.conversation_id,'internal_notification',now(),'intervention:'||new.id||':notify-internal',jsonb_build_object('intervention_id',new.id)) on conflict (tenant_id,idempotency_key) do nothing; end if; return new; end; $$;
create trigger interventions_enqueue_action_job after insert on public.human_interventions for each row execute function private.enqueue_intervention_job();
revoke all on function public.claim_due_action_jobs_worker(integer), public.complete_action_job_worker(uuid,boolean,boolean,text,text) from public, anon, authenticated;
revoke all on function private.enqueue_followup_job(), private.enqueue_intervention_job() from public, anon, authenticated;

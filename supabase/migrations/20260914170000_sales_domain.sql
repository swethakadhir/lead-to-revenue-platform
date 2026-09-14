create table public.pipeline_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and char_length(key) <= 63),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  stage_order integer not null check (stage_order >= 0),
  stage_type text not null check (stage_type in ('open', 'won', 'lost', 'dormant')),
  is_terminal boolean not null default false,
  is_active boolean not null default true,
  constraint pipeline_definitions_tenant_key_key unique (tenant_id, key),
  constraint pipeline_definitions_tenant_order_key unique (tenant_id, stage_order),
  constraint pipeline_definitions_terminal_consistency_check check (
    (stage_type = 'open' and not is_terminal)
    or (stage_type <> 'open' and is_terminal)
  )
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  first_name text not null check (char_length(btrim(first_name)) between 1 and 100),
  last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 100),
  email text check (email is null or char_length(btrim(email)) between 3 and 320),
  phone text check (phone is null or char_length(btrim(phone)) between 3 and 40),
  whatsapp_number text check (whatsapp_number is null or char_length(btrim(whatsapp_number)) between 3 and 40),
  preferred_channel text check (preferred_channel is null or preferred_channel in ('email', 'phone', 'whatsapp')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_id_tenant_key unique (id, tenant_id)
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  contact_id uuid,
  source_id uuid,
  campaign_id uuid,
  external_lead_id text check (external_lead_id is null or char_length(btrim(external_lead_id)) between 1 and 255),
  status text not null default 'new' check (status in ('new', 'contacted', 'engaged', 'qualifying', 'qualified', 'disqualified', 'dormant', 'converted')),
  qualification_status text not null default 'unqualified' check (qualification_status in ('unqualified', 'pending', 'qualified', 'disqualified')),
  qualification_score integer check (qualification_score between 0 and 100),
  assigned_user_id uuid,
  lead_data jsonb not null default '{}'::jsonb check (jsonb_typeof(lead_data) = 'object'),
  first_contacted_at timestamptz,
  last_contacted_at timestamptz,
  next_followup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leads_id_tenant_key unique (id, tenant_id),
  constraint leads_contact_tenant_fkey foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete restrict,
  constraint leads_assignee_tenant_fkey foreign key (tenant_id, assigned_user_id)
    references public.tenant_members (tenant_id, user_id) on delete restrict,
  constraint leads_contacted_timestamps_check check (
    first_contacted_at is null or last_contacted_at is null or last_contacted_at >= first_contacted_at
  )
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid not null,
  contact_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  stage_key text not null,
  estimated_value numeric(15, 2) check (estimated_value is null or estimated_value >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  probability integer check (probability between 0 and 100),
  assigned_user_id uuid,
  expected_close_date date,
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text check (lost_reason is null or char_length(btrim(lost_reason)) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_id_tenant_key unique (id, tenant_id),
  constraint opportunities_lead_tenant_fkey foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete restrict,
  constraint opportunities_contact_tenant_fkey foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete restrict,
  constraint opportunities_assignee_tenant_fkey foreign key (tenant_id, assigned_user_id)
    references public.tenant_members (tenant_id, user_id) on delete restrict,
  constraint opportunities_stage_tenant_fkey foreign key (tenant_id, stage_key)
    references public.pipeline_definitions (tenant_id, key) on update cascade on delete restrict,
  constraint opportunities_outcome_exclusive_check check (won_at is null or lost_at is null)
);

create index pipeline_definitions_tenant_active_order_idx
  on public.pipeline_definitions (tenant_id, is_active, stage_order);
create index contacts_tenant_id_idx on public.contacts (tenant_id);
create index contacts_tenant_normalized_email_idx
  on public.contacts (tenant_id, lower(btrim(email))) where email is not null;
create index contacts_tenant_normalized_phone_idx
  on public.contacts (tenant_id, regexp_replace(phone, '[^0-9]+', '', 'g')) where phone is not null;
create index leads_tenant_created_idx on public.leads (tenant_id, created_at desc);
create index leads_tenant_status_idx on public.leads (tenant_id, status);
create index leads_tenant_assignee_idx on public.leads (tenant_id, assigned_user_id) where assigned_user_id is not null;
create index leads_contact_idx on public.leads (contact_id) where contact_id is not null;
create index opportunities_tenant_stage_idx on public.opportunities (tenant_id, stage_key);
create index opportunities_tenant_assignee_idx on public.opportunities (tenant_id, assigned_user_id) where assigned_user_id is not null;
create index opportunities_lead_idx on public.opportunities (lead_id);

create trigger contacts_set_updated_at
before update on public.contacts
for each row execute function private.set_updated_at();

create trigger leads_set_updated_at
before update on public.leads
for each row execute function private.set_updated_at();

create function private.validate_active_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_user_id is not null and not exists (
    select 1 from public.tenant_members
    where tenant_id = new.tenant_id
      and user_id = new.assigned_user_id
      and status = 'active'
  ) then
    raise exception 'Assigned user must be an active member of the tenant' using errcode = '23503';
  end if;
  return new;
end;
$$;

create trigger leads_validate_active_assignee
before insert or update of tenant_id, assigned_user_id on public.leads
for each row execute function private.validate_active_assignee();

create trigger opportunities_validate_active_assignee
before insert or update of tenant_id, assigned_user_id on public.opportunities
for each row execute function private.validate_active_assignee();

create function private.set_opportunity_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_stage_type text;
begin
  select stage_type into selected_stage_type
  from public.pipeline_definitions
  where tenant_id = new.tenant_id and key = new.stage_key and is_active;

  if selected_stage_type is null then
    raise exception 'Opportunity stage must be active for the tenant' using errcode = '23503';
  elsif selected_stage_type = 'won' then
    new.won_at = case
      when tg_op = 'UPDATE' and old.stage_key = new.stage_key then old.won_at
      else coalesce(new.won_at, now())
    end;
    new.lost_at = null;
    new.lost_reason = null;
  elsif selected_stage_type = 'lost' then
    if nullif(btrim(new.lost_reason), '') is null then
      raise exception 'A lost reason is required for a lost opportunity' using errcode = '23514';
    end if;
    new.lost_at = case
      when tg_op = 'UPDATE' and old.stage_key = new.stage_key then old.lost_at
      else coalesce(new.lost_at, now())
    end;
    new.won_at = null;
  else
    new.won_at = null;
    new.lost_at = null;
    new.lost_reason = null;
  end if;
  return new;
end;
$$;

create trigger opportunities_set_outcome
before insert or update of tenant_id, stage_key, lost_reason on public.opportunities
for each row execute function private.set_opportunity_outcome();

create trigger opportunities_set_updated_at
before update on public.opportunities
for each row execute function private.set_updated_at();

create function private.provision_default_pipeline(p_tenant_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.pipeline_definitions
    (tenant_id, key, name, stage_order, stage_type, is_terminal, is_active)
  values
    (p_tenant_id, 'new', 'New', 10, 'open', false, true),
    (p_tenant_id, 'contacted', 'Contacted', 20, 'open', false, true),
    (p_tenant_id, 'engaged', 'Engaged', 30, 'open', false, true),
    (p_tenant_id, 'qualifying', 'Qualifying', 40, 'open', false, true),
    (p_tenant_id, 'qualified', 'Qualified', 50, 'open', false, true),
    (p_tenant_id, 'appointment_booked', 'Appointment Booked', 60, 'open', false, true),
    (p_tenant_id, 'appointment_completed', 'Appointment Completed', 70, 'open', false, true),
    (p_tenant_id, 'proposal', 'Proposal', 80, 'open', false, true),
    (p_tenant_id, 'won', 'Won', 90, 'won', true, true),
    (p_tenant_id, 'lost', 'Lost', 100, 'lost', true, true),
    (p_tenant_id, 'dormant', 'Dormant', 110, 'dormant', true, true)
  on conflict (tenant_id, key) do nothing;
$$;

create function private.provision_tenant_pipeline()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.provision_default_pipeline(new.id);
  return new;
end;
$$;

create trigger tenants_provision_default_pipeline
after insert on public.tenants
for each row execute function private.provision_tenant_pipeline();

select private.provision_default_pipeline(id) from public.tenants;

create function private.user_colleague_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct colleague.user_id
  from public.tenant_members own
  join public.tenant_members colleague on colleague.tenant_id = own.tenant_id
  where own.user_id = auth.uid()
    and own.status = 'active'
    and colleague.status = 'active';
$$;

revoke all on function private.user_colleague_ids() from public;
grant execute on function private.user_colleague_ids() to authenticated;

drop policy profiles_select_own on public.profiles;
create policy profiles_select_tenant_colleagues
on public.profiles for select
to authenticated
using (id in (select private.user_colleague_ids()));

alter table public.pipeline_definitions enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;

create policy pipeline_definitions_for_active_members
on public.pipeline_definitions for all
to authenticated
using (tenant_id in (select private.user_tenant_ids()))
with check (tenant_id in (select private.user_tenant_ids()));

create policy contacts_for_active_members
on public.contacts for all
to authenticated
using (tenant_id in (select private.user_tenant_ids()))
with check (tenant_id in (select private.user_tenant_ids()));

create policy leads_for_active_members
on public.leads for all
to authenticated
using (tenant_id in (select private.user_tenant_ids()))
with check (tenant_id in (select private.user_tenant_ids()));

create policy opportunities_for_active_members
on public.opportunities for all
to authenticated
using (tenant_id in (select private.user_tenant_ids()))
with check (tenant_id in (select private.user_tenant_ids()));

revoke all on public.pipeline_definitions, public.contacts, public.leads, public.opportunities from anon, authenticated;
grant select, insert, update, delete on public.pipeline_definitions, public.contacts, public.leads, public.opportunities to authenticated;

create function public.create_manual_lead(
  p_tenant_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_status text,
  p_assigned_user_id uuid,
  p_lead_data jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_contact_id uuid;
  created_lead_id uuid;
  clean_email text := nullif(lower(btrim(p_email)), '');
  clean_phone text := nullif(btrim(p_phone), '');
begin
  if p_tenant_id not in (select private.user_tenant_ids()) then
    raise exception 'Active tenant membership is required' using errcode = '42501';
  end if;

  if clean_email is not null then
    select id into selected_contact_id
    from public.contacts
    where tenant_id = p_tenant_id and lower(btrim(email)) = clean_email
    order by created_at limit 1;
  end if;

  if selected_contact_id is null and clean_phone is not null then
    select id into selected_contact_id
    from public.contacts
    where tenant_id = p_tenant_id
      and regexp_replace(phone, '[^0-9]+', '', 'g') = regexp_replace(clean_phone, '[^0-9]+', '', 'g')
    order by created_at limit 1;
  end if;

  if selected_contact_id is null then
    insert into public.contacts (tenant_id, first_name, last_name, email, phone)
    values (
      p_tenant_id,
      btrim(p_first_name),
      nullif(btrim(p_last_name), ''),
      clean_email,
      clean_phone
    ) returning id into selected_contact_id;
  end if;

  insert into public.leads (tenant_id, contact_id, status, assigned_user_id, lead_data)
  values (p_tenant_id, selected_contact_id, p_status, p_assigned_user_id, coalesce(p_lead_data, '{}'::jsonb))
  returning id into created_lead_id;

  return created_lead_id;
end;
$$;

create function public.update_lead_with_contact(
  p_tenant_id uuid,
  p_lead_id uuid,
  p_first_name text,
  p_last_name text,
  p_email text,
  p_phone text,
  p_status text,
  p_qualification_status text,
  p_qualification_score integer,
  p_assigned_user_id uuid,
  p_lead_data jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_contact_id uuid;
begin
  select contact_id into selected_contact_id
  from public.leads
  where id = p_lead_id and tenant_id = p_tenant_id;
  if not found then
    raise exception 'Lead not found' using errcode = 'P0002';
  end if;

  if selected_contact_id is not null then
    update public.contacts
    set first_name = btrim(p_first_name),
        last_name = nullif(btrim(p_last_name), ''),
        email = nullif(lower(btrim(p_email)), ''),
        phone = nullif(btrim(p_phone), '')
    where id = selected_contact_id and tenant_id = p_tenant_id;
  end if;

  update public.leads
  set status = p_status,
      qualification_status = p_qualification_status,
      qualification_score = p_qualification_score,
      assigned_user_id = p_assigned_user_id,
      lead_data = coalesce(p_lead_data, '{}'::jsonb)
  where id = p_lead_id and tenant_id = p_tenant_id;
end;
$$;

revoke all on function public.create_manual_lead(uuid, text, text, text, text, text, uuid, jsonb) from public, anon;
grant execute on function public.create_manual_lead(uuid, text, text, text, text, text, uuid, jsonb) to authenticated;
revoke all on function public.update_lead_with_contact(uuid, uuid, text, text, text, text, text, text, integer, uuid, jsonb) from public, anon;
grant execute on function public.update_lead_with_contact(uuid, uuid, text, text, text, text, text, text, integer, uuid, jsonb) to authenticated;

revoke all on function private.validate_active_assignee() from public, anon, authenticated;
revoke all on function private.set_opportunity_outcome() from public, anon, authenticated;
revoke all on function private.provision_default_pipeline(uuid) from public, anon, authenticated;
revoke all on function private.provision_tenant_pipeline() from public, anon, authenticated;

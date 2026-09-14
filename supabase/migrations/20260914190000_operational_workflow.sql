create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid,
  opportunity_id uuid,
  contact_id uuid not null,
  assigned_user_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  appointment_type text check (appointment_type is null or char_length(btrim(appointment_type)) between 1 and 80),
  status text not null default 'scheduled' check (status in ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null check (char_length(btrim(timezone)) between 1 and 100),
  location text check (location is null or char_length(btrim(location)) <= 500),
  meeting_url text check (meeting_url is null or char_length(btrim(meeting_url)) <= 2000),
  notes text check (notes is null or char_length(notes) <= 10000),
  cancellation_reason text check (cancellation_reason is null or char_length(btrim(cancellation_reason)) <= 1000),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_id_tenant_key unique (id, tenant_id),
  constraint appointments_contact_tenant_fkey foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete restrict,
  constraint appointments_lead_tenant_fkey foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete restrict,
  constraint appointments_opportunity_tenant_fkey foreign key (opportunity_id, tenant_id)
    references public.opportunities (id, tenant_id) on delete restrict,
  constraint appointments_assignee_tenant_fkey foreign key (tenant_id, assigned_user_id)
    references public.tenant_members (tenant_id, user_id) on delete restrict,
  constraint appointments_time_order_check check (ends_at > starts_at),
  constraint appointments_outcome_exclusive_check check (completed_at is null or cancelled_at is null)
);

create table public.followups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lead_id uuid,
  opportunity_id uuid,
  contact_id uuid not null,
  assigned_user_id uuid,
  type text not null check (type in ('call', 'whatsapp', 'email', 'meeting', 'general')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'cancelled')),
  due_at timestamptz not null,
  completed_at timestamptz,
  notes text check (notes is null or char_length(notes) <= 10000),
  outcome text check (outcome is null or char_length(outcome) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint followups_id_tenant_key unique (id, tenant_id),
  constraint followups_contact_tenant_fkey foreign key (contact_id, tenant_id)
    references public.contacts (id, tenant_id) on delete restrict,
  constraint followups_lead_tenant_fkey foreign key (lead_id, tenant_id)
    references public.leads (id, tenant_id) on delete restrict,
  constraint followups_opportunity_tenant_fkey foreign key (opportunity_id, tenant_id)
    references public.opportunities (id, tenant_id) on delete restrict,
  constraint followups_assignee_tenant_fkey foreign key (tenant_id, assigned_user_id)
    references public.tenant_members (tenant_id, user_id) on delete restrict
);

create index appointments_tenant_starts_idx on public.appointments (tenant_id, starts_at);
create index appointments_tenant_status_starts_idx on public.appointments (tenant_id, status, starts_at);
create index appointments_tenant_assignee_starts_idx on public.appointments (tenant_id, assigned_user_id, starts_at)
  where assigned_user_id is not null;
create index appointments_lead_idx on public.appointments (lead_id) where lead_id is not null;
create index appointments_contact_idx on public.appointments (contact_id);

create index followups_tenant_due_idx on public.followups (tenant_id, due_at);
create index followups_tenant_status_due_idx on public.followups (tenant_id, status, due_at);
create index followups_tenant_assignee_due_idx on public.followups (tenant_id, assigned_user_id, due_at)
  where assigned_user_id is not null;
create index followups_lead_idx on public.followups (lead_id) where lead_id is not null;
create index followups_contact_idx on public.followups (contact_id);

create function private.validate_operational_record()
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

  if tg_table_name = 'appointments' and not exists (
    select 1 from pg_catalog.pg_timezone_names where name = btrim(new.timezone)
  ) then
    raise exception 'Appointment timezone must be a valid IANA timezone' using errcode = '22023';
  end if;
  return new;
end;
$$;

create function private.set_appointment_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.completed_at = case
      when tg_op = 'UPDATE' and old.status = 'completed' then old.completed_at
      else coalesce(new.completed_at, now())
    end;
    new.cancelled_at = null;
    new.cancellation_reason = null;
  elsif new.status = 'cancelled' then
    new.cancelled_at = case
      when tg_op = 'UPDATE' and old.status = 'cancelled' then old.cancelled_at
      else coalesce(new.cancelled_at, now())
    end;
    new.completed_at = null;
  else
    new.completed_at = null;
    new.cancelled_at = null;
    new.cancellation_reason = null;
  end if;
  return new;
end;
$$;

create function private.set_followup_outcome()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'completed' then
    new.completed_at = case
      when tg_op = 'UPDATE' and old.status = 'completed' then old.completed_at
      else coalesce(new.completed_at, now())
    end;
  else
    new.completed_at = null;
  end if;
  return new;
end;
$$;

create trigger appointments_validate_record
before insert or update of tenant_id, assigned_user_id, timezone on public.appointments
for each row execute function private.validate_operational_record();
create trigger appointments_set_outcome
before insert or update of status, cancellation_reason on public.appointments
for each row execute function private.set_appointment_outcome();
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function private.set_updated_at();

create trigger followups_validate_record
before insert or update of tenant_id, assigned_user_id on public.followups
for each row execute function private.validate_operational_record();
create trigger followups_set_outcome
before insert or update of status on public.followups
for each row execute function private.set_followup_outcome();
create trigger followups_set_updated_at
before update on public.followups
for each row execute function private.set_updated_at();

alter table public.appointments enable row level security;
alter table public.followups enable row level security;

create policy appointments_select_for_active_members
on public.appointments for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy appointments_insert_for_operators
on public.appointments for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy appointments_update_for_operators
on public.appointments for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy appointments_delete_for_operators
on public.appointments for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));

create policy followups_select_for_active_members
on public.followups for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy followups_insert_for_operators
on public.followups for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy followups_update_for_operators
on public.followups for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy followups_delete_for_operators
on public.followups for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));

revoke all on public.appointments, public.followups from anon, authenticated;
grant select, insert, update, delete on public.appointments, public.followups to authenticated;

revoke all on function private.validate_operational_record() from public, anon, authenticated;
revoke all on function private.set_appointment_outcome() from public, anon, authenticated;
revoke all on function private.set_followup_outcome() from public, anon, authenticated;

-- Configuration arrays must contain strings, not merely be JSON arrays.
create function private.jsonb_string_array(p_value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_value) = 'array'
    and not exists (select 1 from jsonb_array_elements(p_value) as element(value) where jsonb_typeof(value) <> 'string');
$$;

alter table public.lead_field_definitions add constraint lead_field_options_strings_check
  check (private.jsonb_string_array(options));
alter table public.tenant_settings add constraint tenant_appointment_types_strings_check
  check (private.jsonb_string_array(appointment_types));

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('user','system')),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_tenant_created_idx on public.audit_logs(tenant_id, created_at desc);
alter table public.audit_logs enable row level security;
create policy audit_logs_read_for_admins on public.audit_logs for select to authenticated
  using (private.user_has_tenant_role(tenant_id, array['owner','admin']));
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

create function private.audit_tenant_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_tenant_id uuid;
begin
  if to_jsonb(old) = to_jsonb(new) then return new; end if;
  selected_tenant_id := case when tg_table_name = 'tenants' then new.id else new.tenant_id end;
  insert into public.audit_logs(tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, before_data, after_data)
  values (selected_tenant_id, auth.uid(), case when auth.uid() is null then 'system' else 'user' end,
    'configuration.updated', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

create trigger tenant_settings_audit after update on public.tenant_settings for each row execute function private.audit_tenant_configuration();
create trigger lead_field_definitions_audit after update on public.lead_field_definitions for each row execute function private.audit_tenant_configuration();
create trigger qualification_rules_audit after update on public.qualification_rules for each row execute function private.audit_tenant_configuration();
create trigger pipeline_definitions_audit after update on public.pipeline_definitions for each row execute function private.audit_tenant_configuration();
create trigger tenants_template_audit after update of industry_template_id on public.tenants for each row execute function private.audit_tenant_configuration();
revoke all on function private.jsonb_string_array(jsonb) from public, anon, authenticated;
revoke all on function private.audit_tenant_configuration() from public, anon, authenticated;

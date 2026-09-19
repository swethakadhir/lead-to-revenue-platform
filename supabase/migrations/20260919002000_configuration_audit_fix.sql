-- A CHECK constraint evaluates as the mutating role, so this pure helper must
-- be executable by authenticated users who can update allowed config columns.
grant execute on function private.jsonb_string_array(jsonb) to authenticated;

-- Resolve tenant_id only from the record shape belonging to this trigger.
create or replace function private.audit_tenant_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare selected_tenant_id uuid;
begin
  if to_jsonb(old) = to_jsonb(new) then return new; end if;
  if tg_table_name = 'tenants' then
    selected_tenant_id := new.id;
  else
    selected_tenant_id := new.tenant_id;
  end if;
  insert into public.audit_logs(tenant_id, actor_user_id, actor_type, action, entity_type, entity_id, before_data, after_data)
  values (selected_tenant_id, auth.uid(), case when auth.uid() is null then 'system' else 'user' end,
    'configuration.updated', tg_table_name, new.id, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;

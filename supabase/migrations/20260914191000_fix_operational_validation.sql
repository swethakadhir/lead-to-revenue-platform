create or replace function private.validate_operational_record()
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

  if tg_table_name = 'appointments' then
    if not exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = btrim(to_jsonb(new) ->> 'timezone')
    ) then
      raise exception 'Appointment timezone must be a valid IANA timezone' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_operational_record() from public, anon, authenticated;

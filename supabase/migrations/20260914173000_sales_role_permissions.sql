create function private.user_has_tenant_role(p_tenant_id uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and status = 'active'
      and role = any(p_roles)
  );
$$;

revoke all on function private.user_has_tenant_role(uuid, text[]) from public;
grant execute on function private.user_has_tenant_role(uuid, text[]) to authenticated;

drop policy pipeline_definitions_for_active_members on public.pipeline_definitions;
drop policy contacts_for_active_members on public.contacts;
drop policy leads_for_active_members on public.leads;
drop policy opportunities_for_active_members on public.opportunities;

create policy pipeline_definitions_select_for_active_members
on public.pipeline_definitions for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy pipeline_definitions_insert_for_admins
on public.pipeline_definitions for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin']));
create policy pipeline_definitions_update_for_admins
on public.pipeline_definitions for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin']));
create policy pipeline_definitions_delete_for_admins
on public.pipeline_definitions for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin']));

create policy contacts_select_for_active_members
on public.contacts for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy contacts_insert_for_operators
on public.contacts for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy contacts_update_for_operators
on public.contacts for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy contacts_delete_for_operators
on public.contacts for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));

create policy leads_select_for_active_members
on public.leads for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy leads_insert_for_operators
on public.leads for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy leads_update_for_operators
on public.leads for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy leads_delete_for_operators
on public.leads for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));

create policy opportunities_select_for_active_members
on public.opportunities for select to authenticated
using (tenant_id in (select private.user_tenant_ids()));
create policy opportunities_insert_for_operators
on public.opportunities for insert to authenticated
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy opportunities_update_for_operators
on public.opportunities for update to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']))
with check (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));
create policy opportunities_delete_for_operators
on public.opportunities for delete to authenticated
using (private.user_has_tenant_role(tenant_id, array['owner', 'admin', 'sales', 'front_desk']));

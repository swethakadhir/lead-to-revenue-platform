-- Managed Lead-to-Revenue foundation: platform operators are distinct from tenant members.
create table public.platform_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('operator', 'admin')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations add constraint conversations_id_tenant_key unique (id, tenant_id);

create table public.human_interventions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid,
  contact_id uuid,
  conversation_id uuid,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'cancelled')),
  reason text not null check (char_length(btrim(reason)) between 1 and 2000),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_notes text,
  handled_by uuid references public.platform_operators(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_interventions_lead_tenant_fk foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete set null,
  constraint human_interventions_contact_tenant_fk foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete set null,
  constraint human_interventions_conversation_tenant_fk foreign key (conversation_id, tenant_id) references public.conversations(id, tenant_id) on delete set null
);

create index human_interventions_tenant_status_idx on public.human_interventions(tenant_id, status, requested_at desc);
create trigger platform_operators_set_updated_at before update on public.platform_operators for each row execute function private.set_updated_at();
create trigger human_interventions_set_updated_at before update on public.human_interventions for each row execute function private.set_updated_at();

create function private.is_platform_operator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.platform_operators where user_id = auth.uid() and status = 'active');
$$;
revoke all on function private.is_platform_operator() from public;
grant execute on function private.is_platform_operator() to authenticated;

alter table public.platform_operators enable row level security;
alter table public.human_interventions enable row level security;
create policy platform_operators_read_own on public.platform_operators for select to authenticated using (user_id = auth.uid());
create policy platform_operators_read_interventions on public.human_interventions for select to authenticated using (private.is_platform_operator());
create policy platform_operators_create_interventions on public.human_interventions for insert to authenticated with check (private.is_platform_operator());
create policy platform_operators_update_interventions on public.human_interventions for update to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());
revoke all on public.platform_operators, public.human_interventions from anon, authenticated;
grant select on public.platform_operators to authenticated;
grant select, insert, update on public.human_interventions to authenticated;

-- Operators receive read-only cross-tenant visibility. Tenant-member policies remain unchanged.
create policy platform_operators_read_tenants on public.tenants for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_members on public.tenant_members for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_profiles on public.profiles for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_settings on public.tenant_settings for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_lead_fields on public.lead_field_definitions for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_qualification_rules on public.qualification_rules for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_pipeline on public.pipeline_definitions for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_contacts on public.contacts for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_leads on public.leads for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_opportunities on public.opportunities for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_appointments on public.appointments for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_followups on public.followups for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_chatbot_configs on public.chatbot_configs for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_chatbot_nodes on public.chatbot_nodes for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_chatbot_edges on public.chatbot_edges for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_conversations on public.conversations for select to authenticated using (private.is_platform_operator());
create policy platform_operators_read_messages on public.conversation_messages for select to authenticated using (private.is_platform_operator());
create policy platform_operators_update_chatbot_configs on public.chatbot_configs for update to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());
create policy platform_operators_update_chatbot_nodes on public.chatbot_nodes for update to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());
create policy platform_operators_update_chatbot_edges on public.chatbot_edges for update to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());

-- The lead remains the lifecycle source of truth. These additive states support the managed journey.
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads add constraint leads_status_check check (status in ('new', 'contacted', 'engaged', 'understanding_requirement', 'qualifying', 'qualified', 'booking_ready', 'booking_in_progress', 'human_intervention', 'disqualified', 'dormant', 'converted'));

create function private.mark_confirmed_booking_converted()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'confirmed' and new.lead_id is not null then
    update public.leads set status = 'converted' where id = new.lead_id and tenant_id = new.tenant_id;
  end if;
  return new;
end;
$$;
create trigger appointments_confirmed_booking_converted after insert or update of status on public.appointments for each row execute function private.mark_confirmed_booking_converted();

-- Template data, not runtime branching: direct staff contact supplies a valid generic service value
-- when that template requires one before a lead may be created.
update public.industry_templates set configuration = jsonb_set(configuration, '{chatbot,nodes,0,options,4,2}', '{"treatment_type":"Other"}'::jsonb, true) where key = 'dental';
update public.industry_templates set configuration = jsonb_set(configuration, '{chatbot,nodes,0,options,4,2}', '{"service_type":"Other"}'::jsonb, true) where key = 'salon';
update public.industry_templates set configuration = jsonb_set(configuration, '{chatbot,nodes,0,options,5,2}', '{"project_type":"Other"}'::jsonb, true) where key = 'interior_design';

-- Template changes preserve an existing chatbot. This explicit operator-only reset is the safe replacement path.
create function public.reset_chatbot_to_tenant_template(p_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare selected_template_id uuid;
begin
  if not private.is_platform_operator() then raise exception 'Platform operator access required' using errcode = '42501'; end if;
  select industry_template_id into selected_template_id from public.tenants where id = p_tenant_id;
  if selected_template_id is null then raise exception 'Tenant has no selected template' using errcode = '22023'; end if;
  delete from public.chatbot_configs where tenant_id = p_tenant_id;
  perform private.provision_chatbot(p_tenant_id, selected_template_id);
end;
$$;
grant execute on function public.reset_chatbot_to_tenant_template(uuid) to authenticated;

revoke all on function private.mark_confirmed_booking_converted() from public, anon, authenticated;
revoke all on function public.reset_chatbot_to_tenant_template(uuid) from public, anon;

-- Phase 4: immutable starter templates are copied into tenant-owned configuration.
create table public.industry_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text not null default '',
  version integer not null default 1 check (version > 0),
  is_active boolean not null default true,
  configuration jsonb not null check (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenants add column industry_template_id uuid references public.industry_templates(id);

create table public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  business_name text not null,
  business_description text,
  business_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(business_hours) = 'object'),
  default_language text not null default 'en',
  appointment_types jsonb not null default '[]'::jsonb check (jsonb_typeof(appointment_types) = 'array'),
  followup_defaults jsonb not null default '{}'::jsonb check (jsonb_typeof(followup_defaults) = 'object'),
  terminology jsonb not null default '{}'::jsonb check (jsonb_typeof(terminology) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_field_definitions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$' and char_length(key) <= 63),
  label text not null check (char_length(btrim(label)) between 1 and 100),
  field_type text not null check (field_type in ('text','textarea','number','currency','select','multi_select','boolean','date','datetime','phone','email')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  placeholder text,
  help_text text,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  qualification_relevant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  constraint lead_field_select_options_check check (
    field_type not in ('select','multi_select') or jsonb_array_length(options) > 0
  )
);

create table public.qualification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  field_key text not null,
  rule_type text not null default 'presence' check (rule_type in ('presence','contact_details')),
  is_required boolean not null default false,
  score_delta integer not null default 0 check (score_delta between -100 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create index lead_field_definitions_tenant_order_idx on public.lead_field_definitions(tenant_id, is_active, sort_order);
create index qualification_rules_tenant_idx on public.qualification_rules(tenant_id, is_active);
create trigger industry_templates_set_updated_at before update on public.industry_templates for each row execute function private.set_updated_at();
create trigger tenant_settings_set_updated_at before update on public.tenant_settings for each row execute function private.set_updated_at();
create trigger lead_field_definitions_set_updated_at before update on public.lead_field_definitions for each row execute function private.set_updated_at();
create trigger qualification_rules_set_updated_at before update on public.qualification_rules for each row execute function private.set_updated_at();

-- The source template is data; the generic provisioner below has no industry branches.
insert into public.industry_templates (key, name, description, configuration) values
('dental', 'Dental Clinic', 'Starter fields for dental enquiries.', '{"lead_fields":[{"key":"treatment_type","label":"Treatment / service","field_type":"select","required":true,"options":["General Consultation","Dental Implant","Root Canal","Braces / Aligners","Teeth Whitening","Crown / Bridge","Other"],"qualification_relevant":true},{"key":"primary_concern","label":"Primary concern","field_type":"textarea","required":false},{"key":"patient_type","label":"Patient type","field_type":"select","options":["New","Existing"]},{"key":"preferred_date","label":"Preferred appointment date","field_type":"date"},{"key":"preferred_contact_method","label":"Preferred contact method","field_type":"select","options":["Phone","Email","WhatsApp"]},{"key":"budget_range","label":"Budget range","field_type":"text"}],"appointment_types":["Consultation","Treatment","Follow-up"],"pipeline_names":{"appointment_booked":"Visit Booked","appointment_completed":"Visit Completed"},"qualification_rules":[{"key":"treatment_interest","name":"Treatment interest present","field_key":"treatment_type","is_required":true},{"key":"contact_details","name":"Valid contact details","field_key":"contact","rule_type":"contact_details","is_required":true},{"key":"appointment_intent","name":"Appointment date supplied","field_key":"preferred_date"}],"followup_defaults":{"channel":"call","delay_days":1},"terminology":{"appointment":"Visit"}}'::jsonb),
('salon', 'Salon / Parlour', 'Starter fields for salon and parlour enquiries.', '{"lead_fields":[{"key":"service_type","label":"Service interested in","field_type":"select","required":true,"options":["Haircut","Hair Colour","Hair Treatment","Facial","Bridal / Event Package","Manicure / Pedicure","Other"],"qualification_relevant":true},{"key":"preferred_date","label":"Preferred date","field_type":"date"},{"key":"preferred_time","label":"Preferred time","field_type":"text"},{"key":"preferred_stylist","label":"Preferred stylist","field_type":"text"},{"key":"first_visit","label":"First visit?","field_type":"boolean"},{"key":"notes","label":"Notes","field_type":"textarea"}],"appointment_types":["Service Appointment","Consultation","Trial"],"pipeline_names":{"appointment_booked":"Service Booked","appointment_completed":"Service Completed"},"qualification_rules":[{"key":"service_interest","name":"Requested service","field_key":"service_type","is_required":true},{"key":"contact_details","name":"Valid contact details","field_key":"contact","rule_type":"contact_details","is_required":true},{"key":"preferred_date","name":"Preferred date","field_key":"preferred_date"}],"followup_defaults":{"channel":"call","delay_days":1},"terminology":{"appointment":"Service appointment"}}'::jsonb),
('interior_design', 'Interior Design', 'Starter fields for interior-design projects.', '{"lead_fields":[{"key":"project_type","label":"Project type","field_type":"select","required":true,"options":["Full Home Interior","Kitchen","Bedroom","Renovation","Office / Commercial","Other"],"qualification_relevant":true},{"key":"property_type","label":"Property type","field_type":"text"},{"key":"location","label":"Location","field_type":"text","qualification_relevant":true},{"key":"approximate_area","label":"Approximate area (sq ft)","field_type":"number"},{"key":"budget","label":"Budget","field_type":"currency","qualification_relevant":true},{"key":"expected_start_date","label":"Expected start date","field_type":"date"},{"key":"scope_of_work","label":"Scope of work","field_type":"textarea"},{"key":"site_visit_required","label":"Site visit required?","field_type":"boolean"},{"key":"notes","label":"Notes","field_type":"textarea"}],"appointment_types":["Discovery Call","Site Visit","Design Consultation"],"pipeline_names":{"appointment_booked":"Consultation Booked","appointment_completed":"Consultation Completed"},"qualification_rules":[{"key":"project_type","name":"Project type","field_key":"project_type","is_required":true},{"key":"location","name":"Project location","field_key":"location"},{"key":"budget","name":"Budget supplied","field_key":"budget"},{"key":"timeline","name":"Expected start date","field_key":"expected_start_date"}],"followup_defaults":{"channel":"call","delay_days":2},"terminology":{"appointment":"Consultation"}}'::jsonb),
('custom', 'Custom / Generic', 'Flexible starter fields for other businesses.', '{"lead_fields":[{"key":"requirement","label":"Requirement","field_type":"textarea"},{"key":"budget","label":"Budget","field_type":"currency"},{"key":"preferred_contact_method","label":"Preferred contact method","field_type":"select","options":["Phone","Email","WhatsApp"]},{"key":"notes","label":"Notes","field_type":"textarea"}],"appointment_types":["Appointment","Consultation"],"pipeline_names":{},"qualification_rules":[{"key":"contact_details","name":"Valid contact details","field_key":"contact","rule_type":"contact_details","is_required":true},{"key":"requirement","name":"Requirement supplied","field_key":"requirement"}],"followup_defaults":{"channel":"call","delay_days":1},"terminology":{}}'::jsonb);

create function private.provision_tenant_configuration(p_tenant_id uuid, p_template_id uuid, p_replace boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare cfg jsonb; tenant_name text;
begin
  select name into tenant_name from public.tenants where id = p_tenant_id;
  select configuration into cfg from public.industry_templates
    where id = coalesce(p_template_id, (select id from public.industry_templates where key = 'custom')) and is_active;
  if cfg is null or tenant_name is null then raise exception 'Tenant or active template not found' using errcode = '22023'; end if;

  insert into public.tenant_settings (tenant_id, business_name, appointment_types, followup_defaults, terminology)
  values (p_tenant_id, tenant_name, cfg->'appointment_types', cfg->'followup_defaults', cfg->'terminology')
  on conflict (tenant_id) do update set
    appointment_types = excluded.appointment_types,
    followup_defaults = excluded.followup_defaults,
    terminology = excluded.terminology
  where p_replace;

  if p_replace then
    update public.lead_field_definitions set is_active = false where tenant_id = p_tenant_id;
    update public.qualification_rules set is_active = false where tenant_id = p_tenant_id;
  end if;

  insert into public.lead_field_definitions (tenant_id, key, label, field_type, required, options, placeholder, help_text, sort_order, qualification_relevant)
  select p_tenant_id, f->>'key', f->>'label', f->>'field_type', coalesce((f->>'required')::boolean, false),
    coalesce(f->'options', '[]'::jsonb), f->>'placeholder', f->>'help_text', (ordinality::integer * 10),
    coalesce((f->>'qualification_relevant')::boolean, false)
  from jsonb_array_elements(cfg->'lead_fields') with ordinality as fields(f, ordinality)
  on conflict (tenant_id, key) do update set label = excluded.label, field_type = excluded.field_type,
    required = excluded.required, options = excluded.options, placeholder = excluded.placeholder,
    help_text = excluded.help_text, sort_order = excluded.sort_order, qualification_relevant = excluded.qualification_relevant, is_active = true
  where p_replace;

  insert into public.qualification_rules (tenant_id, key, name, field_key, rule_type, is_required)
  select p_tenant_id, r->>'key', r->>'name', r->>'field_key', coalesce(r->>'rule_type','presence'), coalesce((r->>'is_required')::boolean, false)
  from jsonb_array_elements(cfg->'qualification_rules') as rules(r)
  on conflict (tenant_id, key) do update set name = excluded.name, field_key = excluded.field_key,
    rule_type = excluded.rule_type, is_required = excluded.is_required, is_active = true
  where p_replace;

  -- Existing stage keys, types, orders and opportunity FKs are never replaced.
  update public.pipeline_definitions p set name = cfg->'pipeline_names'->>p.key
  where p.tenant_id = p_tenant_id and cfg->'pipeline_names' ? p.key and (p_replace or p.name in ('Appointment Booked','Appointment Completed'));
end;
$$;

create function private.provision_tenant_configuration_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.provision_tenant_configuration(new.id, new.industry_template_id);
  return new;
end;
$$;
create trigger tenants_provision_template_configuration after insert on public.tenants
for each row execute function private.provision_tenant_configuration_trigger();

-- Backfill is additive: no lead_data or pipeline record is deleted or rewritten.
select private.provision_tenant_configuration(id, industry_template_id) from public.tenants;

-- Enforce configured field types even for direct database/RPC writes. Unconfigured
-- legacy keys remain valid, and unchanged historical answers survive edits.
create function private.validate_lead_configuration()
returns trigger language plpgsql security definer set search_path = '' as $$
declare field record; answer jsonb; item jsonb;
begin
  for field in select * from public.lead_field_definitions where tenant_id = new.tenant_id and is_active loop
    answer := new.lead_data -> field.key;
    if answer is null or answer = 'null'::jsonb or answer = '""'::jsonb then
      if field.required then
        if tg_op = 'INSERT' then
          raise exception 'Required lead field: %', field.key using errcode = '23514';
        elsif old.lead_data ? field.key then
          raise exception 'Required lead field: %', field.key using errcode = '23514';
        end if;
      end if;
      continue;
    end if;
    if tg_op = 'UPDATE' and new.tenant_id = old.tenant_id
       and answer is not distinct from old.lead_data -> field.key then continue; end if;
    if field.field_type in ('text','textarea','email','phone','select','date','datetime') and jsonb_typeof(answer) <> 'string' then
      raise exception 'Invalid lead field type: %', field.key using errcode = '23514';
    elsif field.field_type in ('number','currency') and (jsonb_typeof(answer) <> 'number' or (field.field_type = 'currency' and (answer #>> '{}')::numeric < 0)) then
      raise exception 'Invalid lead number: %', field.key using errcode = '23514';
    elsif field.field_type = 'boolean' and jsonb_typeof(answer) <> 'boolean' then
      raise exception 'Invalid lead boolean: %', field.key using errcode = '23514';
    elsif field.field_type = 'select' and not (field.options @> jsonb_build_array(answer)) then
      raise exception 'Invalid lead option: %', field.key using errcode = '23514';
    elsif field.field_type = 'multi_select' then
      if jsonb_typeof(answer) <> 'array' or not (field.options @> answer) then
        raise exception 'Invalid lead options: %', field.key using errcode = '23514';
      end if;
      for item in select value from jsonb_array_elements(answer) loop
        if jsonb_typeof(item) <> 'string' then raise exception 'Invalid lead options: %', field.key using errcode = '23514'; end if;
      end loop;
    elsif field.field_type = 'date' then
      if (answer #>> '{}') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Invalid lead date: %', field.key using errcode = '23514'; end if;
      begin perform (answer #>> '{}')::date; exception when others then raise exception 'Invalid lead date: %', field.key using errcode = '23514'; end;
    elsif field.field_type = 'datetime' then
      begin perform (answer #>> '{}')::timestamp; exception when others then raise exception 'Invalid lead datetime: %', field.key using errcode = '23514'; end;
    end if;
  end loop;
  return new;
end;
$$;
create trigger leads_validate_configuration before insert or update of lead_data, tenant_id on public.leads
for each row execute function private.validate_lead_configuration();

create function private.validate_appointment_type()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed jsonb;
begin
  if new.appointment_type is null then return new; end if;
  if tg_op = 'UPDATE' and new.tenant_id = old.tenant_id and new.appointment_type = old.appointment_type then return new; end if;
  select appointment_types into allowed from public.tenant_settings where tenant_id = new.tenant_id;
  if allowed is null or not (allowed @> jsonb_build_array(new.appointment_type)) then
    raise exception 'Appointment type is not configured for tenant' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger appointments_validate_type before insert or update of appointment_type, tenant_id on public.appointments
for each row execute function private.validate_appointment_type();

-- Keep the five-argument RPC intact for existing callers; the new one adds template choice.
create function public.create_tenant_with_owner(
  p_creator_user_id uuid, p_name text, p_slug text, p_timezone text, p_currency text, p_template_id uuid
) returns public.tenants language plpgsql security definer set search_path = '' as $$
declare new_tenant public.tenants;
begin
  if not exists (select 1 from auth.users where id = p_creator_user_id) then
    raise exception 'Creator must be an authenticated user' using errcode = '23503';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = btrim(p_timezone)) then
    raise exception 'Invalid IANA timezone' using errcode = '22023';
  end if;
  if not exists (select 1 from public.industry_templates where id = p_template_id and is_active) then
    raise exception 'Active template required' using errcode = '22023';
  end if;
  insert into public.tenants (name, slug, timezone, currency, industry_template_id)
  values (btrim(p_name), lower(btrim(p_slug)), btrim(p_timezone), upper(btrim(p_currency)), p_template_id)
  returning * into new_tenant;
  insert into public.tenant_members (tenant_id, user_id, role, status)
  values (new_tenant.id, p_creator_user_id, 'owner', 'active');
  return new_tenant;
end;
$$;

-- One-time assignment for legacy tenants. Config and pipeline are copied in the same transaction.
create function public.apply_industry_template(p_tenant_id uuid, p_template_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.user_has_tenant_role(p_tenant_id, array['owner','admin']) then
    raise exception 'Owner or admin membership required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.industry_templates where id = p_template_id and is_active) then
    raise exception 'Active template required' using errcode = '22023';
  end if;
  update public.tenants set industry_template_id = p_template_id
    where id = p_tenant_id and industry_template_id is null;
  if not found then raise exception 'Template already selected or tenant not found' using errcode = '23514'; end if;
  perform private.provision_tenant_configuration(p_tenant_id, p_template_id, true);
end;
$$;

alter table public.industry_templates enable row level security;
alter table public.tenant_settings enable row level security;
alter table public.lead_field_definitions enable row level security;
alter table public.qualification_rules enable row level security;

create policy industry_templates_read on public.industry_templates for select to authenticated using (is_active);
create policy tenant_settings_read on public.tenant_settings for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy tenant_settings_update on public.tenant_settings for update to authenticated
  using (private.user_has_tenant_role(tenant_id, array['owner','admin']))
  with check (private.user_has_tenant_role(tenant_id, array['owner','admin']));
create policy lead_fields_read on public.lead_field_definitions for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy lead_fields_update on public.lead_field_definitions for update to authenticated
  using (private.user_has_tenant_role(tenant_id, array['owner','admin']))
  with check (private.user_has_tenant_role(tenant_id, array['owner','admin']));
create policy qualification_rules_read on public.qualification_rules for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy qualification_rules_update on public.qualification_rules for update to authenticated
  using (private.user_has_tenant_role(tenant_id, array['owner','admin']))
  with check (private.user_has_tenant_role(tenant_id, array['owner','admin']));

revoke all on public.industry_templates, public.tenant_settings, public.lead_field_definitions, public.qualification_rules from anon, authenticated;
grant select on public.industry_templates, public.tenant_settings, public.lead_field_definitions, public.qualification_rules to authenticated;
grant update (business_name, business_description, business_hours, default_language, appointment_types, followup_defaults, terminology)
  on public.tenant_settings to authenticated;
grant update (label, required, options, sort_order, is_active, placeholder, help_text, qualification_relevant)
  on public.lead_field_definitions to authenticated;
grant update (name, is_required, score_delta, is_active) on public.qualification_rules to authenticated;

revoke all on function public.create_tenant_with_owner(uuid,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.create_tenant_with_owner(uuid,text,text,text,text,uuid) to service_role;
revoke all on function public.apply_industry_template(uuid,uuid) from public, anon;
grant execute on function public.apply_industry_template(uuid,uuid) to authenticated;
revoke all on function private.provision_tenant_configuration(uuid,uuid,boolean) from public, anon, authenticated;
revoke all on function private.provision_tenant_configuration_trigger() from public, anon, authenticated;
revoke all on function private.validate_lead_configuration() from public, anon, authenticated;
revoke all on function private.validate_appointment_type() from public, anon, authenticated;

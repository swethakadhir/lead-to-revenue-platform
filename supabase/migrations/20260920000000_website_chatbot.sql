-- Phase 5: a tenant-owned, channel-neutral deterministic conversation model.
create table public.chatbot_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  widget_id uuid not null unique default gen_random_uuid(),
  name text not null default 'Website assistant' check (char_length(btrim(name)) between 1 and 100),
  welcome_message text not null default 'Hi! How can we help?' check (char_length(btrim(welcome_message)) between 1 and 2000),
  fallback_message text not null default 'I do not have a predefined answer for that yet. Please choose an option or leave your details.' check (char_length(btrim(fallback_message)) between 1 and 2000),
  confirmation_message text not null default 'Thanks. Our team will contact you shortly.' check (char_length(btrim(confirmation_message)) between 1 and 2000),
  root_node_id uuid,
  status text not null default 'draft' check (status in ('draft','published')),
  enabled boolean not null default true,
  branding jsonb not null default '{"primary_color":"#2563eb","position":"right"}'::jsonb check (jsonb_typeof(branding) = 'object'),
  lead_capture_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chatbot_nodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chatbot_config_id uuid not null references public.chatbot_configs(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  node_type text not null check (node_type in ('message','choice','answer','capture','action_placeholder','handoff','end')),
  content text not null default '' check (char_length(content) <= 4000),
  capture_key text,
  capture_type text check (capture_type is null or capture_type in ('name','phone','email','text','lead_field')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (chatbot_config_id, key),
  unique (id, chatbot_config_id),
  unique (id, tenant_id)
);
alter table public.chatbot_configs add constraint chatbot_configs_root_node_fk foreign key (root_node_id, id) references public.chatbot_nodes(id, chatbot_config_id) deferrable initially deferred;

create table public.chatbot_edges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chatbot_config_id uuid not null references public.chatbot_configs(id) on delete cascade,
  source_node_id uuid not null,
  destination_node_id uuid not null,
  label text not null default '' check (char_length(label) <= 160),
  display_order integer not null default 0 check (display_order >= 0),
  set_context jsonb not null default '{}'::jsonb check (jsonb_typeof(set_context) = 'object'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  constraint chatbot_edges_source_fk foreign key (source_node_id, chatbot_config_id) references public.chatbot_nodes(id, chatbot_config_id) on delete cascade,
  constraint chatbot_edges_destination_fk foreign key (destination_node_id, chatbot_config_id) references public.chatbot_nodes(id, chatbot_config_id) on delete cascade,
  unique (source_node_id, display_order)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  chatbot_config_id uuid references public.chatbot_configs(id) on delete set null,
  channel text not null default 'website' check (channel in ('website','whatsapp','instagram','facebook')),
  session_identifier uuid not null,
  contact_id uuid,
  lead_id uuid,
  current_node_id uuid,
  context jsonb not null default '{}'::jsonb check (jsonb_typeof(context) = 'object'),
  status text not null default 'active' check (status in ('active','ended','handoff')),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (chatbot_config_id, channel, session_identifier),
  constraint conversations_contact_tenant_fk foreign key (contact_id, tenant_id) references public.contacts(id, tenant_id) on delete set null,
  constraint conversations_lead_tenant_fk foreign key (lead_id, tenant_id) references public.leads(id, tenant_id) on delete set null
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  node_id uuid,
  sender_type text not null check (sender_type in ('visitor','bot','system')),
  message_type text not null check (message_type in ('text','option','capture','fallback','action_placeholder')),
  content text not null default '' check (char_length(content) <= 4000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index chatbot_nodes_config_idx on public.chatbot_nodes(chatbot_config_id);
create index chatbot_edges_source_idx on public.chatbot_edges(source_node_id, display_order);
create index conversations_tenant_activity_idx on public.conversations(tenant_id, last_activity_at desc);
create index conversation_messages_conversation_idx on public.conversation_messages(conversation_id, created_at);
create trigger chatbot_configs_updated_at before update on public.chatbot_configs for each row execute function private.set_updated_at();
create trigger chatbot_nodes_updated_at before update on public.chatbot_nodes for each row execute function private.set_updated_at();

-- The starter graph is template data. The provisioner consumes a generic JSON format.
update public.industry_templates set configuration = jsonb_set(configuration, '{chatbot}', flow, true)
from (values
('dental', '{"root":"welcome","nodes":[{"key":"welcome","type":"choice","content":"How can we help?","options":[["Book an appointment","capture_name",{"treatment_type":"General Consultation"}],["Treatments","treatments",{}],["Pricing","pricing",{}],["Clinic information","info",{}],["Talk to staff","capture_name",{}]]},{"key":"treatments","type":"choice","content":"Which treatment would you like to know about?","options":[["Dental Implants","implants",{"treatment_type":"Dental Implant"}],["Root Canal","treatment_answer",{"treatment_type":"Root Canal"}],["Braces / Aligners","treatment_answer",{"treatment_type":"Braces / Aligners"}],["Teeth Whitening","treatment_answer",{"treatment_type":"Teeth Whitening"}],["Back","welcome",{}]]},{"key":"implants","type":"answer","content":"Configure your implant description in Chatbot Settings.","next":"treatment_capture"},{"key":"treatment_answer","type":"answer","content":"Configure this treatment information in Chatbot Settings.","next":"treatment_capture"},{"key":"treatment_capture","type":"choice","content":"Would you like our team to contact you?","options":[["Yes","capture_name",{}],["No","welcome",{}]]},{"key":"pricing","type":"answer","content":"Configure your pricing information in Chatbot Settings.","next":"welcome"},{"key":"info","type":"answer","content":"Configure your clinic information in Chatbot Settings.","next":"welcome"},{"key":"capture_name","type":"capture","content":"What is your name?","capture_key":"first_name","capture_type":"name","next":"capture_phone"},{"key":"capture_phone","type":"capture","content":"What is your phone number?","capture_key":"phone","capture_type":"phone","next":"capture_email"},{"key":"capture_email","type":"capture","content":"What is your email? (optional)","capture_key":"email","capture_type":"email","next":"lead_confirmation"},{"key":"lead_confirmation","type":"end","content":"Thanks. Our team will contact you shortly."}]}'::jsonb),
('salon', '{"root":"welcome","nodes":[{"key":"welcome","type":"choice","content":"How can we help?","options":[["Book an appointment","capture_name",{"service_type":"Other"}],["Services","services",{}],["Pricing","pricing",{}],["Opening hours","hours",{}],["Talk to staff","capture_name",{}]]},{"key":"services","type":"choice","content":"Which service are you interested in?","options":[["Hair","service_answer",{"service_type":"Haircut"}],["Facial","service_answer",{"service_type":"Facial"}],["Bridal / Event","service_answer",{"service_type":"Bridal / Event Package"}],["Nail services","service_answer",{"service_type":"Manicure / Pedicure"}],["Back","welcome",{}]]},{"key":"service_answer","type":"answer","content":"Configure this service information in Chatbot Settings.","next":"capture_name"},{"key":"pricing","type":"answer","content":"Configure your pricing information in Chatbot Settings.","next":"welcome"},{"key":"hours","type":"answer","content":"Configure your opening hours in Chatbot Settings.","next":"welcome"},{"key":"capture_name","type":"capture","content":"What is your name?","capture_key":"first_name","capture_type":"name","next":"capture_phone"},{"key":"capture_phone","type":"capture","content":"What is your phone number?","capture_key":"phone","capture_type":"phone","next":"capture_email"},{"key":"capture_email","type":"capture","content":"What is your email? (optional)","capture_key":"email","capture_type":"email","next":"lead_confirmation"},{"key":"lead_confirmation","type":"end","content":"Thanks. Our team will contact you shortly."}]}'::jsonb),
('interior_design', '{"root":"welcome","nodes":[{"key":"welcome","type":"choice","content":"How can we help?","options":[["Start a project","capture_name",{"project_type":"Other"}],["Services","services",{}],["Portfolio information","portfolio",{}],["Pricing / budget","pricing",{}],["Book consultation","capture_name",{"project_type":"Other"}],["Talk to designer","capture_name",{}]]},{"key":"services","type":"answer","content":"Configure your service information in Chatbot Settings.","next":"capture_name"},{"key":"portfolio","type":"answer","content":"Configure portfolio information in Chatbot Settings.","next":"welcome"},{"key":"pricing","type":"answer","content":"Configure pricing and budget information in Chatbot Settings.","next":"welcome"},{"key":"capture_name","type":"capture","content":"What is your name?","capture_key":"first_name","capture_type":"name","next":"capture_phone"},{"key":"capture_phone","type":"capture","content":"What is your phone number?","capture_key":"phone","capture_type":"phone","next":"capture_email"},{"key":"capture_email","type":"capture","content":"What is your email? (optional)","capture_key":"email","capture_type":"email","next":"lead_confirmation"},{"key":"lead_confirmation","type":"end","content":"Thanks. Our team will contact you shortly."}]}'::jsonb),
('custom', '{"root":"welcome","nodes":[{"key":"welcome","type":"choice","content":"How can we help?","options":[["Our services","services",{}],["Pricing","pricing",{}],["Contact us","capture_name",{}],["Talk to staff","capture_name",{}]]},{"key":"services","type":"answer","content":"Configure your services information in Chatbot Settings.","next":"capture_name"},{"key":"pricing","type":"answer","content":"Configure your pricing information in Chatbot Settings.","next":"welcome"},{"key":"capture_name","type":"capture","content":"What is your name?","capture_key":"first_name","capture_type":"name","next":"capture_phone"},{"key":"capture_phone","type":"capture","content":"What is your phone number?","capture_key":"phone","capture_type":"phone","next":"capture_email"},{"key":"capture_email","type":"capture","content":"What is your email? (optional)","capture_key":"email","capture_type":"email","next":"lead_confirmation"},{"key":"lead_confirmation","type":"end","content":"Thanks. Our team will contact you shortly."}]}'::jsonb)
) as starter(key, flow) where industry_templates.key = starter.key;

create function private.provision_chatbot(p_tenant_id uuid, p_template_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cfg jsonb; new_config_id uuid; node_data jsonb; source_id uuid; destination_id uuid; option_data jsonb; root_key text; option_index integer;
begin
  select configuration->'chatbot' into cfg from public.industry_templates where id = coalesce(p_template_id, (select id from public.industry_templates where key='custom'));
  if cfg is null then return; end if;
  insert into public.chatbot_configs(tenant_id, name) values(p_tenant_id, 'Website assistant') on conflict (tenant_id) do nothing returning id into new_config_id;
  if new_config_id is null then return; end if;
  for node_data in select value from jsonb_array_elements(cfg->'nodes') loop
    insert into public.chatbot_nodes(tenant_id, chatbot_config_id, key, node_type, content, capture_key, capture_type)
    values(p_tenant_id, new_config_id, node_data->>'key', node_data->>'type', coalesce(node_data->>'content',''), node_data->>'capture_key', node_data->>'capture_type');
  end loop;
  for node_data in select value from jsonb_array_elements(cfg->'nodes') loop
    select id into source_id from public.chatbot_nodes where chatbot_config_id=new_config_id and key=node_data->>'key';
    if node_data ? 'next' then
      select id into destination_id from public.chatbot_nodes where chatbot_config_id=new_config_id and key=node_data->>'next';
      insert into public.chatbot_edges(tenant_id,chatbot_config_id,source_node_id,destination_node_id,label,is_default) values(p_tenant_id,new_config_id,source_id,destination_id,'',true);
    end if;
    if node_data ? 'options' then
      option_index := 0;
      for option_data in select value from jsonb_array_elements(node_data->'options') loop
        option_index := option_index + 1;
        select id into destination_id from public.chatbot_nodes where chatbot_config_id=new_config_id and key=option_data->>1;
        insert into public.chatbot_edges(tenant_id,chatbot_config_id,source_node_id,destination_node_id,label,display_order,set_context)
        values(p_tenant_id,new_config_id,source_id,destination_id,option_data->>0,option_index * 10,coalesce(option_data->2,'{}'::jsonb));
      end loop;
    end if;
  end loop;
  root_key := cfg->>'root';
  update public.chatbot_configs set root_node_id=(select id from public.chatbot_nodes where chatbot_config_id=new_config_id and key=root_key) where id=new_config_id;
end;
$$;
create function private.provision_chatbot_trigger() returns trigger language plpgsql security definer set search_path = '' as $$ begin perform private.provision_chatbot(new.id,new.industry_template_id); return new; end; $$;
create trigger tenants_provision_chatbot after insert on public.tenants for each row execute function private.provision_chatbot_trigger();

alter table public.chatbot_configs enable row level security;
alter table public.chatbot_nodes enable row level security;
alter table public.chatbot_edges enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;
create policy chatbot_configs_read on public.chatbot_configs for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy chatbot_configs_admin_update on public.chatbot_configs for update to authenticated using (private.user_has_tenant_role(tenant_id,array['owner','admin'])) with check (private.user_has_tenant_role(tenant_id,array['owner','admin']));
create policy chatbot_nodes_read on public.chatbot_nodes for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy chatbot_nodes_admin_update on public.chatbot_nodes for update to authenticated using (private.user_has_tenant_role(tenant_id,array['owner','admin'])) with check (private.user_has_tenant_role(tenant_id,array['owner','admin']));
create policy chatbot_edges_read on public.chatbot_edges for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy chatbot_edges_admin_update on public.chatbot_edges for update to authenticated using (private.user_has_tenant_role(tenant_id,array['owner','admin'])) with check (private.user_has_tenant_role(tenant_id,array['owner','admin']));
create policy conversations_read on public.conversations for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
create policy messages_read on public.conversation_messages for select to authenticated using (tenant_id in (select private.user_tenant_ids()));
revoke all on public.chatbot_configs,public.chatbot_nodes,public.chatbot_edges,public.conversations,public.conversation_messages from anon,authenticated;
grant select on public.chatbot_configs,public.chatbot_nodes,public.chatbot_edges,public.conversations,public.conversation_messages to authenticated;
grant update(enabled,name,welcome_message,fallback_message,confirmation_message,status,branding,lead_capture_enabled) on public.chatbot_configs to authenticated;
grant update(content,capture_key,capture_type) on public.chatbot_nodes to authenticated;
grant update(label,display_order,set_context) on public.chatbot_edges to authenticated;
-- Provisioning writes trigger updated_at; perform all ALTER TABLE work before it.
select private.provision_chatbot(id, industry_template_id) from public.tenants;
create trigger chatbot_configs_audit after update on public.chatbot_configs for each row execute function private.audit_tenant_configuration();
create trigger chatbot_nodes_audit after update on public.chatbot_nodes for each row execute function private.audit_tenant_configuration();
create trigger chatbot_edges_audit after update on public.chatbot_edges for each row execute function private.audit_tenant_configuration();
revoke all on function private.provision_chatbot(uuid,uuid) from public,anon,authenticated;
revoke all on function private.provision_chatbot_trigger() from public,anon,authenticated;

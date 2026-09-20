begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('91000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-owner@example.test','',now(),'{}','{}',now(),now()),
('92000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-other@example.test','',now(),'{}','{}',now(),now()),
('93000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-viewer@example.test','',now(),'{}','{}',now(),now()),
('94000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','chat-admin@example.test','',now(),'{}','{}',now(),now());

set local role service_role;
insert into public.tenants(id,name,slug,timezone,currency,industry_template_id) values
('a1000000-0000-0000-0000-000000000001','Chat Dental','chat-dental','UTC','USD',(select id from public.industry_templates where key='dental')),
('a2000000-0000-0000-0000-000000000002','Chat Salon','chat-salon','UTC','USD',(select id from public.industry_templates where key='salon')),
('a3000000-0000-0000-0000-000000000003','Chat Interior','chat-interior','UTC','USD',(select id from public.industry_templates where key='interior_design')),
('a4000000-0000-0000-0000-000000000004','Chat Custom','chat-custom','UTC','USD',(select id from public.industry_templates where key='custom'));
insert into public.tenant_members(tenant_id,user_id,role) values
('a1000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','owner'),
('a2000000-0000-0000-0000-000000000002','92000000-0000-0000-0000-000000000002','owner'),
('a1000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000003','viewer'),
('a1000000-0000-0000-0000-000000000001','94000000-0000-0000-0000-000000000004','admin');

select is((select count(*) from public.chatbot_configs where tenant_id in ('a1000000-0000-0000-0000-000000000001','a2000000-0000-0000-0000-000000000002','a3000000-0000-0000-0000-000000000003','a4000000-0000-0000-0000-000000000004')),4::bigint,'All four templates provision a chatbot');
select is((select count(*) from public.chatbot_nodes n join public.chatbot_configs c on c.id=n.chatbot_config_id where c.tenant_id='a1000000-0000-0000-0000-000000000001' and n.key='treatments'),1::bigint,'Dental starter treatment node provisioned');
select is((select count(*) from public.chatbot_nodes n join public.chatbot_configs c on c.id=n.chatbot_config_id where c.tenant_id='a2000000-0000-0000-0000-000000000002' and n.key='services'),1::bigint,'Salon starter services node provisioned');
select is((select count(*) from public.chatbot_nodes n join public.chatbot_configs c on c.id=n.chatbot_config_id where c.tenant_id='a3000000-0000-0000-0000-000000000003' and n.key='portfolio'),1::bigint,'Interior starter portfolio node provisioned');
select is((select count(*) from public.chatbot_nodes n join public.chatbot_configs c on c.id=n.chatbot_config_id where c.tenant_id='a4000000-0000-0000-0000-000000000004' and n.key='services'),1::bigint,'Custom starter services node provisioned');
select ok((select root_node_id is not null and widget_id is not null from public.chatbot_configs where tenant_id='a1000000-0000-0000-0000-000000000001'),'Widget public ID and root node exist');
select is((select status from public.chatbot_configs where tenant_id='a1000000-0000-0000-0000-000000000001'),'draft','New chatbots remain private drafts');
select is((select count(*) from public.chatbot_edges e join public.chatbot_configs c on c.id=e.chatbot_config_id where c.tenant_id='a1000000-0000-0000-0000-000000000001' and e.label='Treatments'),1::bigint,'Nested navigation edge exists');
select is((select set_context->>'treatment_type' from public.chatbot_edges e join public.chatbot_configs c on c.id=e.chatbot_config_id where c.tenant_id='a1000000-0000-0000-0000-000000000001' and e.label='Dental Implants'),'Dental Implant','Starter edge captures dynamic lead data');
select throws_ok($$ insert into public.chatbot_edges(tenant_id,chatbot_config_id,source_node_id,destination_node_id,label) select 'a1000000-0000-0000-0000-000000000001',a.id,a.root_node_id,b.root_node_id,'Bad' from public.chatbot_configs a, public.chatbot_configs b where a.tenant_id='a1000000-0000-0000-0000-000000000001' and b.tenant_id='a2000000-0000-0000-0000-000000000002' $$,'23503',null,'Cross-tenant destination node rejected');
insert into public.conversations(tenant_id,chatbot_config_id,channel,session_identifier,current_node_id,context) select tenant_id,id,'website','99000000-0000-0000-0000-000000000009',root_node_id,'{"treatment_type":"Dental Implant"}' from public.chatbot_configs where tenant_id='a1000000-0000-0000-0000-000000000001';
select is((select context->>'treatment_type' from public.conversations where session_identifier='99000000-0000-0000-0000-000000000009'),'Dental Implant','Conversation state persists');
select throws_ok($$ update public.conversations set current_node_id=(select root_node_id from public.chatbot_configs where tenant_id='a2000000-0000-0000-0000-000000000002') where session_identifier='99000000-0000-0000-0000-000000000009' $$,'23503',null,'Conversation cannot point to another chatbot flow node');
insert into public.conversation_messages(tenant_id,conversation_id,sender_type,message_type,content) select tenant_id,id,'visitor','option','Dental Implants' from public.conversations where session_identifier='99000000-0000-0000-0000-000000000009';
select is((select count(*) from public.conversation_messages),1::bigint,'Conversation messages persist');
insert into public.contacts(id,tenant_id,first_name,phone) values ('a5000000-0000-0000-0000-000000000005','a1000000-0000-0000-0000-000000000001','Chat visitor','9999999999');
insert into public.leads(id,tenant_id,contact_id,lead_data) values ('a6000000-0000-0000-0000-000000000006','a1000000-0000-0000-0000-000000000001','a5000000-0000-0000-0000-000000000005','{"treatment_type":"Dental Implant"}');
update public.conversations set contact_id='a5000000-0000-0000-0000-000000000005',lead_id='a6000000-0000-0000-0000-000000000006' where session_identifier='99000000-0000-0000-0000-000000000009';
select is((select contact_id from public.conversations where session_identifier='99000000-0000-0000-0000-000000000009'),'a5000000-0000-0000-0000-000000000005'::uuid,'Conversation can associate a standard contact');
select is((select lead_id from public.conversations where session_identifier='99000000-0000-0000-0000-000000000009'),'a6000000-0000-0000-0000-000000000006'::uuid,'Conversation can associate a standard lead');
select is((select lead_data->>'treatment_type' from public.leads where id='a6000000-0000-0000-0000-000000000006'),'Dental Implant','Chatbot lead preserves dynamic lead_data');

set local role authenticated;
select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"91000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.chatbot_configs),1::bigint,'Tenant A cannot enumerate Tenant B chatbot configuration');
select is((select count(*) from public.conversations),1::bigint,'Tenant A can read its conversations');
select is((select count(*) from public.chatbot_nodes where tenant_id='a2000000-0000-0000-0000-000000000002'),0::bigint,'Tenant A cannot read Tenant B flow nodes');
select results_eq($$ update public.chatbot_configs set name='Compromised' where tenant_id='a2000000-0000-0000-0000-000000000002' returning id $$,$$ select id from public.chatbot_configs where false $$,'Tenant A cannot update Tenant B chatbot');
select lives_ok($$ update public.chatbot_configs set status='published' where tenant_id='a1000000-0000-0000-0000-000000000001' $$,'Owner can publish chatbot');
select ok((select count(*) > 0 from public.audit_logs where tenant_id='a1000000-0000-0000-0000-000000000001' and entity_type='chatbot_configs'),'Chatbot publishing is audited');
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"93000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
update public.chatbot_configs set enabled=false where tenant_id='a1000000-0000-0000-0000-000000000001';
select ok((select enabled from public.chatbot_configs where tenant_id='a1000000-0000-0000-0000-000000000001'),'Viewer cannot disable chatbot');
select is((select count(*) from public.conversations),1::bigint,'Viewer retains read-only conversation access');
select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"94000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select lives_ok($$ update public.chatbot_nodes set content='Updated by admin' where tenant_id='a1000000-0000-0000-0000-000000000001' and key='pricing' $$,'Admin can update own flow');
select lives_ok($$ update public.chatbot_edges set label='Treatments and care' where tenant_id='a1000000-0000-0000-0000-000000000001' and label='Treatments' $$,'Admin can update own option');
select is((select count(*) from public.audit_logs where tenant_id='a1000000-0000-0000-0000-000000000001' and entity_type in ('chatbot_nodes','chatbot_edges')),2::bigint,'Flow updates are audited');
reset role;
select * from finish();
rollback;

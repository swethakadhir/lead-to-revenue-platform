begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

set local role service_role;

insert into public.tenants(id, name, slug, timezone, currency, industry_template_id)
values ('b1000000-0000-0000-0000-000000000001', 'Capture Test Tenant', 'capture-test-tenant', 'UTC', 'USD', (select id from public.industry_templates where key = 'custom'));

insert into public.conversations(id, tenant_id, chatbot_config_id, channel, session_identifier, current_node_id, context)
select 'b3000000-0000-0000-0000-000000000001', tenant_id, id, 'website', 'b2000000-0000-0000-0000-000000000001', root_node_id, '{"first_name":"Avery","phone":"+15550000001"}'::jsonb
from public.chatbot_configs where tenant_id = 'b1000000-0000-0000-0000-000000000001';

select is((select created from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0)), true, 'First capture creates the logical lead');
select is((select count(*) from public.leads where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 1::bigint, 'First capture creates one lead');
select is((select count(*) from public.contacts where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 1::bigint, 'First capture creates one contact');
select ok((select lead_id is not null and contact_id is not null from public.conversations where id = 'b3000000-0000-0000-0000-000000000001'), 'Conversation is linked to the created contact and lead');

update public.lead_journeys set conversation_id = null where lead_id = (select lead_id from public.conversations where id = 'b3000000-0000-0000-0000-000000000001');
select is((select created from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0)), false, 'Retry returns the existing capture result');
select is((select lead_id from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0)), (select lead_id from public.conversations where id = 'b3000000-0000-0000-0000-000000000001'), 'Retry returns the linked lead for engine reuse');
select is((select count(*) from public.leads where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 1::bigint, 'Retry creates no additional lead');
select is((select count(*) from public.contacts where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 1::bigint, 'Retry creates no additional contact');
select ok((select journey.conversation_id = conversation.id from public.lead_journeys journey join public.conversations conversation on conversation.lead_id = journey.lead_id where conversation.id = 'b3000000-0000-0000-0000-000000000001'), 'Lead journey is associated with the capture conversation');

insert into public.conversations(id, tenant_id, chatbot_config_id, channel, session_identifier, current_node_id, context)
select 'b3000000-0000-0000-0000-000000000002', tenant_id, id, 'website', 'b2000000-0000-0000-0000-000000000002', root_node_id, '{"first_name":"Avery","phone":"+15550000001"}'::jsonb
from public.chatbot_configs where tenant_id = 'b1000000-0000-0000-0000-000000000001';

select is((select created from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000002', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0)), true, 'A separate conversation creates a separate enquiry');
select is((select count(*) from public.contacts where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 1::bigint, 'Separate conversation preserves tenant-scoped contact reuse');
select is((select count(*) from public.leads where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 2::bigint, 'Separate conversation may create another lead for the same contact');

select throws_ok($$ select * from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000002', 'b3000000-0000-0000-0000-000000000001', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0) $$, 'P0002', 'Chatbot conversation not found for tenant.', 'Tenant mismatch fails safely');
select is((select count(*) from public.leads where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 2::bigint, 'Tenant mismatch creates no writes');
select throws_ok($$ select * from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000099', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0) $$, 'P0002', 'Chatbot conversation not found for tenant.', 'Missing conversation fails safely');
select is((select count(*) from public.leads where tenant_id = 'b1000000-0000-0000-0000-000000000001'), 2::bigint, 'Missing conversation creates no writes');

set local role authenticated;
select throws_ok($$ select * from public.create_chatbot_capture_lead('b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'Avery', '+15550000001', null, '{}'::jsonb, 'qualifying', 'pending', 0) $$, '42501', null, 'Authenticated users cannot execute the server-only capture RPC');

select * from finish();
rollback;

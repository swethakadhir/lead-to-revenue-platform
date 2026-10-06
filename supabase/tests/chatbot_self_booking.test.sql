begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

set local role postgres;
insert into public.tenants(id, name, slug, timezone, currency, industry_template_id) values
  ('b1000000-0000-0000-0000-000000000001', 'Booking A', 'booking-a', 'UTC', 'USD', (select id from public.industry_templates where key='custom')),
  ('b2000000-0000-0000-0000-000000000002', 'Booking B', 'booking-b', 'UTC', 'USD', (select id from public.industry_templates where key='custom'));
update public.tenant_settings set business_hours = '{"weekly":{"mon":{"enabled":true,"start":"09:00","end":"11:00"}},"slot_duration_minutes":30,"slot_interval_minutes":30,"custom_flag":"keep"}'::jsonb where tenant_id = 'b1000000-0000-0000-0000-000000000001';
insert into public.contacts(id, tenant_id, first_name, phone) values
  ('b3000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'Booking Contact', '9000000001');
insert into public.leads(id, tenant_id, contact_id, status, qualification_status) values
  ('b4000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000003', 'booking_ready', 'qualified');
insert into public.conversations(id, tenant_id, channel, session_identifier, contact_id, lead_id, context) values
  ('b5000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'website', 'b6000000-0000-0000-0000-000000000006', 'b3000000-0000-0000-0000-000000000003', 'b4000000-0000-0000-0000-000000000004', '{"keep":"yes","_journey":{"booking_intent":true}}');
update public.lead_journeys set conversation_id = 'b5000000-0000-0000-0000-000000000005' where tenant_id = 'b1000000-0000-0000-0000-000000000001' and lead_id = 'b4000000-0000-0000-0000-000000000004';

select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-000000000005','2026-10-12 09:00:00+00','2026-10-12 09:30:00+00')),'booked','Booking-ready conversation creates a scheduled appointment');
select is((select count(*) from public.appointments where tenant_id='b1000000-0000-0000-0000-000000000001'),1::bigint,'One appointment is created');
select is((select status from public.appointments where tenant_id='b1000000-0000-0000-0000-000000000001'),'scheduled','Self-booking does not confirm or convert');
select is((select status from public.leads where id='b4000000-0000-0000-0000-000000000004'),'booking_ready','Scheduled appointment does not convert the lead');
select is((select appointment_type from public.appointments where tenant_id='b1000000-0000-0000-0000-000000000001'),'Appointment','Appointment type comes from tenant configuration');
select is((select context->>'keep' from public.conversations where id='b5000000-0000-0000-0000-000000000005'),'yes','Existing conversation context is preserved');
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-000000000005','2026-10-12 09:00:00+00','2026-10-12 09:30:00+00')),'already_booked','Retry returns the existing booking');
select is((select count(*) from public.appointments where tenant_id='b1000000-0000-0000-0000-000000000001'),1::bigint,'Retry does not create a duplicate appointment');
select is((select business_hours->>'custom_flag' from public.tenant_settings where tenant_id='b1000000-0000-0000-0000-000000000001'),'keep','Existing tenant booking configuration remains intact');
select is((select result_code from public.create_chatbot_self_booking('b2000000-0000-0000-0000-000000000002','b5000000-0000-0000-0000-000000000005','2026-10-12 09:00:00+00','2026-10-12 09:30:00+00')),'invalid_request','Cross-tenant conversation is rejected');
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','b7000000-0000-0000-0000-000000000007','2026-10-12 09:00:00+00','2026-10-12 09:30:00+00')),'invalid_request','Missing conversation is rejected');
insert into public.contacts(id, tenant_id, first_name, phone) values ('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','Boundary Contact','9000000011');
insert into public.leads(id, tenant_id, contact_id, status, qualification_status) values ('c2000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','booking_ready','qualified');
insert into public.conversations(id, tenant_id, channel, session_identifier, contact_id, lead_id) values ('c3000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000001','website','c4000000-0000-0000-0000-000000000004','c1000000-0000-0000-0000-000000000001','c2000000-0000-0000-0000-000000000002');
update public.lead_journeys set conversation_id = 'c3000000-0000-0000-0000-000000000003' where tenant_id = 'b1000000-0000-0000-0000-000000000001' and lead_id = 'c2000000-0000-0000-0000-000000000002';
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','c3000000-0000-0000-0000-000000000003','2026-10-12 11:00:00+00','2026-10-12 11:30:00+00')),'slot_unavailable','Configured closing boundary is enforced');
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','b5000000-0000-0000-0000-000000000005','2026-10-12 09:15:00+00','2026-10-12 09:45:00+00')),'already_booked','Idempotency is checked before slot validation');

insert into public.contacts(id, tenant_id, first_name, phone) values ('bc000000-0000-0000-0000-00000000000c','b1000000-0000-0000-0000-000000000001','Overlap Contact','9000000012');
insert into public.leads(id, tenant_id, contact_id, status, qualification_status) values ('bd000000-0000-0000-0000-00000000000d','b1000000-0000-0000-0000-000000000001','bc000000-0000-0000-0000-00000000000c','booking_ready','qualified');
insert into public.conversations(id, tenant_id, channel, session_identifier, contact_id, lead_id) values ('be000000-0000-0000-0000-00000000000e','b1000000-0000-0000-0000-000000000001','website','bf000000-0000-0000-0000-00000000000f','bc000000-0000-0000-0000-00000000000c','bd000000-0000-0000-0000-00000000000d');
update public.lead_journeys set conversation_id = 'be000000-0000-0000-0000-00000000000e' where tenant_id = 'b1000000-0000-0000-0000-000000000001' and lead_id = 'bd000000-0000-0000-0000-00000000000d';
insert into public.appointments(id, tenant_id, lead_id, contact_id, title, appointment_type, starts_at, ends_at, timezone) values ('c0000000-0000-0000-0000-00000000000c','b1000000-0000-0000-0000-000000000001','bd000000-0000-0000-0000-00000000000d','bc000000-0000-0000-0000-00000000000c','Appointment','Appointment','2026-10-12 10:00:00+00','2026-10-12 10:30:00+00','UTC');
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-00000000000e','2026-10-12 10:00:00+00','2026-10-12 10:30:00+00')),'slot_unavailable','Scheduled overlap is rejected');
update public.appointments set status = 'cancelled' where id = 'c0000000-0000-0000-0000-00000000000c';
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-00000000000e','2026-10-12 10:00:00+00','2026-10-12 10:30:00+00')),'booked','Cancelled appointment does not block a slot');
select is((select count(*) from public.appointments where tenant_id='b1000000-0000-0000-0000-000000000001' and status='scheduled'),2::bigint,'Separate conversation creates a separate scheduled appointment');

insert into public.contacts(id, tenant_id, first_name, phone) values ('b8000000-0000-0000-0000-000000000008','b1000000-0000-0000-0000-000000000001','Not Ready','9000000008');
insert into public.leads(id, tenant_id, contact_id, status, qualification_status) values ('b9000000-0000-0000-0000-000000000009','b1000000-0000-0000-0000-000000000001','b8000000-0000-0000-0000-000000000008','qualifying','pending');
insert into public.conversations(id, tenant_id, channel, session_identifier, contact_id, lead_id) values ('ba000000-0000-0000-0000-00000000000a','b1000000-0000-0000-0000-000000000001','website','bb000000-0000-0000-0000-00000000000b','b8000000-0000-0000-0000-000000000008','b9000000-0000-0000-0000-000000000009');
select is((select result_code from public.create_chatbot_self_booking('b1000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-00000000000a','2026-10-12 09:00:00+00','2026-10-12 09:30:00+00')),'invalid_request','Non-booking-ready lead is rejected');

update public.appointments set status = 'confirmed' where tenant_id = 'b1000000-0000-0000-0000-000000000001';
select is((select status from public.leads where id='b4000000-0000-0000-0000-000000000004'),'converted','Confirmed appointment remains the conversion trigger');

reset role;
select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('71000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','journey-owner@example.test','',now(),'{}','{}',now(),now()),
  ('72000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','journey-operator@example.test','',now(),'{}','{}',now(),now());
insert into public.tenants(id,name,slug,timezone,currency) values ('7a000000-0000-0000-0000-000000000001','Journey Tenant','journey-tenant','UTC','USD');
insert into public.tenant_members(tenant_id,user_id,role) values ('7a000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','owner');
insert into public.platform_operators(user_id) values ('72000000-0000-0000-0000-000000000002');
insert into public.contacts(id,tenant_id,first_name,phone) values ('7c000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','Journey Contact','9999999999');
insert into public.leads(id,tenant_id,contact_id,status,qualification_status) values ('7d000000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','7c000000-0000-0000-0000-000000000001','qualifying','pending');
select is((select stage from public.lead_journeys where lead_id = '7d000000-0000-0000-0000-000000000001'),'qualification','Lead creates a durable qualification journey');
update public.leads set status = 'booking_ready', qualification_status = 'qualified' where id = '7d000000-0000-0000-0000-000000000001';
select is((select stage from public.lead_journeys where lead_id = '7d000000-0000-0000-0000-000000000001'),'booking_ready','Qualified lead can become booking-ready without conversion');
select isnt((select stage from public.lead_journeys where lead_id = '7d000000-0000-0000-0000-000000000001'),'converted','Booking readiness is not conversion');
insert into public.human_interventions(tenant_id,lead_id,reason) values ('7a000000-0000-0000-0000-000000000001','7d000000-0000-0000-0000-000000000001','Need internal review');
select ok((select blocked_by_human_intervention from public.lead_journeys where lead_id = '7d000000-0000-0000-0000-000000000001'),'Open intervention blocks but preserves journey');
update public.human_interventions set status = 'resolved' where lead_id = '7d000000-0000-0000-0000-000000000001';
select ok(not (select blocked_by_human_intervention from public.lead_journeys where lead_id = '7d000000-0000-0000-0000-000000000001'),'Resolved intervention unblocks journey');
insert into public.action_jobs(tenant_id,lead_id,job_type,due_at,idempotency_key) values ('7a000000-0000-0000-0000-000000000001','7d000000-0000-0000-0000-000000000001','lead_follow_up',now() - interval '1 minute','journey-test-followup');
select throws_ok($$ insert into public.action_jobs(tenant_id,lead_id,job_type,idempotency_key) values ('7a000000-0000-0000-0000-000000000001','7d000000-0000-0000-0000-000000000001','lead_follow_up','journey-test-followup') $$,'23505',null,'Tenant idempotency key prevents duplicate jobs');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select is((select count(*) from public.action_jobs),0::bigint,'Tenant client cannot read internal action jobs');
select set_config('request.jwt.claim.sub','72000000-0000-0000-0000-000000000002',true);
select is((select status from public.claim_due_action_jobs(1) where id = (select id from public.action_jobs where idempotency_key = 'journey-test-followup')),'processing','Operator claim atomically moves due job to processing');
select is((select status from public.complete_action_job((select id from public.action_jobs where idempotency_key = 'journey-test-followup'),false,'temporary','retry later')),'pending','Retryable completion returns job to pending');
select ok((select next_retry_at is not null and attempt_count = 1 from public.action_jobs where idempotency_key = 'journey-test-followup'),'Retry records attempt and recovery time');
reset role;
select * from finish();
rollback;

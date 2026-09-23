begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users(id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('81000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','orchestration-owner@example.test','',now(),'{}','{}',now(),now());
insert into public.tenants(id,name,slug,timezone,currency) values ('8a000000-0000-0000-0000-000000000001','Orchestration Tenant','orchestration-tenant','UTC','USD');
insert into public.tenant_members(tenant_id,user_id,role) values ('8a000000-0000-0000-0000-000000000001','81000000-0000-0000-0000-000000000001','owner');
insert into public.contacts(id,tenant_id,first_name,phone) values ('8c000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','Orchestration Contact','9999999999');
insert into public.leads(id,tenant_id,contact_id,status,qualification_status) values ('8d000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000001','qualifying','pending');

insert into public.followups(id,tenant_id,lead_id,contact_id,type,due_at,automation_key) values ('8f000000-0000-0000-0000-000000000001','8a000000-0000-0000-0000-000000000001','8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000001','call',now() + interval '1 day','journey:8d000000-0000-0000-0000-000000000001:inactivity:1');
select is((select job_type from public.action_jobs where idempotency_key = 'lead:8d000000-0000-0000-0000-000000000001:followup:8f000000-0000-0000-0000-000000000001'),'lead_follow_up','Automated follow-up uses the existing single trigger path to create its job');
update public.followups set status = 'cancelled' where id = '8f000000-0000-0000-0000-000000000001';
select is((select status from public.action_jobs where idempotency_key = 'lead:8d000000-0000-0000-0000-000000000001:followup:8f000000-0000-0000-0000-000000000001'),'cancelled','Cancelling an automated follow-up cancels its unclaimed action job');
select throws_ok($$ insert into public.followups(tenant_id,lead_id,contact_id,type,due_at,automation_key) values ('8a000000-0000-0000-0000-000000000001','8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000001','call',now(),'journey:8d000000-0000-0000-0000-000000000001:inactivity:1') $$,'23505',null,'Tenant automation key prevents duplicate follow-up creation');
insert into public.followups(tenant_id,lead_id,contact_id,type,due_at) values ('8a000000-0000-0000-0000-000000000001','8d000000-0000-0000-0000-000000000001','8c000000-0000-0000-0000-000000000001','call',now());
select is((select count(*) from public.followups where tenant_id = '8a000000-0000-0000-0000-000000000001' and automation_key is null),1::bigint,'Manual follow-ups remain independent of automated idempotency');
select is((select count(*) from public.journey_events where tenant_id = '8a000000-0000-0000-0000-000000000001' and event_type = 'follow_up_cancelled'),1::bigint,'Cancellation is retained in concise journey audit history');

select * from finish();
rollback;

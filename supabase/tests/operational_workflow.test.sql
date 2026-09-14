begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('42000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('43000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('44000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'front-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('45000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('46000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.tenants (id, name, slug, timezone, currency) values
  ('da000000-0000-0000-0000-000000000001', 'Operations Tenant A', 'operations-tenant-a', 'UTC', 'USD'),
  ('db000000-0000-0000-0000-000000000002', 'Operations Tenant B', 'operations-tenant-b', 'UTC', 'USD');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('da000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 'owner'),
  ('da000000-0000-0000-0000-000000000001', '42000000-0000-0000-0000-000000000002', 'admin'),
  ('da000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000003', 'sales'),
  ('da000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000004', 'front_desk'),
  ('da000000-0000-0000-0000-000000000001', '45000000-0000-0000-0000-000000000005', 'viewer'),
  ('db000000-0000-0000-0000-000000000002', '46000000-0000-0000-0000-000000000006', 'owner');

insert into public.contacts (id, tenant_id, first_name, email) values
  ('d1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'Contact A', 'operations-a@example.test'),
  ('d2000000-0000-0000-0000-000000000002', 'db000000-0000-0000-0000-000000000002', 'Contact B', 'operations-b@example.test');
insert into public.leads (id, tenant_id, contact_id) values
  ('e1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000002', 'db000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002');
insert into public.opportunities (id, tenant_id, lead_id, contact_id, name, stage_key, currency) values
  ('f1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Opportunity A', 'new', 'USD'),
  ('f2000000-0000-0000-0000-000000000002', 'db000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'Opportunity B', 'new', 'USD');

insert into public.appointments (id, tenant_id, lead_id, opportunity_id, contact_id, title, starts_at, ends_at, timezone) values
  ('a1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Appointment A', now() + interval '1 day', now() + interval '2 days', 'UTC'),
  ('a2000000-0000-0000-0000-000000000002', 'db000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'Appointment B', now() + interval '1 day', now() + interval '2 days', 'UTC');
insert into public.followups (id, tenant_id, lead_id, opportunity_id, contact_id, type, due_at) values
  ('b1000000-0000-0000-0000-000000000001', 'da000000-0000-0000-0000-000000000001', 'e1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'call', now() + interval '1 day'),
  ('b2000000-0000-0000-0000-000000000002', 'db000000-0000-0000-0000-000000000002', 'e2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', 'd2000000-0000-0000-0000-000000000002', 'email', now() + interval '1 day');

set local role authenticated;
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"43000000-0000-0000-0000-000000000003","role":"authenticated"}', true);

select results_eq($$ select id from public.appointments order by id $$, $$ values ('a1000000-0000-0000-0000-000000000001'::uuid) $$, 'Tenant A cannot read Tenant B appointments');
select results_eq($$ select id from public.followups order by id $$, $$ values ('b1000000-0000-0000-0000-000000000001'::uuid) $$, 'Tenant A cannot read Tenant B follow-ups');
select throws_ok($$ insert into public.appointments (tenant_id, contact_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'Invalid', now(), now() + interval '1 hour', 'UTC') $$, '23503', null, 'Cross-tenant appointment contact is rejected');
select throws_ok($$ insert into public.appointments (tenant_id, contact_id, lead_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'Invalid', now(), now() + interval '1 hour', 'UTC') $$, '23503', null, 'Cross-tenant appointment lead is rejected');
select throws_ok($$ insert into public.appointments (tenant_id, contact_id, opportunity_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'Invalid', now(), now() + interval '1 hour', 'UTC') $$, '23503', null, 'Cross-tenant appointment opportunity is rejected');
select throws_ok($$ update public.appointments set assigned_user_id = '46000000-0000-0000-0000-000000000006' where id = 'a1000000-0000-0000-0000-000000000001' $$, '23503', 'Assigned user must be an active member of the tenant', 'Cross-tenant appointment assignee is rejected');
select lives_ok($$ insert into public.appointments (tenant_id, contact_id, assigned_user_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000003', 'Valid', now(), now() + interval '1 hour', 'UTC') $$, 'Valid appointment creation works');
select throws_ok($$ insert into public.appointments (tenant_id, contact_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Invalid time', now(), now() - interval '1 hour', 'UTC') $$, '23514', null, 'Appointment end before start is rejected');
update public.appointments set status = 'completed' where id = 'a1000000-0000-0000-0000-000000000001';
select ok((select completed_at is not null and cancelled_at is null from public.appointments where id = 'a1000000-0000-0000-0000-000000000001'), 'Completed appointment sets completed_at');
update public.appointments set status = 'confirmed' where id = 'a1000000-0000-0000-0000-000000000001';
select ok((select completed_at is null and cancelled_at is null from public.appointments where id = 'a1000000-0000-0000-0000-000000000001'), 'Moving out of completed clears outcome timestamps');
update public.appointments set status = 'cancelled', cancellation_reason = 'Client request' where id = 'a1000000-0000-0000-0000-000000000001';
select ok((select cancelled_at is not null and completed_at is null from public.appointments where id = 'a1000000-0000-0000-0000-000000000001'), 'Cancelled appointment sets cancelled_at');

select throws_ok($$ insert into public.followups (tenant_id, contact_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-000000000002', 'call', now()) $$, '23503', null, 'Cross-tenant follow-up contact is rejected');
select throws_ok($$ insert into public.followups (tenant_id, contact_id, lead_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'e2000000-0000-0000-0000-000000000002', 'call', now()) $$, '23503', null, 'Cross-tenant follow-up lead is rejected');
select throws_ok($$ insert into public.followups (tenant_id, contact_id, opportunity_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-000000000002', 'call', now()) $$, '23503', null, 'Cross-tenant follow-up opportunity is rejected');
select throws_ok($$ update public.followups set assigned_user_id = '46000000-0000-0000-0000-000000000006' where id = 'b1000000-0000-0000-0000-000000000001' $$, '23503', 'Assigned user must be an active member of the tenant', 'Cross-tenant follow-up assignee is rejected');
select lives_ok($$ insert into public.followups (tenant_id, contact_id, assigned_user_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', '43000000-0000-0000-0000-000000000003', 'call', now()) $$, 'Valid follow-up creation works');
update public.followups set status = 'completed', outcome = 'Reached client' where id = 'b1000000-0000-0000-0000-000000000001';
select ok((select completed_at is not null from public.followups where id = 'b1000000-0000-0000-0000-000000000001'), 'Completed follow-up sets completed_at');
update public.followups set status = 'pending' where id = 'b1000000-0000-0000-0000-000000000001';
select ok((select completed_at is null from public.followups where id = 'b1000000-0000-0000-0000-000000000001'), 'Moving away from completed clears completed_at');

select set_config('request.jwt.claim.sub', '45000000-0000-0000-0000-000000000005', true);
select throws_ok($$ insert into public.appointments (tenant_id, contact_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Viewer write', now(), now() + interval '1 hour', 'UTC') $$, '42501', null, 'Viewer cannot mutate appointments');
select throws_ok($$ insert into public.followups (tenant_id, contact_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'call', now()) $$, '42501', null, 'Viewer cannot mutate follow-ups');

select set_config('request.jwt.claim.sub', '41000000-0000-0000-0000-000000000001', true);
select lives_ok($$ insert into public.followups (tenant_id, contact_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'general', now()) $$, 'Owner permissions work');
select set_config('request.jwt.claim.sub', '42000000-0000-0000-0000-000000000002', true);
select lives_ok($$ insert into public.appointments (tenant_id, contact_id, title, starts_at, ends_at, timezone) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Admin appointment', now(), now() + interval '1 hour', 'UTC') $$, 'Admin permissions work');
select set_config('request.jwt.claim.sub', '43000000-0000-0000-0000-000000000003', true);
select lives_ok($$ update public.appointments set title = 'Sales update' where id = 'a1000000-0000-0000-0000-000000000001' $$, 'Sales permissions work');
select set_config('request.jwt.claim.sub', '44000000-0000-0000-0000-000000000004', true);
select lives_ok($$ insert into public.followups (tenant_id, contact_id, type, due_at) values ('da000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'meeting', now()) $$, 'Front desk permissions work');

reset role;
select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('31000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('32000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales-b@example.test', '', now(), '{}', '{}', now(), now()),
  ('33000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'outsider@example.test', '', now(), '{}', '{}', now(), now());

insert into public.tenants (id, name, slug, timezone, currency) values
  ('ca000000-0000-0000-0000-000000000001', 'Sales Tenant A', 'sales-tenant-a', 'UTC', 'USD'),
  ('cb000000-0000-0000-0000-000000000002', 'Sales Tenant B', 'sales-tenant-b', 'UTC', 'USD');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('ca000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'sales'),
  ('cb000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002', 'owner'),
  ('ca000000-0000-0000-0000-000000000001', '33000000-0000-0000-0000-000000000003', 'viewer');

insert into public.contacts (id, tenant_id, first_name, email) values
  ('c1000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Contact A', 'contact-a@example.test'),
  ('c2000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000002', 'Contact B', 'contact-b@example.test');

insert into public.leads (id, tenant_id, contact_id, assigned_user_id) values
  ('1a000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001'),
  ('1b000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', '32000000-0000-0000-0000-000000000002');

insert into public.opportunities (id, tenant_id, lead_id, contact_id, name, stage_key, currency) values
  ('0a000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Opportunity A', 'new', 'USD'),
  ('0b000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', 'Opportunity B', 'new', 'USD');

set local role authenticated;
select set_config('request.jwt.claim.sub', '31000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.contacts order by id $$,
  $$ values ('c1000000-0000-0000-0000-000000000001'::uuid) $$,
  'User A cannot read Tenant B contacts'
);

select results_eq(
  $$ select id from public.leads order by id $$,
  $$ values ('1a000000-0000-0000-0000-000000000001'::uuid) $$,
  'User A cannot read Tenant B leads'
);

select results_eq(
  $$ select id from public.opportunities order by id $$,
  $$ values ('0a000000-0000-0000-0000-000000000001'::uuid) $$,
  'User A cannot read Tenant B opportunities'
);

select throws_ok(
  $$ insert into public.leads (tenant_id, contact_id) values ('ca000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000002') $$,
  '23503', null,
  'A cross-tenant contact cannot be attached to a lead'
);

select throws_ok(
  $$ insert into public.opportunities (tenant_id, lead_id, name, stage_key, currency) values ('ca000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000002', 'Invalid', 'new', 'USD') $$,
  '23503', null,
  'A cross-tenant lead cannot be attached to an opportunity'
);

select throws_ok(
  $$ update public.leads set assigned_user_id = '32000000-0000-0000-0000-000000000002' where id = '1a000000-0000-0000-0000-000000000001' $$,
  '23503', 'Assigned user must be an active member of the tenant',
  'An assignee must be an active member of the tenant'
);

select lives_ok(
  $$ select public.create_manual_lead('ca000000-0000-0000-0000-000000000001', 'Valid', 'Lead', 'valid@example.test', '', 'new', '31000000-0000-0000-0000-000000000001', '{"interest":"demo"}'::jsonb) $$,
  'Valid manual lead creation works'
);

select is(
  (select count(*) from public.leads where tenant_id = 'ca000000-0000-0000-0000-000000000001'),
  2::bigint,
  'Manual lead creation persists one lead'
);

select lives_ok(
  $$ insert into public.opportunities (tenant_id, lead_id, contact_id, name, stage_key, currency, assigned_user_id) values ('ca000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'Valid Opportunity', 'qualified', 'USD', '31000000-0000-0000-0000-000000000001') $$,
  'Valid opportunity creation works'
);

select lives_ok(
  $$ update public.opportunities set stage_key = 'proposal' where id = '0a000000-0000-0000-0000-000000000001' $$,
  'A valid stage change works'
);

update public.opportunities set stage_key = 'won' where id = '0a000000-0000-0000-0000-000000000001';
select ok(
  (select won_at is not null and lost_at is null from public.opportunities where id = '0a000000-0000-0000-0000-000000000001'),
  'Won stage sets only won_at'
);

select throws_ok(
  $$ update public.opportunities set stage_key = 'lost' where id = '0a000000-0000-0000-0000-000000000001' $$,
  '23514', 'A lost reason is required for a lost opportunity',
  'Lost stage requires a reason'
);

update public.opportunities set stage_key = 'lost', lost_reason = 'Budget changed' where id = '0a000000-0000-0000-0000-000000000001';
select ok(
  (select lost_at is not null and won_at is null and lost_reason = 'Budget changed' from public.opportunities where id = '0a000000-0000-0000-0000-000000000001'),
  'Lost stage sets lost_at, clears won_at, and keeps its reason'
);

update public.opportunities set name = 'Compromised' where id = '0b000000-0000-0000-0000-000000000002';
select is(
  (select count(*) from public.opportunities where id = '0b000000-0000-0000-0000-000000000002'),
  0::bigint,
  'User A cannot update or observe Tenant B opportunities'
);

select set_config('request.jwt.claim.sub', '33000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"33000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.leads (tenant_id, contact_id) values ('ca000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'Viewer membership is read-only for sales data'
);

reset role;
select * from finish();
rollback;

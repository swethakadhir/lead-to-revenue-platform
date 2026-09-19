begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dashboard-b@example.test', '', now(), '{}', '{}', now(), now());
insert into public.tenants (id, name, slug, timezone, currency) values
  ('71000000-0000-0000-0000-000000000010', 'Dashboard Clinic A', 'dashboard-clinic-a', 'Asia/Kolkata', 'INR'),
  ('72000000-0000-0000-0000-000000000020', 'Dashboard Clinic B', 'dashboard-clinic-b', 'UTC', 'USD');
insert into public.tenant_members (tenant_id, user_id, role) values
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000001', 'owner'),
  ('72000000-0000-0000-0000-000000000020', '72000000-0000-0000-0000-000000000002', 'owner');
insert into public.contacts (id, tenant_id, first_name, email) values
  ('71000000-0000-0000-0000-000000000101', '71000000-0000-0000-0000-000000000010', 'Rahul', 'rahul.dashboard@example.test'),
  ('72000000-0000-0000-0000-000000000201', '72000000-0000-0000-0000-000000000020', 'Other', 'other.dashboard@example.test');
insert into public.leads (id, tenant_id, contact_id, status, qualification_status) values
  ('71000000-0000-0000-0000-000000000111', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000101', 'new', 'unqualified'),
  ('71000000-0000-0000-0000-000000000112', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000101', 'new', 'pending'),
  ('71000000-0000-0000-0000-000000000113', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000101', 'qualified', 'qualified'),
  ('72000000-0000-0000-0000-000000000211', '72000000-0000-0000-0000-000000000020', '72000000-0000-0000-0000-000000000201', 'new', 'unqualified');
insert into public.opportunities (id, tenant_id, lead_id, contact_id, name, stage_key, estimated_value, currency) values
  ('71000000-0000-0000-0000-000000000121', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000111', '71000000-0000-0000-0000-000000000101', 'Implant', 'new', 50000, 'INR'),
  ('71000000-0000-0000-0000-000000000122', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000112', '71000000-0000-0000-0000-000000000101', 'Crown', 'qualified', 25000, 'INR'),
  ('71000000-0000-0000-0000-000000000123', '71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000113', '71000000-0000-0000-0000-000000000101', 'Completed sale', 'won', 80000, 'INR'),
  ('72000000-0000-0000-0000-000000000221', '72000000-0000-0000-0000-000000000020', '72000000-0000-0000-0000-000000000211', '72000000-0000-0000-0000-000000000201', 'Other sale', 'new', 1000000, 'USD');
insert into public.appointments (tenant_id, lead_id, contact_id, title, status, starts_at, ends_at, timezone) values
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000111', '71000000-0000-0000-0000-000000000101', 'Today', 'scheduled', now(), now() + interval '1 hour', 'Asia/Kolkata'),
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000112', '71000000-0000-0000-0000-000000000101', 'Tomorrow', 'confirmed', now() + interval '1 day', now() + interval '1 day 1 hour', 'Asia/Kolkata'),
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000113', '71000000-0000-0000-0000-000000000101', 'Cancelled', 'cancelled', now() + interval '2 days', now() + interval '2 days 1 hour', 'Asia/Kolkata'),
  ('72000000-0000-0000-0000-000000000020', '72000000-0000-0000-0000-000000000211', '72000000-0000-0000-0000-000000000201', 'Other tenant', 'scheduled', now(), now() + interval '1 hour', 'UTC');
insert into public.followups (tenant_id, lead_id, contact_id, type, status, due_at) values
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000111', '71000000-0000-0000-0000-000000000101', 'call', 'pending', now() - interval '1 day'),
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000112', '71000000-0000-0000-0000-000000000101', 'email', 'pending', now()),
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000113', '71000000-0000-0000-0000-000000000101', 'meeting', 'pending', now() + interval '1 day'),
  ('71000000-0000-0000-0000-000000000010', '71000000-0000-0000-0000-000000000111', '71000000-0000-0000-0000-000000000101', 'general', 'completed', now() - interval '1 day'),
  ('72000000-0000-0000-0000-000000000020', '72000000-0000-0000-0000-000000000211', '72000000-0000-0000-0000-000000000201', 'call', 'pending', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is((select count(*) from public.leads where tenant_id = '71000000-0000-0000-0000-000000000010' and status = 'new'), 2::bigint, 'New Leads is 2');
select is((select count(*) from public.leads where tenant_id = '71000000-0000-0000-0000-000000000010' and qualification_status = 'qualified'), 1::bigint, 'Qualified Leads is 1');
select is((select count(*) from public.appointments where tenant_id = '71000000-0000-0000-0000-000000000010' and status in ('scheduled', 'confirmed') and starts_at >= now()), 2::bigint, 'Upcoming active Appointments is 2');
select is((select count(*) from public.opportunities o join public.pipeline_definitions p on p.tenant_id = o.tenant_id and p.key = o.stage_key where o.tenant_id = '71000000-0000-0000-0000-000000000010' and p.is_active and p.stage_type = 'open'), 2::bigint, 'Open Opportunities is 2');
select is((select count(*) from public.opportunities o join public.pipeline_definitions p on p.tenant_id = o.tenant_id and p.key = o.stage_key where o.tenant_id = '71000000-0000-0000-0000-000000000010' and p.is_active and p.stage_type = 'won'), 1::bigint, 'Won is 1');
select is((select sum(o.estimated_value) from public.opportunities o join public.pipeline_definitions p on p.tenant_id = o.tenant_id and p.key = o.stage_key where o.tenant_id = '71000000-0000-0000-0000-000000000010' and p.is_active and p.stage_type = 'open' and o.currency = 'INR'), 75000::numeric, 'INR Pipeline Value is 75000');
select is((select count(*) from public.appointments where tenant_id = '71000000-0000-0000-0000-000000000010' and status in ('scheduled', 'confirmed') and starts_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' and starts_at < (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata'), 1::bigint, 'Appointments today is 1 in tenant timezone');
select is((select count(*) from public.followups where tenant_id = '71000000-0000-0000-0000-000000000010' and status = 'pending' and due_at < now()), 1::bigint, 'Overdue follow-ups is 1');
select is((select count(*) from public.followups where tenant_id = '71000000-0000-0000-0000-000000000010' and status = 'pending' and due_at >= now() and due_at < (date_trunc('day', now() at time zone 'Asia/Kolkata') + interval '1 day') at time zone 'Asia/Kolkata'), 1::bigint, 'Follow-ups due today is 1 and excludes overdue');
select is((select count(*) from public.appointments where tenant_id = '71000000-0000-0000-0000-000000000010' and status in ('scheduled', 'confirmed') and starts_at >= now()), 2::bigint, 'Upcoming appointments list has 2 records');
select is((select count(*) from public.leads where tenant_id = '71000000-0000-0000-0000-000000000010'), 3::bigint, 'Recent leads source has 3 records');
select is((select currency from public.tenants where id = '71000000-0000-0000-0000-000000000010'), 'INR', 'Tenant A currency is INR');
select is((select timezone from public.tenants where id = '71000000-0000-0000-0000-000000000010'), 'Asia/Kolkata', 'Tenant A timezone retains IANA casing');
select is((select count(*) from public.leads), 3::bigint, 'Tenant A cannot see Tenant B leads');
select is((select count(*) from public.followups), 4::bigint, 'Tenant A cannot see Tenant B follow-ups');

reset role;
select * from finish();
rollback;

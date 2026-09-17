begin;

create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'timezone-a@example.test', '', now(), '{}', '{}', now(), now()),
  ('72000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'timezone-b@example.test', '', now(), '{}', '{}', now(), now());

set local role service_role;

select is(
  (select timezone from public.create_tenant_with_owner('71000000-0000-0000-0000-000000000001', 'Timezone Clinic A', 'timezone-clinic-a', 'Asia/Kolkata', 'INR')),
  'Asia/Kolkata',
  'Asia/Kolkata remains exactly cased through tenant creation'
);
select is((select count(*) from public.tenant_members where user_id = '71000000-0000-0000-0000-000000000001' and role = 'owner'), 1::bigint, 'Asia/Kolkata tenant creates owner membership');
select is((select count(*) from public.pipeline_definitions where tenant_id = (select id from public.tenants where slug = 'timezone-clinic-a')), 11::bigint, 'Asia/Kolkata tenant creates default pipeline');

select is(
  (select timezone from public.create_tenant_with_owner('72000000-0000-0000-0000-000000000002', 'Timezone Clinic B', 'timezone-clinic-b', 'America/New_York', 'USD')),
  'America/New_York',
  'America/New_York remains exactly cased through tenant creation'
);
select is((select count(*) from public.tenant_members where user_id = '72000000-0000-0000-0000-000000000002' and role = 'owner'), 1::bigint, 'America/New_York tenant creates owner membership');
select is((select count(*) from public.pipeline_definitions where tenant_id = (select id from public.tenants where slug = 'timezone-clinic-b')), 11::bigint, 'America/New_York tenant creates default pipeline');

reset role;
select * from finish();
rollback;

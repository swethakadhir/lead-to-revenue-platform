begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@example.test', '', now(), '{}', '{}', now(), now()),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@example.test', '', now(), '{}', '{}', now(), now());

insert into public.tenants (id, name, slug, timezone, currency) values
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a', 'UTC', 'USD'),
  ('b0000000-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b', 'UTC', 'USD');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'sales'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select results_eq(
  $$ select id from public.tenants order by id $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'User A can read only Tenant A'
);

select is(
  (select count(*) from public.tenants where id = 'b0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'User A cannot read Tenant B'
);

select throws_ok(
  $$ update public.tenants set name = 'Compromised' where id = 'b0000000-0000-0000-0000-000000000002' $$,
  '42501',
  'permission denied for table tenants',
  'User A cannot update Tenant B'
);

select throws_ok(
  $$ insert into public.tenant_members (tenant_id, user_id, role) values ('b0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owner') $$,
  '42501',
  'permission denied for table tenant_members',
  'User A cannot create membership in Tenant B'
);

select throws_ok(
  $$ update public.tenant_members set role = 'owner' where user_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501',
  'permission denied for table tenant_members',
  'User A cannot elevate their own role'
);

select results_eq(
  $$ select tenant_id from public.tenant_members order by tenant_id $$,
  $$ values ('a0000000-0000-0000-0000-000000000001'::uuid) $$,
  'User A can read memberships only in Tenant A'
);

select is(
  (select role from public.tenant_members where user_id = '10000000-0000-0000-0000-000000000001'),
  'sales',
  'Valid tenant member access returns the assigned role'
);

reset role;
select * from finish();
rollback;

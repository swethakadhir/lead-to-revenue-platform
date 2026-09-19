begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
('81000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-owner@example.test','',now(),'{}','{}',now(),now()),
('82000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-other@example.test','',now(),'{}','{}',now(),now()),
('83000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-viewer@example.test','',now(),'{}','{}',now(),now()),
('84000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','phase4-admin@example.test','',now(),'{}','{}',now(),now());

set local role service_role;
select lives_ok($$ select public.create_tenant_with_owner('81000000-0000-0000-0000-000000000001','Phase4 Dental','phase4-dental','Asia/Kolkata','INR',(select id from public.industry_templates where key='dental')) $$, 'Template-aware RPC creates tenant and owner atomically');
select is((select count(*) from public.tenant_members m join public.tenants t on t.id=m.tenant_id where t.slug='phase4-dental' and m.role='owner'), 1::bigint, 'Owner membership provisioned');
select is((select count(*) from public.lead_field_definitions f join public.tenants t on t.id=f.tenant_id where t.slug='phase4-dental'), 6::bigint, 'Dental fields copied');
select is((select appointment_types->>0 from public.tenant_settings s join public.tenants t on t.id=s.tenant_id where t.slug='phase4-dental'), 'Consultation', 'Dental appointment types copied');
select is((select p.name from public.pipeline_definitions p join public.tenants t on t.id=p.tenant_id where t.slug='phase4-dental' and p.key='appointment_booked'), 'Visit Booked', 'Dental pipeline name copied');
select is((select count(*) from public.qualification_rules r join public.tenants t on t.id=r.tenant_id where t.slug='phase4-dental'), 3::bigint, 'Dental qualification rules copied');

insert into public.tenants (id,name,slug,timezone,currency,industry_template_id) values
('85000000-0000-0000-0000-000000000005','Phase4 Salon','phase4-salon','UTC','USD',(select id from public.industry_templates where key='salon')),
('86000000-0000-0000-0000-000000000006','Phase4 Interiors','phase4-interiors','UTC','USD',(select id from public.industry_templates where key='interior_design')),
('87000000-0000-0000-0000-000000000007','Phase4 Custom','phase4-custom','UTC','USD',(select id from public.industry_templates where key='custom')),
('88000000-0000-0000-0000-000000000008','Phase4 Legacy','phase4-legacy','UTC','USD',null);
insert into public.tenant_members(tenant_id,user_id,role) values
('85000000-0000-0000-0000-000000000005','82000000-0000-0000-0000-000000000002','owner'),
('85000000-0000-0000-0000-000000000005','83000000-0000-0000-0000-000000000003','viewer'),
('85000000-0000-0000-0000-000000000005','84000000-0000-0000-0000-000000000004','admin'),
('88000000-0000-0000-0000-000000000008','81000000-0000-0000-0000-000000000001','owner');
select is((select count(*) from public.lead_field_definitions where tenant_id='85000000-0000-0000-0000-000000000005'), 6::bigint, 'Salon fields copied');
select is((select count(*) from public.lead_field_definitions where tenant_id='86000000-0000-0000-0000-000000000006'), 9::bigint, 'Interior Design fields copied');
select is((select count(*) from public.lead_field_definitions where tenant_id='87000000-0000-0000-0000-000000000007'), 4::bigint, 'Custom fields copied');
select is((select count(*) from public.lead_field_definitions where tenant_id='88000000-0000-0000-0000-000000000008'), 4::bigint, 'Legacy tenant gets non-destructive generic fields');
select is((select name from public.pipeline_definitions where tenant_id='88000000-0000-0000-0000-000000000008' and key='appointment_booked'), 'Appointment Booked', 'Legacy pipeline unchanged');
select is((select appointment_types->>0 from public.tenant_settings where tenant_id='86000000-0000-0000-0000-000000000006'), 'Discovery Call', 'Interior appointment types copied');
select is((select count(*) from public.qualification_rules where tenant_id='86000000-0000-0000-0000-000000000006'), 4::bigint, 'Interior qualification criteria copied');

insert into public.contacts(id,tenant_id,first_name,email) values ('89000000-0000-0000-0000-000000000009',(select id from public.tenants where slug='phase4-dental'),'Test','phase4-lead@example.test');
select throws_ok($$ insert into public.leads(tenant_id,contact_id,lead_data) values ((select id from public.tenants where slug='phase4-dental'),'89000000-0000-0000-0000-000000000009','{}') $$, '23514', null, 'Dental required field enforced in database');
select throws_ok($$ insert into public.leads(tenant_id,contact_id,lead_data) values ((select id from public.tenants where slug='phase4-dental'),'89000000-0000-0000-0000-000000000009','{"treatment_type":"Bad"}') $$, '23514', null, 'Select option validated in database');
select lives_ok($$ insert into public.leads(tenant_id,contact_id,lead_data) values ((select id from public.tenants where slug='phase4-dental'),'89000000-0000-0000-0000-000000000009','{"treatment_type":"Dental Implant","budget_range":"Medium"}') $$, 'Configured dynamic lead values persist');
select lives_ok($$ insert into public.leads(tenant_id,lead_data) values ('88000000-0000-0000-0000-000000000008','{"legacy_key":"kept"}') $$, 'Legacy arbitrary lead_data remains valid');
select throws_ok($$ insert into public.appointments(tenant_id,contact_id,title,appointment_type,starts_at,ends_at,timezone) values ((select id from public.tenants where slug='phase4-dental'),'89000000-0000-0000-0000-000000000009','Test','Not Configured',now()+interval '1 day',now()+interval '2 days','Asia/Kolkata') $$, '23514', null, 'Appointment type checked against tenant settings');

set local role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"81000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*) from public.lead_field_definitions where tenant_id='85000000-0000-0000-0000-000000000005'), 0::bigint, 'Tenant A cannot read Tenant B fields');
select results_eq($$ update public.lead_field_definitions set label='Compromised' where tenant_id='85000000-0000-0000-0000-000000000005' returning id $$, $$ select id from public.lead_field_definitions where false $$, 'Tenant A cannot update Tenant B fields');
select throws_ok($$ update public.industry_templates set name='Compromised' where key='dental' $$, '42501', null, 'Ordinary users cannot modify global templates');
select is((select count(*) from public.lead_field_definitions where tenant_id=(select id from public.tenants where slug='phase4-dental')), 6::bigint, 'Valid tenant member reads own fields');
select lives_ok($$ update public.lead_field_definitions set label='Treatment choice' where tenant_id=(select id from public.tenants where slug='phase4-dental') and key='treatment_type' $$, 'Owner can customize own field');
select ok((select count(*) > 0 from public.audit_logs where tenant_id=(select id from public.tenants where slug='phase4-dental') and entity_type='lead_field_definitions'), 'Owner configuration change is audited');
select lives_ok($$ select public.apply_industry_template('88000000-0000-0000-0000-000000000008',(select id from public.industry_templates where key='salon')) $$, 'Legacy owner can apply a template once');
select is((select count(*) from public.lead_field_definitions where tenant_id='88000000-0000-0000-0000-000000000008' and is_active and key='service_type'), 1::bigint, 'Legacy tenant receives selected fields without removing old data');
select set_config('request.jwt.claim.sub','83000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"83000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
update public.lead_field_definitions set label='Compromised' where tenant_id='85000000-0000-0000-0000-000000000005' and key='service_type';
select is((select label from public.lead_field_definitions where tenant_id='85000000-0000-0000-0000-000000000005' and key='service_type'), 'Service interested in', 'Viewer cannot modify tenant fields');
select is((select count(*) from public.audit_logs where tenant_id='85000000-0000-0000-0000-000000000005'), 0::bigint, 'Viewer cannot read configuration audit history');
select set_config('request.jwt.claim.sub','84000000-0000-0000-0000-000000000004',true);
select set_config('request.jwt.claims','{"sub":"84000000-0000-0000-0000-000000000004","role":"authenticated"}',true);
select lives_ok($$ update public.lead_field_definitions set label='Requested service' where tenant_id='85000000-0000-0000-0000-000000000005' and key='service_type' $$, 'Admin can customize own tenant field');
reset role;
select * from finish();
rollback;

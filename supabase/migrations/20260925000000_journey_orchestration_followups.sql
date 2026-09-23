-- Durable, configuration-driven inactivity follow-ups. The application decides
-- whether to insert one; this migration only protects idempotency and obsolete work.
alter table public.followups
  add column automation_key text check (automation_key is null or char_length(btrim(automation_key)) between 1 and 200);

create unique index followups_tenant_automation_key_idx
  on public.followups (tenant_id, automation_key)
  where automation_key is not null;

create index followups_tenant_lead_automated_pending_idx
  on public.followups (tenant_id, lead_id, due_at)
  where status = 'pending' and automation_key is not null;

create or replace function private.cancel_followup_action_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.action_jobs
      set status = 'cancelled', next_retry_at = null, lease_expires_at = null,
          last_error_category = 'followup_cancelled',
          last_error_message = 'The linked follow-up was cancelled before execution.'
      where tenant_id = new.tenant_id
        and idempotency_key = 'lead:' || new.lead_id || ':followup:' || new.id
        and status in ('pending', 'failed');

    if new.lead_id is not null then
      insert into public.journey_events(tenant_id, lead_id, event_type, metadata)
      values (new.tenant_id, new.lead_id, 'follow_up_cancelled', jsonb_build_object('followup_id', new.id));
    end if;
  end if;
  return new;
end;
$$;

create trigger followups_cancel_action_job
after update of status on public.followups
for each row execute function private.cancel_followup_action_job();

-- New tenants receive the same conservative, editable policy shape. Existing
-- template cadence remains intact; only missing policy controls are supplied.
update public.industry_templates
set configuration = jsonb_set(
  configuration,
  '{followup_defaults}',
  coalesce(configuration->'followup_defaults', '{}'::jsonb) || jsonb_build_object(
    'enabled', true,
    'max_attempts', 3,
    'stop_on_customer_reply', true,
    'stop_on_qualification', true,
    'stop_on_booking', true,
    'stop_on_conversion', true,
    'stop_while_intervention_open', true
  ),
  true
);

update public.tenant_settings
set followup_defaults = coalesce(followup_defaults, '{}'::jsonb) || jsonb_build_object(
  'enabled', true,
  'max_attempts', 3,
  'stop_on_customer_reply', true,
  'stop_on_qualification', true,
  'stop_on_booking', true,
  'stop_on_conversion', true,
  'stop_while_intervention_open', true
);

revoke all on function private.cancel_followup_action_job() from public, anon, authenticated;

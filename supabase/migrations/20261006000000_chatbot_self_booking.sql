-- Atomic, service-only persistence boundary for a validated chatbot booking.
create function public.create_chatbot_self_booking(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_slot_start timestamptz,
  p_slot_end timestamptz
)
returns table(result_code text, appointment_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  locked_conversation public.conversations;
  tenant_timezone text;
  booking_hours jsonb;
  lead_status text;
  contact_id uuid;
  lead_id uuid;
  journey_stage text;
  journey_conversation_id uuid;
  context jsonb;
  existing_appointment public.appointments;
  conflicting_appointment uuid;
  local_start timestamp;
  local_end timestamp;
  opening timestamp;
  closing timestamp;
  day_key text;
  day_config jsonb;
  duration_minutes integer;
  interval_minutes integer;
  appointment_types jsonb;
  appointment_type text;
  appointment_title text;
  booked_appointment_id uuid;
  booked_starts_at timestamptz;
  booked_ends_at timestamptz;
  expected_end timestamptz;
begin
  if p_tenant_id is null or p_conversation_id is null or p_slot_start is null or p_slot_end is null then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- One-capacity MVP: serialize every booking attempt for a tenant.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_tenant_id::text, 0));

  select * into locked_conversation
  from public.conversations
  where id = p_conversation_id and tenant_id = p_tenant_id
  for update;
  if not found then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  -- A successful prior booking is the conversation idempotency boundary.
  context := coalesce(locked_conversation.context, '{}'::jsonb);
  if (context #>> '{_booking,appointment_id}') is not null then
    begin
      select * into existing_appointment
      from public.appointments
      where id = (context #>> '{_booking,appointment_id}')::uuid
        and tenant_id = p_tenant_id
        and lead_id = locked_conversation.lead_id
        and contact_id = locked_conversation.contact_id;
      if found then
        return query select 'already_booked'::text, existing_appointment.id, existing_appointment.starts_at, existing_appointment.ends_at;
        return;
      end if;
    exception when invalid_text_representation then
      null;
    end;
  end if;

  if locked_conversation.lead_id is null or locked_conversation.contact_id is null then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  select l.status, l.contact_id into lead_status, contact_id
  from public.leads l
  where l.id = locked_conversation.lead_id and l.tenant_id = p_tenant_id;
  if not found or contact_id is distinct from locked_conversation.contact_id then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  select j.stage, j.conversation_id into journey_stage, journey_conversation_id
  from public.lead_journeys j
  where j.tenant_id = p_tenant_id and j.lead_id = locked_conversation.lead_id;
  if not found or journey_stage <> 'booking_ready' or (journey_conversation_id is not null and journey_conversation_id <> locked_conversation.id) or lead_status in ('converted', 'disqualified', 'dormant') then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  select t.timezone, s.business_hours, s.appointment_types
    into tenant_timezone, booking_hours, appointment_types
  from public.tenants t
  join public.tenant_settings s on s.tenant_id = t.id
  where t.id = p_tenant_id;
  if not found or tenant_timezone is null or booking_hours is null then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  duration_minutes := coalesce((booking_hours->>'slot_duration_minutes')::integer, 30);
  interval_minutes := coalesce((booking_hours->>'slot_interval_minutes')::integer, 30);
  if duration_minutes < 5 or duration_minutes > 480 or interval_minutes < 5 or interval_minutes > 480 then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  local_start := p_slot_start at time zone tenant_timezone;
  local_end := p_slot_end at time zone tenant_timezone;
  if p_slot_start < now() or p_slot_end <= p_slot_start or local_start <> date_trunc('minute', local_start) then
    return query select 'slot_unavailable'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  day_key := lower(to_char(local_start, 'Dy'));
  day_config := booking_hours->'weekly'->day_key;
  if day_config is null or coalesce((day_config->>'enabled')::boolean, true) is not true then
    return query select 'slot_unavailable'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  begin
    opening := local_start::date + (day_config->>'start')::time;
    closing := local_start::date + (day_config->>'end')::time;
    expected_end := (local_start + make_interval(mins => duration_minutes)) at time zone tenant_timezone;
  exception when others then
    return query select 'invalid_request'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end;
  if closing <= opening or local_start < opening or local_start + make_interval(mins => duration_minutes) > closing
    or extract(epoch from (local_start - opening))::numeric % (interval_minutes * 60) <> 0
    or p_slot_end <> expected_end then
    return query select 'slot_unavailable'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  select a.id into conflicting_appointment
  from public.appointments a
  where a.tenant_id = p_tenant_id
    and a.status in ('scheduled', 'confirmed')
    and p_slot_start < a.ends_at
    and p_slot_end > a.starts_at
  limit 1;
  if conflicting_appointment is not null then
    return query select 'slot_unavailable'::text, null::uuid, null::timestamptz, null::timestamptz;
    return;
  end if;

  appointment_type := case when jsonb_typeof(appointment_types) = 'array' then appointment_types->>0 else null end;
  appointment_title := coalesce(nullif(appointment_type, ''), 'Appointment');
  insert into public.appointments(tenant_id, lead_id, contact_id, title, appointment_type, status, starts_at, ends_at, timezone)
  values (p_tenant_id, locked_conversation.lead_id, locked_conversation.contact_id, appointment_title, nullif(appointment_type, ''), 'scheduled', p_slot_start, p_slot_end, tenant_timezone)
  returning id, starts_at, ends_at into booked_appointment_id, booked_starts_at, booked_ends_at;

  update public.conversations
  set context = jsonb_set(
    jsonb_set(context, '{_booking}', case when jsonb_typeof(context->'_booking') = 'object' then context->'_booking' else '{}'::jsonb end, true),
    '{_booking,appointment_id}', to_jsonb(booked_appointment_id), true
  ), last_activity_at = now()
  where id = locked_conversation.id and tenant_id = p_tenant_id;

  return query select 'booked'::text, booked_appointment_id, booked_starts_at, booked_ends_at;
end;
$$;

revoke all on function public.create_chatbot_self_booking(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.create_chatbot_self_booking(uuid, uuid, timestamptz, timestamptz) to service_role;

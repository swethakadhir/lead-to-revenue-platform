-- One chatbot conversation may create one lead. The conversation row is the
-- idempotency boundary, so retries and concurrent capture submissions converge.
create function public.create_chatbot_capture_lead(
  p_tenant_id uuid,
  p_conversation_id uuid,
  p_first_name text,
  p_phone text,
  p_email text,
  p_lead_data jsonb,
  p_lead_status text,
  p_qualification_status text,
  p_qualification_score integer
)
returns table(conversation_id uuid, contact_id uuid, lead_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_conversation public.conversations;
  resolved_contact_id uuid;
  created_lead_id uuid;
begin
  select * into locked_conversation
  from public.conversations
  where id = p_conversation_id and tenant_id = p_tenant_id
  for update;

  if not found then
    raise exception 'Chatbot conversation not found for tenant.' using errcode = 'P0002';
  end if;

  if locked_conversation.lead_id is not null then
    update public.lead_journeys as journey
    set conversation_id = locked_conversation.id
    where journey.tenant_id = p_tenant_id
      and journey.lead_id = locked_conversation.lead_id
      and journey.conversation_id is null;

    return query select locked_conversation.id, locked_conversation.contact_id, locked_conversation.lead_id, false;
    return;
  end if;

  if p_email is not null then
    select id into resolved_contact_id
    from public.contacts
    where tenant_id = p_tenant_id
      and (email ilike p_email or phone = p_phone)
    limit 1;
  else
    select id into resolved_contact_id
    from public.contacts
    where tenant_id = p_tenant_id and phone = p_phone
    limit 1;
  end if;

  if resolved_contact_id is null then
    insert into public.contacts(tenant_id, first_name, phone, email, metadata)
    values(p_tenant_id, btrim(p_first_name), p_phone, p_email, jsonb_build_object('source', 'website_chatbot'))
    returning id into resolved_contact_id;
  end if;

  insert into public.leads(tenant_id, contact_id, lead_data, status, qualification_status, qualification_score)
  values(p_tenant_id, resolved_contact_id, p_lead_data, p_lead_status, p_qualification_status, p_qualification_score)
  returning id into created_lead_id;

  update public.conversations
  set contact_id = resolved_contact_id,
      lead_id = created_lead_id,
      last_activity_at = now()
  where id = locked_conversation.id and tenant_id = p_tenant_id;

  update public.lead_journeys as journey
  set conversation_id = locked_conversation.id
  where journey.tenant_id = p_tenant_id
    and journey.lead_id = created_lead_id
    and journey.conversation_id is null;

  return query select locked_conversation.id, resolved_contact_id, created_lead_id, true;
end;
$$;

revoke all on function public.create_chatbot_capture_lead(uuid, uuid, text, text, text, jsonb, text, text, integer) from public, anon, authenticated;
grant execute on function public.create_chatbot_capture_lead(uuid, uuid, text, text, text, jsonb, text, text, integer) to service_role;

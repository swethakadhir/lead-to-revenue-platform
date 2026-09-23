import "server-only";

import { createClient } from "@/lib/supabase/server";
import { evaluateLeadJourney } from "@/lib/domain/journey/orchestrator";
import { evaluateQualification } from "@/lib/domain/chatbot/qualification";

export async function getOperatorOverview() {
  const client = await createClient();
  const [tenants, activeLeads, interventions, conversations, bookings] = await Promise.all([
    client.from("tenants").select("id, name, slug, status").order("name").limit(250),
    client.from("leads").select("id", { count: "exact", head: true }).in("status", ["engaged", "understanding_requirement", "qualifying", "qualified", "booking_ready", "booking_in_progress", "human_intervention"]),
    client.from("human_interventions").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    client.from("conversations").select("id", { count: "exact", head: true }).gte("last_activity_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "confirmed").gte("starts_at", new Date().toISOString()),
  ]);
  const failed = [tenants, activeLeads, interventions, conversations, bookings].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { tenants: tenants.data ?? [], metrics: { activeLeads: activeLeads.count ?? 0, interventions: interventions.count ?? 0, recentConversations: conversations.count ?? 0, confirmedBookings: bookings.count ?? 0 } };
}

export async function getOperatorTenant(tenantId: string) {
  const client = await createClient();
  const { data: tenant, error } = await client.from("tenants").select("*").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  if (!tenant) return null;
  const [leads, conversations, appointments, interventions, journeys, events, actionJobs, settings, fields, rules, followups] = await Promise.all([
    client.from("leads").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(25),
    client.from("conversations").select("*").eq("tenant_id", tenantId).order("last_activity_at", { ascending: false }).limit(10),
    client.from("appointments").select("*").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).order("starts_at").limit(10),
    client.from("human_interventions").select("*").eq("tenant_id", tenantId).in("status", ["open", "in_progress"]).order("requested_at", { ascending: false }).limit(10),
    client.from("lead_journeys").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(50),
    client.from("journey_events").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
    client.from("action_jobs").select("*").eq("tenant_id", tenantId).in("status", ["pending", "processing", "failed"]).order("due_at").limit(20),
    client.from("tenant_settings").select("followup_defaults").eq("tenant_id", tenantId).maybeSingle(),
    client.from("lead_field_definitions").select("key,label,required,is_active").eq("tenant_id", tenantId),
    client.from("qualification_rules").select("*").eq("tenant_id", tenantId),
    client.from("followups").select("lead_id,status,automation_key,due_at").eq("tenant_id", tenantId),
  ]);
  const failed = [leads, conversations, appointments, interventions, journeys, events, actionJobs, settings, fields, rules, followups].find((result) => result.error);
  if (failed?.error) throw failed.error;
  const contactIds = [...new Set([...(leads.data ?? []).map((lead) => lead.contact_id), ...(conversations.data ?? []).map((conversation) => conversation.contact_id)].filter((id): id is string => Boolean(id)))];
  const { data: contacts, error: contactsError } = contactIds.length ? await client.from("contacts").select("id, first_name, last_name, email, phone").in("id", contactIds).eq("tenant_id", tenantId) : { data: [], error: null };
  if (contactsError) throw contactsError;
  const contactById = new Map((contacts ?? []).map((contact) => [contact.id, contact]));
  const enrichedLeads = (leads.data ?? []).map((lead) => {
    const contact = lead.contact_id ? contactById.get(lead.contact_id) ?? null : null;
    const leadAppointments = (appointments.data ?? []).filter((appointment) => appointment.lead_id === lead.id);
    const leadFollowups = (followups.data ?? []).filter((followup) => followup.lead_id === lead.id);
    const latestConversation = (conversations.data ?? []).find((conversation) => conversation.lead_id === lead.id);
    const data = lead.lead_data && typeof lead.lead_data === "object" && !Array.isArray(lead.lead_data) ? lead.lead_data : {};
    return { ...lead, contact, journeyDecision: evaluateLeadJourney({ lead, fields: fields.data ?? [], rules: rules.data ?? [], qualification: evaluateQualification(rules.data ?? [], { ...data, email: contact?.email ?? undefined, phone: contact?.phone ?? undefined }), contact, hasActiveAppointment: leadAppointments.some((appointment) => appointment.status === "scheduled"), hasConfirmedAppointment: leadAppointments.some((appointment) => appointment.status === "confirmed"), interventionOpen: (interventions.data ?? []).some((intervention) => intervention.lead_id === lead.id), pendingAutomatedFollowUp: leadFollowups.some((followup) => followup.status === "pending" && followup.automation_key), completedAutomatedFollowUps: leadFollowups.filter((followup) => followup.status === "completed" && followup.automation_key).length, lastMeaningfulActivityAt: latestConversation?.last_activity_at ?? null, policy: settings.data?.followup_defaults ?? {} }) };
  });
  return {
    tenant,
    leads: enrichedLeads,
    conversations: (conversations.data ?? []).map((conversation) => ({ ...conversation, contact: conversation.contact_id ? contactById.get(conversation.contact_id) ?? null : null })),
    appointments: appointments.data ?? [], interventions: interventions.data ?? [], journeys: journeys.data ?? [], events: events.data ?? [], actionJobs: actionJobs.data ?? [],
  };
}

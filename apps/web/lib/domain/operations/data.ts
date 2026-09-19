import "server-only";

import { getTeamMembers } from "@/lib/domain/sales/data";
import { createClient } from "@/lib/supabase/server";
import { partitionAppointments } from "./partition";
import { zonedDayBounds } from "./time";
import type { Appointment, AppointmentListItem, Followup, FollowupListItem, OperationalReferences } from "./types";

export async function getOperationalReferences(tenantId: string): Promise<OperationalReferences> {
  const supabase = await createClient();
  const [contacts, leads, opportunities, members] = await Promise.all([
    supabase.from("contacts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("leads").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("opportunities").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    getTeamMembers(tenantId),
  ]);
  if (contacts.error) throw contacts.error;
  if (leads.error) throw leads.error;
  if (opportunities.error) throw opportunities.error;
  return { contacts: contacts.data ?? [], leads: leads.data ?? [], opportunities: opportunities.data ?? [], members };
}

type Filters = { status?: string; assignee?: string; from?: string; to?: string };

export { partitionAppointments };

export async function listAppointments(tenantId: string, filters: Filters = {}): Promise<AppointmentListItem[]> {
  const supabase = await createClient();
  let query = supabase.from("appointments").select("*").eq("tenant_id", tenantId).order("starts_at").limit(500);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignee === "unassigned") query = query.is("assigned_user_id", null);
  else if (filters.assignee) query = query.eq("assigned_user_id", filters.assignee);
  if (filters.from) query = query.gte("starts_at", filters.from);
  if (filters.to) query = query.lt("starts_at", filters.to);
  const [{ data, error }, references] = await Promise.all([query, getOperationalReferences(tenantId)]);
  if (error) throw error;
  return joinAppointments((data ?? []) as Appointment[], references);
}

export async function listFollowups(tenantId: string, filters: Filters = {}): Promise<FollowupListItem[]> {
  const supabase = await createClient();
  let query = supabase.from("followups").select("*").eq("tenant_id", tenantId).order("due_at").limit(500);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.assignee === "unassigned") query = query.is("assigned_user_id", null);
  else if (filters.assignee) query = query.eq("assigned_user_id", filters.assignee);
  if (filters.from) query = query.gte("due_at", filters.from);
  if (filters.to) query = query.lt("due_at", filters.to);
  const [{ data, error }, references] = await Promise.all([query, getOperationalReferences(tenantId)]);
  if (error) throw error;
  return joinFollowups((data ?? []) as Followup[], references);
}

export async function getLeadOperations(tenantId: string, leadId: string) {
  const supabase = await createClient();
  const [appointments, followups] = await Promise.all([
    supabase.from("appointments").select("*").eq("tenant_id", tenantId).eq("lead_id", leadId).order("starts_at"),
    supabase.from("followups").select("*").eq("tenant_id", tenantId).eq("lead_id", leadId).order("due_at"),
  ]);
  if (appointments.error) throw appointments.error;
  if (followups.error) throw followups.error;
  return { appointments: appointments.data ?? [], followups: followups.data ?? [] };
}

export async function getDashboardData(tenantId: string, timeZone: string, currency: string) {
  const supabase = await createClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const today = zonedDayBounds(timeZone, now);
  const { data: stages, error: stageError } = await supabase.from("pipeline_definitions").select("key, stage_type").eq("tenant_id", tenantId).eq("is_active", true);
  if (stageError) throw stageError;
  const openKeys = (stages ?? []).filter((stage) => stage.stage_type === "open").map((stage) => stage.key);
  const wonKeys = (stages ?? []).filter((stage) => stage.stage_type === "won").map((stage) => stage.key);
  const openOpportunities = openKeys.length
    ? supabase.from("opportunities").select("id, estimated_value, currency").eq("tenant_id", tenantId).in("stage_key", openKeys)
    : Promise.resolve({ data: [], error: null });
  const wonCount = wonKeys.length
    ? supabase.from("opportunities").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("stage_key", wonKeys)
    : Promise.resolve({ count: 0, error: null });
  const [newLeads, qualifiedLeads, upcomingAppointments, openOpportunitiesResult, won, appointmentsToday, overdueFollowups, followupsToday, recentAppointments, recentLeads] = await Promise.all([
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "new"),
    supabase.from("leads").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("qualification_status", "qualified"),
    supabase.from("appointments").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).gte("starts_at", nowIso),
    openOpportunities,
    wonCount,
    supabase.from("appointments").select("*").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).gte("starts_at", today.start).lt("starts_at", today.end).order("starts_at").limit(8),
    supabase.from("followups").select("*").eq("tenant_id", tenantId).eq("status", "pending").lt("due_at", nowIso).order("due_at").limit(8),
    supabase.from("followups").select("*").eq("tenant_id", tenantId).eq("status", "pending").gte("due_at", nowIso).lt("due_at", today.end).order("due_at").limit(8),
    supabase.from("appointments").select("*").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).gte("starts_at", nowIso).order("starts_at").limit(8),
    supabase.from("leads").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(8),
  ]);
  const results = [newLeads, qualifiedLeads, upcomingAppointments, openOpportunitiesResult, won, appointmentsToday, overdueFollowups, followupsToday, recentAppointments, recentLeads];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const references = await getOperationalReferences(tenantId);
  const openItems = openOpportunitiesResult.data ?? [];
  return {
    metrics: {
      newLeads: newLeads.count ?? 0,
      qualifiedLeads: qualifiedLeads.count ?? 0,
      appointments: upcomingAppointments.count ?? 0,
      opportunities: openItems.length,
      won: won.count ?? 0,
      pipelineValue: openItems.filter((opportunity) => opportunity.currency === currency).reduce((sum, opportunity) => sum + Number(opportunity.estimated_value ?? 0), 0),
    },
    appointmentsToday: joinAppointments(appointmentsToday.data ?? [], references),
    overdueFollowups: joinFollowups(overdueFollowups.data ?? [], references),
    followupsToday: joinFollowups(followupsToday.data ?? [], references),
    upcomingAppointments: joinAppointments(recentAppointments.data ?? [], references),
    recentLeads: recentLeads.data ?? [],
    references,
  };
}

function joinAppointments(records: Appointment[], references: OperationalReferences): AppointmentListItem[] {
  const contacts = new Map(references.contacts.map((item) => [item.id, item]));
  const leads = new Map(references.leads.map((item) => [item.id, item]));
  const opportunities = new Map(references.opportunities.map((item) => [item.id, item]));
  const members = new Map(references.members.map((item) => [item.userId, item.label]));
  return records.flatMap((record) => {
    const contact = contacts.get(record.contact_id);
    return contact ? [{ ...record, contact, lead: record.lead_id ? leads.get(record.lead_id) ?? null : null, opportunity: record.opportunity_id ? opportunities.get(record.opportunity_id) ?? null : null, assigneeLabel: record.assigned_user_id ? members.get(record.assigned_user_id) ?? null : null }] : [];
  });
}

function joinFollowups(records: Followup[], references: OperationalReferences): FollowupListItem[] {
  const contacts = new Map(references.contacts.map((item) => [item.id, item]));
  const leads = new Map(references.leads.map((item) => [item.id, item]));
  const opportunities = new Map(references.opportunities.map((item) => [item.id, item]));
  const members = new Map(references.members.map((item) => [item.userId, item.label]));
  return records.flatMap((record) => {
    const contact = contacts.get(record.contact_id);
    return contact ? [{ ...record, contact, lead: record.lead_id ? leads.get(record.lead_id) ?? null : null, opportunity: record.opportunity_id ? opportunities.get(record.opportunity_id) ?? null : null, assigneeLabel: record.assigned_user_id ? members.get(record.assigned_user_id) ?? null : null }] : [];
  });
}

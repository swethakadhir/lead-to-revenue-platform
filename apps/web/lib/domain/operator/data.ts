import "server-only";

import { createClient } from "@/lib/supabase/server";

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
  const [leads, conversations, appointments, interventions] = await Promise.all([
    client.from("leads").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(25),
    client.from("conversations").select("*").eq("tenant_id", tenantId).order("last_activity_at", { ascending: false }).limit(10),
    client.from("appointments").select("*").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).order("starts_at").limit(10),
    client.from("human_interventions").select("*").eq("tenant_id", tenantId).in("status", ["open", "in_progress"]).order("requested_at", { ascending: false }).limit(10),
  ]);
  const failed = [leads, conversations, appointments, interventions].find((result) => result.error);
  if (failed?.error) throw failed.error;
  return { tenant, leads: leads.data ?? [], conversations: conversations.data ?? [], appointments: appointments.data ?? [], interventions: interventions.data ?? [] };
}

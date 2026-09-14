import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Contact, Lead, LeadListItem, Opportunity, OpportunityCard, PipelineStage, TeamMemberOption } from "./types";

export async function getTeamMembers(tenantId: string): Promise<TeamMemberOption[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("tenant_members")
    .select("user_id, role")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("created_at");
  if (error) throw error;
  const userIds = memberships?.map((member) => member.user_id) ?? [];
  if (!userIds.length) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", userIds);
  if (profileError) throw profileError;
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return (memberships ?? []).map((member) => {
    const profile = profileMap.get(member.user_id);
    return {
      userId: member.user_id,
      label: profile?.full_name || profile?.email || member.user_id,
      role: member.role,
    };
  });
}

export async function getPipelineStages(tenantId: string): Promise<PipelineStage[]> {
  const { data, error } = await (await createClient())
    .from("pipeline_definitions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("stage_order");
  if (error) throw error;
  return data ?? [];
}

async function contactMapFor(tenantId: string, ids: (string | null)[]) {
  const contactIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!contactIds.length) return new Map<string, Contact>();
  const { data, error } = await (await createClient())
    .from("contacts")
    .select("*")
    .eq("tenant_id", tenantId)
    .in("id", contactIds);
  if (error) throw error;
  return new Map((data ?? []).map((contact) => [contact.id, contact]));
}

export async function listLeads(tenantId: string): Promise<LeadListItem[]> {
  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase.from("leads").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(250),
    getTeamMembers(tenantId),
  ]);
  if (error) throw error;
  const leads = (data ?? []) as Lead[];
  const contacts = await contactMapFor(tenantId, leads.map((lead) => lead.contact_id));
  const memberMap = new Map(members.map((member) => [member.userId, member.label]));
  return leads.map((lead) => ({
    ...lead,
    contact: lead.contact_id ? contacts.get(lead.contact_id) ?? null : null,
    assigneeLabel: lead.assigned_user_id ? memberMap.get(lead.assigned_user_id) ?? null : null,
  }));
}

export async function getLead(tenantId: string, leadId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").select("*").eq("tenant_id", tenantId).eq("id", leadId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [contacts, opportunities] = await Promise.all([
    contactMapFor(tenantId, [data.contact_id]),
    supabase.from("opportunities").select("*").eq("tenant_id", tenantId).eq("lead_id", leadId).order("created_at", { ascending: false }),
  ]);
  if (opportunities.error) throw opportunities.error;
  return {
    lead: data as Lead,
    contact: data.contact_id ? contacts.get(data.contact_id) ?? null : null,
    opportunities: (opportunities.data ?? []) as Opportunity[],
  };
}

export async function listOpportunities(tenantId: string): Promise<OpportunityCard[]> {
  const supabase = await createClient();
  const [{ data, error }, members] = await Promise.all([
    supabase.from("opportunities").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    getTeamMembers(tenantId),
  ]);
  if (error) throw error;
  const opportunities = (data ?? []) as Opportunity[];
  const contacts = await contactMapFor(tenantId, opportunities.map((item) => item.contact_id));
  const memberMap = new Map(members.map((member) => [member.userId, member.label]));
  return opportunities.map((opportunity) => ({
    ...opportunity,
    contact: opportunity.contact_id ? contacts.get(opportunity.contact_id) ?? null : null,
    assigneeLabel: opportunity.assigned_user_id ? memberMap.get(opportunity.assigned_user_id) ?? null : null,
  }));
}

export function contactName(contact: Contact | null) {
  if (!contact) return "No contact";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ");
}

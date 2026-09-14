"use server";

import { revalidatePath } from "next/cache";
import { fieldsFromError, followupSchema, followupTransitionSchema, type FormState } from "@/lib/domain/operations/schemas";
import { zonedLocalToIso } from "@/lib/domain/operations/time";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function followupInput(formData: FormData) {
  return {
    leadId: value(formData, "leadId"), opportunityId: value(formData, "opportunityId"), contactId: value(formData, "contactId"),
    assignedUserId: value(formData, "assignedUserId"), type: value(formData, "type"), dueAt: value(formData, "dueAt"),
    notes: value(formData, "notes"), outcome: value(formData, "outcome"),
  };
}

function mutationFrom(data: ReturnType<typeof followupSchema.parse>, timeZone: string) {
  return {
    lead_id: data.leadId, opportunity_id: data.opportunityId, contact_id: data.contactId,
    assigned_user_id: data.assignedUserId, type: data.type, due_at: zonedLocalToIso(data.dueAt, timeZone), notes: data.notes, outcome: data.outcome,
  };
}

export async function createFollowup(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = followupSchema.safeParse(followupInput(formData));
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };
  try {
    const { error } = await (await createClient()).from("followups").insert({ ...mutationFrom(result.data, tenant.timezone), tenant_id: tenant.id });
    if (error) return { error: "The follow-up could not be created. Verify its linked records and assignee." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The follow-up time is invalid." };
  }
  revalidateFollowupViews(result.data.leadId);
  return { error: null, message: "Follow-up created." };
}

export async function updateFollowup(followupId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = followupSchema.safeParse(followupInput(formData));
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };
  try {
    const { data, error } = await (await createClient()).from("followups").update(mutationFrom(result.data, tenant.timezone)).eq("tenant_id", tenant.id).eq("id", followupId).select("id").maybeSingle();
    if (error || !data) return { error: "The follow-up could not be updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The follow-up time is invalid." };
  }
  revalidateFollowupViews(result.data.leadId);
  return { error: null, message: "Follow-up updated." };
}

export async function transitionFollowup(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = followupTransitionSchema.safeParse({ followupId: value(formData, "followupId"), status: value(formData, "status"), outcome: value(formData, "outcome") });
  if (!result.success) return { error: "Choose a valid follow-up status.", fieldErrors: fieldsFromError(result.error) };
  const { data, error } = await (await createClient()).from("followups")
    .update({ status: result.data.status, outcome: result.data.outcome })
    .eq("tenant_id", tenant.id).eq("id", result.data.followupId).select("id, lead_id").maybeSingle();
  if (error || !data) return { error: "The follow-up status could not be changed." };
  revalidateFollowupViews(data.lead_id);
  return { error: null, message: "Follow-up status updated." };
}

function revalidateFollowupViews(leadId: string | null) {
  revalidatePath("/app/followups");
  revalidatePath("/app/dashboard");
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
}

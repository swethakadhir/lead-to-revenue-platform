"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createLeadSchema,
  createOpportunitySchema,
  fieldsFromError,
  stageTransitionSchema,
  updateLeadSchema,
  type FormState,
} from "@/lib/domain/sales/schemas";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { getTenantConfiguration } from "@/lib/domain/configuration/data";
import { parseDynamicLeadData } from "@/lib/domain/configuration/dynamic-fields";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function leadInput(formData: FormData) {
  return {
    firstName: value(formData, "firstName"),
    lastName: value(formData, "lastName"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    status: value(formData, "status"),
    assignedUserId: value(formData, "assignedUserId"),
  };
}

export async function createLead(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "Create or select a business before adding leads." };
  const configuration = await getTenantConfiguration(tenant.id);
  const dynamic = parseDynamicLeadData(configuration.fields, formData);
  if (!dynamic.success) return { error: "Check the highlighted fields.", fieldErrors: dynamic.fieldErrors };
  const result = createLeadSchema.safeParse({ ...leadInput(formData), leadData: dynamic.data });
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };

  const { data: leadId, error } = await (await createClient()).rpc("create_manual_lead", {
    p_tenant_id: tenant.id,
    p_first_name: result.data.firstName,
    p_last_name: result.data.lastName ?? "",
    p_email: result.data.email ?? "",
    p_phone: result.data.phone ?? "",
    p_status: result.data.status,
    p_assigned_user_id: result.data.assignedUserId,
    p_lead_data: result.data.leadData,
  });
  if (error || !leadId) return { error: "The lead could not be created. Verify the assignee and try again." };

  revalidatePath("/app/leads");
  redirect(`/app/leads/${leadId}`);
}

export async function updateLead(leadId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const client = await createClient();
  const [{ data: currentLead, error: leadError }, configuration] = await Promise.all([
    client.from("leads").select("lead_data").eq("tenant_id", tenant.id).eq("id", leadId).maybeSingle(),
    getTenantConfiguration(tenant.id),
  ]);
  if (leadError || !currentLead) return { error: "Lead not found for the active business." };
  const dynamic = parseDynamicLeadData(configuration.fields, formData, currentLead.lead_data);
  if (!dynamic.success) return { error: "Check the highlighted fields.", fieldErrors: dynamic.fieldErrors };
  const result = updateLeadSchema.safeParse({
    ...leadInput(formData),
    leadData: dynamic.data,
    qualificationStatus: value(formData, "qualificationStatus"),
    qualificationScore: value(formData, "qualificationScore"),
  });
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };

  const { error } = await client.rpc("update_lead_with_contact", {
    p_tenant_id: tenant.id,
    p_lead_id: leadId,
    p_first_name: result.data.firstName,
    p_last_name: result.data.lastName ?? "",
    p_email: result.data.email ?? "",
    p_phone: result.data.phone ?? "",
    p_status: result.data.status,
    p_qualification_status: result.data.qualificationStatus,
    p_qualification_score: result.data.qualificationScore,
    p_assigned_user_id: result.data.assignedUserId,
    p_lead_data: result.data.leadData,
  });
  if (error) return { error: error.code === "P0002" ? "Lead not found." : "The lead could not be updated." };

  revalidatePath("/app/leads");
  revalidatePath(`/app/leads/${leadId}`);
  return { error: null, message: "Lead updated." };
}

export async function createOpportunity(leadId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = createOpportunitySchema.safeParse({
    name: value(formData, "name"),
    stageKey: value(formData, "stageKey"),
    estimatedValue: value(formData, "estimatedValue"),
    currency: value(formData, "currency"),
    probability: value(formData, "probability"),
    assignedUserId: value(formData, "assignedUserId"),
    expectedCloseDate: value(formData, "expectedCloseDate"),
  });
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, contact_id")
    .eq("tenant_id", tenant.id)
    .eq("id", leadId)
    .maybeSingle();
  if (leadError || !lead) return { error: "Lead not found for the active business." };

  const { error } = await supabase.from("opportunities").insert({
    tenant_id: tenant.id,
    lead_id: lead.id,
    contact_id: lead.contact_id,
    name: result.data.name,
    stage_key: result.data.stageKey,
    estimated_value: result.data.estimatedValue,
    currency: result.data.currency,
    probability: result.data.probability,
    assigned_user_id: result.data.assignedUserId,
    expected_close_date: result.data.expectedCloseDate,
  });
  if (error) return { error: "The opportunity could not be created. Verify its stage and assignee." };

  revalidatePath(`/app/leads/${leadId}`);
  revalidatePath("/app/pipeline");
  return { error: null, message: "Opportunity created." };
}

export async function transitionOpportunity(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = stageTransitionSchema.safeParse({
    opportunityId: value(formData, "opportunityId"),
    stageKey: value(formData, "stageKey"),
    lostReason: value(formData, "lostReason"),
  });
  if (!result.success) return { error: "Choose a valid pipeline stage.", fieldErrors: fieldsFromError(result.error) };

  const supabase = await createClient();
  const { data: stage, error: stageError } = await supabase
    .from("pipeline_definitions")
    .select("stage_type")
    .eq("tenant_id", tenant.id)
    .eq("key", result.data.stageKey)
    .eq("is_active", true)
    .maybeSingle();
  if (stageError || !stage) return { error: "That pipeline stage is not available." };
  if (stage.stage_type === "lost" && !result.data.lostReason) return { error: "Add a reason before marking this opportunity lost.", fieldErrors: { lostReason: ["Lost reason is required."] } };

  const { data, error } = await supabase
    .from("opportunities")
    .update({ stage_key: result.data.stageKey, lost_reason: result.data.lostReason })
    .eq("tenant_id", tenant.id)
    .eq("id", result.data.opportunityId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "The opportunity stage could not be changed." };

  revalidatePath("/app/pipeline");
  revalidatePath("/app/leads");
  return { error: null, message: "Stage updated." };
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformOperator } from "@/lib/auth/platform-operator";
import { createClient } from "@/lib/supabase/server";

export type OperatorActionState = { error: string | null; message?: string };
const initialError = { error: "Invalid request." };

export async function resetStarterChatbot(_state: OperatorActionState, formData: FormData): Promise<OperatorActionState> {
  await requirePlatformOperator();
  const parsed = z.object({ tenantId: z.uuid(), confirm: z.literal("RESET") }).safeParse({ tenantId: String(formData.get("tenantId") ?? ""), confirm: String(formData.get("confirm") ?? "") });
  if (!parsed.success) return { ...initialError, error: "Type RESET to replace this tenant's chatbot with its selected template starter flow." };
  const { error } = await (await createClient()).rpc("reset_chatbot_to_tenant_template", { p_tenant_id: parsed.data.tenantId });
  if (error) return { error: "Could not reset the starter chatbot." };
  revalidatePath(`/operator/tenants/${parsed.data.tenantId}`); revalidatePath(`/operator/tenants/${parsed.data.tenantId}/chatbot`);
  return { error: null, message: "Starter chatbot replaced using the tenant's selected template." };
}

export async function createIntervention(_state: OperatorActionState, formData: FormData): Promise<OperatorActionState> {
  const operator = await requirePlatformOperator();
  const parsed = z.object({ tenantId: z.uuid(), leadId: z.union([z.uuid(), z.literal("")]), conversationId: z.union([z.uuid(), z.literal("")]), reason: z.string().trim().min(1).max(2000) }).safeParse({ tenantId: String(formData.get("tenantId") ?? ""), leadId: String(formData.get("leadId") ?? ""), conversationId: String(formData.get("conversationId") ?? ""), reason: String(formData.get("reason") ?? "") });
  if (!parsed.success) return { ...initialError, error: "Enter a reason for internal intervention." };
  const { error } = await (await createClient()).from("human_interventions").insert({ tenant_id: parsed.data.tenantId, lead_id: parsed.data.leadId || null, conversation_id: parsed.data.conversationId || null, reason: parsed.data.reason, handled_by: operator.userId });
  if (error) return { error: "Could not create the intervention." };
  revalidatePath(`/operator/tenants/${parsed.data.tenantId}`); revalidatePath("/operator");
  return { error: null, message: "Internal intervention opened." };
}

export async function resolveIntervention(_state: OperatorActionState, formData: FormData): Promise<OperatorActionState> {
  const operator = await requirePlatformOperator();
  const parsed = z.object({ id: z.uuid(), notes: z.string().trim().max(5000) }).safeParse({ id: String(formData.get("id") ?? ""), notes: String(formData.get("notes") ?? "") });
  if (!parsed.success) return initialError;
  const { error } = await (await createClient()).from("human_interventions").update({ status: "resolved", resolution_notes: parsed.data.notes || null, resolved_at: new Date().toISOString(), handled_by: operator.userId }).eq("id", parsed.data.id);
  if (error) return { error: "Could not resolve the intervention." };
  revalidatePath("/operator");
  return { error: null, message: "Intervention resolved." };
}

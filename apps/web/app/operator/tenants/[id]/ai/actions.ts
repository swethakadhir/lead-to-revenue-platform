"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformOperator } from "@/lib/auth/platform-operator";
import { createClient } from "@/lib/supabase/server";
import { isValidKnowledgeDatasetReference, knowledgeBindingStatuses, type KnowledgeBindingStatus } from "@/lib/domain/ai/knowledge-binding-validation";
const schema = z.object({ tenantId: z.uuid(), enabled: z.enum(["true", "false"]), knowledgeScope: z.string().trim().min(1).max(160), datasetId: z.string().trim().max(200), bindingStatus: z.enum(knowledgeBindingStatuses) });
export async function saveTenantAIConfig(formData: FormData) {
  await requirePlatformOperator();
  const parsed = schema.safeParse({ tenantId: formData.get("tenantId"), enabled: formData.get("enabled"), knowledgeScope: formData.get("knowledgeScope"), datasetId: formData.get("datasetId") ?? "", bindingStatus: formData.get("bindingStatus") });
  if (!parsed.success) return { error: "Enter valid Dify routing and dataset binding settings." };
  const datasetId = parsed.data.datasetId || null;
  if (parsed.data.bindingStatus === "active" && (!datasetId || !isValidKnowledgeDatasetReference(datasetId))) return { error: "An active binding requires a valid Dify dataset reference." };
  const { error } = await (await createClient()).from("tenant_ai_configs").upsert({ tenant_id: parsed.data.tenantId, enabled: parsed.data.enabled === "true", knowledge_scope: parsed.data.knowledgeScope, dify_dataset_id: datasetId, knowledge_binding_status: parsed.data.bindingStatus as KnowledgeBindingStatus }, { onConflict: "tenant_id" });
  if (error) return { error: "The AI routing setting could not be saved." };
  revalidatePath(`/operator/tenants/${parsed.data.tenantId}/ai`);
  return { error: null };
}

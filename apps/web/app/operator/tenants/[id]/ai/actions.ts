"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformOperator } from "@/lib/auth/platform-operator";
import { createClient } from "@/lib/supabase/server";
const schema = z.object({ tenantId: z.uuid(), enabled: z.enum(["true", "false"]), knowledgeScope: z.string().trim().min(1).max(160) });
export async function saveTenantAIConfig(formData: FormData) { await requirePlatformOperator(); const parsed = schema.safeParse({ tenantId: formData.get("tenantId"), enabled: formData.get("enabled"), knowledgeScope: formData.get("knowledgeScope") }); if (!parsed.success) return { error: "Enter a valid tenant knowledge scope." }; const { error } = await (await createClient()).from("tenant_ai_configs").upsert({ tenant_id: parsed.data.tenantId, enabled: parsed.data.enabled === "true", knowledge_scope: parsed.data.knowledgeScope }, { onConflict: "tenant_id" }); if (error) return { error: "The AI routing setting could not be saved." }; revalidatePath(`/operator/tenants/${parsed.data.tenantId}/ai`); return { error: null }; }

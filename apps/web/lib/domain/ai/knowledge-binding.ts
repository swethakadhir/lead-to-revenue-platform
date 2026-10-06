import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { TableRow } from "@/lib/supabase/database.types";
import { resolveKnowledgeBinding, type TenantKnowledgeBinding } from "./knowledge-binding-validation";

export type { TenantKnowledgeBinding } from "./knowledge-binding-validation";

export async function resolveTenantKnowledgeBinding(tenantId: string): Promise<TenantKnowledgeBinding> {
  const { data, error } = await createAdminClient()
    .from("tenant_ai_configs")
    .select("tenant_id, enabled, provider, dify_dataset_id, knowledge_binding_status")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) return { tenantId, provider: null, datasetId: null, status: "unavailable" };
  return resolveKnowledgeBinding({ requestedTenantId: tenantId, row: data as Pick<TableRow<"tenant_ai_configs">, "tenant_id" | "enabled" | "provider" | "dify_dataset_id" | "knowledge_binding_status"> | null });
}

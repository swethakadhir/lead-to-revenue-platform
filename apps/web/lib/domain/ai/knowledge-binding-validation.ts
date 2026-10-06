export const knowledgeBindingStatuses = ["active", "inactive", "invalid", "unavailable"] as const;
export type KnowledgeBindingStatus = (typeof knowledgeBindingStatuses)[number];

export type TenantKnowledgeBinding =
  | { tenantId: string; provider: "dify"; datasetId: string; status: "active" }
  | { tenantId: string; provider: string | null; datasetId: null; status: "unavailable" };

const datasetReferencePattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

export function isValidKnowledgeDatasetReference(value: unknown): value is string {
  return typeof value === "string" && datasetReferencePattern.test(value.trim()) && value.trim() === value;
}

export function resolveKnowledgeBinding(input: {
  requestedTenantId: string;
  row: { tenant_id: string; enabled: boolean; provider: string; dify_dataset_id: string | null; knowledge_binding_status: KnowledgeBindingStatus } | null;
}): TenantKnowledgeBinding {
  const row = input.row;
  if (!row || row.tenant_id !== input.requestedTenantId || !row.enabled || row.provider !== "dify" || row.knowledge_binding_status !== "active" || !isValidKnowledgeDatasetReference(row.dify_dataset_id)) {
    return { tenantId: input.requestedTenantId, provider: row?.provider ?? null, datasetId: null, status: "unavailable" };
  }
  return { tenantId: input.requestedTenantId, provider: "dify", datasetId: row.dify_dataset_id, status: "active" };
}

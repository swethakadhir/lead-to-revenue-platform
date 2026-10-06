import assert from "node:assert/strict";
import { isValidKnowledgeDatasetReference, resolveKnowledgeBinding } from "./knowledge-binding-validation.ts";

const active = { tenant_id: "tenant-a", enabled: true, provider: "dify", dify_dataset_id: "dataset-a", knowledge_binding_status: "active" };
assert.deepEqual(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: active }), { tenantId: "tenant-a", provider: "dify", datasetId: "dataset-a", status: "active" }, "Tenant A resolves its own active dataset");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-b", row: active }).status, "unavailable", "A tenant cannot resolve another tenant's binding");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: null }).status, "unavailable", "missing binding fails closed");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: { ...active, knowledge_binding_status: "inactive" } }).status, "unavailable", "inactive binding fails closed");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: { ...active, enabled: false } }).status, "unavailable", "AI-disabled tenant fails closed");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: { ...active, provider: "other" } }).status, "unavailable", "unsupported provider fails closed");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: { ...active, dify_dataset_id: "" } }).status, "unavailable", "invalid dataset reference fails closed");
assert.equal(resolveKnowledgeBinding({ requestedTenantId: "tenant-a", row: active, datasetId: "dataset-attacker" }).datasetId, "dataset-a", "untrusted dataset input cannot override the server-side binding");
assert.equal(isValidKnowledgeDatasetReference("dataset-a"), true);
assert.equal(isValidKnowledgeDatasetReference("dataset from browser"), false, "arbitrary browser values are not valid bindings");
console.log("PASS: tenant knowledge binding validation is tenant-scoped and fail-closed");

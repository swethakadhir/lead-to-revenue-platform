import { aiUnderstandingSchema, buildDifyChatMessageBody, hasGroundedKnowledgeAnswer, isKnowledgeIntent, normalizeAIUnderstandingPayload } from "./service.ts";

function assert(value, message) { if (!value) throw new Error(message); }
const valid = aiUnderstandingSchema.safeParse({ intent: "service_enquiry", requirement: "Consultation", extracted_fields: { service: "Consultation" }, confidence: 0.9, answer: "I can help with that.", needs_more_information: true, human_intervention_required: false });
assert(valid.success, "valid structured AI output is accepted");
assert(!aiUnderstandingSchema.safeParse({ intent: "made_up", confidence: 1, extracted_fields: {} }).success, "unknown intents are rejected");
assert(!aiUnderstandingSchema.safeParse({ intent: "greeting", confidence: 2, extracted_fields: {} }).success, "invalid confidence is rejected");
const normalized = aiUnderstandingSchema.safeParse(normalizeAIUnderstandingPayload({ intent: "service_enquiry", confidence: 0.9, extracted_fields: {}, needs_more_information: "false", human_intervention_required: "true" }));
assert(normalized.success && normalized.data.needs_more_information === false && normalized.data.human_intervention_required === true, "exact Dify boolean strings are normalized safely");
assert(!aiUnderstandingSchema.safeParse(normalizeAIUnderstandingPayload({ intent: "service_enquiry", confidence: 0.9, extracted_fields: {}, needs_more_information: "not-a-boolean" })).success, "non-boolean strings remain invalid");
const request = buildDifyChatMessageBody({ tenantId: "tenant-a", conversationId: "conversation-a", message: "hello", currentNodeKey: "root", context: {}, knowledgeScope: "scope-a", datasetId: "dataset-a", configuredFields: [{ key: "service", label: "Service", fieldType: "select", options: ["A"] }] }, "understand");
assert(typeof request.inputs.configured_fields === "string" && request.inputs.configured_fields.includes("service"), "Dify text-input configured_fields is serialized as JSON text");
assert(request.user === "tenant:tenant-a:conversation:conversation-a" && request.inputs.tenant_id === "tenant-a" && request.inputs.knowledge_scope === "scope-a", "trusted tenant identity and scope drive the Dify request");
const knowledgeRequest = buildDifyChatMessageBody({ tenantId: "tenant-a", conversationId: "conversation-a", message: "where are you located?", currentNodeKey: "root", context: {}, knowledgeScope: "hint", datasetId: "dataset-a", configuredFields: [] }, "knowledge");
assert(knowledgeRequest.inputs.dataset_id === "dataset-a", "knowledge requests carry the trusted dataset binding");
assert(!buildDifyChatMessageBody({ tenantId: "tenant-a", conversationId: "conversation-a", message: "hello", currentNodeKey: "root", context: {}, knowledgeScope: "hint", datasetId: "dataset-a", configuredFields: [] }, "understand").inputs.dataset_id, "understand requests do not use dataset routing");
assert(isKnowledgeIntent("business_information") && isKnowledgeIntent("pricing_question") && isKnowledgeIntent("service_enquiry"), "informational intents use the knowledge route");
assert(!isKnowledgeIntent("booking_request"), "booking intent remains deterministic/structured");
assert(hasGroundedKnowledgeAnswer({ intent: "business_information", confidence: 0.9, answer: "We are open today.", knowledge_answer_available: true }), "grounded knowledge answers are accepted");
assert(!hasGroundedKnowledgeAnswer({ intent: "business_information", confidence: 0.9, answer: "Maybe.", knowledge_answer_available: false }), "unavailable knowledge is not presented as grounded");
console.log("PASS: structured AI output validation rejects malformed/untrusted results");

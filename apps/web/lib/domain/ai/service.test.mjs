import { aiUnderstandingSchema } from "./service.ts";

function assert(value, message) { if (!value) throw new Error(message); }
const valid = aiUnderstandingSchema.safeParse({ intent: "service_enquiry", requirement: "Consultation", extracted_fields: { service: "Consultation" }, confidence: 0.9, answer: "I can help with that.", needs_more_information: true, human_intervention_required: false });
assert(valid.success, "valid structured AI output is accepted");
assert(!aiUnderstandingSchema.safeParse({ intent: "made_up", confidence: 1, extracted_fields: {} }).success, "unknown intents are rejected");
assert(!aiUnderstandingSchema.safeParse({ intent: "greeting", confidence: 2, extracted_fields: {} }).success, "invalid confidence is rejected");
console.log("PASS: structured AI output validation rejects malformed/untrusted results");

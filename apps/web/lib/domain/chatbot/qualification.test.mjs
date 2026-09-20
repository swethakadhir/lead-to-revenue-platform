import { evaluateQualification } from "./qualification.ts";
function assert(value, message) { if (!value) throw new Error(message); }
const rules = [{ is_active: true, is_required: true, rule_type: "presence", field_key: "service", score_delta: 30 }, { is_active: true, is_required: true, rule_type: "contact_details", field_key: "contact", score_delta: 20 }];
const pending = evaluateQualification(rules, { service: "Consultation" });
assert(pending.qualificationStatus === "pending" && pending.missingFieldKeys.includes("contact"), "deterministic rules identify missing contact data");
const qualified = evaluateQualification(rules, { service: "Consultation", phone: "+919999999999" });
assert(qualified.qualificationStatus === "qualified" && qualified.score === 50, "deterministic rules own qualification scoring");
console.log("PASS: qualification is deterministic and configuration-driven");

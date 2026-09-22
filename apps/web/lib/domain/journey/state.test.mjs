import { bookingReady, retryDelaySeconds, stageForLead } from "./state.ts";
function assert(value, message) { if (!value) throw new Error(message); }
assert(stageForLead("new") === "requirement_understanding" && stageForLead("qualifying") === "qualification", "lead lifecycle maps to durable journey stages");
assert(stageForLead("converted") === "converted", "only converted lifecycle is a conversion journey stage");
assert(!bookingReady("pending") && bookingReady("qualified"), "booking intent is gated by deterministic qualification");
assert(retryDelaySeconds(1) === 60 && retryDelaySeconds(7) === 3600, "retry backoff is bounded and deterministic");
console.log("PASS: journey lifecycle, booking readiness, and retry policy are deterministic");

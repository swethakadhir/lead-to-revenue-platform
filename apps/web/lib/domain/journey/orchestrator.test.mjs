import { evaluateLeadJourney, followUpPolicyFromConfig } from "./orchestrator.ts";

function assert(value, message) { if (!value) throw new Error(message); }
const now = "2026-09-23T09:00:00.000Z";
const fields = [{ key: "requirement", label: "Requirement", required: true, is_active: true }, { key: "budget", label: "Budget", required: false, is_active: true }];
const rules = [{ is_active: true, is_required: true, rule_type: "presence", field_key: "requirement", score_delta: 30 }, { is_active: true, is_required: true, rule_type: "contact_details", field_key: "contact", score_delta: 20 }];
const base = { lead: { status: "qualifying", qualification_status: "pending", lead_data: {}, updated_at: now }, fields, rules, qualification: { qualificationStatus: "pending", score: 0, missingFieldKeys: ["requirement", "contact"] }, contact: { phone: null, email: null }, hasActiveAppointment: false, hasConfirmedAppointment: false, interventionOpen: false, pendingAutomatedFollowUp: false, completedAutomatedFollowUps: 0, lastMeaningfulActivityAt: now, policy: { delay_days: 2, max_attempts: 3 } };

const missing = evaluateLeadJourney(base);
assert(missing.stage === "requirement_understanding" && missing.nextAction === "understand_requirement" && missing.missingInformation.some((item) => item.key === "requirement"), "missing configured requirement stays in requirement understanding");
const qualifyingInput = { ...base, lead: { ...base.lead, lead_data: { requirement: "Consultation" } }, qualification: { qualificationStatus: "qualified", score: 50, missingFieldKeys: [] }, contact: { phone: "+919999999999", email: null } };
const qualifying = evaluateLeadJourney(qualifyingInput);
assert(qualifying.stage === "qualification" && qualifying.nextAction === "offer_booking" && !qualifying.bookingReady, "deterministic qualification is distinct from booking intent");
const staleProjectionInput = { ...base, lead: { ...base.lead, status: "new", qualification_status: "qualified", lead_data: { requirement: "Consultation" } }, qualification: { qualificationStatus: "qualified", score: 50, missingFieldKeys: [] }, contact: { phone: "+919999999999", email: null } };
const staleProjection = evaluateLeadJourney(staleProjectionInput);
assert(staleProjection.stage === "qualification" && staleProjection.nextAction === "offer_booking" && staleProjection.missingInformation.length === 0 && !staleProjection.bookingReady, "qualified new lead with no missing data remains qualification-stage until booking intent");
const bookingInput = { ...base, lead: { ...base.lead, status: "booking_ready", lead_data: { requirement: "Consultation" } }, qualification: { qualificationStatus: "qualified", score: 50, missingFieldKeys: [] }, contact: { phone: "+919999999999", email: null } };
const booking = evaluateLeadJourney(bookingInput);
assert(booking.stage === "booking_ready" && booking.bookingReady, "qualified booking intent is booking ready, not converted");
const inProgress = evaluateLeadJourney({ ...bookingInput, hasActiveAppointment: true });
assert(inProgress.stage === "booking_in_progress" && inProgress.nextAction === "continue_booking", "unconfirmed appointment does not convert");
const converted = evaluateLeadJourney({ ...bookingInput, hasConfirmedAppointment: true });
assert(converted.stage === "converted" && !converted.shouldScheduleFollowUp && converted.nextAction === "none", "confirmed appointment converts and stops automation");
const intervention = evaluateLeadJourney({ ...qualifyingInput, interventionOpen: true });
assert(intervention.blockedByIntervention && intervention.nextAction === "await_human_intervention" && !intervention.shouldScheduleFollowUp, "open intervention pauses ordinary follow-up without discarding qualification");
const eligibleInput = { ...base, lead: { ...base.lead, lead_data: { requirement: "Consultation" } }, contact: { phone: null, email: null } };
const eligible = evaluateLeadJourney(eligibleInput);
assert(eligible.shouldScheduleFollowUp && eligible.followUpDueAt === "2026-09-25T09:00:00.000Z", "inactive eligible lead receives one configurable delayed follow-up");
const duplicate = evaluateLeadJourney({ ...eligibleInput, pendingAutomatedFollowUp: true });
assert(duplicate.stage === "follow_up" && !duplicate.shouldScheduleFollowUp, "re-evaluation with a pending automated follow-up preserves follow-up state without a duplicate");
const exhausted = evaluateLeadJourney({ ...eligibleInput, completedAutomatedFollowUps: 3 });
assert(exhausted.stage === "dormant" && !exhausted.shouldScheduleFollowUp, "finite follow-up policy stops at its configured maximum");
const disqualified = evaluateLeadJourney({ ...eligibleInput, lead: { ...eligibleInput.lead, status: "disqualified" } });
assert(disqualified.stage === "disqualified" && !disqualified.shouldScheduleFollowUp, "disqualified leads do not receive ordinary follow-ups");
const policy = followUpPolicyFromConfig({ delay_days: 3, max_attempts: 2, enabled: false });
assert(policy.delayDays === 3 && policy.maxAttempts === 2 && !policy.enabled, "tenant policy is data-driven and preserves configured values");
console.log("PASS: deterministic journey orchestration and configurable follow-up policy");

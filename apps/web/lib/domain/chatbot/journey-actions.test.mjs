import { journeyConversationState, looksLikeBookingRequest, looksLikeCustomerQuestion, selectJourneyConversationAction, withJourneyConversationState } from "./journey-actions.ts";
import { validateDynamicJsonValue } from "../configuration/dynamic-fields.ts";

function assert(value, message) { if (!value) throw new Error(message); }
const fields = [
  { key: "service", label: "Service", field_type: "select", help_text: null, is_active: true, sort_order: 10 },
  { key: "location", label: "Location", field_type: "text", help_text: null, is_active: true, sort_order: 20 },
];
const base = { stage: "qualification", nextAction: "collect_missing_information", missingInformation: [{ key: "service", label: "Service" }, { key: "location", label: "Location" }], qualificationState: "pending", bookingReady: false, blockedByIntervention: false, shouldScheduleFollowUp: false, followUpDueAt: null, followUpPolicy: {}, reason: "missing" };
const first = selectJourneyConversationAction({ decision: base, fields, state: { pendingFieldKey: null, bookingIntent: false } });
assert(first.type === "ask_question" && first.field.key === "service", "the first configured missing field is selected deterministically");
const skipped = selectJourneyConversationAction({ decision: { ...base, missingInformation: [{ key: "location", label: "Location" }] }, fields, state: { pendingFieldKey: "service", bookingIntent: false } });
assert(skipped.type === "ask_question" && skipped.field.key === "location", "known fields are skipped for the next configured question");
const booking = selectJourneyConversationAction({ decision: { ...base, bookingReady: true, missingInformation: [] }, fields, state: { pendingFieldKey: null, bookingIntent: true } });
assert(booking.type === "booking_handoff", "only a deterministic booking-ready decision reaches handoff");
const blocked = selectJourneyConversationAction({ decision: { ...base, blockedByIntervention: true }, fields, state: { pendingFieldKey: "service", bookingIntent: false } });
assert(blocked.type === "acknowledge_intervention", "open intervention pauses automated progression");
const resumed = selectJourneyConversationAction({ decision: { ...base, missingInformation: [{ key: "location", label: "Location" }], blockedByIntervention: false }, fields, state: { pendingFieldKey: "service", bookingIntent: false } });
assert(resumed.type === "ask_question" && resumed.field.key === "location", "resolved intervention resumes from the remaining configured field");
const context = withJourneyConversationState({}, { pendingFieldKey: "location", bookingIntent: true });
assert(journeyConversationState(context).pendingFieldKey === "location" && journeyConversationState(context).bookingIntent, "pending question and validated booking intent persist in conversation context");
assert(looksLikeCustomerQuestion("Before that, what does it cost?") && looksLikeBookingRequest("Can I book tomorrow?"), "detours and booking language route before field capture");
const configuredSelect = { id: "service", tenant_id: "tenant-a", key: "service", label: "Service", field_type: "select", required: true, options: ["Consultation"], placeholder: null, help_text: null, sort_order: 10, is_active: true, qualification_relevant: true, created_at: "", updated_at: "" };
assert(validateDynamicJsonValue(configuredSelect, "Consultation").value === "Consultation", "validated AI or customer answers can satisfy configured pending fields");
assert(Boolean(validateDynamicJsonValue(configuredSelect, "Unconfigured service").error), "invalid extracted values cannot satisfy a configured pending field");
console.log("PASS: deterministic journey question selection and persisted resume state");

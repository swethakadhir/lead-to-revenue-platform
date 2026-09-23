import type { Json, TableRow } from "../../supabase/database.types";
import type { JourneyStage } from "./state";

export type FollowUpPolicy = {
  enabled: boolean;
  delayDays: number;
  maxAttempts: number;
  stopOnCustomerReply: boolean;
  stopOnQualification: boolean;
  stopOnBooking: boolean;
  stopOnConversion: boolean;
  stopWhileInterventionOpen: boolean;
};

export type JourneyDecision = {
  stage: JourneyStage;
  nextAction: "understand_requirement" | "collect_missing_information" | "continue_qualification" | "follow_up" | "offer_booking" | "continue_booking" | "await_human_intervention" | "none";
  missingInformation: { key: string; label: string }[];
  qualificationState: "pending" | "qualified" | "disqualified";
  bookingReady: boolean;
  blockedByIntervention: boolean;
  shouldScheduleFollowUp: boolean;
  followUpDueAt: string | null;
  followUpPolicy: FollowUpPolicy;
  reason: string;
};

type Lead = Pick<TableRow<"leads">, "status" | "qualification_status" | "lead_data" | "updated_at">;
type Input = {
  lead: Lead;
  fields: Pick<TableRow<"lead_field_definitions">, "key" | "label" | "required" | "is_active">[];
  rules: TableRow<"qualification_rules">[];
  qualification: { qualificationStatus: "pending" | "qualified"; score: number; missingFieldKeys: string[] };
  contact: Pick<TableRow<"contacts">, "email" | "phone"> | null;
  hasActiveAppointment: boolean;
  hasConfirmedAppointment: boolean;
  interventionOpen: boolean;
  pendingAutomatedFollowUp: boolean;
  completedAutomatedFollowUps: number;
  bookingIntent?: boolean;
  lastMeaningfulActivityAt: string | null;
  policy: Json;
};

const DEFAULT_POLICY: FollowUpPolicy = { enabled: true, delayDays: 1, maxAttempts: 3, stopOnCustomerReply: true, stopOnQualification: true, stopOnBooking: true, stopOnConversion: true, stopWhileInterventionOpen: true };
const valuePresent = (value: Json | undefined) => value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
const object = (value: Json): Record<string, Json | undefined> => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const bool = (value: Json | undefined, fallback: boolean) => typeof value === "boolean" ? value : fallback;
const integer = (value: Json | undefined, fallback: number, min: number, max: number) => typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;

export function followUpPolicyFromConfig(value: Json): FollowUpPolicy {
  const policy = object(value);
  return {
    enabled: bool(policy.enabled, DEFAULT_POLICY.enabled),
    // `delay_days` is the existing template setting; `delay_days` remains the
    // external JSON contract while this domain model uses a clear TS name.
    delayDays: integer(policy.delay_days, DEFAULT_POLICY.delayDays, 1, 30),
    maxAttempts: integer(policy.max_attempts, DEFAULT_POLICY.maxAttempts, 1, 10),
    stopOnCustomerReply: bool(policy.stop_on_customer_reply, DEFAULT_POLICY.stopOnCustomerReply),
    stopOnQualification: bool(policy.stop_on_qualification, DEFAULT_POLICY.stopOnQualification),
    stopOnBooking: bool(policy.stop_on_booking, DEFAULT_POLICY.stopOnBooking),
    stopOnConversion: bool(policy.stop_on_conversion, DEFAULT_POLICY.stopOnConversion),
    stopWhileInterventionOpen: bool(policy.stop_while_intervention_open, DEFAULT_POLICY.stopWhileInterventionOpen),
  };
}

export function evaluateLeadJourney(input: Input): JourneyDecision {
  const policy = followUpPolicyFromConfig(input.policy);
  const leadData = object(input.lead.lead_data);
  const qualification = input.qualification;
  const requiredFields = input.fields.filter((field) => field.is_active && field.required && !valuePresent(leadData[field.key]));
  const byKey = new Map(input.fields.map((field) => [field.key, field.label]));
  const missingKeys = [...new Set([...requiredFields.map((field) => field.key), ...qualification.missingFieldKeys])];
  const missingInformation = missingKeys.map((key) => ({ key, label: byKey.get(key) ?? (key === "contact" ? "Contact details" : key.replaceAll("_", " ")) }));
  const terminal = input.hasConfirmedAppointment || input.lead.status === "converted" ? "converted" : input.lead.status === "disqualified" ? "disqualified" : input.lead.status === "dormant" ? "dormant" : null;
  const qualificationState: JourneyDecision["qualificationState"] = terminal === "disqualified" ? "disqualified" : qualification.qualificationStatus;
  const bookingInProgress = !terminal && (input.hasActiveAppointment || input.lead.status === "booking_in_progress");
  const bookingReady = !terminal && !bookingInProgress && qualificationState === "qualified" && (input.lead.status === "booking_ready" || input.bookingIntent === true);
  let stage: JourneyStage = terminal ?? (bookingInProgress ? "booking_in_progress" : bookingReady ? "booking_ready" : missingInformation.length ? "requirement_understanding" : "qualification");
  let nextAction: JourneyDecision["nextAction"] = stage === "converted" || stage === "disqualified" || stage === "dormant" ? "none" : stage === "booking_in_progress" ? "continue_booking" : stage === "booking_ready" ? "offer_booking" : stage === "requirement_understanding" ? "understand_requirement" : qualificationState === "qualified" ? "offer_booking" : missingInformation.length ? "collect_missing_information" : "continue_qualification";
  if (input.pendingAutomatedFollowUp && (stage === "requirement_understanding" || stage === "qualification")) {
    stage = "follow_up";
    nextAction = "follow_up";
  }
  if (input.interventionOpen) nextAction = "await_human_intervention";

  const policyStops = !policy.enabled || (qualificationState === "qualified" && policy.stopOnQualification) || ((stage === "booking_ready" || stage === "booking_in_progress") && policy.stopOnBooking) || (stage === "converted" && policy.stopOnConversion) || (input.interventionOpen && policy.stopWhileInterventionOpen);
  const exhausted = input.completedAutomatedFollowUps >= policy.maxAttempts;
  if (!terminal && exhausted && !input.interventionOpen && !bookingInProgress && !bookingReady) {
    stage = "dormant";
    nextAction = "none";
  }
  const activeStage = stage === "requirement_understanding" || stage === "qualification";
  const shouldScheduleFollowUp = activeStage && !policyStops && !exhausted && !input.pendingAutomatedFollowUp;
  const activity = input.lastMeaningfulActivityAt ? new Date(input.lastMeaningfulActivityAt) : new Date(input.lead.updated_at);
  const followUpDueAt = shouldScheduleFollowUp && !Number.isNaN(activity.valueOf()) ? new Date(activity.valueOf() + policy.delayDays * 86_400_000).toISOString() : null;
  return { stage, nextAction, missingInformation, qualificationState, bookingReady, blockedByIntervention: input.interventionOpen, shouldScheduleFollowUp, followUpDueAt, followUpPolicy: policy, reason: input.interventionOpen ? "An open internal intervention pauses ordinary automation." : exhausted ? "The configured automated follow-up limit has been reached." : terminal ? "The lead is in a terminal journey state." : bookingInProgress ? "An active appointment is handling booking." : bookingReady ? "Deterministic qualification and booking intent allow booking." : missingInformation.length ? "Required configured information is still missing." : shouldScheduleFollowUp ? "The lead is eligible for one inactivity follow-up." : "The existing journey state remains current." };
}

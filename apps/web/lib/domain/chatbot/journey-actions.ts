import type { Json, TableRow } from "@/lib/supabase/database.types";
import type { JourneyDecision } from "@/lib/domain/journey/orchestrator";

export const journeyContextKey = "_journey";
export type JourneyConversationState = { pendingFieldKey: string | null; bookingIntent: boolean };
export type JourneyConversationAction =
  | { type: "ask_question"; field: Pick<TableRow<"lead_field_definitions">, "key" | "label" | "field_type" | "help_text">; message: string }
  | { type: "acknowledge_intervention"; message: string }
  | { type: "booking_handoff"; message: string }
  | { type: "complete_for_now"; message: string };

type Context = Record<string, Json | undefined>;
type Field = Pick<TableRow<"lead_field_definitions">, "key" | "label" | "field_type" | "help_text" | "is_active" | "sort_order">;

function object(value: Json | undefined): Context { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }

export function journeyConversationState(context: Context): JourneyConversationState {
  const raw = object(context[journeyContextKey]);
  return { pendingFieldKey: typeof raw.pending_field_key === "string" ? raw.pending_field_key : null, bookingIntent: raw.booking_intent === true };
}

export function withJourneyConversationState(context: Context, state: Partial<JourneyConversationState>): Context {
  const current = journeyConversationState(context);
  return { ...context, [journeyContextKey]: { pending_field_key: state.pendingFieldKey === undefined ? current.pendingFieldKey : state.pendingFieldKey, booking_intent: state.bookingIntent === undefined ? current.bookingIntent : state.bookingIntent } };
}

function questionFor(field: Field) {
  if (field.help_text) return field.help_text;
  if (field.field_type === "select" || field.field_type === "multi_select" || field.field_type === "boolean") return `Please share your ${field.label.toLowerCase()}.`;
  return `What is your ${field.label.toLowerCase()}?`;
}

export function selectJourneyConversationAction(input: { decision: JourneyDecision; fields: Field[]; state: JourneyConversationState }): JourneyConversationAction {
  if (input.decision.blockedByIntervention) return { type: "acknowledge_intervention", message: "Thanks for your message. Our team is reviewing this and will be in touch." };
  if (input.decision.bookingReady) return { type: "booking_handoff", message: "You are ready to arrange a booking. Our team will help with the next step." };
  const missing = new Set(input.decision.missingInformation.map((item) => item.key));
  const field = [...input.fields].filter((item) => item.is_active && missing.has(item.key)).sort((a, b) => a.sort_order - b.sort_order)[0];
  if (field) return { type: "ask_question", field, message: questionFor(field) };
  return { type: "complete_for_now", message: input.state.bookingIntent ? "Thanks — we have the information needed to continue your booking request." : "Thanks — we have the information needed for now." };
}

export function looksLikeCustomerQuestion(text: string) {
  return /\?|^(what|when|where|why|how|can|could|do|does|is|are|will|would)\b|\b(price|pricing|cost|fee|hours)\b/i.test(text.trim());
}

export function looksLikeBookingRequest(text: string) {
  return /\b(book|booking|appointment|schedule|availability|available|come tomorrow)\b/i.test(text);
}

import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TableRow } from "@/lib/supabase/database.types";
import { acceptsCaptureInput, initialMenuBookingEntry, isConfiguredBookingSelection, isPublicWidgetAvailable, isStaleMenuTransition } from "./policy";
import { getAIService } from "@/lib/domain/ai";
import { fieldOptions, validateDynamicJsonValue } from "@/lib/domain/configuration/dynamic-fields";
import { evaluateQualification } from "./qualification";
import { bookingReady } from "@/lib/domain/journey/state";
import { recordLeadInboundActivity, syncLeadJourney } from "@/lib/domain/journey/orchestration";
import { journeyConversationState, looksLikeBookingRequest, looksLikeCustomerQuestion, selectJourneyConversationAction, withJourneyConversationState } from "./journey-actions";

function routerDiagnostic(event: string, details: Record<string, string | boolean> = {}) {
  if (process.env.NODE_ENV === "development") console.info("[ChatbotRouter]", event, details);
}

type Config = TableRow<"chatbot_configs">;
type Node = TableRow<"chatbot_nodes">;
type Edge = TableRow<"chatbot_edges">;
type Context = Record<string, Json | undefined>;
export type ChatView = { conversationId: string; assistantName: string; node: { key: string; type: string; content: string; captureType: string | null }; options: { id: string; label: string }[]; messages: { sender: string; content: string }[]; status: string; branding: Json; routeHint?: "RAG_REQUIRED" | "AI_UNAVAILABLE" };

export const publicChatInput = z.object({
  widgetId: z.uuid(), sessionId: z.uuid(),
  action: z.enum(["start", "select", "text", "restart"]),
  edgeId: z.uuid().optional(), text: z.string().trim().max(1000).optional(),
});

function asContext(value: Json): Context { return value && typeof value === "object" && !Array.isArray(value) ? value : {}; }
function publicConfigFilter(widgetId: string) { return { widgetId }; }

async function resolvePublicConfig(widgetId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("chatbot_configs").select("*").eq("widget_id", publicConfigFilter(widgetId).widgetId).maybeSingle();
  if (error || !data || !isPublicWidgetAvailable(data.status, data.enabled)) return null;
  return data as Config;
}

async function graph(config: Config) {
  const admin = createAdminClient();
  const [{ data: nodes, error: nodeError }, { data: edges, error: edgeError }] = await Promise.all([
    admin.from("chatbot_nodes").select("*").eq("chatbot_config_id", config.id).eq("tenant_id", config.tenant_id),
    admin.from("chatbot_edges").select("*").eq("chatbot_config_id", config.id).eq("tenant_id", config.tenant_id).order("display_order"),
  ]);
  if (nodeError || edgeError) throw nodeError ?? edgeError;
  return { nodes: (nodes ?? []) as Node[], edges: (edges ?? []) as Edge[] };
}

function optionsFor(edges: Edge[], nodeId: string) { return edges.filter((edge) => edge.source_node_id === nodeId && !edge.is_default).map((edge) => ({ id: edge.id, label: edge.label })); }

async function view(config: Config, conversation: TableRow<"conversations">, nodes: Node[], edges: Edge[], messages: { sender_type: string; content: string }[], routeHint?: "RAG_REQUIRED" | "AI_UNAVAILABLE"): Promise<ChatView> {
  const node = nodes.find((item) => item.id === conversation.current_node_id) ?? nodes.find((item) => item.id === config.root_node_id);
  if (!node) throw new Error("The chatbot flow has no root node.");
  return { conversationId: conversation.id, assistantName: config.name, node: { key: node.key, type: node.node_type, content: node.content, captureType: node.capture_type }, options: optionsFor(edges, node.id), messages: messages.map((message) => ({ sender: message.sender_type, content: message.content })), status: conversation.status, branding: config.branding, routeHint };
}

async function append(tenantId: string, conversationId: string, nodeId: string | null, sender: "visitor" | "bot" | "system", type: "text" | "option" | "capture" | "fallback" | "action_placeholder", content: string, metadata: Json = {}) {
  const { error } = await createAdminClient().from("conversation_messages").insert({ tenant_id: tenantId, conversation_id: conversationId, node_id: nodeId, sender_type: sender, message_type: type, content, metadata });
  if (error) throw error;
}

async function readMessages(conversationId: string) {
  const { data, error } = await createAdminClient().from("conversation_messages").select("sender_type, content").eq("conversation_id", conversationId).order("created_at").limit(100);
  if (error) throw error;
  return data ?? [];
}

async function latestConversation(config: Config, conversationId: string) {
  const { data, error } = await createAdminClient().from("conversations").select("*").eq("tenant_id", config.tenant_id).eq("id", conversationId).maybeSingle();
  if (error || !data) throw error ?? new Error("Conversation not found.");
  return data as TableRow<"conversations">;
}

async function advanceMenuTransition(config: Config, conversation: TableRow<"conversations">, current: Node, destination: Node, context: Context) {
  const { data, error } = await createAdminClient().from("conversations").update({ current_node_id: destination.id, context, last_activity_at: new Date().toISOString(), status: destination.node_type === "end" ? "ended" : "active" }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).eq("current_node_id", current.id).select("*").maybeSingle();
  if (error) throw error;
  if (data) return { conversation: data as TableRow<"conversations">, applied: true };
  const latest = await latestConversation(config, conversation.id);
  if (isStaleMenuTransition(current.id, latest.current_node_id)) return { conversation: latest, applied: false };
  throw new Error("Conversation transition was not applied.");
}

function validCapture(node: Node, text: string) {
  if (node.capture_type === "name") return text.length >= 1 && text.length <= 100;
  if (node.capture_type === "phone") return text.replace(/\D/g, "").length >= 6;
  if (node.capture_type === "email") return !text || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
  return text.length > 0;
}

async function maybeCreateLead(config: Config, conversation: TableRow<"conversations">, context: Context) {
  if (!config.lead_capture_enabled || conversation.lead_id || !context.first_name || !context.phone) return conversation;
  const admin = createAdminClient();
  const phone = String(context.phone).trim(); const email = typeof context.email === "string" && context.email ? context.email.trim().toLowerCase() : null;
  const { data: existing } = await admin.from("contacts").select("id").eq("tenant_id", config.tenant_id).or(email ? `email.ilike.${email},phone.eq.${phone}` : `phone.eq.${phone}`).limit(1).maybeSingle();
  let contactId = existing?.id;
  if (!contactId) {
    const { data, error } = await admin.from("contacts").insert({ tenant_id: config.tenant_id, first_name: String(context.first_name).trim(), phone, email, metadata: { source: "website_chatbot" } }).select("id").single();
    if (error || !data) throw error ?? new Error("Contact creation failed"); contactId = data.id;
  }
  const { data: fields, error: fieldError } = await admin.from("lead_field_definitions").select("*").eq("tenant_id", config.tenant_id).eq("is_active", true);
  if (fieldError) throw fieldError;
  const leadData: Context = {};
  for (const field of fields ?? []) if (context[field.key] !== undefined) leadData[field.key] = context[field.key];
  const { data: rules, error: rulesError } = await admin.from("qualification_rules").select("*").eq("tenant_id", config.tenant_id).eq("is_active", true);
  if (rulesError) throw rulesError;
  const qualification = evaluateQualification((rules ?? []) as TableRow<"qualification_rules">[], context);
  const { data: lead, error: leadError } = await admin.from("leads").insert({ tenant_id: config.tenant_id, contact_id: contactId, lead_data: leadData, status: qualification.qualificationStatus === "qualified" ? "qualified" : "qualifying", qualification_status: qualification.qualificationStatus, qualification_score: qualification.score }).select("id").single();
  if (leadError || !lead) throw leadError ?? new Error("Lead creation failed");
  const { data: updated, error: updateError } = await admin.from("conversations").update({ contact_id: contactId, lead_id: lead.id, context, last_activity_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single();
  if (updateError || !updated) throw updateError ?? new Error("Conversation association failed");
  const { error: journeyError } = await admin.from("lead_journeys").update({ conversation_id: conversation.id }).eq("tenant_id", config.tenant_id).eq("lead_id", lead.id);
  if (journeyError) throw journeyError;
  return updated as TableRow<"conversations">;
}

async function applyValidatedAIResult(config: Config, conversation: TableRow<"conversations">, current: Node, text: string) {
  const admin = createAdminClient();
  const [{ data: aiConfig, error: aiConfigError }, { data: fields, error: fieldsError }] = await Promise.all([
    admin.from("tenant_ai_configs").select("*").eq("tenant_id", config.tenant_id).eq("enabled", true).maybeSingle(),
    admin.from("lead_field_definitions").select("*").eq("tenant_id", config.tenant_id).eq("is_active", true),
  ]);
  if (aiConfigError || fieldsError) throw aiConfigError ?? fieldsError;
  if (!aiConfig) {
    routerDiagnostic("AI fallback used", { reason: "tenant_ai_disabled" });
    await append(config.tenant_id, conversation.id, current.id, "bot", "fallback", config.fallback_message, { route: "ai_unconfigured", provider: "none" });
    return { conversation, routeHint: "AI_UNAVAILABLE" as const };
  }
  const context = asContext(conversation.context);
  routerDiagnostic("AI route selected", { tenant_scoped: true, capture_state: false });
  const result = await getAIService().understandMessage({ tenantId: config.tenant_id, conversationId: conversation.id, message: text, currentNodeKey: current.key, context, knowledgeScope: aiConfig.knowledge_scope, configuredFields: (fields ?? []).map((field) => ({ key: field.key, label: field.label, fieldType: field.field_type, options: fieldOptions(field) })) });
  if (!result.ok) {
    routerDiagnostic("AI fallback used", { reason: result.category });
    await append(config.tenant_id, conversation.id, current.id, "bot", "fallback", config.fallback_message, { route: "ai_failure", provider: result.provider, failure_category: result.category });
    return { conversation, routeHint: "AI_UNAVAILABLE" as const };
  }
  const accepted: Context = {};
  for (const field of fields ?? []) {
    const parsed = validateDynamicJsonValue(field, result.result.extracted_fields[field.key]);
    if (!parsed.error && parsed.value !== undefined) accepted[field.key] = parsed.value;
  }
  const requirement = result.result.requirement;
  if (requirement && (fields ?? []).some((field) => field.key === "requirement")) accepted.requirement = requirement;
  const nextContext = withJourneyConversationState({ ...context, ...accepted }, { bookingIntent: result.result.intent === "booking_request" ? true : undefined });
  const { data: rules, error: rulesError } = await admin.from("qualification_rules").select("*").eq("tenant_id", config.tenant_id).eq("is_active", true);
  if (rulesError) throw rulesError;
  const qualification = evaluateQualification((rules ?? []) as TableRow<"qualification_rules">[], nextContext);
  const updates: { context: Context; last_activity_at: string; status?: string } = { context: nextContext, last_activity_at: new Date().toISOString() };
  let status = conversation.status;
  const intervention = result.result.human_intervention_required || result.result.intent === "human_request";
  if (intervention) { status = "handoff"; updates.status = status; }
  const { data: updated, error: updateError } = await admin.from("conversations").update(updates).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single();
  if (updateError || !updated) throw updateError ?? new Error("Conversation update failed");
  if (conversation.lead_id) {
    const { data: lead, error: leadError } = await admin.from("leads").select("lead_data").eq("id", conversation.lead_id).eq("tenant_id", config.tenant_id).single();
    if (leadError || !lead) throw leadError ?? new Error("Lead not found");
    // Intent is not authority: booking readiness requires configured qualification rules.
    const leadStatus = intervention ? "human_intervention" : result.result.intent === "booking_request" && bookingReady(qualification.qualificationStatus) ? "booking_ready" : qualification.qualificationStatus === "qualified" ? "qualified" : "qualifying";
    const { error: leadUpdateError } = await admin.from("leads").update({ lead_data: { ...asContext(lead.lead_data), ...accepted }, status: leadStatus, qualification_status: qualification.qualificationStatus, qualification_score: qualification.score }).eq("id", conversation.lead_id).eq("tenant_id", config.tenant_id);
    if (leadUpdateError) throw leadUpdateError;
  }
  if (intervention) {
    const { data: existing, error: existingError } = await admin.from("human_interventions").select("id").eq("tenant_id", config.tenant_id).eq("conversation_id", conversation.id).in("status", ["open", "in_progress"]).maybeSingle();
    if (existingError) throw existingError;
    if (!existing) { const { error: interventionError } = await admin.from("human_interventions").insert({ tenant_id: config.tenant_id, conversation_id: conversation.id, lead_id: conversation.lead_id, contact_id: conversation.contact_id, reason: result.result.human_intervention_reason || "Customer requested human assistance." }); if (interventionError) throw interventionError; }
  }
  const response = result.result.answer || result.result.suggested_next_question || config.fallback_message;
  await append(config.tenant_id, conversation.id, current.id, "bot", "text", response, { route: intervention ? "human_intervention" : "ai_understanding", intent: result.result.intent, confidence: result.result.confidence, requirement: requirement ?? null, provider: result.provider, mapped_field_keys: Object.keys(accepted), missing_field_keys: qualification.missingFieldKeys });
  return { conversation: updated as TableRow<"conversations">, routeHint: undefined };
}

async function enter(config: Config, conversation: TableRow<"conversations">, destination: Node, context: Context, nodes: Node[], edges: Edge[], alreadyAtDestination = false) {
  const admin = createAdminClient();
  let current = destination;
  let updated = conversation;
  // Answer/message nodes can advance via a default edge; a cap prevents malformed loops.
  for (let step = 0; step < 8; step += 1) {
    if (!alreadyAtDestination || step > 0) {
      const { data, error } = await admin.from("conversations").update({ current_node_id: current.id, context, last_activity_at: new Date().toISOString(), status: current.node_type === "end" ? "ended" : "active" }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single();
      if (error || !data) throw error ?? new Error("Conversation transition failed.");
      updated = data as TableRow<"conversations">;
    }
    const content = current.node_type === "end" ? config.confirmation_message || current.content : current.content;
    await append(config.tenant_id, updated.id, current.id, "bot", current.node_type === "action_placeholder" ? "action_placeholder" : "text", content);
    if (current.node_type === "end") {
      updated = await maybeCreateLead(config, updated, context);
      if (updated.lead_id) {
        const { data, error } = await admin.from("conversations").update({ status: "active", ended_at: null }).eq("id", updated.id).eq("tenant_id", config.tenant_id).select("*").single();
        if (error || !data) throw error ?? new Error("Conversation continuation failed");
        updated = data as TableRow<"conversations">;
      }
      break;
    }
    const next = edges.find((edge) => edge.source_node_id === current.id && edge.is_default);
    if (!next || !["message", "answer"].includes(current.node_type)) break;
    const nextNode = nodes.find((node) => node.id === next.destination_node_id); if (!nextNode) break;
    current = nextNode;
  }
  return updated;
}

async function activeJourneyFields(tenantId: string) {
  const { data, error } = await createAdminClient().from("lead_field_definitions").select("*").eq("tenant_id", tenantId).eq("is_active", true);
  if (error) throw error;
  return data ?? [];
}

async function advanceJourneyConversation(config: Config, conversation: TableRow<"conversations">, nodeId: string | null) {
  if (!conversation.lead_id) return conversation;
  const [decision, fields] = await Promise.all([syncLeadJourney(config.tenant_id, conversation.lead_id, "lead_updated"), activeJourneyFields(config.tenant_id)]);
  if (!decision) return conversation;
  const context = asContext(conversation.context);
  const action = selectJourneyConversationAction({ decision, fields, state: journeyConversationState(context) });
  let nextContext = context;
  if (action.type === "ask_question") nextContext = withJourneyConversationState(context, { pendingFieldKey: action.field.key });
  else if (action.type === "booking_handoff" || action.type === "complete_for_now") nextContext = withJourneyConversationState(context, { pendingFieldKey: null });
  const { data, error } = await createAdminClient().from("conversations").update({ context: nextContext, status: action.type === "acknowledge_intervention" ? "handoff" : "active", last_activity_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single();
  if (error || !data) throw error ?? new Error("Journey continuation failed");
  await append(config.tenant_id, conversation.id, nodeId, "bot", "text", action.message, { route: "journey_action", action: action.type, pending_field_key: action.type === "ask_question" ? action.field.key : null });
  return data as TableRow<"conversations">;
}

async function applyJourneyAnswer(config: Config, conversation: TableRow<"conversations">, current: Node, text: string) {
  const context = asContext(conversation.context);
  const state = journeyConversationState(context);
  const fields = await activeJourneyFields(config.tenant_id);
  const pending = state.pendingFieldKey ? fields.find((field) => field.key === state.pendingFieldKey) : undefined;
  // A customer question or booking request is a detour, not an answer to a text field.
  if (!pending || looksLikeCustomerQuestion(text) || looksLikeBookingRequest(text)) {
    const ai = await applyValidatedAIResult(config, conversation, current, text);
    return { conversation: await advanceJourneyConversation(config, ai.conversation, current.id), routeHint: ai.routeHint };
  }
  const parsed = validateDynamicJsonValue(pending as TableRow<"lead_field_definitions">, text);
  if (parsed.error || parsed.value === undefined) {
    const ai = await applyValidatedAIResult(config, conversation, current, text);
    return { conversation: await advanceJourneyConversation(config, ai.conversation, current.id), routeHint: ai.routeHint };
  }
  const nextContext = withJourneyConversationState({ ...context, [pending.key]: parsed.value }, { pendingFieldKey: null });
  const admin = createAdminClient();
  const { data: lead, error: leadError } = await admin.from("leads").select("lead_data").eq("tenant_id", config.tenant_id).eq("id", conversation.lead_id!).single();
  if (leadError || !lead) throw leadError ?? new Error("Lead not found");
  const { error: leadUpdateError } = await admin.from("leads").update({ lead_data: { ...asContext(lead.lead_data), [pending.key]: parsed.value } }).eq("tenant_id", config.tenant_id).eq("id", conversation.lead_id!);
  if (leadUpdateError) throw leadUpdateError;
  const { data: updated, error: conversationError } = await admin.from("conversations").update({ context: nextContext, last_activity_at: new Date().toISOString(), status: "active" }).eq("tenant_id", config.tenant_id).eq("id", conversation.id).select("*").single();
  if (conversationError || !updated) throw conversationError ?? new Error("Conversation update failed");
  return { conversation: await advanceJourneyConversation(config, updated as TableRow<"conversations">, current.id), routeHint: undefined };
}

export async function processIncomingMessage(input: z.infer<typeof publicChatInput>): Promise<ChatView | null> {
  const config = await resolvePublicConfig(input.widgetId); if (!config) return null;
  return processForConfig(config, input);
}

export async function processPreviewMessage(tenantId: string, input: z.infer<typeof publicChatInput>): Promise<ChatView | null> {
  const config = await getChatbotForTenant(tenantId);
  if (config.widget_id !== input.widgetId) return null;
  return processForConfig(config, input);
}

export async function resumeJourneyConversation(tenantId: string, leadId: string) {
  const config = await getChatbotForTenant(tenantId);
  const admin = createAdminClient();
  const { data: conversation, error } = await admin.from("conversations").select("*").eq("tenant_id", tenantId).eq("lead_id", leadId).order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!conversation) return null;
  const { data: active, error: activateError } = await admin.from("conversations").update({ status: "active", ended_at: null }).eq("tenant_id", tenantId).eq("id", conversation.id).select("*").single();
  if (activateError || !active) throw activateError ?? new Error("Conversation resume failed");
  return advanceJourneyConversation(config, active as TableRow<"conversations">, active.current_node_id);
}

async function processForConfig(config: Config, input: z.infer<typeof publicChatInput>): Promise<ChatView> {
  const { nodes, edges } = await graph(config); const root = nodes.find((node) => node.id === config.root_node_id); if (!root) throw new Error("Published chatbot has no root.");
  const admin = createAdminClient();
  const { data: found, error } = await admin.from("conversations").select("*").eq("chatbot_config_id", config.id).eq("channel", "website").eq("session_identifier", input.sessionId).maybeSingle();
  if (error) throw error;
  let conversation = found as TableRow<"conversations"> | null;
  if (!conversation || input.action === "restart") {
    if (conversation && input.action === "restart") {
      const { error: endError } = await admin.from("conversations").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", config.tenant_id);
      if (endError) throw endError;
    }
    const { data, error: createError } = await admin.from("conversations").insert({ tenant_id: config.tenant_id, chatbot_config_id: config.id, channel: "website", session_identifier: input.sessionId, current_node_id: root.id }).select("*").single();
    if (createError || !data) throw createError ?? new Error("Conversation creation failed"); conversation = data as TableRow<"conversations">;
    await append(config.tenant_id, conversation.id, root.id, "bot", "text", config.welcome_message);
    if (root.content) await append(config.tenant_id, conversation.id, root.id, "bot", "text", root.content);
  }
  if (!conversation) throw new Error("Conversation creation failed");
  const activeConversation = conversation;
  const startedWithLead = Boolean(activeConversation.lead_id);
  if (input.action === "start" || input.action === "restart") return view(config, activeConversation, nodes, edges, await readMessages(activeConversation.id));
  const current = nodes.find((node) => node.id === activeConversation.current_node_id); if (!current || activeConversation.status !== "active") return view(config, activeConversation, nodes, edges, await readMessages(activeConversation.id));
  let routeHint: "RAG_REQUIRED" | "AI_UNAVAILABLE" | undefined;
  if (input.action === "select") {
    const edge = edges.find((item) => item.id === input.edgeId && item.source_node_id === current.id);
    if (!edge) throw new Error("Invalid chatbot transition.");
    const destination = nodes.find((node) => node.id === edge.destination_node_id); if (!destination) throw new Error("Invalid chatbot destination.");
    const context = withJourneyConversationState({ ...asContext(activeConversation.context), ...asContext(edge.set_context) }, { bookingIntent: isConfiguredBookingSelection(edge, nodes) ? true : undefined });
    const transition = await advanceMenuTransition(config, activeConversation, current, destination, context);
    if (!transition.applied) return view(config, transition.conversation, nodes, edges, await readMessages(transition.conversation.id));
    await append(config.tenant_id, activeConversation.id, current.id, "visitor", "option", edge.label, { edge_id: edge.id });
    conversation = await enter(config, transition.conversation, destination, context, nodes, edges, true);
  } else if (input.action === "text") {
    const text = input.text ?? "";
    const bookingEntry = !activeConversation.lead_id ? initialMenuBookingEntry({ rootNodeId: root.id, currentNodeId: current.id, currentNodeType: current.node_type, text, nodes, edges }) : null;
    if (bookingEntry) {
      const destination = nodes.find((node) => node.id === bookingEntry.destination_node_id);
      if (!destination) throw new Error("Invalid chatbot destination.");
      const context = withJourneyConversationState({ ...asContext(activeConversation.context), ...asContext(bookingEntry.set_context ?? {}) }, { bookingIntent: true });
      const transition = await advanceMenuTransition(config, activeConversation, current, destination, context);
      if (!transition.applied) return view(config, transition.conversation, nodes, edges, await readMessages(transition.conversation.id));
      await append(config.tenant_id, activeConversation.id, current.id, "visitor", "text", text);
      conversation = await enter(config, transition.conversation, destination, context, nodes, edges, true);
    } else {
      await append(config.tenant_id, activeConversation.id, current.id, "visitor", current.node_type === "capture" ? "capture" : "text", text);
      if (activeConversation.lead_id) {
      const journey = await applyJourneyAnswer(config, activeConversation, current, text);
      conversation = journey.conversation; routeHint = journey.routeHint;
      } else if (!acceptsCaptureInput(current.node_type, current.capture_key, validCapture(current, text))) {
        // Current capture states remain protected: invalid capture text never reaches AI.
        if (current.node_type === "capture") {
          const ai = await applyValidatedAIResult(config, activeConversation, current, text);
          conversation = ai.conversation; routeHint = ai.routeHint;
          await append(config.tenant_id, activeConversation.id, current.id, "bot", "text", current.content, { route: "resume_pending_capture", pending_capture_key: current.capture_key });
        }
        else { const ai = await applyValidatedAIResult(config, activeConversation, current, text); conversation = ai.conversation; routeHint = ai.routeHint; }
      } else {
        const destination = edges.find((edge) => edge.source_node_id === current.id && edge.is_default);
        if (!destination) throw new Error("Capture node has no next step.");
        const node = nodes.find((item) => item.id === destination.destination_node_id); if (!node) throw new Error("Invalid chatbot destination.");
        conversation = await enter(config, activeConversation, node, { ...asContext(activeConversation.context), [current.capture_key!]: text.trim() }, nodes, edges);
      }
    }
  }
  if (!conversation) throw new Error("Conversation update failed");
  let finalConversation = conversation;
  const currentAfterInput = nodes.find((node) => node.id === finalConversation.current_node_id);
  if (finalConversation.lead_id && currentAfterInput?.node_type === "end" && !startedWithLead) finalConversation = await advanceJourneyConversation(config, finalConversation, currentAfterInput.id);
  if (finalConversation.lead_id) await recordLeadInboundActivity(config.tenant_id, finalConversation.lead_id);
  return view(config, finalConversation, nodes, edges, await readMessages(finalConversation.id), routeHint);
}

export async function getChatbotForTenant(tenantId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("chatbot_configs").select("*").eq("tenant_id", tenantId).single(); if (error) throw error;
  return data as Config;
}

import "server-only";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json, TableRow } from "@/lib/supabase/database.types";
import { isPublicWidgetAvailable } from "./policy";

type Config = TableRow<"chatbot_configs">;
type Node = TableRow<"chatbot_nodes">;
type Edge = TableRow<"chatbot_edges">;
type Context = Record<string, Json | undefined>;
export type ChatView = { conversationId: string; assistantName: string; node: { key: string; type: string; content: string; captureType: string | null }; options: { id: string; label: string }[]; messages: { sender: string; content: string }[]; status: string; branding: Json; routeHint?: "RAG_REQUIRED" };

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

async function view(config: Config, conversation: TableRow<"conversations">, nodes: Node[], edges: Edge[], messages: { sender_type: string; content: string }[], routeHint?: "RAG_REQUIRED"): Promise<ChatView> {
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
  // Required dynamic fields are enforced by the existing DB trigger. This route only
  // creates a lead after a flow has supplied all configured required values.
  if ((fields ?? []).some((field) => field.required && leadData[field.key] === undefined)) return conversation;
  const { data: lead, error: leadError } = await admin.from("leads").insert({ tenant_id: config.tenant_id, contact_id: contactId, lead_data: leadData }).select("id").single();
  if (leadError || !lead) throw leadError ?? new Error("Lead creation failed");
  const { data: updated, error: updateError } = await admin.from("conversations").update({ contact_id: contactId, lead_id: lead.id, context, last_activity_at: new Date().toISOString() }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single();
  if (updateError || !updated) throw updateError ?? new Error("Conversation association failed");
  return updated as TableRow<"conversations">;
}

async function enter(config: Config, conversation: TableRow<"conversations">, destination: Node, context: Context, nodes: Node[], edges: Edge[]) {
  const admin = createAdminClient();
  let current = destination;
  let updated = conversation;
  // Answer/message nodes can advance via a default edge; a cap prevents malformed loops.
  for (let step = 0; step < 8; step += 1) {
    updated = (await admin.from("conversations").update({ current_node_id: current.id, context, last_activity_at: new Date().toISOString(), status: current.node_type === "end" ? "ended" : "active" }).eq("id", conversation.id).eq("tenant_id", config.tenant_id).select("*").single()).data as TableRow<"conversations">;
    const content = current.node_type === "end" ? config.confirmation_message || current.content : current.content;
    await append(config.tenant_id, updated.id, current.id, "bot", current.node_type === "action_placeholder" ? "action_placeholder" : "text", content);
    if (current.node_type === "end") { updated = await maybeCreateLead(config, updated, context); break; }
    const next = edges.find((edge) => edge.source_node_id === current.id && edge.is_default);
    if (!next || !["message", "answer"].includes(current.node_type)) break;
    const nextNode = nodes.find((node) => node.id === next.destination_node_id); if (!nextNode) break;
    current = nextNode;
  }
  return updated;
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

async function processForConfig(config: Config, input: z.infer<typeof publicChatInput>): Promise<ChatView> {
  const { nodes, edges } = await graph(config); const root = nodes.find((node) => node.id === config.root_node_id); if (!root) throw new Error("Published chatbot has no root.");
  const admin = createAdminClient();
  const { data: found, error } = await admin.from("conversations").select("*").eq("chatbot_config_id", config.id).eq("channel", "website").eq("session_identifier", input.sessionId).maybeSingle();
  if (error) throw error;
  let conversation = found as TableRow<"conversations"> | null;
  if (!conversation || input.action === "restart") {
    if (conversation && input.action === "restart") await admin.from("conversations").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", conversation.id);
    const { data, error: createError } = await admin.from("conversations").insert({ tenant_id: config.tenant_id, chatbot_config_id: config.id, channel: "website", session_identifier: input.sessionId, current_node_id: root.id }).select("*").single();
    if (createError || !data) throw createError ?? new Error("Conversation creation failed"); conversation = data as TableRow<"conversations">;
    await append(config.tenant_id, conversation.id, root.id, "bot", "text", config.welcome_message);
    if (root.content) await append(config.tenant_id, conversation.id, root.id, "bot", "text", root.content);
  }
  if (!conversation) throw new Error("Conversation creation failed");
  const activeConversation = conversation;
  if (input.action === "start" || input.action === "restart") return view(config, activeConversation, nodes, edges, await readMessages(activeConversation.id));
  const current = nodes.find((node) => node.id === activeConversation.current_node_id); if (!current || activeConversation.status !== "active") return view(config, activeConversation, nodes, edges, await readMessages(activeConversation.id));
  let routeHint: "RAG_REQUIRED" | undefined;
  if (input.action === "select") {
    const edge = edges.find((item) => item.id === input.edgeId && item.source_node_id === current.id);
    if (!edge) throw new Error("Invalid chatbot transition.");
    const destination = nodes.find((node) => node.id === edge.destination_node_id); if (!destination) throw new Error("Invalid chatbot destination.");
    await append(config.tenant_id, activeConversation.id, current.id, "visitor", "option", edge.label, { edge_id: edge.id });
    conversation = await enter(config, activeConversation, destination, { ...asContext(activeConversation.context), ...asContext(edge.set_context) }, nodes, edges);
  } else if (input.action === "text") {
    const text = input.text ?? "";
    await append(config.tenant_id, activeConversation.id, current.id, "visitor", current.node_type === "capture" ? "capture" : "text", text);
    if (current.node_type !== "capture" || !current.capture_key || !validCapture(current, text)) {
      await append(config.tenant_id, activeConversation.id, current.id, "bot", "fallback", config.fallback_message, { route_hint: "RAG_REQUIRED" }); routeHint = "RAG_REQUIRED";
    } else {
      const destination = edges.find((edge) => edge.source_node_id === current.id && edge.is_default);
      if (!destination) throw new Error("Capture node has no next step.");
      const node = nodes.find((item) => item.id === destination.destination_node_id); if (!node) throw new Error("Invalid chatbot destination.");
      conversation = await enter(config, activeConversation, node, { ...asContext(activeConversation.context), [current.capture_key]: text.trim() }, nodes, edges);
    }
  }
  return view(config, conversation, nodes, edges, await readMessages(conversation.id), routeHint);
}

export async function getChatbotForTenant(tenantId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("chatbot_configs").select("*").eq("tenant_id", tenantId).single(); if (error) throw error;
  return data as Config;
}

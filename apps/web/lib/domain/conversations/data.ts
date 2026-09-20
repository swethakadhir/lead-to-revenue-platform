import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TableRow } from "@/lib/supabase/database.types";

type Conversation = TableRow<"conversations">;
type Contact = TableRow<"contacts">;

export type ConversationListItem = Conversation & { contact: Contact | null; latestMessage: string | null };

async function contactsFor(tenantId: string, ids: (string | null)[]) {
  const contactIds = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (!contactIds.length) return new Map<string, Contact>();
  const { data, error } = await (await createClient()).from("contacts").select("*").eq("tenant_id", tenantId).in("id", contactIds);
  if (error) throw error;
  return new Map((data ?? []).map((contact) => [contact.id, contact]));
}

export function conversationCustomerName(contact: Contact | null) {
  const name = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";
  return name || "Anonymous visitor";
}

export async function listConversations(tenantId: string): Promise<ConversationListItem[]> {
  const client = await createClient();
  const { data, error } = await client.from("conversations").select("*").eq("tenant_id", tenantId).order("last_activity_at", { ascending: false }).limit(250);
  if (error) throw error;
  const conversations = (data ?? []) as Conversation[];
  const [contacts, messages] = await Promise.all([
    contactsFor(tenantId, conversations.map((conversation) => conversation.contact_id)),
    conversations.length ? client.from("conversation_messages").select("conversation_id, content, created_at").eq("tenant_id", tenantId).in("conversation_id", conversations.map((conversation) => conversation.id)).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
  ]);
  if (messages.error) throw messages.error;
  const latest = new Map<string, string>();
  for (const message of messages.data ?? []) if (!latest.has(message.conversation_id)) latest.set(message.conversation_id, message.content);
  return conversations.map((conversation) => ({ ...conversation, contact: conversation.contact_id ? contacts.get(conversation.contact_id) ?? null : null, latestMessage: latest.get(conversation.id) ?? null }));
}

export async function getConversation(tenantId: string, conversationId: string) {
  const client = await createClient();
  const { data: conversation, error } = await client.from("conversations").select("*").eq("tenant_id", tenantId).eq("id", conversationId).maybeSingle();
  if (error) throw error;
  if (!conversation) return null;
  const [contacts, messages] = await Promise.all([
    contactsFor(tenantId, [conversation.contact_id]),
    client.from("conversation_messages").select("*").eq("tenant_id", tenantId).eq("conversation_id", conversationId).order("created_at").limit(250),
  ]);
  if (messages.error) throw messages.error;
  return { conversation: conversation as Conversation, contact: conversation.contact_id ? contacts.get(conversation.contact_id) ?? null : null, messages: messages.data ?? [] };
}

export async function findConversationForLead(tenantId: string, leadId: string) {
  const { data, error } = await (await createClient()).from("conversations").select("id").eq("tenant_id", tenantId).eq("lead_id", leadId).order("last_activity_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

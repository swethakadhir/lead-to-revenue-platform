"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";

export type ChatbotSettingsState = { error: string | null; message?: string };
const schema = z.object({ name: z.string().trim().min(1).max(100), welcome: z.string().trim().min(1).max(2000), fallback: z.string().trim().min(1).max(2000), confirmation: z.string().trim().min(1).max(2000), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), position: z.enum(["left", "right"]), status: z.enum(["draft", "published"]) });
async function admin() { const tenant = await getActiveTenant(); return tenant && ["owner", "admin"].includes(tenant.role) ? tenant : null; }

export async function saveChatbotSettings(_state: ChatbotSettingsState, formData: FormData): Promise<ChatbotSettingsState> {
  const tenant = await admin(); if (!tenant) return { error: "Only owners and admins can configure the chatbot." };
  const parsed = schema.safeParse({ name: String(formData.get("name") ?? ""), welcome: String(formData.get("welcome") ?? ""), fallback: String(formData.get("fallback") ?? ""), confirmation: String(formData.get("confirmation") ?? ""), color: String(formData.get("color") ?? ""), position: String(formData.get("position") ?? ""), status: String(formData.get("status") ?? "") });
  if (!parsed.success) return { error: "Check the chatbot settings." };
  const { error } = await (await createClient()).from("chatbot_configs").update({ name: parsed.data.name, welcome_message: parsed.data.welcome, fallback_message: parsed.data.fallback, confirmation_message: parsed.data.confirmation, branding: { primary_color: parsed.data.color, position: parsed.data.position }, status: parsed.data.status, enabled: formData.get("enabled") === "on", lead_capture_enabled: formData.get("leadCapture") === "on" }).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save chatbot settings." };
  revalidatePath("/app/settings/chatbot"); revalidatePath("/app/settings/chatbot/preview"); return { error: null, message: "Chatbot settings saved." };
}

export async function saveChatbotNode(_state: ChatbotSettingsState, formData: FormData): Promise<ChatbotSettingsState> {
  const tenant = await admin(); if (!tenant) return { error: "Only owners and admins can change the flow." };
  const id = String(formData.get("id") ?? ""); const content = String(formData.get("content") ?? "").trim();
  if (!id || content.length > 4000) return { error: "Enter valid flow text." };
  const { error } = await (await createClient()).from("chatbot_nodes").update({ content }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save flow text." }; revalidatePath("/app/settings/chatbot/advanced"); revalidatePath("/app/settings/chatbot/preview"); return { error: null, message: "Flow text saved." };
}

export async function saveChatbotEdge(_state: ChatbotSettingsState, formData: FormData): Promise<ChatbotSettingsState> {
  const tenant = await admin(); if (!tenant) return { error: "Only owners and admins can change the flow." };
  const id = String(formData.get("id") ?? ""); const label = String(formData.get("label") ?? "").trim();
  if (!id || !label || label.length > 160) return { error: "Enter a valid option label." };
  const { error } = await (await createClient()).from("chatbot_edges").update({ label }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save this option." }; revalidatePath("/app/settings/chatbot/advanced"); revalidatePath("/app/settings/chatbot/preview"); return { error: null, message: "Option saved." };
}

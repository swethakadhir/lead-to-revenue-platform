import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatWidget } from "@/components/chatbot/chat-widget";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";

export default async function ChatbotPreviewPage() {
  const tenant = await getActiveTenant(); if (!tenant) redirect("/app/create-business");
  const { data: config } = await (await createClient()).from("chatbot_configs").select("widget_id").eq("tenant_id", tenant.id).single();
  if (!config) return <main className="p-8">Chatbot preview is unavailable.</main>;
  return <main className="mx-auto max-w-lg px-5 py-8"><Link className="text-sm text-blue-700" href="/app/settings/chatbot">← Chatbot settings</Link><h1 className="mt-4 text-2xl font-semibold">Authenticated draft preview</h1><p className="mt-1 text-sm text-slate-600">This preview can use draft configuration; public visitors cannot.</p><div className="mt-5 rounded-xl border bg-slate-50"><ChatWidget endpoint="/api/chatbot/preview" widgetId={config.widget_id} /></div></main>;
}

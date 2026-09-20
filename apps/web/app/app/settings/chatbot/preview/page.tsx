import Link from "next/link";
import { redirect } from "next/navigation";
import { ChatWidget } from "@/components/chatbot/chat-widget";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { getTenantConfiguration } from "@/lib/domain/configuration/data";
import { createClient } from "@/lib/supabase/server";
import { canManageAdvancedChatbotSetup } from "@/lib/domain/chatbot/policy";

export default async function ChatbotPreviewPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  if (!canManageAdvancedChatbotSetup(tenant.role)) redirect("/app/settings/chatbot");
  const [{ data: config }, configuration] = await Promise.all([
    (await createClient()).from("chatbot_configs").select("widget_id").eq("tenant_id", tenant.id).single(),
    getTenantConfiguration(tenant.id),
  ]);
  if (!config) return <main className="p-8">Chatbot preview is unavailable.</main>;
  return <main className="mx-auto max-w-6xl px-5 py-8"><Link className="text-sm text-blue-700" href="/app/settings/chatbot">← Chatbot settings</Link><header className="mt-4"><p className="text-sm font-medium text-blue-700">Private preview</p><h1 className="text-3xl font-semibold">See your visitor experience</h1><p className="mt-1 text-slate-600">This simulated website uses the same widget and conversation engine as the public embed. Drafts remain private.</p></header><section className="relative mt-6 min-h-[620px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-7 py-5"><p className="text-xl font-semibold">{configuration.settings.business_name}</p><p className="mt-1 text-sm text-slate-500">Welcome to our website</p></div><div className="grid gap-6 px-7 py-10 md:grid-cols-2"><div><p className="text-3xl font-semibold tracking-tight">We are here to help.</p><p className="mt-4 max-w-prose text-slate-600">Explore our services, ask a question, or leave your details and our team will get in touch.</p><button className="mt-6 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Explore services</button></div><div className="rounded-xl bg-slate-50 p-6"><p className="font-medium">Contact our team</p><p className="mt-2 text-sm text-slate-600">Use the chat icon in the lower corner to start a conversation.</p></div></div><ChatWidget endpoint="/api/chatbot/preview" floating sessionScope="preview" widgetId={config.widget_id} /></section></main>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";
import { canManageAdvancedChatbotSetup, isPublicWidgetAvailable } from "@/lib/domain/chatbot/policy";

export default async function ChatbotInstallPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  if (!canManageAdvancedChatbotSetup(tenant.role)) redirect("/app/settings/chatbot");
  const { data: config } = await (await createClient()).from("chatbot_configs").select("widget_id, status, enabled").eq("tenant_id", tenant.id).single();
  if (!config) return <main className="p-8">Chatbot setup is unavailable.</main>;
  const widgetUrl = `/chatbot/widget?widget=${config.widget_id}`;
  return <main className="mx-auto max-w-3xl space-y-6 px-5 py-8"><Link className="text-sm text-blue-700" href="/app/settings/chatbot">← Chatbot settings</Link><header><h1 className="text-3xl font-semibold">Install on website</h1><p className="mt-1 text-slate-600">Share this with your website developer. It contains a public widget identifier, never a credential.</p></header><section className="rounded-xl border border-slate-200 bg-white p-5"><ol className="list-inside list-decimal space-y-2 text-sm text-slate-700"><li>Publish and enable the chatbot.</li><li>Copy this iframe snippet.</li><li>Paste it before the closing <code>&lt;/body&gt;</code> tag on the client website.</li></ol><code className="mt-5 block overflow-auto rounded bg-slate-100 p-3 text-xs">{`<iframe src="${widgetUrl}" title="Chat with us" style="position:fixed;right:20px;bottom:20px;border:0;width:400px;height:680px;z-index:9999" allow="clipboard-write"></iframe>`}</code><p className="mt-4 text-sm text-slate-600">Current status: {isPublicWidgetAvailable(config.status, config.enabled) ? "published and ready" : "not public yet — preview it before publishing"}.</p></section></main>;
}

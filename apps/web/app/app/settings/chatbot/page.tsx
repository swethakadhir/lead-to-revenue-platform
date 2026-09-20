import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";
import { ChatbotSettingsForm } from "./chatbot-forms";
import { canManageAdvancedChatbotSetup, isPublicWidgetAvailable } from "@/lib/domain/chatbot/policy";

export default async function ChatbotSettingsPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const { data: config } = await (await createClient()).from("chatbot_configs").select("*").eq("tenant_id", tenant.id).single();
  if (!config) return <main className="p-8">Chatbot setup is unavailable for this business.</main>;

  const editable = canManageAdvancedChatbotSetup(tenant.role);
  const publicAvailable = isPublicWidgetAvailable(config.status, config.enabled);
  const widgetUrl = `/chatbot/widget?widget=${config.widget_id}`;

  return <main className="mx-auto max-w-4xl space-y-6 px-5 py-8">
    <Link className="text-sm text-blue-700" href="/app/settings">← Business settings</Link>
    <header><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Website chatbot</h1><p className="mt-1 text-slate-600">Keep the visitor experience clear and welcoming. Your implementation team manages the conversation structure separately.</p></header>
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Assistant and publishing</h2><ChatbotSettingsForm config={config} editable={editable} /></section>
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"><div><h2 className="text-lg font-semibold">Preview chatbot</h2><p className="mt-1 text-sm text-slate-600">See the same floating chat experience your website visitors will use. Drafts are safe to preview here.</p><Link className="mt-4 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white" href="/app/settings/chatbot/preview">Preview chatbot</Link></div><div><h2 className="text-lg font-semibold">Website status</h2><p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${publicAvailable ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{publicAvailable ? "Published and enabled" : config.status === "draft" ? "Draft — private preview only" : "Disabled — not visible to visitors"}</p><p className="mt-3 text-sm text-slate-600">{publicAvailable ? "The public website widget is available." : "Publish and enable the assistant when it is ready for visitors."}</p></div></section>
    {editable && <section className="rounded-xl border border-slate-200 bg-slate-50 p-5"><h2 className="text-lg font-semibold">For your implementation team</h2><p className="mt-1 text-sm text-slate-600">Flow routing, prompts, and website installation are technical setup tasks.</p><div className="mt-4 flex flex-wrap gap-3"><Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" href="/app/settings/chatbot/advanced">Advanced setup</Link><Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" href="/app/settings/chatbot/install">Install on website</Link>{publicAvailable && <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" href={widgetUrl} target="_blank">Open public widget</Link>}</div></section>}
  </main>;
}

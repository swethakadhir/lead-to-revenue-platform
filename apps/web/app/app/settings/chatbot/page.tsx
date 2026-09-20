import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";
import { ChatbotSettingsForm, EdgeForm, NodeForm } from "./chatbot-forms";

export default async function ChatbotSettingsPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const client = await createClient();
  const [{ data: config }, { data: nodes }, { data: edges }] = await Promise.all([
    client.from("chatbot_configs").select("*").eq("tenant_id", tenant.id).single(),
    client.from("chatbot_nodes").select("*").eq("tenant_id", tenant.id).order("key"),
    client.from("chatbot_edges").select("*").eq("tenant_id", tenant.id).order("display_order"),
  ]);
  if (!config) return <main className="p-8">Chatbot setup is unavailable for this business.</main>;

  const editable = ["owner", "admin"].includes(tenant.role);
  const widgetUrl = `/chatbot/widget?widget=${config.widget_id}`;
  const publicAvailable = config.status === "published" && config.enabled;

  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
    <Link className="text-sm text-blue-700" href="/app/settings">← Business settings</Link>
    <header><h1 className="text-3xl font-semibold">Website chatbot</h1><p className="mt-1 text-slate-600">Deterministic starter flow. Free text returns the configured fallback; no AI is used.</p></header>
    <section className="rounded-xl border bg-white p-5"><h2 className="mb-4 text-lg font-semibold">General and publishing</h2><ChatbotSettingsForm config={config} editable={editable} /></section>
    <section className="rounded-xl border bg-white p-5">
      <h2 className="text-lg font-semibold">Preview and embed</h2>
      <Link className="mt-3 inline-block text-sm font-medium text-blue-700" href="/app/settings/chatbot/preview">Preview this draft securely →</Link>
      <p className="mt-3 text-sm text-slate-600">After publishing, embed this iframe on the client website:</p>
      <code className="mt-3 block overflow-auto rounded bg-slate-100 p-3 text-xs">{`<iframe src="${widgetUrl}" title="Chat with us" style="position:fixed;right:20px;bottom:20px;border:0;width:400px;height:680px"></iframe>`}</code>
      {publicAvailable ? <Link className="mt-3 inline-block text-sm font-medium text-blue-700" href={widgetUrl} target="_blank">Open public widget</Link> : <p className="mt-3 text-sm text-amber-800">The public widget stays unavailable until this chatbot is enabled and published.</p>}
    </section>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Flow text</h2><div className="mt-4 grid gap-3">{(nodes ?? []).map((node) => <NodeForm editable={editable} key={node.id} node={node} />)}</div><h3 className="mt-6 font-semibold">Option labels</h3><div className="mt-3 grid gap-2">{(edges ?? []).map((edge) => <EdgeForm edge={edge} editable={editable} key={edge.id} />)}</div></section>
  </main>;
}

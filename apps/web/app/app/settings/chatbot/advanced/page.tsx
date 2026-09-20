import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";
import { EdgeForm, NodeForm } from "../chatbot-forms";
import { canManageAdvancedChatbotSetup } from "@/lib/domain/chatbot/policy";

export default async function AdvancedChatbotSetupPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const canManage = canManageAdvancedChatbotSetup(tenant.role);
  if (!canManage) redirect("/app/settings/chatbot");
  const client = await createClient();
  const [{ data: nodes }, { data: edges }] = await Promise.all([
    client.from("chatbot_nodes").select("*").eq("tenant_id", tenant.id).order("key"),
    client.from("chatbot_edges").select("*").eq("tenant_id", tenant.id).order("display_order"),
  ]);
  return <main className="mx-auto max-w-5xl space-y-6 px-5 py-8"><Link className="text-sm text-blue-700" href="/app/settings/chatbot">← Chatbot settings</Link><header><h1 className="text-3xl font-semibold">Advanced setup</h1><p className="mt-1 text-slate-600">For implementation and support staff. Changes affect the visitor conversation flow.</p></header><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Conversation prompts</h2><div className="mt-4 grid gap-3">{(nodes ?? []).map((node) => <NodeForm editable node={node} key={node.id} />)}</div><h2 className="mt-7 text-lg font-semibold">Visitor choices</h2><div className="mt-4 grid gap-3">{(edges ?? []).map((edge) => <EdgeForm editable edge={edge} key={edge.id} />)}</div></section></main>;
}

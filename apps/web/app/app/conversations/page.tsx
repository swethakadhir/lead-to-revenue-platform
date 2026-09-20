import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { conversationCustomerName, listConversations } from "@/lib/domain/conversations/data";

export default async function ConversationsPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const conversations = await listConversations(tenant.id);
  return <main className="mx-auto max-w-6xl px-5 py-8"><header><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Conversations</h1><p className="mt-1 text-slate-600">Website chat history and visitor enquiries for your team.</p></header><section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{conversations.length ? <ul className="divide-y divide-slate-200">{conversations.map((conversation) => <li key={conversation.id}><Link className="grid gap-2 p-4 transition hover:bg-slate-50 sm:grid-cols-[1.2fr_1.5fr_auto] sm:items-center" href={`/app/conversations/${conversation.id}`}><div><p className="font-medium">{conversationCustomerName(conversation.contact)}</p><p className="text-sm capitalize text-slate-500">{conversation.channel} · {conversation.status}</p></div><p className="truncate text-sm text-slate-600">{conversation.latestMessage ?? "No messages yet"}</p><div className="text-left text-xs text-slate-500 sm:text-right">{conversation.lead_id ? <span className="block font-medium text-blue-700">Lead created</span> : <span className="block">No lead yet</span>}<time>{new Date(conversation.last_activity_at).toLocaleString()}</time></div></Link></li>)}</ul> : <div className="p-10 text-center"><h2 className="font-semibold">No conversations yet</h2><p className="mt-1 text-sm text-slate-500">Website chat conversations will appear here.</p></div>}</section></main>;
}

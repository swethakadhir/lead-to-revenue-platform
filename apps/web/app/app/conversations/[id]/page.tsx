import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { conversationCustomerName, getConversation } from "@/lib/domain/conversations/data";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const { id } = await params;
  const detail = await getConversation(tenant.id, id);
  if (!detail) notFound();
  return <main className="mx-auto max-w-3xl px-5 py-8"><Link className="text-sm font-medium text-blue-700" href="/app/conversations">← All conversations</Link><header className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-slate-500">{detail.conversation.channel} conversation</p><h1 className="text-3xl font-semibold">{conversationCustomerName(detail.contact)}</h1><p className="mt-1 text-sm capitalize text-slate-600">{detail.conversation.status}</p></div>{detail.conversation.lead_id && <Link className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium" href={`/app/leads/${detail.conversation.lead_id}`}>Open related lead</Link>}</header><section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="grid gap-3">{detail.messages.map((message) => <article className={`w-fit max-w-[90%] rounded-2xl px-4 py-3 ${message.sender_type === "visitor" ? "ml-auto bg-blue-50" : "bg-slate-100"}`} key={message.id}><p className="text-xs font-medium text-slate-500">{message.sender_type === "visitor" ? "Customer" : message.sender_type === "bot" ? "Assistant" : "System"}</p><p className="mt-1 text-sm text-slate-800">{message.content}</p><time className="mt-1 block text-xs text-slate-400">{new Date(message.created_at).toLocaleString()}</time></article>)}</div></section></main>;
}

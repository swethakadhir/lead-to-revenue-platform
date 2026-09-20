import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformOperator } from "@/lib/auth/platform-operator";
import { getOperatorTenant } from "@/lib/domain/operator/data";
import { ResetStarterChatbotForm } from "../../../operator-forms";

export default async function OperatorChatbotPage({ params }: { params: Promise<{ id: string }> }) { await requirePlatformOperator(); const { id } = await params; const detail = await getOperatorTenant(id); if (!detail) notFound(); return <main className="mx-auto max-w-3xl px-5 py-8"><Link className="text-sm text-violet-700" href={`/operator/tenants/${id}`}>← {detail.tenant.name}</Link><h1 className="mt-4 text-3xl font-semibold">Chatbot setup</h1><p className="mt-1 text-slate-600">Use the tenant-selected template to replace a generic or outdated starter flow. Existing chatbot content will be replaced; historical conversations remain.</p><section className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"><h2 className="text-lg font-semibold">Replace starter chatbot</h2><ResetStarterChatbotForm tenantId={id} /></section></main>; }

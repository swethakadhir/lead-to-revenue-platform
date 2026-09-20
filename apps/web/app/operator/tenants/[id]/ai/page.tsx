import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformOperator } from "@/lib/auth/platform-operator";
import { getOperatorTenant } from "@/lib/domain/operator/data";
import { createClient } from "@/lib/supabase/server";
import { TenantAIConfigForm } from "./config-form";
export default async function OperatorTenantAIPage({ params }: { params: Promise<{ id: string }> }) { await requirePlatformOperator(); const { id } = await params; const detail = await getOperatorTenant(id); if (!detail) notFound(); const { data, error } = await (await createClient()).from("tenant_ai_configs").select("*").eq("tenant_id", id).maybeSingle(); if (error) throw error; return <main className="mx-auto max-w-3xl px-5 py-8"><Link className="text-sm text-violet-700" href={`/operator/tenants/${id}`}>← {detail.tenant.name}</Link><h1 className="mt-4 text-3xl font-semibold">AI routing</h1><p className="mt-1 text-slate-600">Dify is optional assistance for non-capture free text. It cannot advance the deterministic chatbot flow or convert a lead.</p><section className="mt-6 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold">Tenant knowledge isolation</h2><TenantAIConfigForm tenantId={id} initialEnabled={data?.enabled ?? false} initialScope={data?.knowledge_scope ?? `tenant:${id}`} /></section></main>; }

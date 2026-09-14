import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LeadEditForm } from "@/components/sales/lead-edit-form";
import { OpportunityCreateForm } from "@/components/sales/opportunity-create-form";
import { StageForm } from "@/components/sales/stage-form";
import { contactName, getLead, getPipelineStages, getTeamMembers } from "@/lib/domain/sales/data";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const { id } = await params;
  const [detail, stages, members] = await Promise.all([getLead(tenant.id, id), getPipelineStages(tenant.id), getTeamMembers(tenant.id)]);
  if (!detail) notFound();
  const canOperate = tenant.role !== "viewer";
  const memberMap = new Map(members.map((member) => [member.userId, member.label]));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <Link className="text-sm font-medium text-blue-700" href="/app/leads">← All leads</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-slate-500">Lead detail</p><h1 className="text-3xl font-semibold">{contactName(detail.contact)}</h1></div><dl className="text-right text-xs text-slate-500"><div><dt className="inline">Created </dt><dd className="inline">{new Date(detail.lead.created_at).toLocaleString()}</dd></div><div><dt className="inline">Updated </dt><dd className="inline">{new Date(detail.lead.updated_at).toLocaleString()}</dd></div></dl></div>
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        {canOperate ? <LeadEditForm contact={detail.contact} lead={detail.lead} members={members} /> : <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Lead and contact</h2><p className="mt-2 text-sm text-slate-500">Viewer access is read-only.</p><dl className="mt-4 grid gap-3 text-sm"><div><dt className="text-slate-500">Email</dt><dd>{detail.contact?.email ?? "Not set"}</dd></div><div><dt className="text-slate-500">Phone</dt><dd>{detail.contact?.phone ?? "Not set"}</dd></div><div><dt className="text-slate-500">Status</dt><dd>{detail.lead.status}</dd></div><div><dt className="text-slate-500">Qualification</dt><dd>{detail.lead.qualification_status} · {detail.lead.qualification_score ?? "Not scored"}</dd></div></dl></section>}
        <div className="grid content-start gap-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Opportunities</h2>{detail.opportunities.length ? <ul className="mt-4 grid gap-4">{detail.opportunities.map((opportunity) => <li className="grid gap-3 rounded-lg border border-slate-200 p-4" key={opportunity.id}><div><h3 className="font-medium">{opportunity.name}</h3><p className="text-sm text-slate-500">{opportunity.estimated_value === null ? "Value not set" : `${opportunity.currency} ${opportunity.estimated_value.toLocaleString()}`} · {opportunity.assigned_user_id ? memberMap.get(opportunity.assigned_user_id) ?? "Unknown assignee" : "Unassigned"}</p>{opportunity.won_at && <p className="mt-1 text-xs text-emerald-700">Won {new Date(opportunity.won_at).toLocaleString()}</p>}{opportunity.lost_at && <p className="mt-1 text-xs text-red-700">Lost {new Date(opportunity.lost_at).toLocaleString()} · {opportunity.lost_reason}</p>}</div>{canOperate ? <StageForm currentStage={opportunity.stage_key} opportunityId={opportunity.id} stages={stages} /> : <p className="text-xs text-slate-500">Stage: {stages.find((stage) => stage.key === opportunity.stage_key)?.name ?? opportunity.stage_key}</p>}</li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No opportunity has been created for this lead.</p>}</section>
          {canOperate && <OpportunityCreateForm currency={tenant.currency} leadId={detail.lead.id} members={members} stages={stages} />}
        </div>
      </div>
    </main>
  );
}

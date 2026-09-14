import Link from "next/link";
import { redirect } from "next/navigation";
import { StageForm } from "@/components/sales/stage-form";
import { contactName, getPipelineStages, listOpportunities } from "@/lib/domain/sales/data";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

export default async function PipelinePage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const [stages, opportunities] = await Promise.all([getPipelineStages(tenant.id), listOpportunities(tenant.id)]);
  const canOperate = tenant.role !== "viewer";

  return (
    <main className="px-5 py-8">
      <div className="mx-auto max-w-7xl"><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Pipeline</h1><p className="mt-1 text-slate-600">Opportunities grouped by the tenant’s configurable stages.</p></div>
      {opportunities.length ? <div className="mx-auto mt-7 flex max-w-7xl gap-4 overflow-x-auto pb-4">{stages.map((stage) => {
        const stageOpportunities = opportunities.filter((item) => item.stage_key === stage.key);
        return <section className="w-80 shrink-0 rounded-xl bg-slate-100 p-3" key={stage.id}><div className="flex items-center justify-between px-1"><h2 className="font-semibold">{stage.name}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600">{stageOpportunities.length}</span></div><div className="mt-3 grid gap-3">{stageOpportunities.map((opportunity) => <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={opportunity.id}><Link className="font-medium hover:text-blue-700" href={`/app/leads/${opportunity.lead_id}`}>{opportunity.name}</Link><p className="mt-1 text-sm text-slate-600">{contactName(opportunity.contact)}</p><dl className="my-3 grid gap-1 text-xs text-slate-500"><div><dt className="inline">Value: </dt><dd className="inline">{opportunity.estimated_value === null ? "Not set" : `${opportunity.currency} ${opportunity.estimated_value.toLocaleString()}`}</dd></div><div><dt className="inline">Assignee: </dt><dd className="inline">{opportunity.assigneeLabel ?? "Unassigned"}</dd></div></dl>{canOperate && <StageForm currentStage={opportunity.stage_key} opportunityId={opportunity.id} stages={stages} />}</article>)}</div></section>;
      })}</div> : <div className="mx-auto mt-8 max-w-7xl rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center"><h2 className="font-semibold">No opportunities yet</h2><p className="mt-1 text-sm text-slate-500">Open a lead to create the first opportunity.</p><Link className="mt-4 inline-block text-sm font-medium text-blue-700" href="/app/leads">Open leads</Link></div>}
    </main>
  );
}

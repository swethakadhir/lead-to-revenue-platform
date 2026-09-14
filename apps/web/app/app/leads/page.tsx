import Link from "next/link";
import { redirect } from "next/navigation";
import { LeadCreateForm } from "@/components/sales/lead-create-form";
import { contactName, getTeamMembers, listLeads } from "@/lib/domain/sales/data";
import { leadStatuses } from "@/lib/domain/sales/schemas";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

type SearchParams = Promise<{ status?: string; assignee?: string; q?: string }>;

export default async function LeadsPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const [{ status = "", assignee = "", q = "" }, leads, members] = await Promise.all([searchParams, listLeads(tenant.id), getTeamMembers(tenant.id)]);
  const canOperate = tenant.role !== "viewer";
  const search = q.trim().toLowerCase();
  const visibleLeads = leads.filter((lead) => {
    const contact = lead.contact;
    const haystack = [contact?.first_name, contact?.last_name, contact?.email, contact?.phone].filter(Boolean).join(" ").toLowerCase();
    const assigneeMatches = !assignee || (assignee === "unassigned" ? !lead.assigned_user_id : lead.assigned_user_id === assignee);
    return (!status || lead.status === status) && assigneeMatches && (!search || haystack.includes(search));
  });

  return (
    <main className={`mx-auto grid max-w-7xl gap-8 px-5 py-8 ${canOperate ? "lg:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <section className="min-w-0">
        <div><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Leads</h1><p className="mt-1 text-slate-600">Manage enquiries and open each lead for qualification and opportunity work.</p></div>
        <form className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3" method="get">
          <input aria-label="Search leads" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={q} name="q" placeholder="Name, email, or phone" />
          <select aria-label="Filter by status" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={status} name="status"><option value="">All statuses</option>{leadStatuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>
          <select aria-label="Filter by assignee" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={assignee} name="assignee"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select>
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium sm:col-start-3" type="submit">Apply filters</button>
        </form>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {visibleLeads.length ? <ul className="divide-y divide-slate-200">{visibleLeads.map((lead) => <li key={lead.id}><Link className="grid gap-2 p-4 hover:bg-slate-50 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center" href={`/app/leads/${lead.id}`}><div><p className="font-medium">{contactName(lead.contact)}</p><p className="text-sm text-slate-500">{lead.contact?.email || lead.contact?.phone || "No contact details"}</p></div><span className="w-fit rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium capitalize text-blue-800">{lead.status.replaceAll("_", " ")}</span><span className="text-sm text-slate-600">{lead.assigneeLabel ?? "Unassigned"}</span><time className="text-xs text-slate-500">{new Date(lead.created_at).toLocaleDateString()}</time></Link></li>)}</ul> : <div className="p-10 text-center"><h2 className="font-semibold">No leads found</h2><p className="mt-1 text-sm text-slate-500">Adjust the filters or create the first lead.</p></div>}
        </div>
      </section>
      {canOperate && <aside><LeadCreateForm members={members} /></aside>}
    </main>
  );
}

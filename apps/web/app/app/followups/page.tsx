import Link from "next/link";
import { redirect } from "next/navigation";
import { FollowupForm } from "@/components/operations/followup-form";
import { FollowupStatusForm } from "@/components/operations/followup-status-form";
import { getOperationalReferences, listFollowups } from "@/lib/domain/operations/data";
import { followupStatuses } from "@/lib/domain/operations/schemas";
import { formatInTimeZone, zonedDayBounds } from "@/lib/domain/operations/time";
import { contactName } from "@/lib/domain/sales/data";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

type SearchParams = Promise<{ status?: string; assignee?: string }>;

export default async function FollowupsPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const { status = "", assignee = "" } = await searchParams;
  const [followups, references] = await Promise.all([listFollowups(tenant.id, { status, assignee }), getOperationalReferences(tenant.id)]);
  const now = new Date();
  const today = zonedDayBounds(tenant.timezone, now);
  const pending = followups.filter((item) => item.status === "pending");
  const overdue = pending.filter((item) => item.due_at < now.toISOString());
  const dueToday = pending.filter((item) => item.due_at >= now.toISOString() && item.due_at < today.end);
  const upcoming = pending.filter((item) => item.due_at >= today.end);
  const history = followups.filter((item) => item.status !== "pending").reverse();
  const canOperate = tenant.role !== "viewer";

  return <main className={`mx-auto grid max-w-7xl gap-8 px-5 py-8 ${canOperate ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}><section className="min-w-0"><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Follow-ups</h1><p className="mt-1 text-slate-600">Prioritized work due in {tenant.timezone}.</p><form className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2" method="get"><select aria-label="Filter by status" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={status} name="status"><option value="">All statuses</option>{followupStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><select aria-label="Filter by assignee" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={assignee} name="assignee"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{references.members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium sm:col-start-2" type="submit">Apply filters</button></form><FollowupGroup items={overdue} canOperate={canOperate} references={references} timezone={tenant.timezone} title="Overdue" tone="red" /><FollowupGroup items={dueToday} canOperate={canOperate} references={references} timezone={tenant.timezone} title="Due today" tone="amber" /><FollowupGroup items={upcoming} canOperate={canOperate} references={references} timezone={tenant.timezone} title="Upcoming" /><FollowupGroup items={history} canOperate={canOperate} references={references} timezone={tenant.timezone} title="Completed or cancelled" /></section>{canOperate && <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Create follow-up</h2><FollowupForm references={references} timezone={tenant.timezone} /></aside>}</main>;
}

function FollowupGroup({ title, items, canOperate, references, timezone, tone }: { title: string; items: Awaited<ReturnType<typeof listFollowups>>; canOperate: boolean; references: Awaited<ReturnType<typeof getOperationalReferences>>; timezone: string; tone?: "red" | "amber" }) {
  const toneClass = tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-slate-950";
  return <section className="mt-7"><h2 className={`text-lg font-semibold ${toneClass}`}>{title} <span className="text-sm font-normal text-slate-500">({items.length})</span></h2>{items.length ? <ul className="mt-3 grid gap-3">{items.map((followup) => <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={followup.id}><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><div className="flex items-center gap-2"><h3 className="font-semibold capitalize">{followup.type}</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize">{followup.status}</span></div><p className="mt-1 text-sm text-slate-600">{contactName(followup.contact)} · {formatInTimeZone(followup.due_at, timezone)}</p><p className="mt-1 text-xs text-slate-500">{followup.assigneeLabel ?? "Unassigned"}</p>{followup.notes && <p className="mt-2 text-sm text-slate-600">{followup.notes}</p>}{followup.lead_id && <Link className="mt-2 inline-block text-sm font-medium text-blue-700" href={`/app/leads/${followup.lead_id}`}>Open related lead</Link>}</div>{canOperate && <div className="w-full sm:w-52"><FollowupStatusForm id={followup.id} outcome={followup.outcome} status={followup.status} /></div>}</div>{canOperate && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">Edit follow-up</summary><div className="mt-4"><FollowupForm followup={followup} references={references} timezone={timezone} /></div></details>}</li>)}</ul> : <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-7 text-center text-sm text-slate-500">No {title.toLowerCase()} follow-ups.</div>}</section>;
}

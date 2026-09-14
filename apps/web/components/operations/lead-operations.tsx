import Link from "next/link";
import { AppointmentForm } from "./appointment-form";
import { AppointmentStatusForm } from "./appointment-status-form";
import { FollowupForm } from "./followup-form";
import { FollowupStatusForm } from "./followup-status-form";
import { formatInTimeZone } from "@/lib/domain/operations/time";
import type { OperationalReferences } from "@/lib/domain/operations/types";
import type { Appointment, Followup } from "@/lib/domain/operations/types";

export function LeadOperations({ leadId, contactId, appointments, followups, references, timezone, canOperate }: { leadId: string; contactId: string | null; appointments: Appointment[]; followups: Followup[]; references: OperationalReferences; timezone: string; canOperate: boolean }) {
  const now = new Date().toISOString();
  const upcoming = appointments.filter((item) => item.starts_at >= now && ["scheduled", "confirmed"].includes(item.status));
  const history = appointments.filter((item) => !upcoming.some((upcomingItem) => upcomingItem.id === item.id)).reverse();
  const pending = followups.filter((item) => item.status === "pending");
  const completed = followups.filter((item) => item.status !== "pending").reverse();
  return <section className="mt-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold">Appointments and follow-ups</h2><p className="text-sm text-slate-500">Operational work linked to this lead.</p></div><div className="flex gap-3"><Link className="text-sm font-medium text-blue-700" href="/app/appointments">All appointments</Link><Link className="text-sm font-medium text-blue-700" href="/app/followups">All follow-ups</Link></div></div>
    <div className="mt-5 grid gap-6 lg:grid-cols-2"><OperationList title="Upcoming appointments" empty="No upcoming appointments.">{upcoming.map((item) => <li className="rounded-lg border border-slate-200 p-3" key={item.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">{formatInTimeZone(item.starts_at, item.timezone)} · {item.status}</p></div>{canOperate && <div className="w-full sm:w-48"><AppointmentStatusForm cancellationReason={item.cancellation_reason} id={item.id} status={item.status} /></div>}</div></li>)}</OperationList>
      <OperationList title="Appointment history" empty="No appointment history.">{history.map((item) => <li className="rounded-lg border border-slate-200 p-3" key={item.id}><p className="font-medium">{item.title}</p><p className="text-sm text-slate-500">{formatInTimeZone(item.starts_at, item.timezone)} · {item.status}</p></li>)}</OperationList>
      <OperationList title="Pending follow-ups" empty="No pending follow-ups.">{pending.map((item) => <li className="rounded-lg border border-slate-200 p-3" key={item.id}><div className="flex flex-wrap justify-between gap-2"><div><p className="font-medium capitalize">{item.type}</p><p className="text-sm text-slate-500">Due {formatInTimeZone(item.due_at, timezone)}</p></div>{canOperate && <div className="w-full sm:w-48"><FollowupStatusForm id={item.id} outcome={item.outcome} status={item.status} /></div>}</div></li>)}</OperationList>
      <OperationList title="Completed follow-ups" empty="No completed or cancelled follow-ups.">{completed.map((item) => <li className="rounded-lg border border-slate-200 p-3" key={item.id}><p className="font-medium capitalize">{item.type} · {item.status}</p><p className="text-sm text-slate-500">{item.outcome || formatInTimeZone(item.due_at, timezone)}</p></li>)}</OperationList>
    </div>
    {canOperate && contactId && <div className="mt-6 grid gap-6 lg:grid-cols-2"><details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-semibold">Create appointment from lead</summary><div className="mt-4"><AppointmentForm compact fixedLinks={{ contactId, leadId }} references={references} timezone={timezone} /></div></details><details className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer font-semibold">Create follow-up from lead</summary><div className="mt-4"><FollowupForm compact fixedLinks={{ contactId, leadId }} references={references} timezone={timezone} /></div></details></div>}
  </section>;
}

function OperationList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-semibold">{title}</h3>{children.length ? <ul className="mt-3 grid gap-3">{children}</ul> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}</section>;
}

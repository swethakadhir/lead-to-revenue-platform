import Link from "next/link";
import { redirect } from "next/navigation";
import { AppointmentForm } from "@/components/operations/appointment-form";
import { AppointmentStatusForm } from "@/components/operations/appointment-status-form";
import { getOperationalReferences, listAppointments, partitionAppointments } from "@/lib/domain/operations/data";
import { appointmentStatuses } from "@/lib/domain/operations/schemas";
import { formatInTimeZone, zonedLocalToIso } from "@/lib/domain/operations/time";
import { contactName } from "@/lib/domain/sales/data";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

type SearchParams = Promise<{ status?: string; assignee?: string; from?: string; to?: string }>;

export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const { status = "", assignee = "", from = "", to = "" } = await searchParams;
  const fromIso = dateBoundary(from, tenant.timezone);
  const toIso = dateBoundary(to, tenant.timezone, true);
  const [appointments, references] = await Promise.all([listAppointments(tenant.id, { status, assignee, from: fromIso, to: toIso }), getOperationalReferences(tenant.id)]);
  const { upcoming, past } = partitionAppointments(appointments);
  const canOperate = tenant.role !== "viewer";

  return <main className={`mx-auto grid max-w-7xl gap-8 px-5 py-8 ${canOperate ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
    <section className="min-w-0"><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Appointments</h1><p className="mt-1 text-slate-600">Upcoming commitments and appointment history in {tenant.timezone}.</p>
      <form className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4" method="get"><select aria-label="Filter by status" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={status} name="status"><option value="">All statuses</option>{appointmentStatuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select><select aria-label="Filter by assignee" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={assignee} name="assignee"><option value="">All assignees</option><option value="unassigned">Unassigned</option>{references.members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select><input aria-label="From date" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={from} name="from" type="date" /><input aria-label="To date" className="rounded-lg border border-slate-300 px-3 py-2" defaultValue={to} name="to" type="date" /><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium xl:col-start-4" type="submit">Apply filters</button></form>
      <AppointmentGroup appointments={upcoming} canOperate={canOperate} references={references} tenantTimezone={tenant.timezone} title="Upcoming" />
      <AppointmentGroup appointments={past} canOperate={canOperate} references={references} tenantTimezone={tenant.timezone} title="Past" />
    </section>
    {canOperate && <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-lg font-semibold">Create appointment</h2><AppointmentForm references={references} timezone={tenant.timezone} /></aside>}
  </main>;
}

function AppointmentGroup({ title, appointments, canOperate, references, tenantTimezone }: { title: string; appointments: Awaited<ReturnType<typeof listAppointments>>; canOperate: boolean; references: Awaited<ReturnType<typeof getOperationalReferences>>; tenantTimezone: string }) {
  return <section className="mt-7"><h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-slate-500">({appointments.length})</span></h2>{appointments.length ? <ul className="mt-3 grid gap-3">{appointments.map((appointment) => <li className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={appointment.id}><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{appointment.title}</h3><span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs capitalize text-blue-800">{appointment.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{contactName(appointment.contact)} · {formatInTimeZone(appointment.starts_at, appointment.timezone)}–{new Intl.DateTimeFormat("en", { timeZone: appointment.timezone, timeStyle: "short" }).format(new Date(appointment.ends_at))}</p><p className="mt-1 text-xs text-slate-500">{appointment.assigneeLabel ?? "Unassigned"}{appointment.location ? ` · ${appointment.location}` : ""}</p>{appointment.lead_id && <Link className="mt-2 inline-block text-sm font-medium text-blue-700" href={`/app/leads/${appointment.lead_id}`}>Open related lead</Link>}</div>{canOperate && <div className="w-full sm:w-52"><AppointmentStatusForm cancellationReason={appointment.cancellation_reason} id={appointment.id} status={appointment.status} /></div>}</div>{canOperate && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-medium text-slate-700">Edit appointment</summary><div className="mt-4"><AppointmentForm appointment={appointment} references={references} timezone={tenantTimezone} /></div></details>}</li>)}</ul> : <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">No {title.toLowerCase()} appointments match these filters.</div>}</section>;
}

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dateBoundary(value: string, timeZone: string, inclusiveEnd = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  try { return zonedLocalToIso(`${inclusiveEnd ? nextDate(value) : value}T00:00`, timeZone); } catch { return undefined; }
}

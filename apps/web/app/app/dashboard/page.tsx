import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/domain/operations/data";
import { formatInTimeZone } from "@/lib/domain/operations/time";
import { contactName } from "@/lib/domain/sales/data";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

export default async function DashboardPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const dashboard = await getDashboardData(tenant.id, tenant.timezone, tenant.currency);
  const contacts = new Map(dashboard.references.contacts.map((contact) => [contact.id, contact]));
  const money = new Intl.NumberFormat("en", { style: "currency", currency: tenant.currency, maximumFractionDigits: 0 });
  const cards = [
    ["New Leads", dashboard.metrics.newLeads], ["Qualified Leads", dashboard.metrics.qualifiedLeads],
    ["Appointments", dashboard.metrics.appointments], ["Opportunities", dashboard.metrics.opportunities],
    ["Won", dashboard.metrics.won], ["Pipeline Value", money.format(dashboard.metrics.pipelineValue)],
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8">
      <p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Operational dashboard</h1><p className="mt-1 text-slate-600">Live tenant data · {tenant.timezone}</p>
      <dl className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([label, metric]) => <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 text-3xl font-semibold">{metric}</dd></div>)}</dl>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <DashboardList title="Appointments today" empty="No appointments today." href="/app/appointments">{dashboard.appointmentsToday.map((item) => <li className="border-b border-slate-100 py-3 last:border-0" key={item.id}><Link className="font-medium hover:text-blue-700" href={item.lead_id ? `/app/leads/${item.lead_id}` : "/app/appointments"}>{item.title}</Link><p className="text-sm text-slate-500">{contactName(item.contact)} · {formatInTimeZone(item.starts_at, item.timezone)}</p></li>)}</DashboardList>
        <DashboardList title="Overdue follow-ups" empty="No overdue follow-ups." href="/app/followups">{dashboard.overdueFollowups.map((item) => <li className="border-b border-slate-100 py-3 last:border-0" key={item.id}><Link className="font-medium text-red-700" href={item.lead_id ? `/app/leads/${item.lead_id}` : "/app/followups"}>{item.type} · {contactName(item.contact)}</Link><p className="text-sm text-slate-500">Due {formatInTimeZone(item.due_at, tenant.timezone)}</p></li>)}</DashboardList>
        <DashboardList title="Follow-ups due today" empty="No follow-ups due today." href="/app/followups">{dashboard.followupsToday.map((item) => <li className="border-b border-slate-100 py-3 last:border-0" key={item.id}><Link className="font-medium hover:text-blue-700" href={item.lead_id ? `/app/leads/${item.lead_id}` : "/app/followups"}>{item.type} · {contactName(item.contact)}</Link><p className="text-sm text-slate-500">{formatInTimeZone(item.due_at, tenant.timezone)}</p></li>)}</DashboardList>
        <DashboardList title="Upcoming appointments" empty="No upcoming appointments." href="/app/appointments">{dashboard.upcomingAppointments.map((item) => <li className="border-b border-slate-100 py-3 last:border-0" key={item.id}><Link className="font-medium hover:text-blue-700" href={item.lead_id ? `/app/leads/${item.lead_id}` : "/app/appointments"}>{item.title}</Link><p className="text-sm text-slate-500">{contactName(item.contact)} · {formatInTimeZone(item.starts_at, item.timezone)}</p></li>)}</DashboardList>
        <DashboardList title="Recent leads" empty="No leads yet." href="/app/leads">{dashboard.recentLeads.map((lead) => <li className="border-b border-slate-100 py-3 last:border-0" key={lead.id}><Link className="font-medium hover:text-blue-700" href={`/app/leads/${lead.id}`}>{contactName(lead.contact_id ? contacts.get(lead.contact_id) ?? null : null)}</Link><p className="text-sm capitalize text-slate-500">{lead.status.replaceAll("_", " ")} · {new Date(lead.created_at).toLocaleDateString()}</p></li>)}</DashboardList>
      </div>
    </main>
  );
}

function DashboardList({ title, empty, href, children }: { title: string; empty: string; href: string; children: React.ReactNode[] }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><Link className="text-sm font-medium text-blue-700" href={href}>View all</Link></div>{children.length ? <ul className="mt-2">{children}</ul> : <p className="mt-4 text-sm text-slate-500">{empty}</p>}</section>;
}

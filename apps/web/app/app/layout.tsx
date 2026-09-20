import type { ReactNode } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const tenant = await getActiveTenant();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div><Link className="font-semibold" href="/app/dashboard">Lead-to-Revenue</Link><p className="text-xs text-slate-500">{tenant?.name ?? "No active business"}</p></div>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm">
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/dashboard">Dashboard</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/leads">Leads</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/conversations">Conversations</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/pipeline">Pipeline</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/appointments">Appointments</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/followups">Follow-ups</Link>
            <Link className="rounded-lg px-3 py-2 hover:bg-slate-100" href="/app/settings">Settings</Link>
          </nav>
          <div className="flex items-center gap-3 text-sm"><span className="hidden text-slate-500 sm:inline">{user.email}</span><form action={signOut}><button className="rounded-lg border border-slate-300 px-3 py-2" type="submit">Sign out</button></form></div>
        </div>
      </header>
      {children}
    </div>
  );
}

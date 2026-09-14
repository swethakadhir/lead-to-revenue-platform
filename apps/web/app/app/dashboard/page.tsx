import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth/session";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";

export default async function DashboardPage() {
  const user = await requireUser();
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm text-slate-600">Active business</p><h1 className="text-3xl font-semibold text-slate-950">{tenant.name}</h1></div>
          <form action={signOut}><button className="rounded-lg border border-slate-300 px-4 py-2" type="submit">Sign out</button></form>
        </header>
        <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-semibold">Dashboard foundation</h2>
          <p className="mt-2 text-slate-600">Authentication and tenant isolation are active. Product modules begin in a later phase.</p>
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-500">Signed in as</dt><dd>{user.email ?? user.id}</dd></div>
            <div><dt className="text-slate-500">Tenant role</dt><dd>{tenant.role}</dd></div>
            <div><dt className="text-slate-500">Timezone</dt><dd>{tenant.timezone}</dd></div>
            <div><dt className="text-slate-500">Currency</dt><dd>{tenant.currency}</dd></div>
          </dl>
          <Link className="mt-7 inline-block text-sm font-medium text-blue-700" href="/app/create-business">Create another business</Link>
        </section>
      </div>
    </main>
  );
}

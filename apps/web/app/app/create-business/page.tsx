import Link from "next/link";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { BusinessForm } from "./business-form";

export default async function CreateBusinessPage() {
  const tenant = await getActiveTenant();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-blue-700">Tenant setup</p>
        <h1 className="mt-2 text-2xl font-semibold">Create a business</h1>
        <p className="mt-2 text-sm text-slate-600">The business and your owner membership are created together in one database transaction.</p>
        {tenant ? <Link className="mt-4 inline-block text-sm text-blue-700" href="/app/dashboard">Return to {tenant.name}</Link> : null}
        <BusinessForm />
      </section>
    </main>
  );
}

import Link from "next/link";

export default function LeadNotFound() {
  return <main className="mx-auto max-w-2xl px-5 py-16 text-center"><h1 className="text-2xl font-semibold">Lead not found</h1><p className="mt-2 text-slate-600">This lead does not exist or is not available in the active business.</p><Link className="mt-5 inline-block font-medium text-blue-700" href="/app/leads">Return to leads</Link></main>;
}

"use client";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">We could not load your workspace</h1>
        <p className="mt-3 text-sm text-slate-600">Check the Supabase connection and try again.</p>
        <button className="mt-6 rounded-lg bg-slate-950 px-4 py-2 text-white" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}

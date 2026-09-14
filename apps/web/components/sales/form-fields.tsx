import type { ReactNode } from "react";

export function Field({ label, name, error, children }: { label: string; name: string; error?: string[]; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700" htmlFor={name}>
      {label}
      {children}
      {error?.map((message) => <span className="text-xs font-normal text-red-700" key={message}>{message}</span>)}
    </label>
  );
}

export const inputClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950 shadow-sm placeholder:text-slate-400";

export function FormNotice({ error, message }: { error: string | null; message?: string }) {
  if (error) return <p aria-live="polite" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>;
  if (message) return <p aria-live="polite" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p>;
  return null;
}

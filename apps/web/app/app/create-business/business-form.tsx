"use client";

import type { InputHTMLAttributes } from "react";
import { useActionState } from "react";
import { createBusiness, type CreateBusinessState } from "./actions";
import type { TableRow } from "@/lib/supabase/database.types";

const initialState: CreateBusinessState = { error: null };

export function BusinessForm({ templates }: { templates: TableRow<"industry_templates">[] }) {
  const [state, action, pending] = useActionState(createBusiness, initialState);
  return (
    <form action={action} className="mt-7 space-y-5">
      <Field label="Business name" name="name" placeholder="Acme Services" />
      <Field label="Slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="acme-services" />
      <Field label="Timezone" name="timezone" placeholder="Asia/Kolkata" />
      <Field label="Currency" maxLength={3} name="currency" placeholder="USD" />
      <div><label className="mb-2 block text-sm font-medium" htmlFor="templateId">Business type</label><select className="w-full rounded-lg border border-slate-300 px-3 py-2" id="templateId" name="templateId" required><option value="">Choose a business type</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>
      {state.error ? <p aria-live="polite" className="text-sm text-red-700" role="alert">{state.error}</p> : null}
      <button className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Creating business…" : "Create business"}</button>
    </form>
  );
}

function Field({ label, name, ...props }: { label: string; name: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <div><label className="mb-2 block text-sm font-medium" htmlFor={name}>{label}</label><input className="w-full rounded-lg border border-slate-300 px-3 py-2" id={name} name={name} required {...props} /></div>;
}

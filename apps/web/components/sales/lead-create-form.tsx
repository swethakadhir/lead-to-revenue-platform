"use client";

import { useActionState } from "react";
import { createLead } from "@/app/app/leads/actions";
import { Field, FormNotice, inputClass } from "./form-fields";
import { initialFormState, leadStatuses } from "@/lib/domain/sales/schemas";
import type { TeamMemberOption } from "@/lib/domain/sales/types";

export function LeadCreateForm({ members }: { members: TeamMemberOption[] }) {
  const [state, action, pending] = useActionState(createLead, initialFormState);
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><h2 className="text-lg font-semibold text-slate-950">Create lead</h2><p className="text-sm text-slate-500">A matching email or phone reuses the existing contact.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" error={state.fieldErrors?.firstName}><input className={inputClass} id="firstName" name="firstName" required /></Field>
        <Field label="Last name" name="lastName" error={state.fieldErrors?.lastName}><input className={inputClass} id="lastName" name="lastName" /></Field>
        <Field label="Email" name="email" error={state.fieldErrors?.email}><input className={inputClass} id="email" name="email" type="email" /></Field>
        <Field label="Phone" name="phone" error={state.fieldErrors?.phone}><input className={inputClass} id="phone" name="phone" /></Field>
        <Field label="Status" name="status" error={state.fieldErrors?.status}><select className={inputClass} defaultValue="new" id="status" name="status">{leadStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></Field>
        <Field label="Assignee" name="assignedUserId" error={state.fieldErrors?.assignedUserId}><select className={inputClass} defaultValue="" id="assignedUserId" name="assignedUserId"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {member.role}</option>)}</select></Field>
      </div>
      <Field label="Lead data (JSON)" name="leadData" error={state.fieldErrors?.leadData}><textarea className={`${inputClass} min-h-24 font-mono text-xs`} defaultValue="{}" id="leadData" name="leadData" /></Field>
      <FormNotice error={state.error} message={state.message} />
      <button className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Creating…" : "Create lead"}</button>
    </form>
  );
}

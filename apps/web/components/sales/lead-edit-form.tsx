"use client";

import { useActionState } from "react";
import { updateLead } from "@/app/app/leads/actions";
import { Field, FormNotice, inputClass } from "./form-fields";
import { initialFormState, leadStatuses, qualificationStatuses } from "@/lib/domain/sales/schemas";
import type { Contact, Lead, TeamMemberOption } from "@/lib/domain/sales/types";

export function LeadEditForm({ lead, contact, members }: { lead: Lead; contact: Contact | null; members: TeamMemberOption[] }) {
  const updateLeadById = updateLead.bind(null, lead.id);
  const [state, action, pending] = useActionState(updateLeadById, initialFormState);
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Lead and contact</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" name="firstName" error={state.fieldErrors?.firstName}><input className={inputClass} defaultValue={contact?.first_name ?? ""} id="firstName" name="firstName" required /></Field>
        <Field label="Last name" name="lastName" error={state.fieldErrors?.lastName}><input className={inputClass} defaultValue={contact?.last_name ?? ""} id="lastName" name="lastName" /></Field>
        <Field label="Email" name="email" error={state.fieldErrors?.email}><input className={inputClass} defaultValue={contact?.email ?? ""} id="email" name="email" type="email" /></Field>
        <Field label="Phone" name="phone" error={state.fieldErrors?.phone}><input className={inputClass} defaultValue={contact?.phone ?? ""} id="phone" name="phone" /></Field>
        <Field label="Lead status" name="status" error={state.fieldErrors?.status}><select className={inputClass} defaultValue={lead.status} id="status" name="status">{leadStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></Field>
        <Field label="Qualification" name="qualificationStatus" error={state.fieldErrors?.qualificationStatus}><select className={inputClass} defaultValue={lead.qualification_status} id="qualificationStatus" name="qualificationStatus">{qualificationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
        <Field label="Qualification score" name="qualificationScore" error={state.fieldErrors?.qualificationScore}><input className={inputClass} defaultValue={lead.qualification_score ?? ""} id="qualificationScore" max="100" min="0" name="qualificationScore" type="number" /></Field>
        <Field label="Assignee" name="assignedUserId" error={state.fieldErrors?.assignedUserId}><select className={inputClass} defaultValue={lead.assigned_user_id ?? ""} id="assignedUserId" name="assignedUserId"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.label} · {member.role}</option>)}</select></Field>
      </div>
      <Field label="Lead data (JSON)" name="leadData" error={state.fieldErrors?.leadData}><textarea className={`${inputClass} min-h-32 font-mono text-xs`} defaultValue={JSON.stringify(lead.lead_data, null, 2)} id="leadData" name="leadData" /></Field>
      <FormNotice error={state.error} message={state.message} />
      <button className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Save lead"}</button>
    </form>
  );
}

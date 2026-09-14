"use client";

import { useActionState } from "react";
import { createOpportunity } from "@/app/app/leads/actions";
import { Field, FormNotice, inputClass } from "./form-fields";
import { initialFormState } from "@/lib/domain/sales/schemas";
import type { PipelineStage, TeamMemberOption } from "@/lib/domain/sales/types";

export function OpportunityCreateForm({ leadId, currency, stages, members }: { leadId: string; currency: string; stages: PipelineStage[]; members: TeamMemberOption[] }) {
  const actionByLead = createOpportunity.bind(null, leadId);
  const [state, action, pending] = useActionState(actionByLead, initialFormState);
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Create opportunity</h2>
      <Field label="Name" name="name" error={state.fieldErrors?.name}><input className={inputClass} id="name" name="name" required /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stage" name="stageKey" error={state.fieldErrors?.stageKey}><select className={inputClass} defaultValue={stages[0]?.key} id="stageKey" name="stageKey">{stages.filter((stage) => stage.stage_type !== "lost").map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}</select></Field>
        <Field label="Assignee" name="assignedUserId" error={state.fieldErrors?.assignedUserId}><select className={inputClass} defaultValue="" id="assignedUserId" name="assignedUserId"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select></Field>
        <Field label="Estimated value" name="estimatedValue" error={state.fieldErrors?.estimatedValue}><input className={inputClass} id="estimatedValue" min="0" name="estimatedValue" step="0.01" type="number" /></Field>
        <Field label="Currency" name="currency" error={state.fieldErrors?.currency}><input className={inputClass} defaultValue={currency} id="currency" maxLength={3} name="currency" /></Field>
        <Field label="Probability (%)" name="probability" error={state.fieldErrors?.probability}><input className={inputClass} id="probability" max="100" min="0" name="probability" type="number" /></Field>
        <Field label="Expected close date" name="expectedCloseDate" error={state.fieldErrors?.expectedCloseDate}><input className={inputClass} id="expectedCloseDate" name="expectedCloseDate" type="date" /></Field>
      </div>
      <FormNotice error={state.error} message={state.message} />
      <button className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={pending || !stages.length} type="submit">{pending ? "Creating…" : "Create opportunity"}</button>
    </form>
  );
}

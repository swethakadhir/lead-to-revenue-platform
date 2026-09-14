"use client";

import { useActionState } from "react";
import { createFollowup, updateFollowup } from "@/app/app/followups/actions";
import { Field, FormNotice, inputClass } from "@/components/sales/form-fields";
import { followupTypes } from "@/lib/domain/operations/schemas";
import { toLocalInput } from "@/lib/domain/operations/time";
import { initialFormState } from "@/lib/domain/sales/schemas";
import { contactName } from "@/lib/domain/sales/format";
import type { Followup, OperationalReferences } from "@/lib/domain/operations/types";

type FixedLinks = { contactId: string; leadId?: string | null; opportunityId?: string | null };

export function FollowupForm({ references, timezone, followup, fixedLinks, compact = false }: { references: OperationalReferences; timezone: string; followup?: Followup; fixedLinks?: FixedLinks; compact?: boolean }) {
  const serverAction = followup ? updateFollowup.bind(null, followup.id) : createFollowup;
  const [state, action, pending] = useActionState(serverAction, initialFormState);
  const contactId = fixedLinks?.contactId ?? followup?.contact_id ?? "";
  const leadId = fixedLinks?.leadId ?? followup?.lead_id ?? "";
  const opportunityId = fixedLinks?.opportunityId ?? followup?.opportunity_id ?? "";
  return <form action={action} className="grid gap-4">
    {fixedLinks ? <><input name="contactId" type="hidden" value={contactId} /><input name="leadId" type="hidden" value={leadId ?? ""} /><input name="opportunityId" type="hidden" value={opportunityId ?? ""} /></> : <div className="grid gap-4 sm:grid-cols-3"><Field label="Contact" name={`followup-contact-${followup?.id ?? "new"}`} error={state.fieldErrors?.contactId}><select className={inputClass} defaultValue={contactId} id={`followup-contact-${followup?.id ?? "new"}`} name="contactId" required><option value="">Choose contact</option>{references.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}</select></Field><Field label="Lead" name={`followup-lead-${followup?.id ?? "new"}`}><select className={inputClass} defaultValue={leadId ?? ""} id={`followup-lead-${followup?.id ?? "new"}`} name="leadId"><option value="">No lead</option>{references.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.id.slice(0, 8)} · {lead.status}</option>)}</select></Field><Field label="Opportunity" name={`followup-opportunity-${followup?.id ?? "new"}`}><select className={inputClass} defaultValue={opportunityId ?? ""} id={`followup-opportunity-${followup?.id ?? "new"}`} name="opportunityId"><option value="">No opportunity</option>{references.opportunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field></div>}
    <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-3"}`}><Field label="Type" name={`followup-type-${followup?.id ?? "new"}`} error={state.fieldErrors?.type}><select className={inputClass} defaultValue={followup?.type ?? "general"} id={`followup-type-${followup?.id ?? "new"}`} name="type">{followupTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field><Field label={`Due (${timezone})`} name={`followup-due-${followup?.id ?? "new"}`} error={state.fieldErrors?.dueAt}><input className={inputClass} defaultValue={followup ? toLocalInput(followup.due_at, timezone) : ""} id={`followup-due-${followup?.id ?? "new"}`} name="dueAt" required type="datetime-local" /></Field><Field label="Assignee" name={`followup-assignee-${followup?.id ?? "new"}`} error={state.fieldErrors?.assignedUserId}><select className={inputClass} defaultValue={followup?.assigned_user_id ?? ""} id={`followup-assignee-${followup?.id ?? "new"}`} name="assignedUserId"><option value="">Unassigned</option>{references.members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select></Field></div>
    <Field label="Notes" name={`followup-notes-${followup?.id ?? "new"}`} error={state.fieldErrors?.notes}><textarea className={`${inputClass} min-h-20`} defaultValue={followup?.notes ?? ""} id={`followup-notes-${followup?.id ?? "new"}`} name="notes" /></Field>
    <Field label="Outcome" name={`followup-outcome-${followup?.id ?? "new"}`} error={state.fieldErrors?.outcome}><textarea className={`${inputClass} min-h-16`} defaultValue={followup?.outcome ?? ""} id={`followup-outcome-${followup?.id ?? "new"}`} name="outcome" /></Field>
    <FormNotice error={state.error} message={state.message} /><button className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : followup ? "Save follow-up" : "Create follow-up"}</button>
  </form>;
}

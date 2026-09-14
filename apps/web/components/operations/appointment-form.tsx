"use client";

import { useActionState } from "react";
import { createAppointment, updateAppointment } from "@/app/app/appointments/actions";
import { Field, FormNotice, inputClass } from "@/components/sales/form-fields";
import { initialFormState } from "@/lib/domain/sales/schemas";
import { contactName } from "@/lib/domain/sales/format";
import { toLocalInput } from "@/lib/domain/operations/time";
import type { Appointment, OperationalReferences } from "@/lib/domain/operations/types";

type FixedLinks = { contactId: string; leadId?: string | null; opportunityId?: string | null };

export function AppointmentForm({ references, timezone, appointment, fixedLinks, compact = false }: { references: OperationalReferences; timezone: string; appointment?: Appointment; fixedLinks?: FixedLinks; compact?: boolean }) {
  const serverAction = appointment ? updateAppointment.bind(null, appointment.id) : createAppointment;
  const [state, action, pending] = useActionState(serverAction, initialFormState);
  const contactId = fixedLinks?.contactId ?? appointment?.contact_id ?? "";
  const leadId = fixedLinks?.leadId ?? appointment?.lead_id ?? "";
  const opportunityId = fixedLinks?.opportunityId ?? appointment?.opportunity_id ?? "";
  return (
    <form action={action} className="grid gap-4">
      {fixedLinks ? <><input name="contactId" type="hidden" value={contactId} /><input name="leadId" type="hidden" value={leadId ?? ""} /><input name="opportunityId" type="hidden" value={opportunityId ?? ""} /></> : <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Contact" name={`contactId-${appointment?.id ?? "new"}`} error={state.fieldErrors?.contactId}><select className={inputClass} defaultValue={contactId} id={`contactId-${appointment?.id ?? "new"}`} name="contactId" required><option value="">Choose contact</option>{references.contacts.map((contact) => <option key={contact.id} value={contact.id}>{contactName(contact)}</option>)}</select></Field>
        <Field label="Lead" name={`leadId-${appointment?.id ?? "new"}`} error={state.fieldErrors?.leadId}><select className={inputClass} defaultValue={leadId ?? ""} id={`leadId-${appointment?.id ?? "new"}`} name="leadId"><option value="">No lead</option>{references.leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.id.slice(0, 8)} · {lead.status}</option>)}</select></Field>
        <Field label="Opportunity" name={`opportunityId-${appointment?.id ?? "new"}`} error={state.fieldErrors?.opportunityId}><select className={inputClass} defaultValue={opportunityId ?? ""} id={`opportunityId-${appointment?.id ?? "new"}`} name="opportunityId"><option value="">No opportunity</option>{references.opportunities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      </div>}
      <div className={`grid gap-4 ${compact ? "" : "sm:grid-cols-2"}`}>
        <Field label="Title" name={`title-${appointment?.id ?? "new"}`} error={state.fieldErrors?.title}><input className={inputClass} defaultValue={appointment?.title ?? ""} id={`title-${appointment?.id ?? "new"}`} name="title" required /></Field>
        <Field label="Type" name={`appointmentType-${appointment?.id ?? "new"}`} error={state.fieldErrors?.appointmentType}><input className={inputClass} defaultValue={appointment?.appointment_type ?? ""} id={`appointmentType-${appointment?.id ?? "new"}`} name="appointmentType" placeholder="Consultation" /></Field>
        <Field label="Starts" name={`startsAt-${appointment?.id ?? "new"}`} error={state.fieldErrors?.startsAt}><input className={inputClass} defaultValue={appointment ? toLocalInput(appointment.starts_at, appointment.timezone) : ""} id={`startsAt-${appointment?.id ?? "new"}`} name="startsAt" required type="datetime-local" /></Field>
        <Field label="Ends" name={`endsAt-${appointment?.id ?? "new"}`} error={state.fieldErrors?.endsAt}><input className={inputClass} defaultValue={appointment ? toLocalInput(appointment.ends_at, appointment.timezone) : ""} id={`endsAt-${appointment?.id ?? "new"}`} name="endsAt" required type="datetime-local" /></Field>
        <Field label="Timezone" name={`timezone-${appointment?.id ?? "new"}`} error={state.fieldErrors?.timezone}><input className={inputClass} defaultValue={appointment?.timezone ?? timezone} id={`timezone-${appointment?.id ?? "new"}`} name="timezone" required /></Field>
        <Field label="Assignee" name={`assignedUserId-${appointment?.id ?? "new"}`} error={state.fieldErrors?.assignedUserId}><select className={inputClass} defaultValue={appointment?.assigned_user_id ?? ""} id={`assignedUserId-${appointment?.id ?? "new"}`} name="assignedUserId"><option value="">Unassigned</option>{references.members.map((member) => <option key={member.userId} value={member.userId}>{member.label}</option>)}</select></Field>
        <Field label="Location" name={`location-${appointment?.id ?? "new"}`} error={state.fieldErrors?.location}><input className={inputClass} defaultValue={appointment?.location ?? ""} id={`location-${appointment?.id ?? "new"}`} name="location" /></Field>
        <Field label="Meeting URL" name={`meetingUrl-${appointment?.id ?? "new"}`} error={state.fieldErrors?.meetingUrl}><input className={inputClass} defaultValue={appointment?.meeting_url ?? ""} id={`meetingUrl-${appointment?.id ?? "new"}`} name="meetingUrl" type="url" /></Field>
      </div>
      <Field label="Notes" name={`notes-${appointment?.id ?? "new"}`} error={state.fieldErrors?.notes}><textarea className={`${inputClass} min-h-20`} defaultValue={appointment?.notes ?? ""} id={`notes-${appointment?.id ?? "new"}`} name="notes" /></Field>
      <FormNotice error={state.error} message={state.message} />
      <button className="rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : appointment ? "Save appointment" : "Create appointment"}</button>
    </form>
  );
}

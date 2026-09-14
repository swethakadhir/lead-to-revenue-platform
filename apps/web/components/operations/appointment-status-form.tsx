"use client";

import { useActionState, useState } from "react";
import { transitionAppointment } from "@/app/app/appointments/actions";
import { FormNotice, inputClass } from "@/components/sales/form-fields";
import { appointmentStatuses } from "@/lib/domain/operations/schemas";
import { initialFormState } from "@/lib/domain/sales/schemas";

export function AppointmentStatusForm({ id, status, cancellationReason }: { id: string; status: string; cancellationReason: string | null }) {
  const [selected, setSelected] = useState(status);
  const [state, action, pending] = useActionState(transitionAppointment, initialFormState);
  return <form action={action} className="grid gap-2"><input name="appointmentId" type="hidden" value={id} /><select aria-label="Appointment status" className={inputClass} name="status" onChange={(event) => setSelected(event.target.value)} value={selected}>{appointmentStatuses.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select>{selected === "cancelled" && <input className={inputClass} defaultValue={cancellationReason ?? ""} name="cancellationReason" placeholder="Cancellation reason (optional)" />}<FormNotice error={state.error} message={state.message} /><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Update status"}</button></form>;
}

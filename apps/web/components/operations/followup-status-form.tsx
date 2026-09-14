"use client";

import { useActionState } from "react";
import { transitionFollowup } from "@/app/app/followups/actions";
import { FormNotice, inputClass } from "@/components/sales/form-fields";
import { followupStatuses } from "@/lib/domain/operations/schemas";
import { initialFormState } from "@/lib/domain/sales/schemas";

export function FollowupStatusForm({ id, status, outcome }: { id: string; status: string; outcome: string | null }) {
  const [state, action, pending] = useActionState(transitionFollowup, initialFormState);
  return <form action={action} className="grid gap-2"><input name="followupId" type="hidden" value={id} /><select aria-label="Follow-up status" className={inputClass} defaultValue={status} name="status">{followupStatuses.map((item) => <option key={item} value={item}>{item}</option>)}</select><input className={inputClass} defaultValue={outcome ?? ""} name="outcome" placeholder="Outcome (optional)" /><FormNotice error={state.error} message={state.message} /><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Update status"}</button></form>;
}

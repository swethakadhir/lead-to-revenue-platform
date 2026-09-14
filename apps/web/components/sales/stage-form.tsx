"use client";

import { useActionState, useState } from "react";
import { transitionOpportunity } from "@/app/app/leads/actions";
import { FormNotice, inputClass } from "./form-fields";
import { initialFormState } from "@/lib/domain/sales/schemas";
import type { PipelineStage } from "@/lib/domain/sales/types";

export function StageForm({ opportunityId, currentStage, stages }: { opportunityId: string; currentStage: string; stages: PipelineStage[] }) {
  const [stageKey, setStageKey] = useState(currentStage);
  const [state, action, pending] = useActionState(transitionOpportunity, initialFormState);
  const selectedStage = stages.find((stage) => stage.key === stageKey);
  return (
    <form action={action} className="grid gap-2">
      <input name="opportunityId" type="hidden" value={opportunityId} />
      <select aria-label="Pipeline stage" className={inputClass} name="stageKey" onChange={(event) => setStageKey(event.target.value)} value={stageKey}>{stages.map((stage) => <option key={stage.key} value={stage.key}>{stage.name}</option>)}</select>
      {selectedStage?.stage_type === "lost" && <input className={inputClass} name="lostReason" placeholder="Reason lost" required />}
      <FormNotice error={state.error} message={state.message} />
      <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving…" : "Update stage"}</button>
    </form>
  );
}

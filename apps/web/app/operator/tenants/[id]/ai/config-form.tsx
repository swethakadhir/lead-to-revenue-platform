"use client";

import { useActionState } from "react";
import { saveTenantAIConfig } from "./actions";

export function TenantAIConfigForm({ tenantId, initialEnabled, initialScope, initialDatasetId, initialBindingStatus }: { tenantId: string; initialEnabled: boolean; initialScope: string; initialDatasetId: string; initialBindingStatus: string }) {
  const [state, action, pending] = useActionState(async (_previous: { error: string | null }, formData: FormData) => saveTenantAIConfig(formData), { error: null });
  return <form action={action} className="mt-5 grid gap-4">
    <input type="hidden" name="tenantId" value={tenantId} />
    <label className="grid gap-1 text-sm font-medium">Knowledge scope<input name="knowledgeScope" defaultValue={initialScope} required maxLength={160} className="rounded border px-3 py-2 font-normal" /><span className="font-normal text-slate-500">Optional routing/prompt hint only; it is not the dataset isolation boundary.</span></label>
    <label className="grid gap-1 text-sm font-medium">Dify dataset reference<input name="datasetId" defaultValue={initialDatasetId} maxLength={200} className="rounded border px-3 py-2 font-normal" /><span className="font-normal text-slate-500">Record the primary dataset created externally in Dify. Never accept this from chatbot visitors.</span></label>
    <label className="grid gap-1 text-sm font-medium">Knowledge binding status<select name="bindingStatus" defaultValue={initialBindingStatus} className="rounded border px-3 py-2 font-normal"><option value="unavailable">Unavailable</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="invalid">Invalid</option></select></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" value="true" defaultChecked={initialEnabled} /> Enable Dify routing for this tenant</label>
    <input type="hidden" name="enabled" value="false" />
    {state.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
    <button disabled={pending} className="w-fit rounded bg-violet-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? "Saving…" : "Save AI routing"}</button>
  </form>;
}

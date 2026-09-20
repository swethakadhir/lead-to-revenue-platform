"use client";

import { useActionState } from "react";
import { applyTemplate, saveAppointmentTypes, saveField, saveStage, type SettingsState } from "./actions";
import type { TableRow } from "@/lib/supabase/database.types";
import { appointmentTypes, fieldOptions } from "@/lib/domain/configuration/dynamic-fields";

const initial: SettingsState = { error: null };
const input = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
function Notice({ state }: { state: SettingsState }) { return state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : state.message ? <p role="status" className="text-sm text-emerald-700">{state.message}</p> : null; }

export function TemplateForm({ templates }: { templates: TableRow<"industry_templates">[] }) {
  const [state, action, pending] = useActionState(applyTemplate, initial);
  return <form action={action} className="flex flex-wrap items-center gap-3"><select aria-label="Business template" className={input} name="templateId" required><option value="">Choose template</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={pending}>Apply template</button><Notice state={state} /></form>;
}

export function FieldSettingsForm({ field }: { field: TableRow<"lead_field_definitions"> }) {
  const [state, action, pending] = useActionState(saveField, initial);
  return <form action={action} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2"><input name="id" type="hidden" value={field.id} /><div className="text-xs text-slate-500 sm:col-span-2">{field.field_type.replaceAll("_", " ")}</div><label className="grid gap-1 text-sm">Label<input className={input} defaultValue={field.label} name="label" required /></label><label className="grid gap-1 text-sm">Order<input className={input} defaultValue={field.sort_order} min="0" name="sortOrder" type="number" /></label>{["select", "multi_select"].includes(field.field_type) && <label className="grid gap-1 text-sm sm:col-span-2">Options, one per line<textarea className={input} defaultValue={fieldOptions(field).join("\n")} name="options" rows={3} /></label>}<div className="flex items-center gap-4 text-sm"><label><input defaultChecked={field.required} name="required" type="checkbox" /> Required</label><label><input defaultChecked={field.is_active} name="isActive" type="checkbox" /> Active</label></div><div className="flex items-center gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60" disabled={pending}>Save field</button><Notice state={state} /></div></form>;
}

export function AppointmentTypesForm({ value }: { value: TableRow<"tenant_settings">["appointment_types"] }) {
  const [state, action, pending] = useActionState(saveAppointmentTypes, initial);
  return <form action={action} className="grid gap-3"><label className="grid gap-1 text-sm">One type per line<textarea className={input} defaultValue={appointmentTypes(value).join("\n")} name="types" rows={4} /></label><div><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60" disabled={pending}>Save appointment types</button></div><Notice state={state} /></form>;
}

export function StageSettingsForm({ stage }: { stage: TableRow<"pipeline_definitions"> }) {
  const [state, action, pending] = useActionState(saveStage, initial);
  return <form action={action} className="flex flex-wrap items-center gap-2"><input name="key" type="hidden" value={stage.key} /><span className="w-40 text-xs text-slate-500 capitalize">{stage.stage_type} stage</span><input aria-label={`${stage.name} stage name`} className={input} defaultValue={stage.name} name="name" required /><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-60" disabled={pending}>Save</button><Notice state={state} /></form>;
}

import { redirect } from "next/navigation";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { getTenantConfiguration, listIndustryTemplates } from "@/lib/domain/configuration/data";
import { appointmentTypes } from "@/lib/domain/configuration/dynamic-fields";
import { getPipelineStages } from "@/lib/domain/sales/data";
import { AppointmentTypesForm, FieldSettingsForm, StageSettingsForm, TemplateForm } from "./settings-forms";
import Link from "next/link";

export default async function SettingsPage() {
  const tenant = await getActiveTenant();
  if (!tenant) redirect("/app/create-business");
  const [configuration, templates, stages] = await Promise.all([getTenantConfiguration(tenant.id), listIndustryTemplates(), getPipelineStages(tenant.id)]);
  const canEdit = ["owner", "admin"].includes(tenant.role);
  const template = templates.find((item) => item.id === configuration.templateId);
  return <main className="mx-auto grid max-w-5xl gap-6 px-5 py-8"><header><p className="text-sm font-medium text-blue-700">{tenant.name}</p><h1 className="text-3xl font-semibold">Business settings</h1><p className="mt-1 text-slate-600">Tenant-owned configuration copied from an industry template.</p></header>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Template and business</h2><p className="mt-2 text-sm">{template ? `${template.name} · version ${template.version}` : "Legacy business · generic configuration"}</p><p className="mt-1 text-sm text-slate-500">Currency: {tenant.currency} · Timezone: {tenant.timezone} · Name: {configuration.settings.business_name}</p>{!template && canEdit && <div className="mt-4"><p className="mb-2 text-sm text-slate-600">Apply a template once. Existing lead answers and pipeline records are preserved.</p><TemplateForm templates={templates} /></div>}</section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Lead fields</h2><div className="mt-4 grid gap-3">{configuration.fields.map((field) => canEdit ? <FieldSettingsForm field={field} key={field.id} /> : <div className="rounded-lg border border-slate-200 p-3 text-sm" key={field.id}>{field.label} · {field.field_type} · {field.required ? "Required" : "Optional"} · {field.is_active ? "Active" : "Inactive"}</div>)}</div></section>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Website chatbot</h2><p className="mt-2 text-sm text-slate-600">Configure the published website conversation, branding, lead capture, and starter flow.</p><Link className="mt-3 inline-block text-sm font-medium text-blue-700" href="/app/settings/chatbot">Open chatbot settings →</Link></section>
    <div className="grid gap-6 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Pipeline stages</h2><div className="mt-4 grid gap-3">{stages.map((stage) => canEdit ? <StageSettingsForm key={stage.id} stage={stage} /> : <p className="text-sm" key={stage.id}>{stage.stage_order}. {stage.name} · {stage.stage_type}</p>)}</div></section><section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-semibold">Appointment types</h2><div className="mt-4">{canEdit ? <AppointmentTypesForm value={configuration.settings.appointment_types} /> : <ul className="list-inside list-disc text-sm">{appointmentTypes(configuration.settings.appointment_types).map((type) => <li key={type}>{type}</li>)}</ul>}</div><h2 className="mt-7 text-lg font-semibold">Qualification criteria</h2><ul className="mt-3 grid gap-2 text-sm">{configuration.rules.filter((rule) => rule.is_active).map((rule) => <li key={rule.id}>{rule.name} · {rule.is_required ? "Required" : "Relevant"}</li>)}</ul><h2 className="mt-7 text-lg font-semibold">Follow-up defaults</h2><pre className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{JSON.stringify(configuration.settings.followup_defaults, null, 2)}</pre></section></div>
  </main>;
}

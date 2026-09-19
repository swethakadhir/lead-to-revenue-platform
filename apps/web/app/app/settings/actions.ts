"use server";

import { revalidatePath } from "next/cache";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { createClient } from "@/lib/supabase/server";

export type SettingsState = { error: string | null; message?: string };

async function adminTenant() {
  const tenant = await getActiveTenant();
  return tenant && ["owner", "admin"].includes(tenant.role) ? tenant : null;
}

export async function applyTemplate(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const tenant = await adminTenant();
  if (!tenant) return { error: "Only owners and admins can change configuration." };
  const templateId = String(formData.get("templateId") ?? "");
  const { error } = await (await createClient()).rpc("apply_industry_template", { p_tenant_id: tenant.id, p_template_id: templateId });
  if (error) return { error: "The template could not be applied. Check that this business has not selected one already." };
  revalidatePath("/app/settings"); revalidatePath("/app/leads");
  return { error: null, message: "Template applied to this business." };
}

export async function saveField(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const tenant = await adminTenant();
  if (!tenant) return { error: "Only owners and admins can change configuration." };
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder"));
  const required = formData.get("required") === "on";
  const isActive = formData.get("isActive") === "on";
  const options = String(formData.get("options") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (label.length < 1 || label.length > 100 || !Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 10000) return { error: "Enter a valid label and order." };
  if (options.length > 30 || options.some((item) => item.length > 100) || new Set(options).size !== options.length) return { error: "Options must be unique, at most 30, and under 100 characters." };
  const client = await createClient();
  const { data: field } = await client.from("lead_field_definitions").select("field_type").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
  if (!field) return { error: "Field not found in this business." };
  if (["select", "multi_select"].includes(field.field_type) && !options.length) return { error: "Select fields need at least one option." };
  const { error } = await client.from("lead_field_definitions").update({ label, sort_order: sortOrder, required, is_active: isActive, options: ["select", "multi_select"].includes(field.field_type) ? options : [] }).eq("id", id).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save this field." };
  revalidatePath("/app/settings"); revalidatePath("/app/leads");
  return { error: null, message: "Field saved." };
}

export async function saveAppointmentTypes(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const tenant = await adminTenant();
  if (!tenant) return { error: "Only owners and admins can change configuration." };
  const types = String(formData.get("types") ?? "").split("\n").map((item) => item.trim()).filter(Boolean);
  if (!types.length || types.length > 20 || types.some((item) => item.length > 80) || new Set(types).size !== types.length) return { error: "Enter 1–20 unique appointment types, one per line." };
  const { error } = await (await createClient()).from("tenant_settings").update({ appointment_types: types }).eq("tenant_id", tenant.id);
  if (error) return { error: "Could not save appointment types." };
  revalidatePath("/app/settings"); revalidatePath("/app/appointments");
  return { error: null, message: "Appointment types saved." };
}

export async function saveStage(_state: SettingsState, formData: FormData): Promise<SettingsState> {
  const tenant = await adminTenant();
  if (!tenant) return { error: "Only owners and admins can change configuration." };
  const key = String(formData.get("key") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 80) return { error: "Stage name must be 1–80 characters." };
  const { error } = await (await createClient()).from("pipeline_definitions").update({ name }).eq("tenant_id", tenant.id).eq("key", key);
  if (error) return { error: "Could not save stage name." };
  revalidatePath("/app/settings"); revalidatePath("/app/pipeline");
  return { error: null, message: "Stage renamed." };
}

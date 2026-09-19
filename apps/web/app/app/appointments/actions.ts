"use server";

import { revalidatePath } from "next/cache";
import { appointmentSchema, appointmentTransitionSchema, fieldsFromError, type FormState } from "@/lib/domain/operations/schemas";
import { zonedLocalToIso } from "@/lib/domain/operations/time";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { getTenantConfiguration } from "@/lib/domain/configuration/data";
import { appointmentTypes } from "@/lib/domain/configuration/dynamic-fields";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function appointmentInput(formData: FormData) {
  return {
    leadId: value(formData, "leadId"), opportunityId: value(formData, "opportunityId"), contactId: value(formData, "contactId"),
    assignedUserId: value(formData, "assignedUserId"), title: value(formData, "title"), appointmentType: value(formData, "appointmentType"),
    startsAt: value(formData, "startsAt"), endsAt: value(formData, "endsAt"), timezone: value(formData, "timezone"),
    location: value(formData, "location"), meetingUrl: value(formData, "meetingUrl"), notes: value(formData, "notes"),
  };
}

function mutationFrom(data: ReturnType<typeof appointmentSchema.parse>) {
  return {
    lead_id: data.leadId, opportunity_id: data.opportunityId, contact_id: data.contactId,
    assigned_user_id: data.assignedUserId, title: data.title, appointment_type: data.appointmentType,
    starts_at: zonedLocalToIso(data.startsAt, data.timezone), ends_at: zonedLocalToIso(data.endsAt, data.timezone), timezone: data.timezone,
    location: data.location, meeting_url: data.meetingUrl, notes: data.notes,
  };
}

export async function createAppointment(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = appointmentSchema.safeParse(appointmentInput(formData));
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };
  const types = appointmentTypes((await getTenantConfiguration(tenant.id)).settings.appointment_types);
  if (result.data.appointmentType && !types.includes(result.data.appointmentType)) return { error: "Choose an available appointment type.", fieldErrors: { appointmentType: ["Choose an available type."] } };
  try {
    const { error } = await (await createClient()).from("appointments").insert({ ...mutationFrom(result.data), tenant_id: tenant.id });
    if (error) return { error: "The appointment could not be created. Verify its linked records and assignee." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The appointment time is invalid." };
  }
  revalidateAppointmentViews(result.data.leadId);
  return { error: null, message: "Appointment created." };
}

export async function updateAppointment(appointmentId: string, _state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = appointmentSchema.safeParse(appointmentInput(formData));
  if (!result.success) return { error: "Check the highlighted fields.", fieldErrors: fieldsFromError(result.error) };
  const types = appointmentTypes((await getTenantConfiguration(tenant.id)).settings.appointment_types);
  if (result.data.appointmentType && !types.includes(result.data.appointmentType)) {
    const { data: existing } = await (await createClient()).from("appointments").select("appointment_type").eq("tenant_id", tenant.id).eq("id", appointmentId).maybeSingle();
    if (existing?.appointment_type !== result.data.appointmentType) return { error: "Choose an available appointment type.", fieldErrors: { appointmentType: ["Choose an available type."] } };
  }
  try {
    const { data, error } = await (await createClient()).from("appointments").update(mutationFrom(result.data)).eq("tenant_id", tenant.id).eq("id", appointmentId).select("id").maybeSingle();
    if (error || !data) return { error: "The appointment could not be updated." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "The appointment time is invalid." };
  }
  revalidateAppointmentViews(result.data.leadId);
  return { error: null, message: "Appointment updated." };
}

export async function transitionAppointment(_state: FormState, formData: FormData): Promise<FormState> {
  const tenant = await getActiveTenant();
  if (!tenant) return { error: "No active business is available." };
  const result = appointmentTransitionSchema.safeParse({ appointmentId: value(formData, "appointmentId"), status: value(formData, "status"), cancellationReason: value(formData, "cancellationReason") });
  if (!result.success) return { error: "Choose a valid appointment status.", fieldErrors: fieldsFromError(result.error) };
  const { data, error } = await (await createClient()).from("appointments")
    .update({ status: result.data.status, cancellation_reason: result.data.cancellationReason })
    .eq("tenant_id", tenant.id).eq("id", result.data.appointmentId).select("id, lead_id").maybeSingle();
  if (error || !data) return { error: "The appointment status could not be changed." };
  revalidateAppointmentViews(data.lead_id);
  return { error: null, message: "Appointment status updated." };
}

function revalidateAppointmentViews(leadId: string | null) {
  revalidatePath("/app/appointments");
  revalidatePath("/app/dashboard");
  if (leadId) revalidatePath(`/app/leads/${leadId}`);
}

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAvailability, type AvailableSlot } from "@/lib/domain/availability/calculate";
import { parseBookingHours, type BookingHours } from "@/lib/domain/configuration/booking-hours";
import { toLocalInput, zonedLocalToIso } from "@/lib/domain/operations/time";
import type { Json, TableRow } from "@/lib/supabase/database.types";
import { createChatbotSelfBooking, type SelfBookingResult } from "./self-booking";

const SEARCH_DAYS = 7;
const MAX_SLOTS = 5;
const SLOT_PREFIX = "booking-slot:";

export type BookingPresentation = {
  kind: "not_ready" | "missing_config" | "no_slots" | "available" | "already_booked";
  message?: string;
  options: { id: string; label: string }[];
  slots: AvailableSlot[];
  existing?: { startsAt: string; endsAt: string; timezone: string };
};

function object(value: Json | null | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function optionId(slot: AvailableSlot) { return `${SLOT_PREFIX}${slot.slotKey}`; }

function localDate(value: Date, timezone: string) { return toLocalInput(value.toISOString(), timezone).slice(0, 10); }

function addLocalDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function labelFor(slot: AvailableSlot) {
  return new Intl.DateTimeFormat("en", { timeZone: slot.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(slot.startsAt));
}

function hasBookingConfig(value: Json) {
  const config = object(value);
  return config.weekly !== undefined && config.slot_duration_minutes !== undefined && config.slot_interval_minutes !== undefined;
}

function existingBookingId(context: Json | null | undefined) {
  const booking = object(object(context)._booking);
  return typeof booking.appointment_id === "string" ? booking.appointment_id : null;
}

export async function getChatbotBookingPresentation(tenantId: string, conversation: TableRow<"conversations">, now = new Date()): Promise<BookingPresentation> {
  if (!conversation.lead_id) return { kind: "not_ready", options: [], slots: [] };
  const admin = createAdminClient();
  const [{ data: journey, error: journeyError }, { data: tenant, error: tenantError }, { data: settings, error: settingsError }] = await Promise.all([
    admin.from("lead_journeys").select("stage").eq("tenant_id", tenantId).eq("lead_id", conversation.lead_id).maybeSingle(),
    admin.from("tenants").select("timezone").eq("id", tenantId).single(),
    admin.from("tenant_settings").select("business_hours").eq("tenant_id", tenantId).single(),
  ]);
  if (journeyError || tenantError || settingsError) throw journeyError ?? tenantError ?? settingsError;
  if (!journey || journey.stage !== "booking_ready") return { kind: "not_ready", options: [], slots: [] };

  const appointmentId = existingBookingId(conversation.context);
  if (appointmentId) {
    const { data: existing, error } = await admin.from("appointments").select("starts_at,ends_at").eq("tenant_id", tenantId).eq("id", appointmentId).eq("lead_id", conversation.lead_id).eq("contact_id", conversation.contact_id).maybeSingle();
    if (error) throw error;
    if (existing) return { kind: "already_booked", options: [], slots: [], existing: { startsAt: existing.starts_at, endsAt: existing.ends_at, timezone: tenant.timezone } };
  }

  const rawHours = settings?.business_hours as Json;
  if (!hasBookingConfig(rawHours)) return { kind: "missing_config", message: "Online booking is not currently configured. Please contact our team to arrange a time.", options: [], slots: [] };
  const parsed = parseBookingHours(rawHours);
  if (parsed.error || !parsed.value) return { kind: "missing_config", message: "Online booking is not currently configured. Please contact our team to arrange a time.", options: [], slots: [] };
  const startDate = localDate(now, tenant.timezone);
  const endDate = addLocalDays(startDate, SEARCH_DAYS);
  const rangeStart = zonedLocalToIso(`${startDate}T00:00`, tenant.timezone);
  const rangeEnd = zonedLocalToIso(`${endDate}T00:00`, tenant.timezone);
  const { data: appointments, error: appointmentsError } = await admin.from("appointments").select("starts_at,ends_at,status").eq("tenant_id", tenantId).in("status", ["scheduled", "confirmed"]).lt("starts_at", rangeEnd).gt("ends_at", rangeStart);
  if (appointmentsError) throw appointmentsError;
  const slots = calculateAvailability(parsed.value as BookingHours, tenant.timezone, appointments ?? [], { startDate, endDate, maxResults: MAX_SLOTS, now });
  if (!slots.length) return { kind: "no_slots", message: "No online appointment times are currently available.", options: [], slots: [] };
  return { kind: "available", options: slots.map((slot) => ({ id: optionId(slot), label: labelFor(slot) })), slots };
}

export function isBookingSlotOption(value: string | undefined) { return Boolean(value?.startsWith(SLOT_PREFIX)); }

export async function selectChatbotBookingSlot(tenantId: string, conversation: TableRow<"conversations">, optionValue: string, now = new Date()): Promise<{ result: SelfBookingResult; slot: AvailableSlot | null; presentation: BookingPresentation }> {
  const presentation = await getChatbotBookingPresentation(tenantId, conversation, now);
  const selected = presentation.kind === "available" ? presentation.slots.find((slot) => optionId(slot) === optionValue) ?? null : null;
  if (!selected) return { result: { resultCode: presentation.kind === "available" ? "slot_unavailable" : "invalid_request", appointmentId: null, startsAt: null, endsAt: null }, slot: null, presentation };
  const result = await createChatbotSelfBooking(tenantId, conversation.id, selected);
  return { result, slot: selected, presentation };
}

export function bookingConfirmation(result: Extract<SelfBookingResult, { resultCode: "booked" | "already_booked" }>, timezone: string) {
  return `Your appointment is scheduled for ${new Intl.DateTimeFormat("en", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(result.startsAt))}.`;
}

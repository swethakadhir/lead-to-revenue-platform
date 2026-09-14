import { z } from "zod";
import { isTimeZone } from "./time";
import { fieldsFromError, type FormState } from "@/lib/domain/sales/schemas";

export type { FormState };
export { fieldsFromError };

export const appointmentStatuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
export const followupStatuses = ["pending", "completed", "cancelled"] as const;
export const followupTypes = ["call", "whatsapp", "email", "meeting", "general"] as const;

const optionalUuid = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);
const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time.");

export const appointmentSchema = z.object({
  leadId: optionalUuid,
  opportunityId: optionalUuid,
  contactId: z.uuid("Choose a contact."),
  assignedUserId: optionalUuid,
  title: z.string().trim().min(1, "Title is required.").max(160),
  appointmentType: optionalText(80),
  startsAt: localDateTime,
  endsAt: localDateTime,
  timezone: z.string().trim().max(100).refine(isTimeZone, "Enter a valid IANA timezone."),
  location: optionalText(500),
  meetingUrl: z.union([z.url("Enter a valid meeting URL."), z.literal("")]).transform((value) => value || null),
  notes: optionalText(10_000),
}).refine((value) => value.endsAt > value.startsAt, { path: ["endsAt"], message: "End time must be after start time." });

export const appointmentTransitionSchema = z.object({
  appointmentId: z.uuid(),
  status: z.enum(appointmentStatuses),
  cancellationReason: optionalText(1000),
});

export const followupSchema = z.object({
  leadId: optionalUuid,
  opportunityId: optionalUuid,
  contactId: z.uuid("Choose a contact."),
  assignedUserId: optionalUuid,
  type: z.enum(followupTypes),
  dueAt: localDateTime,
  notes: optionalText(10_000),
  outcome: optionalText(5000),
});

export const followupTransitionSchema = z.object({
  followupId: z.uuid(),
  status: z.enum(followupStatuses),
  outcome: optionalText(5000),
});

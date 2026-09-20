import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

export const leadStatuses = ["new", "contacted", "engaged", "understanding_requirement", "qualifying", "qualified", "booking_ready", "booking_in_progress", "human_intervention", "disqualified", "dormant", "converted"] as const;
export const qualificationStatuses = ["unqualified", "pending", "qualified", "disqualified"] as const;

export type FormState = {
  error: string | null;
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

export const initialFormState: FormState = { error: null };

const optionalUuid = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const optionalPhone = z.string().trim().max(40).refine(
  (value) => !value || value.replace(/\D/g, "").length >= 6,
  "Enter a valid phone number.",
).transform((value) => value || null);
const optionalNumber = (minimum: number, maximum: number) => z.preprocess(
  (value) => value === "" || value === null ? undefined : value,
  z.coerce.number().min(minimum).max(maximum).optional(),
).transform((value) => value ?? null);

const jsonObjectText = z.preprocess((input, context): unknown => {
  const value = typeof input === "string" ? input.trim() : input;
  if (value === "") return {};
  if (typeof value === "object" && value !== null && !Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed;
    } catch {
      // The schema issue below provides the user-facing validation message.
    }
  }
  context.addIssue({ code: "custom", message: "Enter a valid JSON object." });
  return z.NEVER;
}, z.record(z.string(), z.unknown()).transform((value): Json => value as Json));

const contactFields = {
  firstName: z.string().trim().min(1, "First name is required.").max(100),
  lastName: optionalText(100),
  email: z.union([z.email("Enter a valid email address."), z.literal("")]).transform((value) => value || null),
  phone: optionalPhone,
};

export const createLeadSchema = z.object({
  ...contactFields,
  status: z.enum(leadStatuses),
  assignedUserId: optionalUuid,
  leadData: jsonObjectText,
}).refine((value) => value.email || value.phone, {
  message: "Add an email address or phone number.",
  path: ["email"],
});

export const updateLeadSchema = z.object({
  ...contactFields,
  status: z.enum(leadStatuses),
  qualificationStatus: z.enum(qualificationStatuses),
  qualificationScore: optionalNumber(0, 100),
  assignedUserId: optionalUuid,
  leadData: jsonObjectText,
});

export const createOpportunitySchema = z.object({
  name: z.string().trim().min(1, "Opportunity name is required.").max(160),
  stageKey: z.string().trim().min(1).max(63),
  estimatedValue: optionalNumber(0, 999_999_999_999.99),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a three-letter currency code."),
  probability: optionalNumber(0, 100),
  assignedUserId: optionalUuid,
  expectedCloseDate: z.union([z.iso.date(), z.literal("")]).transform((value) => value || null),
});

export const stageTransitionSchema = z.object({
  opportunityId: z.uuid(),
  stageKey: z.string().trim().min(1).max(63),
  lostReason: optionalText(1000),
});

export function fieldsFromError(error: z.ZodError) {
  return z.flattenError(error).fieldErrors as Record<string, string[]>;
}

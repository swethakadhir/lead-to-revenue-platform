import type { TableRow, Json } from "@/lib/supabase/database.types";

export type LeadFieldDefinition = TableRow<"lead_field_definitions">;
export type DynamicFieldResult = { success: true; data: Record<string, Json | undefined> } | { success: false; fieldErrors: Record<string, string[]> };

export function fieldOptions(field: LeadFieldDefinition): string[] {
  return Array.isArray(field.options) ? field.options.filter((item): item is string => typeof item === "string") : [];
}

export function appointmentTypes(value: Json): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function parseValue(field: LeadFieldDefinition, raw: string | string[]): { value?: Json; error?: string } {
  const value = Array.isArray(raw) ? raw : raw.trim();
  if (value === "" || (Array.isArray(value) && value.length === 0)) return {};
  switch (field.field_type) {
    case "text": case "phone": case "email": case "textarea": {
      if (typeof value !== "string") return { error: "Enter a single value." };
      if (value.length > (field.field_type === "textarea" ? 5000 : 500)) return { error: "This value is too long." };
      if (field.field_type === "phone" && value.replace(/\D/g, "").length < 6) return { error: "Enter a valid phone number." };
      if (field.field_type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: "Enter a valid email address." };
      return { value };
    }
    case "number": case "currency": {
      if (typeof value !== "string" || !/^-?\d+(?:\.\d+)?$/.test(value)) return { error: "Enter a valid number." };
      const number = Number(value);
      if (!Number.isFinite(number) || (field.field_type === "currency" && number < 0)) return { error: "Enter a valid non-negative amount." };
      return { value: number };
    }
    case "select":
      return typeof value === "string" && fieldOptions(field).includes(value) ? { value } : { error: "Choose an available option." };
    case "multi_select":
      return Array.isArray(value) && value.every((item) => fieldOptions(field).includes(item)) && new Set(value).size === value.length
        ? { value } : { error: "Choose available options." };
    case "boolean":
      return value === "true" ? { value: true } : value === "false" ? { value: false } : { error: "Choose yes or no." };
    case "date":
      return typeof value === "string" && validDate(value) ? { value } : { error: "Enter a valid date." };
    case "datetime":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)
        && validDate(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14, 16)) < 60
        ? { value } : { error: "Enter a valid date and time." };
    default:
      return { error: "Unsupported field type." };
  }
}

export function parseDynamicLeadData(fields: LeadFieldDefinition[], formData: FormData, existing?: Json): DynamicFieldResult {
  const previous: Record<string, Json | undefined> = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...existing } : {};
  const data = { ...previous };
  const fieldErrors: Record<string, string[]> = {};
  for (const field of fields.filter((item) => item.is_active)) {
    const name = `dynamic.${field.key}`;
    const entries = formData.getAll(name);
    const raw = field.field_type === "multi_select" ? entries.map(String) : String(entries[0] ?? "");
    const parsed = parseValue(field, raw);
    if (parsed.error) fieldErrors[name] = [parsed.error];
    else if (parsed.value === undefined) {
      if (field.required && (!existing || previous[field.key] !== undefined)) fieldErrors[name] = ["This field is required."];
      else delete data[field.key];
    } else data[field.key] = parsed.value;
  }
  return Object.keys(fieldErrors).length ? { success: false, fieldErrors } : { success: true, data };
}

export function displayDynamicValue(value: Json | undefined): string {
  if (value === undefined || value === null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(String).join(", ") || "Not set";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

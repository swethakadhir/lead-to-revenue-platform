"use client";

import { Field, inputClass } from "./form-fields";
import { fieldOptions, type LeadFieldDefinition } from "@/lib/domain/configuration/dynamic-fields";
import type { Json } from "@/lib/supabase/database.types";

export function DynamicLeadFields({ fields, values, errors }: { fields: LeadFieldDefinition[]; values?: Json; errors?: Record<string, string[]> }) {
  const data = values && typeof values === "object" && !Array.isArray(values) ? values : {};
  return <fieldset className="grid gap-4"><legend className="mb-3 font-medium">Business-specific details</legend>
    {fields.filter((field) => field.is_active).map((field) => {
      const name = `dynamic.${field.key}`;
      const current = data[field.key];
      const text = typeof current === "string" || typeof current === "number" ? String(current) : "";
      const options = fieldOptions(field);
      return <Field key={field.id} label={`${field.label}${field.required ? " *" : ""}`} name={name} error={errors?.[name]}>
        {field.field_type === "textarea" ? <textarea className={`${inputClass} min-h-20`} defaultValue={text} id={name} name={name} placeholder={field.placeholder ?? undefined} />
          : field.field_type === "select" ? <select className={inputClass} defaultValue={text} id={name} name={name}><option value="">Choose an option</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          : field.field_type === "multi_select" ? <select className={`${inputClass} min-h-24`} defaultValue={Array.isArray(current) ? current.map(String) : []} id={name} multiple name={name}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
          : field.field_type === "boolean" ? <select className={inputClass} defaultValue={typeof current === "boolean" ? String(current) : ""} id={name} name={name}><option value="">Choose</option><option value="true">Yes</option><option value="false">No</option></select>
          : <input className={inputClass} defaultValue={text} id={name} name={name} placeholder={field.placeholder ?? undefined} step={field.field_type === "number" || field.field_type === "currency" ? "any" : undefined} type={{ currency: "number", number: "number", date: "date", datetime: "datetime-local", email: "email", phone: "tel" }[field.field_type] ?? "text"} />}
        {field.help_text && <span className="mt-1 block text-xs text-slate-500">{field.help_text}</span>}
      </Field>;
    })}
  </fieldset>;
}

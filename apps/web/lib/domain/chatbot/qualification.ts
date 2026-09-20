import type { Json, TableRow } from "@/lib/supabase/database.types";
type Context = Record<string, Json | undefined>;
export function evaluateQualification(rules: TableRow<"qualification_rules">[], context: Context) {
  const active = rules.filter((rule) => rule.is_active); const required = active.filter((rule) => rule.is_required);
  const missingFieldKeys = required.filter((rule) => { if (rule.rule_type === "contact_details") return !context.email && !context.phone; const value = context[rule.field_key]; return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0); }).map((rule) => rule.field_key);
  const score = active.reduce((total, rule) => { const value = rule.rule_type === "contact_details" ? (context.email || context.phone) : context[rule.field_key]; return value === undefined || value === null || value === "" ? total : total + rule.score_delta; }, 0);
  return { qualificationStatus: missingFieldKeys.length ? "pending" : "qualified", score, missingFieldKeys } as const;
}

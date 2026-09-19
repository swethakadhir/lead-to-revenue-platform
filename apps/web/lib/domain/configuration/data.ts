import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TableRow } from "@/lib/supabase/database.types";

export async function listIndustryTemplates(): Promise<TableRow<"industry_templates">[]> {
  const { data, error } = await (await createClient()).from("industry_templates").select("*").eq("is_active", true).order("name");
  if (error) throw error;
  return data ?? [];
}

export async function getTenantConfiguration(tenantId: string) {
  const client = await createClient();
  const [settings, fields, rules, tenant] = await Promise.all([
    client.from("tenant_settings").select("*").eq("tenant_id", tenantId).single(),
    client.from("lead_field_definitions").select("*").eq("tenant_id", tenantId).order("sort_order"),
    client.from("qualification_rules").select("*").eq("tenant_id", tenantId).order("name"),
    client.from("tenants").select("industry_template_id").eq("id", tenantId).single(),
  ]);
  if (settings.error || fields.error || rules.error || tenant.error) throw settings.error ?? fields.error ?? rules.error ?? tenant.error;
  return { settings: settings.data!, fields: fields.data ?? [], rules: rules.data ?? [], templateId: tenant.data!.industry_template_id };
}

"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { setActiveTenant } from "@/lib/tenancy/active-tenant";
import { canonicalizeIanaTimeZone } from "@/lib/tenancy/timezone";

export type CreateBusinessState = { error: string | null };

export async function createBusiness(_state: CreateBusinessState, formData: FormData): Promise<CreateBusinessState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const timezone = canonicalizeIanaTimeZone(String(formData.get("timezone") ?? ""));
  const currency = String(formData.get("currency") ?? "").trim().toUpperCase();

  if (name.length < 2 || name.length > 120) {
    return { error: "Business name must be between 2 and 120 characters." };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 63) {
    return { error: "Slug must use lowercase letters, numbers, and single hyphens." };
  }
  if (!timezone || timezone.length > 100) {
    return { error: "Enter a valid IANA timezone, such as Asia/Kolkata." };
  }
  if (!/^[A-Z]{3}$/.test(currency)) {
    return { error: "Currency must be a three-letter ISO code, such as USD." };
  }

  const { data: tenant, error } = await createAdminClient().rpc("create_tenant_with_owner", {
    p_creator_user_id: user.id,
    p_name: name,
    p_slug: slug,
    p_timezone: timezone,
    p_currency: currency,
  });
  if (error || !tenant) {
    if (error?.code === "23505") return { error: "That business slug is already in use." };
    return { error: "The business could not be created. Please try again." };
  }

  await setActiveTenant(tenant.id);
  redirect("/app/dashboard");
}

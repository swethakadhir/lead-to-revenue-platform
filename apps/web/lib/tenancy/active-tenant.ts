import "server-only";

import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_TENANT_COOKIE = "ltr_active_tenant";

export type ActiveTenant = {
  id: string; name: string; slug: string; timezone: string; currency: string; role: string;
};

export async function getActiveTenant(): Promise<ActiveTenant | null> {
  const user = await requireUser();
  const requestedTenantId = (await cookies()).get(ACTIVE_TENANT_COOKIE)?.value;
  const supabase = await createClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_members")
    .select("tenant_id, role, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (membershipError) throw membershipError;
  if (!memberships?.length) return null;

  const { data: tenants, error: tenantError } = await supabase
    .from("tenants")
    .select("id, name, slug, timezone, currency")
    .in("id", memberships.map((item) => item.tenant_id))
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (tenantError) throw tenantError;
  if (!tenants?.length) return null;

  const tenant = tenants.find((item) => item.id === requestedTenantId) ?? tenants[0];
  const membership = memberships.find((item) => item.tenant_id === tenant.id);
  if (!membership) return null;
  return { ...tenant, role: membership.role };
}

export async function setActiveTenant(tenantId: string) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error } = await supabase
    .from("tenant_members")
    .select("tenant_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !membership) throw new Error("You do not have access to that tenant.");

  (await cookies()).set(ACTIVE_TENANT_COOKIE, membership.tenant_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearActiveTenant() {
  (await cookies()).delete(ACTIVE_TENANT_COOKIE);
}

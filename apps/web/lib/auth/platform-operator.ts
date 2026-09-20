import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function getPlatformOperator() {
  const user = await requireUser();
  const { data, error } = await (await createClient()).from("platform_operators").select("user_id, role").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (error) throw error;
  return data ? { userId: data.user_id, role: data.role } : null;
}

export async function requirePlatformOperator() {
  const operator = await getPlatformOperator();
  if (!operator) redirect("/app/dashboard");
  return operator;
}

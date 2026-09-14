import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

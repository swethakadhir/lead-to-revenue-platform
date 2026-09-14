import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";

export default async function AppPage() {
  await requireUser();
  redirect("/app/dashboard");
}

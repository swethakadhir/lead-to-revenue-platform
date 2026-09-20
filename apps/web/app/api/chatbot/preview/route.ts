import { NextResponse } from "next/server";
import { publicChatInput, processPreviewMessage } from "@/lib/domain/chatbot/engine";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { canManageAdvancedChatbotSetup } from "@/lib/domain/chatbot/policy";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const tenant = await getActiveTenant();
  if (!tenant) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!canManageAdvancedChatbotSetup(tenant.role)) return NextResponse.json({ error: "Chatbot preview is not available for this role." }, { status: 403 });
  const parsed = publicChatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid preview request." }, { status: 400 });
  try {
    const result = await processPreviewMessage(tenant.id, parsed.data);
    if (!result) return NextResponse.json({ error: "Preview is unavailable." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "The preview could not process that request." }, { status: 400 }); }
}

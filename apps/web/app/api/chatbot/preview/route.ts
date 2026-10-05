import { NextResponse } from "next/server";
import { publicChatInput, processPreviewMessage } from "@/lib/domain/chatbot/engine";
import { getActiveTenant } from "@/lib/tenancy/active-tenant";
import { canManageAdvancedChatbotSetup } from "@/lib/domain/chatbot/policy";
import { ChatbotTiming } from "@/lib/domain/chatbot/timing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const timing = new ChatbotTiming();
  const tenant = await timing.measure("preview.authorization_tenant_resolution", () => getActiveTenant());
  if (!tenant) {
    timing.finish({ route: "preview", outcome: "unauthorized" });
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!canManageAdvancedChatbotSetup(tenant.role)) {
    timing.finish({ route: "preview", outcome: "forbidden" });
    return NextResponse.json({ error: "Chatbot preview is not available for this role." }, { status: 403 });
  }
  const parsed = publicChatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    timing.finish({ route: "preview", outcome: "invalid_request" });
    return NextResponse.json({ error: "Invalid preview request." }, { status: 400 });
  }
  try {
    const result = await processPreviewMessage(tenant.id, parsed.data, timing);
    if (!result) {
      timing.finish({ route: "preview", action: parsed.data.action, outcome: "unavailable" });
      return NextResponse.json({ error: "Preview is unavailable." }, { status: 404 });
    }
    timing.finish({ route: "preview", action: parsed.data.action, outcome: "ok" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    timing.finish({ route: "preview", action: parsed.data.action, outcome: "error" });
    console.error("[ChatbotPreview] request failed", { action: parsed.data.action, category: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "The preview could not process that request." }, { status: 400 });
  }
}

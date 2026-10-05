import { NextResponse } from "next/server";
import { processIncomingMessage, publicChatInput } from "@/lib/domain/chatbot/engine";
import { ChatbotTiming } from "@/lib/domain/chatbot/timing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const timing = new ChatbotTiming();
  const parsed = publicChatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    timing.finish({ route: "public", outcome: "invalid_request" });
    return NextResponse.json({ error: "Invalid chatbot request." }, { status: 400 });
  }
  try {
    const result = await processIncomingMessage(parsed.data, timing);
    if (!result) {
      timing.finish({ route: "public", action: parsed.data.action, outcome: "unavailable" });
      return NextResponse.json({ error: "This chatbot is unavailable." }, { status: 404 });
    }
    timing.finish({ route: "public", action: parsed.data.action, outcome: "ok" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    timing.finish({ route: "public", action: parsed.data.action, outcome: "error" });
    // Do not reveal graph or tenant details to anonymous visitors.
    return NextResponse.json({ error: "The chatbot could not process that request." }, { status: 400 });
  }
}

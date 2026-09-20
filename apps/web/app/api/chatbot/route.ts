import { NextResponse } from "next/server";
import { processIncomingMessage, publicChatInput } from "@/lib/domain/chatbot/engine";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const parsed = publicChatInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid chatbot request." }, { status: 400 });
  try {
    const result = await processIncomingMessage(parsed.data);
    if (!result) return NextResponse.json({ error: "This chatbot is unavailable." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not reveal graph or tenant details to anonymous visitors.
    return NextResponse.json({ error: "The chatbot could not process that request." }, { status: 400 });
  }
}

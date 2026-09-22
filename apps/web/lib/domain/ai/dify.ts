import "server-only";

import { aiUnderstandingSchema, buildDifyChatMessageBody, normalizeAIUnderstandingPayload, type AIMessageInput, type AIService, type AIServiceResult } from "./service";
function endpoint(baseUrl: string) { return `${baseUrl.replace(/\/$/, "")}/chat-messages`; }
function diagnostic(event: string, details: Record<string, string | number | boolean> = {}) {
  if (process.env.NODE_ENV === "development") console.info("[DifyAIService]", event, details);
}
export class DifyAIService implements AIService {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly timeoutMs = 8000) {}
  async understandMessage(input: AIMessageInput): Promise<AIServiceResult> { return this.request(input, "understand"); }
  async answerKnowledgeQuery(input: AIMessageInput): Promise<AIServiceResult> { return this.request(input, "knowledge"); }
  private async request(input: AIMessageInput, mode: "understand" | "knowledge"): Promise<AIServiceResult> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      diagnostic("request started", { mode, tenant_scoped: true });
      const response = await fetch(endpoint(this.baseUrl), { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify(buildDifyChatMessageBody(input, mode)) });
      diagnostic("HTTP status", { status: response.status });
      if (!response.ok) { diagnostic("provider error", { category: "unavailable", status: response.status }); return { ok: false, provider: "dify", category: "unavailable" }; }
      const body: unknown = await response.json().catch(() => null);
      const answer = body && typeof body === "object" && "answer" in body && typeof body.answer === "string" ? body.answer : null;
      if (!answer) { diagnostic("response validation failed", { reason: "missing_answer" }); return { ok: false, provider: "dify", category: "malformed" }; }
      const parsed = aiUnderstandingSchema.safeParse(normalizeAIUnderstandingPayload(JSON.parse(answer)));
      if (!parsed.success) { diagnostic("response validation failed", { reason: "schema" }); return { ok: false, provider: "dify", category: "malformed" }; }
      if (parsed.data.confidence < 0.55) { diagnostic("provider error", { category: "low_confidence" }); return { ok: false, provider: "dify", category: "low_confidence" }; }
      return { ok: true, provider: "dify", result: parsed.data };
    } catch (error) { const category = error instanceof DOMException && error.name === "AbortError" ? "timeout" : "unavailable"; diagnostic("provider error", { category }); return { ok: false, provider: "dify", category }; } finally { clearTimeout(timeout); }
  }
}

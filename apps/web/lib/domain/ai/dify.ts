import "server-only";

import { aiUnderstandingSchema, type AIMessageInput, type AIService, type AIServiceResult } from "./service";
function endpoint(baseUrl: string) { return `${baseUrl.replace(/\/$/, "")}/chat-messages`; }
export class DifyAIService implements AIService {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly timeoutMs = 8000) {}
  async understandMessage(input: AIMessageInput): Promise<AIServiceResult> { return this.request(input, "understand"); }
  async answerKnowledgeQuery(input: AIMessageInput): Promise<AIServiceResult> { return this.request(input, "knowledge"); }
  private async request(input: AIMessageInput, mode: "understand" | "knowledge"): Promise<AIServiceResult> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(endpoint(this.baseUrl), { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({
        inputs: { tenant_id: input.tenantId, knowledge_scope: input.knowledgeScope, routing_mode: mode, current_node: input.currentNodeKey, configured_fields: input.configuredFields }, query: input.message, response_mode: "blocking",
        // Server-derived and stable, so Dify's API sessions are never shared across tenants/conversations.
        user: `tenant:${input.tenantId}:conversation:${input.conversationId}`,
      }) });
      if (!response.ok) return { ok: false, provider: "dify", category: "unavailable" };
      const body: unknown = await response.json().catch(() => null);
      const answer = body && typeof body === "object" && "answer" in body && typeof body.answer === "string" ? body.answer : null;
      if (!answer) return { ok: false, provider: "dify", category: "malformed" };
      const parsed = aiUnderstandingSchema.safeParse(JSON.parse(answer));
      if (!parsed.success) return { ok: false, provider: "dify", category: "malformed" };
      if (parsed.data.confidence < 0.55) return { ok: false, provider: "dify", category: "low_confidence" };
      return { ok: true, provider: "dify", result: parsed.data };
    } catch (error) { return { ok: false, provider: "dify", category: error instanceof DOMException && error.name === "AbortError" ? "timeout" : "unavailable" }; } finally { clearTimeout(timeout); }
  }
}

import "server-only";
import { DifyAIService } from "./dify";
import type { AIService, AIServiceResult, AIMessageInput } from "./service";
class UnconfiguredAIService implements AIService {
  async understandMessage(input: AIMessageInput): Promise<AIServiceResult> { void input; return { ok: false, provider: "none", category: "unconfigured" }; }
  async answerKnowledgeQuery(input: AIMessageInput): Promise<AIServiceResult> { void input; return { ok: false, provider: "none", category: "unconfigured" }; }
}
export function getAIService(): AIService { const baseUrl = process.env.DIFY_API_URL; const apiKey = process.env.DIFY_API_KEY; if (!baseUrl || !apiKey) return new UnconfiguredAIService(); const raw = Number(process.env.DIFY_TIMEOUT_MS ?? "8000"); return new DifyAIService(baseUrl, apiKey, Number.isFinite(raw) ? Math.min(Math.max(raw, 1000), 20000) : 8000); }
export * from "./service";

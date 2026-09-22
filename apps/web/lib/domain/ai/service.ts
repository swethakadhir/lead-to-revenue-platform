import { z } from "zod";
import type { Json } from "@/lib/supabase/database.types";

export const aiIntentSchema = z.enum(["greeting", "service_enquiry", "business_information", "pricing_question", "qualification_response", "booking_request", "human_request", "unknown"]);
export const aiUnderstandingSchema = z.object({
  intent: aiIntentSchema, requirement: z.string().trim().max(240).nullable().optional(),
  extracted_fields: z.record(z.string().max(80), z.unknown()).default({}), confidence: z.number().min(0).max(1),
  answer: z.string().trim().max(2000).nullable().optional(), needs_more_information: z.boolean().default(false),
  suggested_next_question: z.string().trim().max(500).nullable().optional(), human_intervention_required: z.boolean().default(false),
  human_intervention_reason: z.string().trim().max(500).nullable().optional(),
});
export type AIUnderstanding = z.infer<typeof aiUnderstandingSchema>;

/** Dify's text-input variables can emit exact boolean strings. Convert only those
 * representation equivalents; every other value remains subject to strict validation. */
export function normalizeAIUnderstandingPayload(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const payload = { ...(value as Record<string, unknown>) };
  for (const key of ["needs_more_information", "human_intervention_required"]) {
    if (payload[key] === "true") payload[key] = true;
    if (payload[key] === "false") payload[key] = false;
  }
  return payload;
}

export function buildDifyChatMessageBody(input: AIMessageInput, mode: "understand" | "knowledge") {
  return {
    inputs: {
      tenant_id: input.tenantId,
      knowledge_scope: input.knowledgeScope,
      routing_mode: mode,
      current_node: input.currentNodeKey,
      // The configured Dify Chatflow declares this as a text input, not a JSON input.
      configured_fields: JSON.stringify(input.configuredFields),
    },
    query: input.message,
    response_mode: "blocking" as const,
    // Server-derived and stable, so Dify's API sessions are never shared across tenants/conversations.
    user: `tenant:${input.tenantId}:conversation:${input.conversationId}`,
  };
}
export type AIServiceResult = { ok: true; provider: "dify"; result: AIUnderstanding } | { ok: false; provider: "dify" | "none"; category: "unconfigured" | "timeout" | "unavailable" | "malformed" | "low_confidence" };
export type AIMessageInput = { tenantId: string; conversationId: string; message: string; currentNodeKey: string; context: Record<string, Json | undefined>; knowledgeScope: string; configuredFields: { key: string; label: string; fieldType: string; options: string[] }[] };
export interface AIService { understandMessage(input: AIMessageInput): Promise<AIServiceResult>; answerKnowledgeQuery(input: AIMessageInput): Promise<AIServiceResult>; }

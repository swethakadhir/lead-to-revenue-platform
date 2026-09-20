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
export type AIServiceResult = { ok: true; provider: "dify"; result: AIUnderstanding } | { ok: false; provider: "dify" | "none"; category: "unconfigured" | "timeout" | "unavailable" | "malformed" | "low_confidence" };
export type AIMessageInput = { tenantId: string; conversationId: string; message: string; currentNodeKey: string; context: Record<string, Json | undefined>; knowledgeScope: string; configuredFields: { key: string; label: string; fieldType: string; options: string[] }[] };
export interface AIService { understandMessage(input: AIMessageInput): Promise<AIServiceResult>; answerKnowledgeQuery(input: AIMessageInput): Promise<AIServiceResult>; }

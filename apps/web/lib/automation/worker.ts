import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
export const actionJobTypes = ["internal_notification","lead_follow_up","appointment_reminder"] as const;
export const claimSchema = z.object({ limit: z.number().int().min(1).max(50).default(10) });
export const completeSchema = z.object({ success: z.boolean(), retryable: z.boolean().default(false), errorCategory: z.string().trim().max(80).optional(), errorMessage: z.string().trim().max(500).optional() });
export function workerAuthorized(value: string | null) { const secret = process.env.AUTOMATION_WORKER_SECRET; if (!secret || !value) return false; const a = Buffer.from(secret); const b = Buffer.from(value); return a.length === b.length && timingSafeEqual(a,b); }
export function safeJob(job: { id:string; job_type:string; payload:unknown; due_at:string; attempt_count:number; max_attempts:number; idempotency_key:string; tenant_id:string; lead_id:string|null; conversation_id:string|null }) { if (!actionJobTypes.includes(job.job_type as typeof actionJobTypes[number])) return null; return { id:job.id, type:job.job_type, payload:job.payload, dueAt:job.due_at, attempt:job.attempt_count, maxAttempts:job.max_attempts, idempotencyKey:job.idempotency_key, leadId:job.lead_id, conversationId:job.conversation_id }; }
export async function claimWorkerJobs(limit:number) { const {data,error}=await createAdminClient().rpc("claim_due_action_jobs_worker",{p_limit:limit}); if(error) throw error; return (data??[]).map(safeJob).filter((job): job is NonNullable<typeof job> => Boolean(job)); }
export async function completeWorkerJob(id:string,input:z.infer<typeof completeSchema>) { const {data,error}=await createAdminClient().rpc("complete_action_job_worker",{p_job_id:id,p_success:input.success,p_retryable:input.retryable,p_error_category:input.errorCategory??null,p_error_message:input.errorMessage??null}); if(error) throw error; return data; }

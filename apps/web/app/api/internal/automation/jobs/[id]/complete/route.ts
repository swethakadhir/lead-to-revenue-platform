import { NextResponse } from "next/server";
import { z } from "zod";
import { completeSchema, completeWorkerJob, workerAuthorized } from "@/lib/automation/worker";
export const dynamic = "force-dynamic";
export async function POST(request: Request,{params}:{params:Promise<{id:string}>}) { if(!workerAuthorized(request.headers.get("x-automation-worker-secret"))) return NextResponse.json({error:"Unauthorized"},{status:401}); const [body,{id}]=await Promise.all([request.json().catch(()=>null),params]); if(!z.uuid().safeParse(id).success) return NextResponse.json({error:"Invalid job."},{status:400}); const parsed=completeSchema.safeParse(body); if(!parsed.success) return NextResponse.json({error:"Invalid completion request."},{status:400}); try { const job=await completeWorkerJob(id,parsed.data); return NextResponse.json({id:job.id,status:job.status}); } catch { return NextResponse.json({error:"Worker completion unavailable."},{status:409}); } }

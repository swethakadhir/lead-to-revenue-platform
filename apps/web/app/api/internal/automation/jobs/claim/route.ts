import { NextResponse } from "next/server";
import { claimSchema, claimWorkerJobs, workerAuthorized } from "@/lib/automation/worker";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { if(!workerAuthorized(request.headers.get("x-automation-worker-secret"))) return NextResponse.json({error:"Unauthorized"},{status:401}); const body=await request.json().catch(()=>({})); const parsed=claimSchema.safeParse(body); if(!parsed.success) return NextResponse.json({error:"Invalid claim request."},{status:400}); try { return NextResponse.json({jobs:await claimWorkerJobs(parsed.data.limit)}); } catch { return NextResponse.json({error:"Worker claim unavailable."},{status:503}); } }

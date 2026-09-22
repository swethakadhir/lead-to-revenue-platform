import { NextResponse } from "next/server";
import { workerAuthorized } from "@/lib/automation/worker";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return workerAuthorized(request.headers.get("x-automation-worker-secret")) ? NextResponse.json({ok:true,service:"automation-worker"}) : NextResponse.json({error:"Unauthorized"},{status:401}); }

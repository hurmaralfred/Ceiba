import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/family";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getServiceClient();
  const { data, error } = await service.rpc("run_kinship_discovery");

  if (error) {
    console.error("[kinship-discovery] RPC error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}

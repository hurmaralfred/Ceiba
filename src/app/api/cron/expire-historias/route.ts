import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

function getService() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/cron/expire-historias
 * Deletes stories (is_story = true) older than 24 hours.
 * Runs hourly via Vercel Cron.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.INTERNAL_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = getService();

  const { data, error } = await service
    .from("family_events")
    .delete()
    .eq("is_story", true)
    .lt("created_at", new Date(Date.now() - 86_400_000).toISOString())
    .select("id");

  if (error) {
    console.error("expire-historias cron error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = (data ?? []).length;
  console.log(`expire-historias: deleted ${deleted} expired stories`);
  return NextResponse.json({ ok: true, deleted });
}

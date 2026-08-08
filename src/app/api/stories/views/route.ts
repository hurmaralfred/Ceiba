import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/stories/views
 * Body: { story_ids: string[] }
 * Records the caller as having viewed each story (upsert — idempotent).
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { story_ids } = await req.json();
  if (!Array.isArray(story_ids) || story_ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const service = getServiceClient();
  const rows = story_ids.map((id: string) => ({
    story_id: id,
    viewer_user_id: user.id,
  }));

  // Graceful: if the table doesn't exist yet, silently succeed
  const { error } = await service
    .from("story_views")
    .upsert(rows, { onConflict: "story_id,viewer_user_id", ignoreDuplicates: true });

  if (error && !error.message.includes("does not exist")) {
    console.error("story_views upsert:", error.message);
  }

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/stories/views?ids=id1,id2,...
 * Returns { counts: { [story_id]: number } }
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const idsParam = req.nextUrl.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ counts: {} });

  const service = getServiceClient();
  const { data, error } = await service
    .from("story_views")
    .select("story_id")
    .in("story_id", ids);

  if (error) {
    // Table not yet created — return zeros gracefully
    return NextResponse.json({ counts: {} });
  }

  const counts: Record<string, number> = {};
  for (const id of ids) counts[id] = 0;
  for (const row of data ?? []) {
    counts[(row as any).story_id] = (counts[(row as any).story_id] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}

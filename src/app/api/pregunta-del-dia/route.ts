import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";
import {
  getDayTheme,
  getFallbackQuestion,
  generateAndCacheQuestion,
  TOTAL_QUESTIONS,
} from "@/lib/preguntaDiaria";

async function getSpaceId(
  service: ReturnType<typeof getServiceClient>,
  userId: string,
): Promise<string | null> {
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", userId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim?.person_id) return null;

  const { data: mem } = await service
    .from("space_memberships")
    .select("space_id")
    .eq("person_id", (claim as any).person_id)
    .maybeSingle();
  return (mem as any)?.space_id ?? null;
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);

  const today = new Date().toISOString().split("T")[0];
  const dayNumber = Math.floor(Date.now() / 86400000);

  // No family space: return a global fallback without caching
  if (!spaceId) {
    const pool = getDayTheme(dayNumber);
    const fallback = pool.questions[dayNumber % pool.questions.length];
    return NextResponse.json({ question: fallback, total_pool: TOTAL_QUESTIONS });
  }

  const question = await generateAndCacheQuestion(service, spaceId, today, dayNumber);
  return NextResponse.json({ question, total_pool: TOTAL_QUESTIONS });
}

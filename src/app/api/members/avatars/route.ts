import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/members/avatars
 * Body: { personIds: string[] }
 *
 * Returns a map of personId → public avatarUrl for all requested persons.
 * Reads profiles.avatar_path (preferred) falling back to persons.photo_path.
 * Uses service role to bypass RLS on person_claims and profiles.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const personIds: string[] = Array.isArray(body.personIds) ? body.personIds : [];
  if (personIds.length === 0) return NextResponse.json({ avatars: {} });

  const service = getServiceClient();

  // Get user_id for each person via person_claims
  const { data: claims } = await service
    .from("person_claims")
    .select("person_id, user_id")
    .in("person_id", personIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  if (!claims || claims.length === 0) return NextResponse.json({ avatars: {} });

  const userIds = claims.map((c: any) => c.user_id as string);

  // Get avatar_path from profiles for those users
  const { data: profiles } = await service
    .from("profiles")
    .select("user_id, avatar_path")
    .in("user_id", userIds);

  const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id as string, p.avatar_path as string | null]));
  const claimMap = new Map((claims as any[]).map((c: any) => [c.person_id as string, c.user_id as string]));

  const avatars: Record<string, string> = {};
  for (const personId of personIds) {
    const userId = claimMap.get(personId);
    if (!userId) continue;
    const avatarPath = profileMap.get(userId);
    if (!avatarPath) continue;
    const { data: urlData } = service.storage.from("avatars").getPublicUrl(avatarPath);
    if (urlData?.publicUrl) avatars[personId] = urlData.publicUrl;
  }

  return NextResponse.json({ avatars });
}

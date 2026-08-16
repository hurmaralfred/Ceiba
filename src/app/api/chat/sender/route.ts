import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/** GET /api/chat/sender?userId=xxx — resolves first_name + photo for a user. */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const targetUserId = req.nextUrl.searchParams.get("userId");
  if (!targetUserId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });

  const service = getServiceClient();

  // Try person_claims first (canonical name + photo)
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", targetUserId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (claim?.person_id) {
    const { data: person } = await service
      .from("persons")
      .select("first_name, photo_path")
      .eq("id", claim.person_id)
      .maybeSingle();
    if (person?.first_name) {
      return NextResponse.json({ name: person.first_name, photo: person.photo_path ?? null });
    }
  }

  // Fallback to profiles
  const { data: profile } = await service
    .from("profiles")
    .select("first_name")
    .eq("id", targetUserId)
    .maybeSingle();

  return NextResponse.json({ name: profile?.first_name ?? "Familiar", photo: null });
}

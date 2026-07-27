import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

/**
 * POST /api/people/resolve
 * Body: { userIds: string[] }
 * Resuelve nombre/foto (persons vía person_claims) para user_ids, limitado
 * a mí mismo + personas de mi(s) family_space — nunca resuelve identidades
 * arbitrarias fuera de ese alcance.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { userIds } = await req.json();
  if (!Array.isArray(userIds)) {
    return NextResponse.json({ error: "userIds debe ser un arreglo" }, { status: 400 });
  }

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) return NextResponse.json({ people: [] });

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  const { data: familyClaims } = await service
    .from("person_claims")
    .select("user_id")
    .in("person_id", familyPersonIds.length > 0 ? familyPersonIds : [myPersonId])
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const allowedUserIds = new Set([
    user.id,
    ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string),
  ]);

  const requested = (userIds as string[]).filter((id) => allowedUserIds.has(id));
  const map = await resolvePersonsByUserIds(service, requested);

  return NextResponse.json({ people: [...map.values()] });
}

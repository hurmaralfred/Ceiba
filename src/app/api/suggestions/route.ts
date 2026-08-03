import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/suggestions
 * Returns pending kinship suggestions for spaces the current user belongs to.
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  // Resolve user's spaces via person_claims + space_memberships (space_user_roles may be empty)
  const { data: claims } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const myPersonIds = (claims ?? []).map((c: any) => c.person_id as string);

  const [{ data: memberships }, { data: ownedSpaces }] = await Promise.all([
    myPersonIds.length
      ? service.from("space_memberships").select("space_id").in("person_id", myPersonIds)
      : Promise.resolve({ data: [] }),
    service.from("family_spaces").select("id").eq("created_by", user.id),
  ]);

  const mySpaceIds = [...new Set([
    ...(memberships ?? []).map((m: any) => m.space_id as string),
    ...(ownedSpaces  ?? []).map((s: any) => s.id       as string),
  ])];

  if (!mySpaceIds.length) return NextResponse.json({ suggestions: [] });

  const SELECT = "id, score, evidence, status, created_at, person_id_a, person_id_b, space_id_a, space_id_b";

  const [{ data: rowsA, error: errA }, { data: rowsB, error: errB }] = await Promise.all([
    service.from("suggested_connections").select(SELECT).eq("status", "pending").in("space_id_a", mySpaceIds),
    service.from("suggested_connections").select(SELECT).eq("status", "pending").in("space_id_b", mySpaceIds),
  ]);

  const error = errA || errB;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Merge and deduplicate by id
  const seen = new Set<string>();
  const rows = [...(rowsA ?? []), ...(rowsB ?? [])].filter((r: any) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  }).sort((a: any, b: any) => b.score - a.score).slice(0, 20);

  if (!rows || rows.length === 0) return NextResponse.json({ suggestions: [] });

  // Batch-fetch persons and spaces
  const personIds = [...new Set(rows.flatMap((r: any) => [r.person_id_a, r.person_id_b]))];
  const spaceIds  = [...new Set(rows.flatMap((r: any) => [r.space_id_a,  r.space_id_b]))];

  const [{ data: persons }, { data: spaces }] = await Promise.all([
    service.from("persons")
      .select("id, first_name, first_surname, second_surname, birth_date, birth_city, birth_country")
      .in("id", personIds),
    service.from("family_spaces").select("id, name").in("id", spaceIds),
  ]);

  const personMap = new Map((persons ?? []).map((p: any) => [p.id, p]));
  const spaceMap  = new Map((spaces  ?? []).map((s: any) => [s.id, s]));

  const suggestions = (rows as any[]).map((r) => ({
    id:        r.id,
    score:     r.score,
    evidence:  r.evidence,
    status:    r.status,
    created_at: r.created_at,
    person_a:  personMap.get(r.person_id_a) ?? null,
    person_b:  personMap.get(r.person_id_b) ?? null,
    space_a:   spaceMap.get(r.space_id_a)   ?? null,
    space_b:   spaceMap.get(r.space_id_b)   ?? null,
  }));

  return NextResponse.json({ suggestions });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  const { data: suggestion, error: fetchError } = await service
    .from("suggested_connections")
    .select("space_id_a, space_id_b, status")
    .eq("id", params.id)
    .single();

  if (fetchError || !suggestion) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const mySpaceIds = new Set([
    ...(memberships ?? []).map((m: any) => m.space_id as string),
    ...(ownedSpaces  ?? []).map((s: any) => s.id       as string),
  ]);

  if (!mySpaceIds.has(suggestion.space_id_a) && !mySpaceIds.has(suggestion.space_id_b)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: updated, error } = await service
    .from("suggested_connections")
    .update({
      status:       "confirmed",
      confirmed_by: user.id,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("status", "pending")
    .select("person_id_a,person_id_b");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = updated?.[0];
  if (row) {
    await service.from("relationships").insert({
      person_a_id:       row.person_id_a,
      person_b_id:       row.person_id_b,
      relationship_type: "guardian",
      source:            "kinship_suggested",
      created_by:        user.id,
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { INVERSE_RELATION, BLOOD_RELATIONS, RelationType } from "@/lib/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ceiba.app";

/**
 * GET /api/para/[token]
 * Public endpoint — no auth required.
 * Returns the personalized invite data for a family member.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find the family_member by invite_token
  const { data: member } = await service
    .from("family_members")
    .select("id, first_name, last_name, relation_type, relation_kind, added_by, profile_id")
    .eq("invite_token", params.token)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Already joined — tell client so they can redirect to tree
  if (member.profile_id) {
    return NextResponse.json({ already_joined: true });
  }

  // Load inviter profile
  const { data: inviter } = await service
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", member.added_by)
    .single();

  // Count how many family members the inviter has who are on Ceiba
  const { count: joinedCount } = await service
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("added_by", member.added_by)
    .not("profile_id", "is", null);

  // Total family members in their tree
  const { count: totalCount } = await service
    .from("family_members")
    .select("id", { count: "exact", head: true })
    .eq("added_by", member.added_by);

  return NextResponse.json({
    member: {
      first_name: member.first_name,
      last_name: member.last_name,
      relation_type: member.relation_type,
    },
    inviter: inviter ?? { first_name: "Tu familiar", last_name: "", avatar_url: null },
    joinedCount: joinedCount ?? 0,
    totalCount: totalCount ?? 0,
    registerUrl: `${APP_URL}/auth/register?para=${params.token}`,
  });
}

/**
 * POST /api/para/[token]
 * Authenticated. Call with Bearer token header to claim this family member spot.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Validate caller via their JWT
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: { user } } = await service.auth.getUser(jwt);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Load family_member by invite_token
  const { data: member } = await service
    .from("family_members")
    .select("id, first_name, last_name, relation_type, relation_kind, added_by, profile_id")
    .eq("invite_token", params.token)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (member.profile_id) return NextResponse.json({ already_joined: true });
  if (member.added_by === user.id) return NextResponse.json({ error: "self" }, { status: 400 });

  // 1. Claim the family_member spot
  await service.from("family_members")
    .update({ profile_id: user.id })
    .eq("id", member.id);

  // 2. Bidirectional relationship
  const inviterRelation = member.relation_type as RelationType;
  const myRelation: RelationType = INVERSE_RELATION[inviterRelation] ?? "other";
  const myRelationKind = BLOOD_RELATIONS.has(myRelation) ? "blood" : "affinity";

  await service.from("relationships").upsert({
    profile_a: member.added_by,
    profile_b: user.id,
    relation_from_a: inviterRelation,
    relation_from_b: myRelation,
    relation_kind: myRelationKind,
    confirmed: true,
  });

  // 3. Add inviter to new user's family tree (if not already there)
  const { data: inviterProfile } = await service
    .from("profiles").select("first_name, last_name").eq("id", member.added_by).single();

  const { data: existing } = await service
    .from("family_members")
    .select("id")
    .eq("added_by", user.id)
    .eq("profile_id", member.added_by)
    .maybeSingle();

  if (!existing && inviterProfile) {
    await service.from("family_members").insert({
      added_by: user.id,
      profile_id: member.added_by,
      first_name: inviterProfile.first_name,
      last_name: inviterProfile.last_name,
      relation_type: myRelation,
      relation_kind: myRelationKind,
    });
  }

  // 4. Generate suggestions async
  const { data: myProfile } = await service
    .from("profiles").select("first_name, last_name").eq("id", user.id).single();

  if (myProfile) {
    service.rpc("generate_family_suggestions", {
      p_adder_id: member.added_by,
      p_first_name: myProfile.first_name ?? "",
      p_last_name: myProfile.last_name ?? "",
      p_relation_type: inviterRelation,
      p_family_member_id: member.id,
    }).catch(() => {});

    service.rpc("generate_reverse_suggestions", {
      p_new_user_id: user.id,
      p_connector_id: member.added_by,
      p_my_relation: myRelation,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

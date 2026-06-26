import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET — fetch pending suggestions for current user
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("relationship_suggestions")
    .select("*")
    .eq("suggested_to", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return NextResponse.json(data || []);
}

// POST — respond to a suggestion (accept/reject) or generate new ones
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  // Respond to suggestion
  if (body.action === "respond") {
    const { id, status, first_name, last_name, relation_type, relation_kind, family_member_id } = body;

    await supabase
      .from("relationship_suggestions")
      .update({ status })
      .eq("id", id)
      .eq("suggested_to", user.id);

    // Notify suggester if accepted
    if (status === "accepted" && body.suggested_by_profile_id) {
      const { data: acceptorProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (acceptorProfile) {
        const { RELATION_LABELS } = await import("@/lib/types");
        fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/push/notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.INTERNAL_SECRET || "",
          },
          body: JSON.stringify({
            invitedBy: body.suggested_by_profile_id,
            joinerName: `${acceptorProfile.first_name} ${acceptorProfile.last_name || ""}`.trim(),
            relationLabel: RELATION_LABELS[relation_type as keyof typeof RELATION_LABELS] || relation_type,
            message: "aceptó tu sugerencia de conexión familiar",
          }),
        }).catch(() => {});
      }
    }

    // If accepted, add to family_members
    if (status === "accepted") {
      const { data: existing } = await supabase
        .from("family_members")
        .select("id")
        .eq("added_by", user.id)
        .eq("first_name", first_name)
        .limit(1)
        .single();

      if (!existing) {
        const { data: inserted } = await supabase.from("family_members").insert({
          added_by: user.id,
          first_name,
          last_name: last_name || null,
          relation_type,
          relation_kind,
        }).select("id").single();

        if (inserted) {
          // Forward: suggest this person to my connected family
          await supabase.rpc("generate_family_suggestions", {
            p_adder_id: user.id,
            p_first_name: first_name,
            p_last_name: last_name || "",
            p_relation_type: relation_type,
            p_family_member_id: inserted.id,
          });
          // Reverse: suggest my family to the suggested_by person
          if (body.suggested_by_profile_id) {
            await supabase.rpc("generate_reverse_suggestions", {
              p_new_user_id: body.suggested_by_profile_id,
              p_connector_id: user.id,
              p_my_relation: relation_type,
            });
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  }

  // Generate suggestions after adding a family member
  if (body.action === "generate") {
    const { first_name, last_name, relation_type, family_member_id } = body;
    await supabase.rpc("generate_family_suggestions", {
      p_adder_id: user.id,
      p_first_name: first_name,
      p_last_name: last_name || "",
      p_relation_type: relation_type,
      p_family_member_id: family_member_id,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

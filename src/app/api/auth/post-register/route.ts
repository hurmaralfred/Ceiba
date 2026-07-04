import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Admin client — bypasses RLS for linking operations
const service = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/auth/post-register
 *
 * Called immediately after a user registers via the invite flow.
 * - If invite_code is present: links the pre-existing person record to the new user
 *   (this triggers trg_mark_invitation_activated → marks invitation as signed_up)
 * - Also creates a profile row and, for organic signups, a fresh persons row.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const invite_code: string | undefined = body.invite_code;

  // 1) Crear perfil si no existe
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!existingProfile) {
    const meta = user.user_metadata ?? {};
    await service.from("profiles").insert({
      id: user.id,
      email: user.email,
      first_name: meta.first_name ?? user.email?.split("@")[0] ?? "Usuario",
      last_name: meta.last_name ?? "",
      avatar_url: meta.avatar_url ?? null,
    });
  }

  // 2) Si hay invite_code → vincular persona preexistente
  if (invite_code) {
    const { data: inv } = await service
      .from("invitations")
      .select("id, invited_person_id, status, expires_at")
      .eq("code", invite_code)
      .maybeSingle();

    if (!inv) {
      return NextResponse.json({ ok: true, linked: false, reason: "invitation not found" });
    }
    if (new Date(inv.expires_at) < new Date()) {
      return NextResponse.json({ ok: true, linked: false, reason: "invitation expired" });
    }

    // Vincular la persona al nuevo usuario (solo si aún no tiene linked_user_id)
    const { error: linkErr } = await service
      .from("persons")
      .update({
        linked_user_id: user.id,
        email: user.email,
        status: "active",
        verification_level: "self_verified",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inv.invited_person_id)
      .is("linked_user_id", null);

    if (linkErr) {
      console.error("[post-register] link error:", linkErr);
      return NextResponse.json({ ok: true, linked: false, reason: linkErr.message });
    }

    // trg_mark_invitation_activated dispara automáticamente en el UPDATE de persons
    return NextResponse.json({ ok: true, linked: true, person_id: inv.invited_person_id });
  }

  // 3) Signup orgánico (sin invite) — crear nodo persona propio si no existe
  const { data: existingPerson } = await service
    .from("persons")
    .select("id")
    .eq("linked_user_id", user.id)
    .maybeSingle();

  if (!existingPerson) {
    const meta = user.user_metadata ?? {};
    await service.from("persons").insert({
      first_names: meta.first_name ?? user.email?.split("@")[0] ?? "Usuario",
      last_names: meta.last_name ?? "",
      email: user.email,
      is_living: true,
      linked_user_id: user.id,
      created_by_user_id: user.id,
      status: "active",
      verification_level: "self_verified",
    });
  }

  return NextResponse.json({ ok: true, linked: false });
}

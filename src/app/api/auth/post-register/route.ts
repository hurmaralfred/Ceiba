import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * POST /api/auth/post-register
 *
 * Called immediately after a user registers (and can be called again later).
 * Scans ALL unlinked family_member records across all users looking for entries
 * that match the current user by email OR name, then sets their profile_id.
 *
 * This solves the case where Person A added Person B before B was on Ceiba,
 * and B finally registers — B immediately appears in A's tree.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get the current user's profile
  const { data: profile } = await service
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ linked: 0 });

  // Asegurar que existe una fila en persons para este usuario
  await service.from("persons").upsert({
    id: user.id,
    first_names: profile.first_name || "Sin nombre",
    last_names: profile.last_name || "",
    email: profile.email,
    is_living: true,
    linked_user_id: user.id,
    created_by_user_id: user.id,
    status: "active",
    verification_level: "self_verified",
  }, { onConflict: "id" });

  // Normalize: remove accents, lowercase, first word only
  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/̀-ͯ/g, "")
      .trim()
      .split(" ")[0];

  const myFn = norm(profile.first_name || "");
  const myLn = norm(profile.last_name || "");
  const myEmail = (profile.email || "").toLowerCase().trim();

  // Fetch all unlinked family_member records (across all users)
  const { data: candidates } = await service
    .from("family_members")
    .select("id, first_name, last_name, email, profile_id, added_by")
    .is("profile_id", null);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ linked: 0 });
  }

  const toLink: string[] = [];
  for (const c of candidates) {
    // Never self-link
    if (c.added_by === user.id) continue;

    // Match by email (exact, case-insensitive)
    if (myEmail && c.email && c.email.toLowerCase().trim() === myEmail) {
      toLink.push(c.id);
      continue;
    }

    // Match by name (first word of first_name + first word of last_name)
    const cFn = norm(c.first_name || "");
    const cLn = norm(c.last_name || "");
    if (myFn && myLn && cFn === myFn && cLn === myLn) {
      toLink.push(c.id);
    }
  }

  if (toLink.length === 0) return NextResponse.json({ linked: 0 });

  await service
    .from("family_members")
    .update({ profile_id: user.id })
    .in("id", toLink);

  return NextResponse.json({ linked: toLink.length });
}

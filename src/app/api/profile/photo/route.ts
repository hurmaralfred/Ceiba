import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/profile/photo
 *
 * Receives multipart/form-data with a 'photo' field.
 * All work runs server-side with service role:
 *   1. Resolve the caller's approved person_claim
 *   2. Read the current profiles.avatar_path for compensation
 *   3. Validate and upload the file to Storage
 *   4. Update profiles.avatar_path (storage key)
 *   5. Update persons.photo_path (full public URL)
 *      → If step 5 fails, restore profiles.avatar_path and delete the uploaded file
 *
 * The client never provides a personId — it is resolved exclusively from
 * the authenticated user's approved claim to prevent updating foreign persons.
 *
 * NOTE: steps 4 and 5 are NOT a single SQL transaction; they are sequential
 * writes with explicit compensation. If step 5 fails, step 4 is reversed by
 * restoring the previous avatar_path. A Storage remove failure on compensation
 * is swallowed (the file becomes an orphan); the response is still 500.
 */

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  // ── 1. Authentication ──────────────────────────────────────────────────────
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  // ── 2. Resolve claimed person (service role bypasses RLS) ─────────────────
  // Canonical claim_status enum: 'pending' | 'approved' | 'rejected' | 'revoked'
  // Double-filter: claim_status = 'approved' AND revoked_at IS NULL
  // (defense in depth against partially-revoked rows).
  // Multiple active claims for one user is a data integrity violation; maybySingle()
  // surfaces that as an error rather than silently picking one.
  const { data: claim, error: claimError } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (claimError) {
    return NextResponse.json(
      { error: "Error al verificar identidad: " + claimError.message },
      { status: 500 }
    );
  }

  if (!claim?.person_id) {
    return NextResponse.json(
      { error: "Sin identidad reclamada en la galaxia" },
      { status: 409 }
    );
  }

  const personId: string = claim.person_id;

  // ── 3. Read current avatar_path for compensation ───────────────────────────
  // Needed to restore profiles.avatar_path if the persons update fails.
  const { data: existingProfile } = await service
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();
  const prevAvatarPath: string | null = existingProfile?.avatar_path ?? null;

  // ── 4. Parse multipart file ────────────────────────────────────────────────
  let file: File | null = null;
  try {
    const formData = await req.formData();
    const entry = formData.get("photo");
    if (entry instanceof File) file = entry;
  } catch {
    return NextResponse.json({ error: "Formato de solicitud inválido" }, { status: 400 });
  }

  if (!file || file.size === 0) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  // ── 5. Validate file ───────────────────────────────────────────────────────
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo no permitido. Usa JPEG, PNG o WebP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "El archivo supera el límite de 5 MB" },
      { status: 400 }
    );
  }

  // ── 6. Upload ──────────────────────────────────────────────────────────────
  const ext = EXT[file.type];
  const storagePath = `member-photos/${user.id}/${personId}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await service.storage
    .from("avatars")
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json(
      { error: "Error al subir la foto: " + uploadError.message },
      { status: 500 }
    );
  }

  // ── 7. Get canonical public URL ────────────────────────────────────────────
  const { data: urlData } = service.storage.from("avatars").getPublicUrl(storagePath);
  const avatarUrl: string = urlData.publicUrl;

  // ── 8. Update profiles.avatar_path ────────────────────────────────────────
  const { error: profileError } = await service
    .from("profiles")
    .update({ avatar_path: storagePath })
    .eq("user_id", user.id);

  if (profileError) {
    await service.storage.from("avatars").remove([storagePath]).catch(() => {});
    return NextResponse.json(
      { error: "Error al guardar perfil: " + profileError.message },
      { status: 500 }
    );
  }

  // ── 9. Update persons.photo_path; compensate profiles on failure ──────────
  // Chain .select().single() so PostgREST returns the updated row.
  // Without .select(), a silent 0-row update (RLS, missing id, etc.) returns
  // {error: null} and we cannot detect it.  With .single(), 0 rows → PGRST116.
  // After a successful update, read the value back to confirm the write persisted.
  const { data: updatedPerson, error: personError } = await service
    .from("persons")
    .update({ photo_path: avatarUrl })
    .eq("id", personId)
    .select("id, photo_path")
    .single();

  const personWriteFailed =
    personError !== null ||
    !updatedPerson ||
    updatedPerson.photo_path !== avatarUrl;

  if (personWriteFailed) {
    try {
      await service
        .from("profiles")
        .update({ avatar_path: prevAvatarPath })
        .eq("user_id", user.id);
    } catch { /* ignore compensation error */ }
    await service.storage.from("avatars").remove([storagePath]).catch(() => {});
    return NextResponse.json(
      { error: "La foto no pudo persistirse en la galaxia genealógica" },
      { status: 500 }
    );
  }

  return NextResponse.json({ personId, avatarUrl });
}

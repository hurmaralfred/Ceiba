import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/profile/photo
 *
 * Receives multipart/form-data with a 'photo' field.
 * All work runs server-side with service role:
 *   1. Resolve the caller's approved person_claim
 *   2. Validate and upload the file to Storage
 *   3. Update profiles.avatar_path (storage key)
 *   4. Update persons.photo_path (full public URL)
 *
 * The client never provides a personId — it is resolved exclusively from
 * the authenticated user's approved claim to prevent updating foreign persons.
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
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!claim?.person_id) {
    return NextResponse.json(
      { error: "Sin identidad reclamada en el árbol" },
      { status: 409 }
    );
  }

  const personId: string = claim.person_id;

  // ── 3. Parse multipart file ────────────────────────────────────────────────
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

  // ── 4. Validate file ───────────────────────────────────────────────────────
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

  // ── 5. Upload ──────────────────────────────────────────────────────────────
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

  // ── 6. Get canonical public URL ────────────────────────────────────────────
  const { data: urlData } = service.storage.from("avatars").getPublicUrl(storagePath);
  const avatarUrl: string = urlData.publicUrl;

  // ── 7. Update both tables (best-effort rollback on DB failure) ────────────
  const [profileResult, personResult] = await Promise.all([
    service.from("profiles").update({ avatar_path: storagePath }).eq("user_id", user.id),
    service.from("persons").update({ photo_path: avatarUrl }).eq("id", personId),
  ]);

  if (profileResult.error || personResult.error) {
    await service.storage.from("avatars").remove([storagePath]).catch(() => {});
    const msg = [profileResult.error?.message, personResult.error?.message]
      .filter(Boolean)
      .join("; ");
    return NextResponse.json({ error: "Error al guardar: " + msg }, { status: 500 });
  }

  return NextResponse.json({ personId, avatarUrl });
}

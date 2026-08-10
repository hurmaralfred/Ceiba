import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

// POST /api/persona/[personId]/photo
// Uploads a profile photo for an unclaimed person via the service role (bypasses RLS).
export async function POST(
  req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const { personId } = params;

  // Verify the requester is the creator and person is unclaimed
  const { data: person } = await service
    .from("persons")
    .select("id, created_by")
    .eq("id", personId)
    .single();

  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });
  if (person.created_by !== user.id)
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

  const { data: claim } = await service
    .from("person_claims")
    .select("id")
    .eq("person_id", personId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (claim)
    return NextResponse.json({ error: "Perfil ya reclamado" }, { status: 403 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("photo") as File | null;
  if (!file || file.size === 0)
    return NextResponse.json({ error: "Archivo no recibido" }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "La foto debe ser menor a 5 MB" }, { status: 400 });

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `persons/${personId}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { data: upData, error: upErr } = await service.storage
    .from("family-photos")
    .upload(path, arrayBuffer, {
      contentType: file.type || "image/jpeg",
      upsert: true,
      cacheControl: "3600",
    });

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pubData } = service.storage.from("family-photos").getPublicUrl(upData.path);

  // Persist the URL on the person record
  await service
    .from("persons")
    .update({ photo_path: pubData.publicUrl })
    .eq("id", personId);

  return NextResponse.json({ photo_path: pubData.publicUrl });
}

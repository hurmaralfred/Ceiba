import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

/**
 * GET /api/photos
 * Fotos subidas por mí o por personas de mi(s) family_space, con
 * subidor resuelto y etiquetas (photo_tags -> persons) resueltas.
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);

  let uploaderUserIds = [user.id];
  if (myPersonId) {
    const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
    if (familyPersonIds.length > 0) {
      const { data: familyClaims } = await service
        .from("person_claims")
        .select("user_id")
        .in("person_id", familyPersonIds)
        .eq("claim_status", "approved")
        .is("revoked_at", null);
      uploaderUserIds = [...new Set([user.id, ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string)])];
    }
  }

  const { data: photos, error } = await service
    .from("photos")
    .select("id, uploader_user_id, storage_path, caption, taken_at, created_at")
    .in("uploader_user_id", uploaderUserIds)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const photoIds = (photos ?? []).map((p) => p.id as string);
  const uploaderMap = await resolvePersonsByUserIds(service, uploaderUserIds);

  let tagsByPhoto: Record<string, { person_id: string; first_name: string; last_name: string }[]> = {};
  if (photoIds.length > 0) {
    const { data: tags } = await service
      .from("photo_tags")
      .select("photo_id, person_id")
      .in("photo_id", photoIds);

    const taggedPersonIds = [...new Set((tags ?? []).map((t) => t.person_id as string))];
    const { data: taggedPersons } = taggedPersonIds.length > 0
      ? await service.from("persons").select("id, first_name, first_surname").in("id", taggedPersonIds)
      : { data: [] };
    const personInfo = new Map((taggedPersons ?? []).map((p: any) => [p.id, p]));

    for (const t of (tags ?? []) as any[]) {
      const p = personInfo.get(t.person_id);
      if (!p) continue;
      if (!tagsByPhoto[t.photo_id]) tagsByPhoto[t.photo_id] = [];
      tagsByPhoto[t.photo_id].push({ person_id: p.id, first_name: p.first_name ?? "", last_name: p.first_surname ?? "" });
    }
  }

  const enriched = (photos ?? []).map((p) => {
    const { data: urlData } = service.storage.from("family-photos").getPublicUrl(p.storage_path as string);
    return {
      ...p,
      url: urlData.publicUrl,
      uploader: uploaderMap.get(p.uploader_user_id) ?? null,
      tags: tagsByPhoto[p.id] ?? [],
    };
  });

  return NextResponse.json({ photos: enriched });
}

/** POST /api/photos — Body: { storagePath: string, caption?: string } */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Solicitud demasiado grande (máx 10MB)" }, { status: 413 });
  }

  const { storagePath, caption } = await req.json();
  if (!storagePath) return NextResponse.json({ error: "Falta storagePath" }, { status: 400 });

  const service = getServiceClient();
  const { data: photo, error } = await service
    .from("photos")
    .insert({
      uploader_user_id: user.id,
      storage_path: storagePath,
      caption: caption?.trim() || null,
      scope: "direct_family",
    })
    .select("id, uploader_user_id, storage_path, caption, taken_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ photo });
}

/** DELETE /api/photos?id=... — solo el propio subidor puede borrar. */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const service = getServiceClient();
  const { data: photo } = await service.from("photos").select("uploader_user_id, storage_path").eq("id", id).maybeSingle();
  if (!photo || photo.uploader_user_id !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  await service.storage.from("family-photos").remove([photo.storage_path]);
  const { error } = await service.from("photos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

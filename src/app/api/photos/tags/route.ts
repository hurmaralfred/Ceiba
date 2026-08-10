import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolveApprovedPersonId, resolveFamilySpaceMemberIds } from "@/lib/server/family";

async function assertTaggablePerson(service: ReturnType<typeof getServiceClient>, userId: string, personId: string) {
  const myPersonId = await resolveApprovedPersonId(service, userId);
  if (!myPersonId) return false;
  if (personId === myPersonId) return true;
  const familyIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  return familyIds.includes(personId);
}

/** POST /api/photos/tags — Body: { photoId, personId } */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { photoId, personId } = await req.json();
  if (!photoId || !personId) return NextResponse.json({ error: "Falta photoId o personId" }, { status: 400 });

  const service = getServiceClient();
  const allowed = await assertTaggablePerson(service, user.id, personId);
  if (!allowed) return NextResponse.json({ error: "Solo puedes etiquetar a tu familia" }, { status: 403 });

  const { error } = await service.from("photo_tags").insert({ photo_id: photoId, person_id: personId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/photos/tags — Body: { photoId, personId } */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { photoId, personId } = await req.json();
  if (!photoId || !personId) return NextResponse.json({ error: "Falta photoId o personId" }, { status: 400 });

  const service = getServiceClient();
  const allowed = await assertTaggablePerson(service, user.id, personId);
  if (!allowed) return NextResponse.json({ error: "Solo puedes etiquetar a tu familia" }, { status: 403 });

  const { error } = await service.from("photo_tags").delete().eq("photo_id", photoId).eq("person_id", personId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

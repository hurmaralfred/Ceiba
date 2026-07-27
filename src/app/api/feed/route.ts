import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

/**
 * GET /api/feed
 * Agrega, únicamente de mi(s) family_space:
 *   - cumpleaños próximos (persons.birth_date de mi familia)
 *   - fotos recientes (photos)
 *   - anuncios recientes (broadcasts)
 *   - eventos familiares recientes (family_events, creados por mi familia)
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) {
    return NextResponse.json({ birthdays: [], photos: [], broadcasts: [], events: [] });
  }

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  const allPersonIds = [myPersonId, ...familyPersonIds];

  const { data: familyClaims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", allPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const familyUserIds = [...new Set([user.id, ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string)])];
  const personDisplayByUser = await resolvePersonsByUserIds(service, familyUserIds);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: persons }, { data: photos }, { data: broadcasts }, { data: events }] = await Promise.all([
    service
      .from("persons")
      .select("id, first_name, first_surname, birth_date")
      .in("id", allPersonIds)
      .not("birth_date", "is", null),
    service
      .from("photos")
      .select("id, uploader_user_id, storage_path, caption, created_at")
      .in("uploader_user_id", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("broadcasts")
      .select("id, sender_user_id, message, scope, created_at")
      .in("sender_user_id", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20),
    service
      .from("family_events")
      .select("id, created_by, title, event_type, event_date, created_at")
      .in("created_by", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const now = new Date();
  const isBirthdaySoon = (dateStr: string, days = 7) => {
    const bd = new Date(dateStr);
    const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    return (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24) <= days;
  };

  const birthdays = ((persons ?? []) as any[])
    .filter((p) => isBirthdaySoon(p.birth_date))
    .map((p) => ({ person_id: p.id, first_name: p.first_name, last_name: p.first_surname, birth_date: p.birth_date }));

  const { data: publicUrlData } = service.storage.from("family-photos").getPublicUrl("");
  const baseUrl = publicUrlData.publicUrl.replace(/\/$/, "");

  return NextResponse.json({
    birthdays,
    photos: ((photos ?? []) as any[]).map((p) => ({
      ...p,
      url: `${baseUrl}/${p.storage_path}`,
      uploader: personDisplayByUser.get(p.uploader_user_id) ?? null,
    })),
    broadcasts: ((broadcasts ?? []) as any[]).map((b) => ({
      ...b,
      sender: personDisplayByUser.get(b.sender_user_id) ?? null,
    })),
    events: ((events ?? []) as any[]).map((e) => ({
      ...e,
      creator: personDisplayByUser.get(e.created_by) ?? null,
    })),
  });
}

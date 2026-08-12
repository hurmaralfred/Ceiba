import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

export interface ActivityItem {
  id: string;
  type: "memory" | "reaction" | "photo" | "joined";
  actorName: string;
  actorPhoto: string | null;
  text: string;
  thumbUrl?: string | null;
  createdAt: string;
}

/** GET /api/activity — últimas 24h de actividad familiar */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) return NextResponse.json({ items: [] });

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  const allPersonIds = [myPersonId, ...familyPersonIds];

  const { data: familyClaims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", allPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const familyUserIds = [
    ...new Set([user.id, ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string)]),
  ];
  const personByUser = await resolvePersonsByUserIds(service, familyUserIds);

  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: memories },
    { data: reactions },
    { data: photos },
  ] = await Promise.all([
    service
      .from("family_memories")
      .select("id, author_user_id, body, photo_path, created_at")
      .in("author_user_id", familyUserIds)
      .gte("created_at", cutoff24h)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("memory_reactions")
      .select("id, user_id, emoji, created_at, memory_id, family_memories(body)")
      .in("user_id", familyUserIds)
      .neq("user_id", user.id)   // no mostrar mis propias reacciones
      .gte("created_at", cutoff24h)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("photos")
      .select("id, uploader_user_id, storage_path, caption, created_at")
      .in("uploader_user_id", familyUserIds)
      .gte("created_at", cutoff24h)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const items: ActivityItem[] = [];

  function actor(userId: string) {
    const p = personByUser.get(userId);
    return {
      actorName: p ? `${p.first_name} ${p.last_name}`.trim() : "Un familiar",
      actorPhoto: p?.photo_path ?? null,
    };
  }

  for (const m of (memories ?? []) as any[]) {
    if (m.author_user_id === user.id) continue;
    const preview = m.body?.slice(0, 60) ?? "";
    items.push({
      id: `memory-${m.id}`,
      type: "memory",
      ...actor(m.author_user_id),
      text: `compartió un recuerdo: "${preview}${m.body?.length > 60 ? "…" : ""}"`,
      thumbUrl: m.photo_path ?? null,
      createdAt: m.created_at,
    });
  }

  for (const r of (reactions ?? []) as any[]) {
    const memPreview = (r.family_memories as any)?.body?.slice(0, 40) ?? "un recuerdo";
    items.push({
      id: `reaction-${r.id}`,
      type: "reaction",
      ...actor(r.user_id),
      text: `reaccionó ${r.emoji} a "${memPreview}${memPreview.length >= 40 ? "…" : ""}"`,
      createdAt: r.created_at,
    });
  }

  for (const p of (photos ?? []) as any[]) {
    if (p.uploader_user_id === user.id) continue;
    items.push({
      id: `photo-${p.id}`,
      type: "photo",
      ...actor(p.uploader_user_id),
      text: p.caption ? `subió una foto: "${p.caption}"` : "subió una foto",
      thumbUrl: p.storage_path ?? null,
      createdAt: p.created_at,
    });
  }

  // Sort newest first
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ items: items.slice(0, 8) });
}

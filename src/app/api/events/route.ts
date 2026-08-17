import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

const VALID_TYPES = ["birth", "marriage", "death", "graduation", "reunion", "anniversary", "other"];

async function getSpaceId(service: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  const { data: claim } = await service
    .from("person_claims").select("person_id")
    .eq("user_id", userId).eq("claim_status", "approved")
    .is("revoked_at", null).maybeSingle();

  if (claim?.person_id) {
    const { data: mem } = await service
      .from("space_memberships").select("space_id")
      .eq("person_id", claim.person_id).maybeSingle();
    if ((mem as any)?.space_id) return (mem as any).space_id;
  }

  const { data: space } = await service
    .from("family_spaces").select("id")
    .eq("created_by", userId).maybeSingle();
  return (space as any)?.id ?? null;
}

/** GET /api/events — eventos y recuerdos de texto de mi familia. */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);

  let creatorUserIds = [user.id];
  if (myPersonId) {
    const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
    if (familyPersonIds.length > 0) {
      const { data: familyClaims } = await service
        .from("person_claims")
        .select("user_id")
        .in("person_id", familyPersonIds)
        .eq("claim_status", "approved")
        .is("revoked_at", null);
      creatorUserIds = [...new Set([user.id, ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string)])];
    }
  }

  const [eventsResult, spaceId] = await Promise.all([
    service
      .from("family_events")
      .select("id, created_by, title, event_type, event_date, description, location, created_at")
      .in("created_by", creatorUserIds)
      .order("event_date", { ascending: false }),
    getSpaceId(service, user.id),
  ]);

  if (eventsResult.error) return NextResponse.json({ error: eventsResult.error.message }, { status: 500 });

  const creatorMap = await resolvePersonsByUserIds(service, creatorUserIds);
  const enriched = (eventsResult.data ?? []).map((e) => ({ ...e, creator: creatorMap.get(e.created_by) ?? null }));

  // Fetch text memories (no photo) from the family space
  let memories: any[] = [];
  if (spaceId) {
    const { data: memData } = await service
      .from("family_memories")
      .select("id, author_user_id, body, memory_date, photo_path, person_id, created_at")
      .eq("family_space_id", spaceId)
      .is("photo_path", null)
      .order("created_at", { ascending: false });

    if (memData && memData.length > 0) {
      const personIds = [...new Set(
        (memData as any[]).filter(m => m.person_id).map(m => m.person_id as string)
      )];
      let personNameMap = new Map<string, string>();
      if (personIds.length > 0) {
        const { data: persons } = await service
          .from("persons")
          .select("id, first_name, first_surname")
          .in("id", personIds);
        personNameMap = new Map(
          (persons ?? []).map((p: any) => [p.id, `${p.first_name} ${p.first_surname ?? ""}`.trim()])
        );
      }

      memories = (memData as any[]).map(m => ({
        ...m,
        person_name: m.person_id ? (personNameMap.get(m.person_id) ?? null) : null,
      }));
    }
  }

  return NextResponse.json({ events: enriched, memories });
}

/** POST /api/events — crea un evento. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { title, event_type, event_date, description, location, is_story } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: "El título es obligatorio" }, { status: 400 });
  if (!event_date) return NextResponse.json({ error: "La fecha es obligatoria" }, { status: 400 });
  const type = VALID_TYPES.includes(event_type) ? event_type : "other";

  const service = getServiceClient();
  const { data: event, error } = await service
    .from("family_events")
    .insert({
      created_by: user.id,
      title: title.trim(),
      event_type: type,
      event_date,
      description: description?.trim() || null,
      location: location?.trim() || null,
      is_story: is_story === true,
    })
    .select("id, created_by, title, event_type, event_date, description, location, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event });
}

/** PATCH /api/events — edita un evento propio. */
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id, title, event_type, event_date, description, location } = await req.json();
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const service = getServiceClient();
  const { data: existing } = await service.from("family_events").select("created_by").eq("id", id).maybeSingle();
  if (!existing || existing.created_by !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const patch: Record<string, any> = {};
  if (title !== undefined) patch.title = title.trim();
  if (event_type !== undefined) patch.event_type = VALID_TYPES.includes(event_type) ? event_type : "other";
  if (event_date !== undefined) patch.event_date = event_date;
  if (description !== undefined) patch.description = description?.trim() || null;
  if (location !== undefined) patch.location = location?.trim() || null;

  const { data: event, error } = await service
    .from("family_events")
    .update(patch)
    .eq("id", id)
    .select("id, created_by, title, event_type, event_date, description, location, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ event });
}

/** DELETE /api/events?id=... */
export async function DELETE(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const service = getServiceClient();
  const { data: existing } = await service.from("family_events").select("created_by").eq("id", id).maybeSingle();
  if (!existing || existing.created_by !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { error } = await service.from("family_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

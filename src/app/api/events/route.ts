import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

const VALID_TYPES = ["birth", "marriage", "death", "graduation", "reunion", "anniversary", "other"];

/** GET /api/events — eventos de mi familia (family_space) con creador resuelto. */
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

  const { data: events, error } = await service
    .from("family_events")
    .select("id, created_by, title, event_type, event_date, description, location, created_at")
    .in("created_by", creatorUserIds)
    .order("event_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creatorMap = await resolvePersonsByUserIds(service, creatorUserIds);
  const enriched = (events ?? []).map((e) => ({ ...e, creator: creatorMap.get(e.created_by) ?? null }));

  return NextResponse.json({ events: enriched });
}

/** POST /api/events — crea un evento. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { title, event_type, event_date, description, location } = await req.json();
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

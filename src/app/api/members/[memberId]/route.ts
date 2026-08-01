import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, canEditPerson } from "@/lib/server/family";

/**
 * PATCH /api/members/[memberId]
 * Actualiza una persona usando service role (bypass RLS).
 * La autorización la hace canEditPerson (incluye collab_requests aprobadas).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  const { data: person, error: fetchError } = await service
    .from("persons")
    .select("id, created_by")
    .eq("id", params.memberId)
    .maybeSingle();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

  const canEdit = await canEditPerson(service, params.memberId, user.id, person.created_by ?? "");
  if (!canEdit) {
    return NextResponse.json({ error: "Sin permiso para editar" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    first_name, middle_name, first_surname, second_surname,
    birth_date, birth_city, birth_country, is_deceased, photo_path,
  } = body as Record<string, string | boolean | undefined>;

  // photo_path-only updates (from profile page) don't require first_name
  if (!first_name && !photo_path) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (first_name !== undefined) patch.first_name = first_name;
  if (middle_name !== undefined) patch.middle_name = middle_name || null;
  if (first_surname !== undefined) patch.first_surname = first_surname || null;
  if (second_surname !== undefined) patch.second_surname = second_surname || null;
  if (birth_date !== undefined) patch.birth_date = birth_date || null;
  if (birth_city !== undefined) patch.birth_city = birth_city || null;
  if (birth_country !== undefined) patch.birth_country = birth_country || null;
  if (is_deceased !== undefined) patch.is_deceased = is_deceased;
  if (photo_path !== undefined) {
    if (photo_path && !String(photo_path).startsWith("https://")) {
      return NextResponse.json({ error: "photo_path debe ser una URL https válida" }, { status: 400 });
    }
    patch.photo_path = photo_path || null;
  }

  const { data: updated, error: updateError } = await service
    .from("persons")
    .update(patch)
    .eq("id", params.memberId)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  await service.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "update_person",
    entity_type: "persons",
    entity_id: params.memberId,
    metadata: { fields: Object.keys(patch).filter(k => k !== "updated_at") },
  });

  return NextResponse.json({ person: updated });
}

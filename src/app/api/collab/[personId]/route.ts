import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/collab/[personId]
 * Devuelve: nombre de la persona, info del dueño actual, solicitud pendiente del usuario.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  // Datos de la persona
  const { data: person } = await service
    .from("persons")
    .select("id, first_name, first_surname, created_by")
    .eq("id", params.personId)
    .maybeSingle();

  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

  // Determinar quién es el dueño (claim aprobado o created_by)
  const { data: claim } = await service
    .from("person_claims")
    .select("user_id")
    .eq("person_id", params.personId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  const ownerUserId = (claim?.user_id ?? person.created_by) as string | null;
  let ownerName: string | null = null;

  if (ownerUserId && ownerUserId !== user.id) {
    // Buscar nombre del dueño en la tabla persons via claim
    const { data: ownerPerson } = await service
      .from("person_claims")
      .select("person_id")
      .eq("user_id", ownerUserId)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .maybeSingle();

    if (ownerPerson?.person_id) {
      const { data: op } = await service
        .from("persons")
        .select("first_name, first_surname")
        .eq("id", ownerPerson.person_id)
        .maybeSingle();
      ownerName = op ? `${op.first_name} ${op.first_surname ?? ""}`.trim() : null;
    }
  }

  // Solicitud pendiente del usuario actual para esta persona
  const { data: existingRequest } = await service
    .from("collab_requests")
    .select("id, request_type, status, created_at")
    .eq("person_id", params.personId)
    .eq("requester_user_id", user.id)
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    person: {
      id: person.id,
      name: `${person.first_name} ${person.first_surname ?? ""}`.trim(),
    },
    ownerName,
    ownerUserId,
    existingRequest: existingRequest ?? null,
  });
}

/**
 * POST /api/collab/[personId]
 * Crea una solicitud de colaboración (edit o transfer).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { personId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { type, message } = body as { type?: string; message?: string };

  if (!type || !["edit", "transfer"].includes(type)) {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: person } = await service
    .from("persons")
    .select("id, first_name, first_surname, created_by")
    .eq("id", params.personId)
    .maybeSingle();

  if (!person) return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 });

  // Determinar dueño
  const { data: claim } = await service
    .from("person_claims")
    .select("user_id")
    .eq("person_id", params.personId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  const ownerUserId = (claim?.user_id ?? person.created_by) as string | null;
  if (!ownerUserId) {
    return NextResponse.json({ error: "Esta persona no tiene administrador" }, { status: 422 });
  }
  if (ownerUserId === user.id) {
    return NextResponse.json({ error: "Ya eres el administrador de esta persona" }, { status: 422 });
  }

  // Cancelar solicitudes previas pendientes del mismo tipo
  await service
    .from("collab_requests")
    .update({ status: "rejected", resolved_at: new Date().toISOString(), resolved_by: user.id })
    .eq("person_id", params.personId)
    .eq("requester_user_id", user.id)
    .eq("status", "pending");

  const { data: newRequest, error: insertError } = await service
    .from("collab_requests")
    .insert({
      person_id: params.personId,
      requester_user_id: user.id,
      owner_user_id: ownerUserId,
      request_type: type,
      status: "pending",
      message: message?.trim() || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error("collab_request insert error:", insertError);
    return NextResponse.json({ error: "Error al crear la solicitud" }, { status: 500 });
  }

  // Auditoría
  await service.from("audit_logs").insert({
    actor_user_id: user.id,
    action: `collab_request_${type}`,
    entity_type: "persons",
    entity_id: params.personId,
    metadata: { request_id: newRequest.id, owner_user_id: ownerUserId },
  });

  return NextResponse.json({ request: newRequest }, { status: 201 });
}

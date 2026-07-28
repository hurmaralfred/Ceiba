import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * PATCH /api/collab/requests/[requestId]
 * El dueño aprueba o rechaza una solicitud.
 * Body: { action: 'approve' | 'reject' }
 *
 * Aprobación de tipo 'edit':  deja la solicitud como 'approved' — canEditPerson
 *   ya consulta collab_requests para dar acceso al solicitante.
 * Aprobación de tipo 'transfer': actualiza persons.created_by al solicitante
 *   (via service role) y marca la solicitud como 'approved'.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { action } = body as { action?: string };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const service = getServiceClient();

  const { data: request } = await service
    .from("collab_requests")
    .select("*")
    .eq("id", params.requestId)
    .maybeSingle();

  if (!request) return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  if (request.owner_user_id !== user.id) {
    return NextResponse.json({ error: "No tienes permiso para resolver esta solicitud" }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Esta solicitud ya fue procesada" }, { status: 409 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const now = new Date().toISOString();

  // Si es transferencia aprobada → cambiar created_by en persons
  if (action === "approve" && request.request_type === "transfer") {
    const { error: transferError } = await service
      .from("persons")
      .update({ created_by: request.requester_user_id, updated_at: now })
      .eq("id", request.person_id);

    if (transferError) {
      console.error("collab transfer persons update error:", transferError);
      return NextResponse.json({ error: "Error al transferir la persona" }, { status: 500 });
    }
  }

  const { data: updated, error: updateError } = await service
    .from("collab_requests")
    .update({ status: newStatus, resolved_at: now, resolved_by: user.id })
    .eq("id", params.requestId)
    .select()
    .single();

  if (updateError) {
    console.error("collab_request update error:", updateError);
    return NextResponse.json({ error: "Error al actualizar la solicitud" }, { status: 500 });
  }

  // Auditoría
  await service.from("audit_logs").insert({
    actor_user_id: user.id,
    action: `collab_request_${action}`,
    entity_type: "persons",
    entity_id: request.person_id,
    metadata: {
      request_id: params.requestId,
      request_type: request.request_type,
      requester_user_id: request.requester_user_id,
    },
  });

  return NextResponse.json({ request: updated });
}

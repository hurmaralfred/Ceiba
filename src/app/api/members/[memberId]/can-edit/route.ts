import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, canEditPerson } from "@/lib/server/family";

/**
 * GET /api/members/[memberId]/can-edit
 * Valida si el usuario actual puede editar un miembro específico.
 *
 * Reglas:
 * - No reclamada: quien la agregó (added_by)
 * - Reclamada por usuario actual: sí
 * - Reclamada por otro usuario: no
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  try {
    // Obtener datos de la persona
    const { data: member, error: memberError } = await service
      .from("persons")
      .select("id, added_by")
      .eq("id", params.memberId)
      .maybeSingle();

    if (memberError) throw memberError;
    if (!member) return NextResponse.json({ can_edit: false });

    // Validar permiso
    const canEdit = await canEditPerson(
      service,
      params.memberId,
      user.id,
      member.added_by
    );

    return NextResponse.json({ can_edit: canEdit, member_id: params.memberId });
  } catch (err: any) {
    console.error("can-edit error:", err);
    return NextResponse.json({ error: err.message || "Error" }, { status: 500 });
  }
}

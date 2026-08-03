import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/profile/confirm-data
 * Guarda los datos corregidos del usuario en su nodo del árbol y
 * marca data_confirmed_at para no volver a mostrar la pantalla.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!claim?.person_id) {
    return NextResponse.json({ error: "Sin claim aprobado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country } =
    body as Record<string, string>;

  if (!first_name?.trim()) {
    return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const [updateResult] = await Promise.all([
    service
      .from("persons")
      .update({
        first_name:     first_name.trim(),
        middle_name:    middle_name?.trim() || null,
        first_surname:  first_surname?.trim() || null,
        second_surname: second_surname?.trim() || null,
        birth_date:     birth_date || null,
        birth_city:     birth_city?.trim() || null,
        birth_country:  birth_country?.trim() || null,
        updated_at:     now,
      })
      .eq("id", claim.person_id),
    service
      .from("person_claims")
      .update({ data_confirmed_at: now })
      .eq("person_id", claim.person_id)
      .eq("user_id", user.id),
  ]);

  if (updateResult.error) {
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }

  await service.from("audit_logs").insert({
    actor_user_id: user.id,
    action: "confirm_own_data",
    entity_type: "persons",
    entity_id: claim.person_id,
    metadata: { fields: ["first_name","middle_name","first_surname","second_surname","birth_date","birth_city","birth_country"] },
  });

  return NextResponse.json({ ok: true });
}

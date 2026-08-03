import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/profile/data-status
 * Devuelve si el usuario tiene datos no confirmados en su nodo del árbol.
 * Necesita confirmación cuando:
 *   - tiene un claim aprobado
 *   - data_confirmed_at IS NULL
 *   - la persona fue creada por un usuario distinto (otra persona la agregó)
 */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ needsConfirmation: false });

  const service = getServiceClient();

  const { data: claim } = await service
    .from("person_claims")
    .select("person_id, data_confirmed_at")
    .eq("user_id", user.id)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (!claim?.person_id) return NextResponse.json({ needsConfirmation: false });
  if (claim.data_confirmed_at) return NextResponse.json({ needsConfirmation: false });

  const { data: person } = await service
    .from("persons")
    .select("id, first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country, created_by")
    .eq("id", claim.person_id)
    .maybeSingle();

  if (!person) return NextResponse.json({ needsConfirmation: false });

  // Solo mostrar pantalla de confirmación si fue agregado por OTRA persona
  const addedByOther = person.created_by && person.created_by !== user.id;
  if (!addedByOther) {
    // Marcar como confirmado automáticamente si fue el propio usuario quien se agregó
    await service
      .from("person_claims")
      .update({ data_confirmed_at: new Date().toISOString() })
      .eq("person_id", claim.person_id)
      .eq("user_id", user.id);
    return NextResponse.json({ needsConfirmation: false });
  }

  return NextResponse.json({
    needsConfirmation: true,
    personId: person.id,
    data: {
      first_name:     person.first_name ?? "",
      middle_name:    person.middle_name ?? "",
      first_surname:  person.first_surname ?? "",
      second_surname: person.second_surname ?? "",
      birth_date:     person.birth_date ?? "",
      birth_city:     person.birth_city ?? "",
      birth_country:  person.birth_country ?? "",
    },
  });
}

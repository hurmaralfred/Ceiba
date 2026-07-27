import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/audit/relationships?name=washington
 * Audita todas las relaciones de una persona.
 *
 * Verifica:
 * - person_id
 * - todas las relaciones (incoming y outgoing)
 * - dirección (person_a_id vs person_b_id)
 * - estado (deleted_at)
 * - tipo de relación (parent/partner/guardian)
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "Falta parámetro: name" }, { status: 400 });

  const service = getServiceClient();

  try {
    // 1. Encontrar la persona
    const { data: persons, error: personError } = await service
      .from("persons")
      .select("id, first_names, last_names, gender, created_at")
      .ilike("first_names", `%${name}%`)
      .limit(10);

    if (personError) throw personError;

    if (!persons || persons.length === 0) {
      return NextResponse.json({ error: `No encontrada: ${name}` }, { status: 404 });
    }

    const person = persons[0];

    // 2. Todas las relaciones (incoming + outgoing, vivas y eliminadas)
    const { data: relationsA, error: errorA } = await service
      .from("relationships")
      .select(`
        id,
        person_a_id,
        person_b_id,
        relationship_type,
        parent_kind,
        deleted_at,
        created_at
      `)
      .eq("person_a_id", person.id);

    const { data: relationsB, error: errorB } = await service
      .from("relationships")
      .select(`
        id,
        person_a_id,
        person_b_id,
        relationship_type,
        parent_kind,
        deleted_at,
        created_at
      `)
      .eq("person_b_id", person.id);

    if (errorA) throw errorA;
    if (errorB) throw errorB;

    // 3. Resolver nombres de las otras personas
    const otherPersonIds = new Set<string>();
    (relationsA || []).forEach(r => otherPersonIds.add(r.person_b_id));
    (relationsB || []).forEach(r => otherPersonIds.add(r.person_a_id));

    const { data: otherPersons } = await service
      .from("persons")
      .select("id, first_names, last_names, gender")
      .in("id", [...otherPersonIds]);

    const personById = new Map(
      (otherPersons || []).map(p => [p.id, p])
    );

    return NextResponse.json({
      person: {
        id: person.id,
        name: `${person.first_names} ${person.last_names}`,
        gender: person.gender,
        created_at: person.created_at,
      },
      outgoing: (relationsA || []).map(r => ({
        id: r.id,
        direction: `${person.first_names} → ${personById.get(r.person_b_id)?.first_names}`,
        type: r.relationship_type,
        parent_kind: r.parent_kind,
        deleted: !!r.deleted_at,
        created_at: r.created_at,
      })),
      incoming: (relationsB || []).map(r => ({
        id: r.id,
        direction: `${personById.get(r.person_a_id)?.first_names} → ${person.first_names}`,
        type: r.relationship_type,
        parent_kind: r.parent_kind,
        deleted: !!r.deleted_at,
        created_at: r.created_at,
      })),
      summary: {
        total_outgoing: (relationsA || []).length,
        total_incoming: (relationsB || []).length,
        active_outgoing: (relationsA || []).filter(r => !r.deleted_at).length,
        active_incoming: (relationsB || []).filter(r => !r.deleted_at).length,
      },
    });
  } catch (err: any) {
    console.error("audit error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

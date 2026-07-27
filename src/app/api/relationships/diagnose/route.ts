import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/relationships/diagnose?parent=washington&child=cindy
 *
 * Diagnóstico completo de relaciones padre-hijo:
 * - Encuentra ambas personas
 * - Lista todas las relaciones entre ellas
 * - Identifica problemas (inversas, duplicadas, eliminadas)
 * - Sugiere correcciones
 */
export async function GET(req: NextRequest) {
  const parentName = req.nextUrl.searchParams.get("parent");
  const childName = req.nextUrl.searchParams.get("child");

  if (!parentName || !childName) {
    return NextResponse.json(
      { error: "Faltan parámetros: parent, child" },
      { status: 400 }
    );
  }

  const service = getServiceClient();

  try {
    // 1. Buscar personas
    const { data: parents } = await service
      .from("persons")
      .select("id, first_names, last_names, gender")
      .ilike("first_names", `%${parentName}%`)
      .limit(5);

    const { data: children } = await service
      .from("persons")
      .select("id, first_names, last_names, gender")
      .ilike("first_names", `%${childName}%`)
      .limit(5);

    if (!parents?.length || !children?.length) {
      return NextResponse.json({
        error: "No encontradas ambas personas",
        parents: parents?.length || 0,
        children: children?.length || 0,
      }, { status: 404});
    }

    const parentPerson = parents[0];
    const childPerson = children[0];

    // 2. Buscar todas las relaciones entre ellos
    const { data: allRelations } = await service
      .from("relationships")
      .select("id, person_a_id, person_b_id, relationship_type, parent_kind, deleted_at, created_at")
      .or(
        `and(person_a_id.eq.${parentPerson.id},person_b_id.eq.${childPerson.id}),` +
        `and(person_a_id.eq.${childPerson.id},person_b_id.eq.${parentPerson.id})`
      );

    // 3. Analizar relaciones
    const problems: string[] = [];
    const suggestions: Array<{
      action: string;
      relationId?: string;
      reason: string;
    }> = [];

    const directCorrect = (allRelations || []).filter(
      r => r.person_a_id === parentPerson.id &&
           r.person_b_id === childPerson.id &&
           r.relationship_type === "parent" &&
           !r.deleted_at
    );

    const directInverse = (allRelations || []).filter(
      r => r.person_a_id === childPerson.id &&
           r.person_b_id === parentPerson.id &&
           r.relationship_type === "parent" &&
           !r.deleted_at
    );

    const directDead = (allRelations || []).filter(
      r => r.person_a_id === parentPerson.id &&
           r.person_b_id === childPerson.id &&
           r.relationship_type === "parent" &&
           r.deleted_at
    );

    // 4. Diagnosticar
    if (directCorrect.length > 0) {
      return NextResponse.json({
        status: "healthy",
        message: "Relación correcta existe",
        parent: { id: parentPerson.id, name: parentPerson.first_names },
        child: { id: childPerson.id, name: childPerson.first_names },
        relations: {
          correct: directCorrect.length,
          inverse: directInverse.length,
          deleted: directDead.length,
        },
      });
    }

    if (directInverse.length > 0) {
      problems.push("Relación inversa detectada (hijo → padre)");
      suggestions.push({
        action: "delete",
        relationId: directInverse[0].id,
        reason: "Eliminar relación inversa y crear la correcta",
      });
    }

    if (directDead.length > 0) {
      problems.push("Relación existe pero está eliminada (soft-deleted)");
      suggestions.push({
        action: "restore",
        relationId: directDead[0].id,
        reason: "Restaurar relación eliminada",
      });
    }

    if (directCorrect.length === 0 && directInverse.length === 0 && directDead.length === 0) {
      problems.push("No existe relación entre padre e hijo");
      suggestions.push({
        action: "create",
        reason: `Crear relación ${parentPerson.first_names} → ${childPerson.first_names}`,
      });
    }

    return NextResponse.json({
      status: "unhealthy",
      parent: { id: parentPerson.id, name: parentPerson.first_names },
      child: { id: childPerson.id, name: childPerson.first_names },
      problems,
      suggestions,
      relations: {
        correct: directCorrect.length,
        inverse: directInverse.length,
        deleted: directDead.length,
        total: (allRelations || []).length,
      },
    });
  } catch (err: any) {
    console.error("diagnose error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

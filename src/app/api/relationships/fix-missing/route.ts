import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * POST /api/relationships/fix-missing
 * Body: { parentPersonId, childPersonId }
 *
 * Asegura que existe una relación "parent" entre padre e hijo.
 * - Busca relaciones inversas (hijo → padre) y las corrige
 * - Busca relaciones duplicadas y las consolida
 * - Crea la relación si no existe
 *
 * Ejemplo: Washington es padre de Cindy
 *   POST { parentPersonId: "w-id", childPersonId: "c-id" }
 *   Resultado: relación "parent" (w → c) viva
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { parentPersonId, childPersonId } = await req.json();
  if (!parentPersonId || !childPersonId) {
    return NextResponse.json({ error: "Faltan IDs" }, { status: 400 });
  }

  const service = getServiceClient();

  try {
    // 1. Buscar relaciones directas y inversas
    const { data: directRelations } = await service
      .from("relationships")
      .select("id, deleted_at")
      .eq("person_a_id", parentPersonId)
      .eq("person_b_id", childPersonId)
      .eq("relationship_type", "parent");

    const { data: inverseRelations } = await service
      .from("relationships")
      .select("id, deleted_at")
      .eq("person_a_id", childPersonId)
      .eq("person_b_id", parentPersonId)
      .eq("relationship_type", "parent");

    // 2. Si hay relación inversa (hijo → padre como "parent"), corregir
    if (inverseRelations && inverseRelations.length > 0) {
      for (const rel of inverseRelations) {
        // Eliminar la relación inversa
        await service
          .from("relationships")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", rel.id);
      }
    }

    // 3. Si hay relación directa viva, listo
    if (directRelations && directRelations.some(r => !r.deleted_at)) {
      return NextResponse.json({
        status: "already_exists",
        message: "Relación ya existe",
      });
    }

    // 4. Si relación directa está eliminada, restaurar
    if (directRelations && directRelations.some(r => r.deleted_at)) {
      const deadRelation = directRelations.find(r => r.deleted_at);
      await service
        .from("relationships")
        .update({ deleted_at: null })
        .eq("id", deadRelation!.id);

      return NextResponse.json({
        status: "restored",
        message: "Relación restaurada",
      });
    }

    // 5. Crear relación nueva
    const { data: newRelation, error } = await service
      .from("relationships")
      .insert({
        person_a_id: parentPersonId,
        person_b_id: childPersonId,
        relationship_type: "parent",
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({
      status: "created",
      message: "Relación creada",
      relation_id: newRelation.id,
    });
  } catch (err: any) {
    console.error("fix-missing error:", err);
    return NextResponse.json({ error: err.message || "Error" }, { status: 500 });
  }
}

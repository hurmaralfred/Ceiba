import type { FamilyMember } from "@/lib/types";
import type { ExtendedEntry } from "@/components/tree/FamilyTreeGraph";

/**
 * Conjunto ÚNICO de personas visibles del grafo familiar, unificando:
 *   - members        (grado 1: padres, hermanos, pareja, hijos)
 *   - extendedMembers (grado ≥2: abuelos, bisabuelos, nietos, suegros,
 *                      cuñados, sobrinos, ...)
 *
 * Es la fuente de verdad compartida por la vista Galaxia, la vista Lista, el
 * contador y el selector de edición: si una persona aparece en el Galaxia,
 * aparece aquí (y por tanto en Lista y en el contador). Deduplica por id de
 * persona — el grafo genealógico no depende de que tengan cuenta ni claim.
 */
export function buildVisibleMembers(
  members: FamilyMember[],
  extendedMembers: ExtendedEntry[]
): FamilyMember[] {
  const byId = new Map<string, FamilyMember>();
  for (const m of members) {
    if (m?.id) byId.set(m.id, m);
  }
  for (const e of extendedMembers) {
    const m = e?.member;
    if (m?.id && !byId.has(m.id)) byId.set(m.id, m);
  }
  return [...byId.values()];
}

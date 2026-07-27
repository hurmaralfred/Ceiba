/**
 * Capa canónica de PRESENTACIÓN del parentesco.
 *
 * El cálculo vive en `resolveRelationsFromRoot` (src/lib/graphAdapter.ts),
 * que es la única fuente de verdad y la comparten /tree y /invitar. Este
 * módulo solo traduce ese resultado a texto para la interfaz.
 *
 * Regla de género: cuando el género de la persona es desconocido, NO se
 * cae al masculino por defecto — se usa una etiqueta neutral
 * ("Tío/Tía", "Yerno/Nuera"). Nunca se modifica ningún dato para lograrlo.
 */
import { RELATION_LABELS, type RelationType } from "@/lib/types";
import {
  resolveRelationsFromRoot,
  type FamilyGraph,
  type ResolvedRelation,
} from "@/lib/graphAdapter";

export { resolveRelationsFromRoot };
export type { ResolvedRelation };

/**
 * Etiquetas neutrales para cuando NO se conoce el género de la persona.
 *
 * Solo se listan los parentescos cuya forma canónica tiene género. Los que
 * ya son neutros ("Pareja", "Primo/a", "Hijastro/a") o cuya distinción no
 * depende del género de esta persona no necesitan entrada aquí.
 */
export const NEUTRAL_RELATION_LABELS: Partial<Record<RelationType, string>> = {
  father: "Padre/Madre",
  mother: "Padre/Madre",
  son: "Hijo/Hija",
  daughter: "Hijo/Hija",
  brother: "Hermano/Hermana",
  sister: "Hermano/Hermana",
  half_brother: "Medio hermano/a",
  half_sister: "Medio hermano/a",
  husband: "Esposo/a",
  wife: "Esposo/a",
  grandfather: "Abuelo/Abuela",
  grandmother: "Abuelo/Abuela",
  grandfather_paternal: "Abuelo/Abuela",
  grandmother_paternal: "Abuelo/Abuela",
  grandfather_maternal: "Abuelo/Abuela",
  grandmother_maternal: "Abuelo/Abuela",
  great_grandfather: "Bisabuelo/a",
  great_grandmother: "Bisabuelo/a",
  grandson: "Nieto/Nieta",
  granddaughter: "Nieto/Nieta",
  great_grandson: "Bisnieto/a",
  great_granddaughter: "Bisnieto/a",
  uncle: "Tío/Tía",
  aunt: "Tío/Tía",
  nephew: "Sobrino/Sobrina",
  niece: "Sobrino/Sobrina",
  father_in_law: "Suegro/Suegra",
  mother_in_law: "Suegro/Suegra",
  brother_in_law: "Cuñado/Cuñada",
  sister_in_law: "Cuñado/Cuñada",
  son_in_law: "Yerno/Nuera",
  daughter_in_law: "Yerno/Nuera",
  stepfather: "Padrastro/Madrastra",
  stepmother: "Padrastro/Madrastra",
  stepson: "Hijastro/a",
  stepdaughter: "Hijastro/a",
};

/** Texto que se muestra cuando el parentesco no tiene nombre reconocido. */
export const UNKNOWN_RELATION_LABEL = "Familiar";

/**
 * Etiqueta de parentesco lista para mostrar.
 *
 * Si el género es desconocido devuelve la forma neutral; si se conoce,
 * la forma con género del catálogo canónico (RELATION_LABELS).
 */
export function describeRelation(resolved: ResolvedRelation | undefined): string {
  if (!resolved) return UNKNOWN_RELATION_LABEL;

  if (!resolved.genderKnown) {
    const neutral = NEUTRAL_RELATION_LABELS[resolved.relation];
    if (neutral) return neutral;
  }

  const label = RELATION_LABELS[resolved.relation];
  if (!label || resolved.relation === "other") return UNKNOWN_RELATION_LABEL;
  return label;
}

/**
 * Misma etiqueta en forma posesiva ("Tu madre", "Tu tío/tía"), que es como
 * la muestra /invitar. Se deriva de `describeRelation` para que no puedan
 * divergir.
 */
export function describeRelationPossessive(
  resolved: ResolvedRelation | undefined,
): string {
  // Los términos de parentesco no son nombres propios: en forma posesiva
  // van enteros en minúscula. Importa en las etiquetas neutrales, donde
  // ambas mitades deben bajar ("Padre/Madre" -> "tu padre/madre").
  return `Tu ${describeRelation(resolved).toLowerCase()}`;
}

/**
 * Atajo para páginas que solo necesitan el mapa id → etiqueta a partir del
 * grafo crudo del RPC `get_my_family_graph`.
 */
export function buildRelationLabels(
  graph: FamilyGraph,
  options?: { possessive?: boolean },
): Map<string, string> {
  const { byPersonId } = resolveRelationsFromRoot(graph);
  const describe = options?.possessive
    ? describeRelationPossessive
    : describeRelation;

  const labels = new Map<string, string>();
  for (const [personId, resolved] of byPersonId) {
    labels.set(personId, describe(resolved));
  }
  return labels;
}

// Decisiones del flujo de onboarding para una persona ya identificada
// (recién creada, reclamada por match, o con una identidad previamente
// aprobada de este mismo usuario). Aislado y puro: sin llamadas de red,
// sin React — solo la regla de negocio, para poder probarla directamente.

/**
 * Si la persona identificada YA tiene relaciones familiares activas, el
 * onboarding no debe pedirle construir una galaxia desde cero: hay que
 * saltar "Construye tu galaxia" y llevarla directo a /tree. Si no tiene
 * ninguna, el paso de agregar familiares sigue siendo útil (pero nunca
 * obligatorio — ver `getAddFamilyContinueLabel`).
 */
export type ExistingIdentityDecision = "redirect_to_tree" | "show_add_family";

export function decideExistingIdentityStep(
  hasRelationships: boolean
): ExistingIdentityDecision {
  return hasRelationships ? "redirect_to_tree" : "show_add_family";
}

/**
 * Etiqueta del botón de "Construye tu galaxia". 0/5 es progreso recomendado,
 * nunca un requisito: el botón existe y está habilitado desde 0.
 */
export function getAddFamilyContinueLabel(filledCount: number): string {
  return filledCount === 0 ? "Omitir por ahora" : "Continuar a la galaxia";
}

/**
 * El botón de continuar/omitir de "Construye tu galaxia" SIEMPRE está
 * habilitado, sin importar cuántos familiares se hayan agregado — el
 * conteo es solo informativo.
 */
export function isAddFamilyContinueEnabled(_filledCount: number): boolean {
  return true;
}

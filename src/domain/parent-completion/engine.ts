/**
 * ParentCompletionEngine — servicio de dominio (Architecture v3).
 *
 * No es un flujo, no es una RPC, no es un evento: los eventos lo invocan a
 * través de un Adaptador. No conoce HTTP, cron, GEDCOM ni UI.
 *
 * Puro y determinista: la misma entrada produce siempre la misma salida.
 * No escribe nada — confirmar una sugerencia es una operación distinta,
 * responsabilidad de un Adaptador en una fase posterior.
 */

import { computeConfidence } from "./confidence";
import type { EvaluationInput, EvaluationOutcome, RankedCandidate } from "./types";

/**
 * Evalúa qué candidatos podrían ser el segundo progenitor de un hijo.
 *
 * Devuelve TODOS los candidatos con evidencia, ordenados por score
 * descendente. Decidir cómo preguntar cuando hay empate en el nivel más alto
 * ("¿es X?" vs. "¿es alguno de estos?") es responsabilidad del Adaptador UI,
 * no del dominio: aquí se rankea y se explica, no se decide la presentación.
 */
export function evaluate(input: EvaluationInput): EvaluationOutcome {
  if (input.childAlreadyHasTwoParents) {
    return { kind: "no_suggestion", reason: "child_already_has_two_parents" };
  }

  if (input.childHasInformativeDenial) {
    return { kind: "no_suggestion", reason: "informative_denial" };
  }

  const withEvidence = input.candidates.filter(
    (candidate) => candidate.evidence.length > 0,
  );

  if (withEvidence.length === 0) {
    return { kind: "no_suggestion", reason: "no_candidates_with_evidence" };
  }

  const ranked: readonly RankedCandidate[] = withEvidence
    .map((candidate) => ({
      personId: candidate.personId,
      confidence: computeConfidence(candidate.evidence),
    }))
    // Desempate determinista por personId: sin él, dos candidatos con el mismo
    // score podrían alternar de orden entre ejecuciones.
    .sort((a, b) =>
      b.confidence.score !== a.confidence.score
        ? b.confidence.score - a.confidence.score
        : a.personId.localeCompare(b.personId),
    );

  return { kind: "ranked", candidates: ranked };
}

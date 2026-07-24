/**
 * Cálculo de Confidence — el ÚNICO lugar del sistema que sabe cómo combinar
 * evidencia en confianza (Architecture v3).
 *
 * Los tipos de Evidence no conocen su propia fuerza: es contextual. Por eso
 * agregar un tipo de evidencia nuevo no obliga a rediseñar el motor, solo a
 * extender estas reglas.
 */

import type { ConfidenceLevel, ConfidenceResult, Evidence } from "./types";

export class EmptyEvidenceError extends Error {
  constructor() {
    super("computeConfidence requiere al menos una evidencia.");
    this.name = "EmptyEvidenceError";
  }
}

/** El nivel siempre domina sobre la corroboración (ver `score`). */
const LEVEL_SCORE: Readonly<Record<ConfidenceLevel, number>> = {
  weak: 10,
  medium: 50,
  strong: 100,
};

/** Corroboración: tipos distintos más allá del primero, acotada. */
const MAX_CORROBORATION_BONUS = 5;

const LEVEL_RANK: Readonly<Record<ConfidenceLevel, number>> = {
  weak: 0,
  medium: 1,
  strong: 2,
};

/**
 * Fuerza de UNA evidencia aislada. La combinación se resuelve después, en
 * `computeConfidence`.
 */
function baseLevel(evidence: Evidence): ConfidenceLevel {
  switch (evidence.type) {
    case "self_declaration":
      // La persona misma declara su progenitor: la señal de mayor calidad.
      return "strong";

    case "shared_children":
      // Patrón repetido dentro del propio árbol.
      if (evidence.siblingCount >= 2) return "strong";
      if (evidence.siblingCount === 1) return "medium";
      // siblingCount <= 0 no debería ocurrir; defensivo, nunca eleva.
      return "weak";

    case "active_union":
      return evidence.dateVerified ? "strong" : "medium";

    case "historical_union":
      // Un escalón por debajo de la unión vigente equivalente.
      return evidence.dateVerified ? "medium" : "weak";

    case "surname_match":
    case "imported_family_record":
      return "weak";
  }
}

const LEVEL_LABEL: Readonly<Record<ConfidenceLevel, string>> = {
  strong: "Muy probable",
  medium: "Posible",
  weak: "Poco probable",
};

function describe(evidence: Evidence): string {
  switch (evidence.type) {
    case "self_declaration":
      return "la propia persona lo declaró";
    case "shared_children":
      return evidence.siblingCount === 1
        ? "ya es progenitor/a de 1 hermano/a"
        : `ya es progenitor/a de ${evidence.siblingCount} hermanos/as`;
    case "active_union":
      return evidence.dateVerified
        ? "unión vigente y compatible con la fecha del hijo/a"
        : "unión vigente";
    case "historical_union":
      return evidence.dateVerified
        ? "unión anterior compatible con la fecha del hijo/a"
        : "unión anterior";
    case "surname_match":
      return `coincide el apellido "${evidence.matchedSurname}", sin relación registrada`;
    case "imported_family_record":
      return "registro familiar importado";
  }
}

function distinctTypeCountAtLevel(
  evidence: readonly Evidence[],
  level: ConfidenceLevel,
): number {
  const types = new Set<string>();
  for (const item of evidence) {
    if (baseLevel(item) === level) types.add(item.type);
  }
  return types.size;
}

/**
 * Confianza derivada del CONJUNTO de evidencias.
 *
 * Escalación por combinación (v3: la confianza surge del conjunto, no de una
 * señal aislada):
 *   - 2+ señales medium de tipos distintos => strong
 *   - 2+ señales weak de tipos distintos   => medium
 *
 * @throws {EmptyEvidenceError} Precondición: un candidato sin evidencia nunca
 * debe llegar aquí (el motor los descarta antes).
 */
export function computeConfidence(evidence: readonly Evidence[]): ConfidenceResult {
  if (evidence.length === 0) throw new EmptyEvidenceError();

  const highest = evidence.reduce<ConfidenceLevel>((acc, item) => {
    const current = baseLevel(item);
    return LEVEL_RANK[current] > LEVEL_RANK[acc] ? current : acc;
  }, "weak");

  let level: ConfidenceLevel = highest;
  let escalated = false;

  if (highest !== "strong" && distinctTypeCountAtLevel(evidence, "medium") >= 2) {
    level = "strong";
    escalated = true;
  } else if (highest === "weak" && distinctTypeCountAtLevel(evidence, "weak") >= 2) {
    level = "medium";
    escalated = true;
  }

  const distinctTypes = new Set(evidence.map((item) => item.type)).size;
  const corroboration = Math.min(distinctTypes - 1, MAX_CORROBORATION_BONUS);
  const score = LEVEL_SCORE[level] + corroboration;

  const details = evidence.map(describe).join("; ");
  const reason = escalated
    ? `${LEVEL_LABEL[level]} — varias señales coinciden: ${details}`
    : `${LEVEL_LABEL[level]} — ${details}`;

  return { level, score, reason, evidence };
}

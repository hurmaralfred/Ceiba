/**
 * ParentCompletionEngine — vocabulario del dominio (Architecture v3).
 *
 * Responde a: "un hijo tiene un solo progenitor conocido, ¿quién podría ser
 * el segundo?".
 *
 * Separación obligatoria de v3:
 *   Evidence   = hechos atómicos encontrados. Vocabulario ABIERTO: agregar un
 *                tipo nuevo es aditivo y no obliga a rediseñar el motor.
 *                Una Evidence NUNCA declara su propia fuerza.
 *   Confidence = valor DERIVADO del conjunto de evidencias. La fuerza es
 *                contextual y se calcula en un único lugar (confidence.ts).
 *
 * Este módulo es dominio puro: sin DB, sin RPC, sin Supabase, sin UI y sin
 * efectos secundarios.
 */

export type EvidenceType =
  | "self_declaration"
  | "active_union"
  | "historical_union"
  | "shared_children"
  | "surname_match"
  | "imported_family_record";

/** La propia persona declara quién es su progenitor (vía claim_person). */
export interface SelfDeclarationEvidence {
  readonly type: "self_declaration";
  readonly declaredByPersonId: string;
}

/** Unión vigente del progenitor conocido con el candidato. */
export interface ActiveUnionEvidence {
  readonly type: "active_union";
  /** true = el rango de la unión cubre la fecha del hijo (Family Union Engine). */
  readonly dateVerified: boolean;
  readonly unionId?: string;
}

/** Unión pasada del progenitor conocido con el candidato. */
export interface HistoricalUnionEvidence {
  readonly type: "historical_union";
  readonly dateVerified: boolean;
  readonly unionId?: string;
}

/** El candidato ya es progenitor confirmado de N hermanos de este hijo. */
export interface SharedChildrenEvidence {
  readonly type: "shared_children";
  readonly siblingCount: number;
}

/** Coincidencia textual de apellido (convención hispana). Heurística. */
export interface SurnameMatchEvidence {
  readonly type: "surname_match";
  readonly matchedSurname: string;
}

/** Registro de una importación externa (p. ej. grupo FAM de GEDCOM). */
export interface ImportedFamilyRecordEvidence {
  readonly type: "imported_family_record";
  readonly sourceRef?: string;
}

export type Evidence =
  | SelfDeclarationEvidence
  | ActiveUnionEvidence
  | HistoricalUnionEvidence
  | SharedChildrenEvidence
  | SurnameMatchEvidence
  | ImportedFamilyRecordEvidence;

export type ConfidenceLevel = "strong" | "medium" | "weak";

export interface ConfidenceResult {
  readonly level: ConfidenceLevel;
  /** Orden determinista. El nivel siempre domina sobre la corroboración. */
  readonly score: number;
  /** Explicabilidad obligatoria (v3): nunca una sugerencia sin razón. */
  readonly reason: string;
  readonly evidence: readonly Evidence[];
}

/**
 * Entrada ya recolectada. El dominio no sabe de dónde vino la evidencia: la
 * recolección es responsabilidad de un Adaptador (fase posterior).
 */
export interface CandidateInput {
  readonly personId: string;
  readonly evidence: readonly Evidence[];
}

export interface RankedCandidate {
  readonly personId: string;
  readonly confidence: ConfidenceResult;
}

export interface EvaluationInput {
  readonly childPersonId: string;
  readonly childAlreadyHasTwoParents: boolean;
  /**
   * Rechazo informativo ("no aplica": donante anónimo, adopción sin datos).
   * Es un hecho a nivel del HIJO, no evidencia por candidato. Quién lo calcula
   * y persiste es responsabilidad de una fase posterior (riesgo abierto v3).
   */
  readonly childHasInformativeDenial: boolean;
  readonly candidates: readonly CandidateInput[];
}

export type NoSuggestionReason =
  | "child_already_has_two_parents"
  | "informative_denial"
  | "no_candidates_with_evidence";

export type EvaluationOutcome =
  | { readonly kind: "no_suggestion"; readonly reason: NoSuggestionReason }
  | { readonly kind: "ranked"; readonly candidates: readonly RankedCandidate[] };

/**
 * Ciclo de vida conceptual de UNA sugerencia (v3). `pending` es el único
 * estado no terminal.
 */
export type SuggestionState =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired"
  | "obsolete";

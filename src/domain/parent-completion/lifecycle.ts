/**
 * Ciclo de vida conceptual de UNA sugerencia (Architecture v3).
 *
 *                    ┌─────────┐
 *                    │ pending │  ← único estado no terminal
 *                    └────┬────┘
 *          ┌──────────┬───┴────┬───────────┐
 *          ▼          ▼        ▼           ▼
 *     confirmed   rejected  expired    obsolete   ← todos terminales
 *
 * Los estados terminales NUNCA transicionan entre sí. Si más adelante se
 * reevalúa la evidencia, nace una instancia NUEVA — no se revive la anterior.
 * Eso preserva un historial de auditoría append-only.
 *
 * Dominio puro: valida transiciones, no las persiste.
 */

import type { SuggestionState } from "./types";

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: SuggestionState,
    readonly to: SuggestionState,
  ) {
    super(`Transición inválida: ${from} → ${to}.`);
    this.name = "IllegalTransitionError";
  }
}

const ALLOWED_TRANSITIONS: Readonly<
  Record<SuggestionState, readonly SuggestionState[]>
> = {
  pending: ["confirmed", "rejected", "expired", "obsolete"],
  confirmed: [],
  rejected: [],
  expired: [],
  obsolete: [],
};

export function canTransition(from: SuggestionState, to: SuggestionState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** @throws {IllegalTransitionError} si la transición no está permitida. */
export function assertTransition(from: SuggestionState, to: SuggestionState): void {
  if (!canTransition(from, to)) throw new IllegalTransitionError(from, to);
}

export function isTerminal(state: SuggestionState): boolean {
  return ALLOWED_TRANSITIONS[state].length === 0;
}

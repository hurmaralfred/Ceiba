import { describe, it, expect } from "vitest";

import {
  assertTransition,
  canTransition,
  IllegalTransitionError,
  isTerminal,
} from "./lifecycle";
import type { SuggestionState } from "./types";

// Architecture v3: `pending` es el único estado no terminal. Los estados
// terminales NUNCA transicionan entre sí — una reevaluación crea una
// instancia nueva, no revive la anterior (historial append-only).

const TERMINAL: readonly SuggestionState[] = [
  "confirmed",
  "rejected",
  "expired",
  "obsolete",
];

describe("canTransition — transiciones válidas", () => {
  it.each(TERMINAL)("pending → %s es válida", (to) => {
    expect(canTransition("pending", to)).toBe(true);
  });
});

describe("canTransition — transiciones inválidas", () => {
  it("pending → pending no es válida", () => {
    expect(canTransition("pending", "pending")).toBe(false);
  });

  it.each(TERMINAL)("%s no puede volver a pending", (from) => {
    expect(canTransition(from, "pending")).toBe(false);
  });

  it("ningún estado terminal transiciona a otro terminal", () => {
    for (const from of TERMINAL) {
      for (const to of TERMINAL) {
        expect(canTransition(from, to)).toBe(false);
      }
    }
  });
});

describe("assertTransition", () => {
  it("no lanza en una transición válida", () => {
    expect(() => assertTransition("pending", "confirmed")).not.toThrow();
  });

  it("lanza IllegalTransitionError en una transición inválida", () => {
    expect(() => assertTransition("confirmed", "pending")).toThrow(
      IllegalTransitionError,
    );
    expect(() => assertTransition("rejected", "confirmed")).toThrow(
      IllegalTransitionError,
    );
  });

  it("el error conserva el origen y el destino", () => {
    try {
      assertTransition("expired", "obsolete");
      expect.unreachable("debería haber lanzado");
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalTransitionError);
      expect((error as IllegalTransitionError).from).toBe("expired");
      expect((error as IllegalTransitionError).to).toBe("obsolete");
    }
  });
});

describe("isTerminal", () => {
  it("pending no es terminal", () => {
    expect(isTerminal("pending")).toBe(false);
  });

  it.each(TERMINAL)("%s es terminal", (state) => {
    expect(isTerminal(state)).toBe(true);
  });
});

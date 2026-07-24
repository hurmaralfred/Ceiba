import { describe, it, expect } from "vitest";

import { evaluate } from "./engine";
import type { EvaluationInput } from "./types";

// ParentCompletionEngine — dominio puro y determinista. No escribe nada.

function input(overrides: Partial<EvaluationInput> = {}): EvaluationInput {
  return {
    childPersonId: "child-1",
    childAlreadyHasTwoParents: false,
    childHasInformativeDenial: false,
    candidates: [],
    ...overrides,
  };
}

describe("evaluate — cuándo NO sugerir a nadie", () => {
  it("el hijo ya tiene dos progenitores", () => {
    const result = evaluate(
      input({
        childAlreadyHasTwoParents: true,
        candidates: [
          {
            personId: "p1",
            evidence: [{ type: "self_declaration", declaredByPersonId: "child-1" }],
          },
        ],
      }),
    );
    expect(result).toEqual({
      kind: "no_suggestion",
      reason: "child_already_has_two_parents",
    });
  });

  it("existe un rechazo informativo a nivel del hijo", () => {
    const result = evaluate(
      input({
        childHasInformativeDenial: true,
        candidates: [
          { personId: "p1", evidence: [{ type: "active_union", dateVerified: true }] },
        ],
      }),
    );
    expect(result).toEqual({ kind: "no_suggestion", reason: "informative_denial" });
  });

  it("no hay candidatos", () => {
    expect(evaluate(input())).toEqual({
      kind: "no_suggestion",
      reason: "no_candidates_with_evidence",
    });
  });

  it("ningún candidato tiene evidencia", () => {
    const result = evaluate(
      input({ candidates: [{ personId: "p1", evidence: [] }] }),
    );
    expect(result).toEqual({
      kind: "no_suggestion",
      reason: "no_candidates_with_evidence",
    });
  });
});

describe("evaluate — ranking", () => {
  it("ordena strong > medium > weak", () => {
    const result = evaluate(
      input({
        candidates: [
          {
            personId: "weak-one",
            evidence: [{ type: "surname_match", matchedSurname: "Hurtado" }],
          },
          {
            personId: "strong-one",
            evidence: [{ type: "self_declaration", declaredByPersonId: "child-1" }],
          },
          {
            personId: "medium-one",
            evidence: [{ type: "shared_children", siblingCount: 1 }],
          },
        ],
      }),
    );

    expect(result.kind).toBe("ranked");
    if (result.kind !== "ranked") return;
    expect(result.candidates.map((c) => c.personId)).toEqual([
      "strong-one",
      "medium-one",
      "weak-one",
    ]);
    expect(result.candidates.map((c) => c.confidence.level)).toEqual([
      "strong",
      "medium",
      "weak",
    ]);
  });

  it("descarta candidatos sin evidencia pero conserva los demás", () => {
    const result = evaluate(
      input({
        candidates: [
          { personId: "sin-evidencia", evidence: [] },
          {
            personId: "con-evidencia",
            evidence: [{ type: "active_union", dateVerified: true }],
          },
        ],
      }),
    );

    expect(result.kind).toBe("ranked");
    if (result.kind !== "ranked") return;
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].personId).toBe("con-evidencia");
  });

  it("devuelve TODOS los candidatos empatados en el nivel más alto (la presentación es del adaptador UI)", () => {
    const result = evaluate(
      input({
        candidates: [
          {
            personId: "zeta",
            evidence: [{ type: "self_declaration", declaredByPersonId: "child-1" }],
          },
          {
            personId: "alfa",
            evidence: [{ type: "self_declaration", declaredByPersonId: "child-1" }],
          },
        ],
      }),
    );

    expect(result.kind).toBe("ranked");
    if (result.kind !== "ranked") return;
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every((c) => c.confidence.level === "strong")).toBe(true);
    // Desempate determinista por personId.
    expect(result.candidates.map((c) => c.personId)).toEqual(["alfa", "zeta"]);
  });
});

describe("evaluate — determinismo", () => {
  it("la misma entrada produce siempre la misma salida", () => {
    const shared = input({
      candidates: [
        {
          personId: "b",
          evidence: [{ type: "shared_children", siblingCount: 1 }],
        },
        {
          personId: "a",
          evidence: [{ type: "shared_children", siblingCount: 1 }],
        },
        {
          personId: "c",
          evidence: [{ type: "active_union", dateVerified: true }],
        },
      ],
    });

    const first = evaluate(shared);
    const second = evaluate(shared);
    expect(first).toEqual(second);
  });

  it("no muta la entrada recibida", () => {
    const candidates = [
      {
        personId: "b",
        evidence: [{ type: "surname_match" as const, matchedSurname: "X" }],
      },
      {
        personId: "a",
        evidence: [{ type: "active_union" as const, dateVerified: true }],
      },
    ];
    evaluate(input({ candidates }));
    expect(candidates.map((c) => c.personId)).toEqual(["b", "a"]);
  });
});

import { describe, it, expect } from "vitest";

import { computeConfidence, EmptyEvidenceError } from "./confidence";
import type { Evidence } from "./types";

// ParentCompletionEngine — Confidence se DERIVA del conjunto de evidencias.
// Una Evidence nunca declara su propia fuerza (Architecture v3).

describe("computeConfidence — señales aisladas", () => {
  it("self_declaration => strong", () => {
    const evidence: Evidence[] = [
      { type: "self_declaration", declaredByPersonId: "p1" },
    ];
    expect(computeConfidence(evidence).level).toBe("strong");
  });

  it("shared_children con siblingCount >= 2 => strong", () => {
    expect(
      computeConfidence([{ type: "shared_children", siblingCount: 2 }]).level,
    ).toBe("strong");
    expect(
      computeConfidence([{ type: "shared_children", siblingCount: 5 }]).level,
    ).toBe("strong");
  });

  it("shared_children con siblingCount === 1 => medium", () => {
    expect(
      computeConfidence([{ type: "shared_children", siblingCount: 1 }]).level,
    ).toBe("medium");
  });

  it("active_union con fecha verificada => strong", () => {
    expect(
      computeConfidence([{ type: "active_union", dateVerified: true }]).level,
    ).toBe("strong");
  });

  it("active_union sin verificar => medium", () => {
    expect(
      computeConfidence([{ type: "active_union", dateVerified: false }]).level,
    ).toBe("medium");
  });

  it("historical_union con fecha verificada => medium", () => {
    expect(
      computeConfidence([{ type: "historical_union", dateVerified: true }]).level,
    ).toBe("medium");
  });

  it("historical_union sin verificar => weak (un escalón bajo la vigente)", () => {
    expect(
      computeConfidence([{ type: "historical_union", dateVerified: false }]).level,
    ).toBe("weak");
  });

  it("surname_match sola => weak", () => {
    expect(
      computeConfidence([{ type: "surname_match", matchedSurname: "Pineda" }]).level,
    ).toBe("weak");
  });

  it("imported_family_record solo => weak", () => {
    expect(
      computeConfidence([{ type: "imported_family_record" }]).level,
    ).toBe("weak");
  });
});

describe("computeConfidence — escalación por combinación", () => {
  it("2+ señales medium de tipos distintos => strong", () => {
    const evidence: Evidence[] = [
      { type: "active_union", dateVerified: false }, // medium
      { type: "shared_children", siblingCount: 1 }, // medium
    ];
    expect(computeConfidence(evidence).level).toBe("strong");
  });

  it("2+ señales weak de tipos distintos => medium", () => {
    const evidence: Evidence[] = [
      { type: "surname_match", matchedSurname: "Hurtado" }, // weak
      { type: "imported_family_record" }, // weak
    ];
    expect(computeConfidence(evidence).level).toBe("medium");
  });

  it("una sola señal medium NO escala a strong", () => {
    expect(
      computeConfidence([{ type: "active_union", dateVerified: false }]).level,
    ).toBe("medium");
  });

  it("dos señales medium del MISMO tipo no escalan (exige tipos distintos)", () => {
    const evidence: Evidence[] = [
      { type: "historical_union", dateVerified: true, unionId: "u1" },
      { type: "historical_union", dateVerified: true, unionId: "u2" },
    ];
    expect(computeConfidence(evidence).level).toBe("medium");
  });

  it("dos señales weak del MISMO tipo no escalan", () => {
    const evidence: Evidence[] = [
      { type: "surname_match", matchedSurname: "Hurtado" },
      { type: "surname_match", matchedSurname: "Martinez" },
    ];
    expect(computeConfidence(evidence).level).toBe("weak");
  });
});

describe("computeConfidence — score, explicabilidad y precondición", () => {
  it("el nivel siempre domina sobre la corroboración", () => {
    const weakCorroborado = computeConfidence([
      { type: "surname_match", matchedSurname: "X" },
    ]);
    const medium = computeConfidence([
      { type: "historical_union", dateVerified: true },
    ]);
    expect(medium.score).toBeGreaterThan(weakCorroborado.score);
  });

  it("más tipos distintos suben el score dentro del mismo nivel", () => {
    const solo = computeConfidence([
      { type: "self_declaration", declaredByPersonId: "p1" },
    ]);
    const corroborado = computeConfidence([
      { type: "self_declaration", declaredByPersonId: "p1" },
      { type: "active_union", dateVerified: true },
    ]);
    expect(corroborado.level).toBe(solo.level);
    expect(corroborado.score).toBeGreaterThan(solo.score);
  });

  it("siempre devuelve una razón explicable y la evidencia usada", () => {
    const evidence: Evidence[] = [{ type: "shared_children", siblingCount: 3 }];
    const result = computeConfidence(evidence);
    expect(result.reason).toContain("3");
    expect(result.reason.length).toBeGreaterThan(0);
    expect(result.evidence).toEqual(evidence);
  });

  it("lanza si se invoca sin evidencia (precondición del motor)", () => {
    expect(() => computeConfidence([])).toThrow(EmptyEvidenceError);
  });
});

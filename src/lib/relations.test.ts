import { describe, it, expect } from "vitest";

import { inferRelation } from "./relations";
import { applyGenderToRelation, classifyGender } from "./graphAdapter";
import type { RelationType } from "./types";

// Genealogy Engine — parentescos derivados y familia política.
// inferRelation(parentRelation, childRelation): dado que el CONECTOR tiene
// `parentRelation` conmigo y la persona extendida tiene `childRelation` con el
// conector, devuelve la relación de esa persona conmigo.
// El género NO está en inferRelation (las claves son base); lo resuelve
// applyGenderToRelation con el gender REAL de la persona.

describe("inferRelation — consanguíneos colaterales", () => {
  it("tío/tía = hermano/a de un padre o madre", () => {
    expect(inferRelation("father", "brother")).toBe("uncle");
    expect(inferRelation("father", "sister")).toBe("aunt");
    expect(inferRelation("mother", "brother")).toBe("uncle");
    expect(inferRelation("mother", "sister")).toBe("aunt");
  });

  it("sobrino/a = hijo/a de un hermano o hermana", () => {
    expect(inferRelation("brother", "son")).toBe("nephew");
    expect(inferRelation("brother", "daughter")).toBe("niece");
    expect(inferRelation("sister", "son")).toBe("nephew");
    expect(inferRelation("sister", "daughter")).toBe("niece");
  });

  it("primo/a = hijo/a de un tío o tía", () => {
    expect(inferRelation("uncle", "son")).toBe("cousin");
    expect(inferRelation("uncle", "daughter")).toBe("cousin");
    expect(inferRelation("aunt", "son")).toBe("cousin");
    expect(inferRelation("aunt", "daughter")).toBe("cousin");
  });
});

describe("inferRelation — familia política", () => {
  it("suegro/a = padre o madre de la pareja", () => {
    expect(inferRelation("partner", "father")).toBe("father_in_law");
    expect(inferRelation("partner", "mother")).toBe("mother_in_law");
    expect(inferRelation("spouse", "father")).toBe("father_in_law");
  });

  it("cuñado/a = hermano/a de la pareja", () => {
    expect(inferRelation("partner", "brother")).toBe("brother_in_law");
    expect(inferRelation("partner", "sister")).toBe("sister_in_law");
  });

  it("cuñado/a = pareja de un hermano/a", () => {
    expect(inferRelation("brother", "partner")).toBe("brother_in_law");
    expect(inferRelation("sister", "spouse")).toBe("brother_in_law"); // base; género luego
  });

  it("yerno/nuera = pareja de un hijo/a (base son_in_law)", () => {
    expect(inferRelation("son", "partner")).toBe("son_in_law");
    expect(inferRelation("daughter", "partner")).toBe("son_in_law");
    expect(inferRelation("son", "spouse")).toBe("son_in_law");
  });

  it("padrastro/madrastra = pareja de un padre/madre", () => {
    // pareja de mi madre → padrastro; pareja de mi padre → madrastra
    expect(inferRelation("mother", "partner")).toBe("stepfather");
    expect(inferRelation("father", "partner")).toBe("stepmother");
  });

  it("hijastro/a = hijo/a de la pareja (no hijo propio → lo garantiza el BFS)", () => {
    expect(inferRelation("partner", "son")).toBe("stepson");
    expect(inferRelation("partner", "daughter")).toBe("stepdaughter");
    expect(inferRelation("spouse", "son")).toBe("stepson");
  });
});

describe("inferRelation — relaciones en ambas direcciones", () => {
  it("tío ↔ sobrino", () => {
    expect(inferRelation("father", "brother")).toBe("uncle"); // el hermano de mi papá es mi tío
    expect(inferRelation("brother", "son")).toBe("nephew"); // el hijo de mi hermano es mi sobrino
  });

  it("suegro ↔ yerno", () => {
    expect(inferRelation("partner", "father")).toBe("father_in_law");
    expect(inferRelation("son", "partner")).toBe("son_in_law");
  });

  it("padrastro ↔ hijastro", () => {
    expect(inferRelation("mother", "partner")).toBe("stepfather");
    expect(inferRelation("partner", "son")).toBe("stepson");
  });
});

describe("applyGenderToRelation — el género real fija la etiqueta", () => {
  it("aplica femenino a derivados y políticos", () => {
    expect(applyGenderToRelation("uncle", "female")).toBe("aunt");
    expect(applyGenderToRelation("nephew", "female")).toBe("niece");
    expect(applyGenderToRelation("father_in_law", "female")).toBe("mother_in_law");
    expect(applyGenderToRelation("brother_in_law", "female")).toBe("sister_in_law");
    expect(applyGenderToRelation("son_in_law", "female")).toBe("daughter_in_law");
    expect(applyGenderToRelation("stepson", "female")).toBe("stepdaughter");
    expect(applyGenderToRelation("stepfather", "female")).toBe("stepmother");
  });

  it("mantiene masculino cuando el género es male", () => {
    expect(applyGenderToRelation("son_in_law", "male")).toBe("son_in_law");
    expect(applyGenderToRelation("uncle", "male")).toBe("uncle");
  });

  it("NO convierte unknown/neutral en masculino: respeta lo inferido", () => {
    expect(applyGenderToRelation("son_in_law", "unknown")).toBe("son_in_law");
    expect(applyGenderToRelation("uncle", null)).toBe("uncle");
    expect(applyGenderToRelation("aunt", "unknown")).toBe("aunt"); // femenino inferido se conserva
    expect(applyGenderToRelation("daughter_in_law", undefined)).toBe("daughter_in_law");
  });

  it("classifyGender normaliza formatos (M/F/male/female/mayúsculas)", () => {
    expect(classifyGender("female")).toBe("female");
    expect(classifyGender("F")).toBe("female");
    expect(classifyGender("Female")).toBe("female");
    expect(classifyGender("male")).toBe("male");
    expect(classifyGender("unknown")).toBe(null);
    expect(classifyGender(null)).toBe(null);
  });

  // Regression: pareja femenina del hijo → Nuera, no Yerno
  // La pareja de hijo se infiere como son_in_law (base masculina);
  // applyGenderToRelation la convierte a daughter_in_law cuando gender="female".
  // Si gender es null (p.ej. Valeria, cuyo gender no está en la BD),
  // la relación queda como son_in_law → se muestra "Yerno" hasta que se corrija el dato.
  it("pareja femenina del hijo: inferRelation → son_in_law, applyGender(female) → daughter_in_law", () => {
    const base = inferRelation("son", "partner") as RelationType;
    expect(base).toBe("son_in_law");
    expect(applyGenderToRelation(base, "female")).toBe("daughter_in_law");
    expect(applyGenderToRelation(base, "femenina")).toBe("daughter_in_law");
    expect(applyGenderToRelation(base, "F")).toBe("daughter_in_law");
  });

  it("pareja masculina del hijo: inferRelation → son_in_law, applyGender(male) → son_in_law", () => {
    const base = inferRelation("son", "partner") as RelationType;
    expect(applyGenderToRelation(base, "male")).toBe("son_in_law");
  });

  it("gender null en la BD → relación base sin cambiar (sin crash, sin inferencia errónea)", () => {
    const base = inferRelation("son", "partner") as RelationType;
    expect(applyGenderToRelation(base, null)).toBe("son_in_law");
    expect(applyGenderToRelation(base, undefined)).toBe("son_in_law");
  });
});

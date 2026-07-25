import { describe, it, expect } from "vitest";

import { buildAddRelativeRequest, isAddRelativeSupported } from "./graphAdapter";
import type { RelationType } from "./types";
import { KINSHIP_CATALOG, planRelationship, type KinshipKey } from "@/domain/relationships";

// "Agregar familiar": el selector consume el CATÁLOGO CENTRAL y solo habilita
// los parentescos que se pueden traducir a relaciones canónicas
// (parent | partner). Nada derivado se persiste directamente.

// Mismo orden/agrupado que usa el selector en /tree.
const SELECTOR_KEYS: KinshipKey[] = [
  "father", "mother", "grandfather", "grandmother", "great_grandfather", "great_grandmother",
  "brother", "sister",
  "spouse", "partner",
  "son", "daughter", "grandson", "granddaughter", "great_grandson", "great_granddaughter",
  "uncle", "aunt", "nephew", "niece",
  "father_in_law", "mother_in_law", "son_in_law", "daughter_in_law", "brother_in_law", "sister_in_law",
];

describe("el selector consume el catálogo central", () => {
  it("toda opción del selector existe en KINSHIP_CATALOG con etiqueta", () => {
    for (const key of SELECTOR_KEYS) {
      expect(KINSHIP_CATALOG[key], `falta ${key} en el catálogo`).toBeDefined();
      expect(KINSHIP_CATALOG[key].label.length).toBeGreaterThan(0);
    }
  });

  it("las etiquetas provienen del catálogo, no de una lista local", () => {
    expect(KINSHIP_CATALOG.uncle.label).toBe("Tío");
    expect(KINSHIP_CATALOG.aunt.label).toBe("Tía");
    expect(KINSHIP_CATALOG.son_in_law.label).toBe("Yerno");
    expect(KINSHIP_CATALOG.daughter_in_law.label).toBe("Nuera");
    expect(KINSHIP_CATALOG.brother_in_law.label).toBe("Cuñado");
    expect(KINSHIP_CATALOG.sister_in_law.label).toBe("Cuñada");
  });

  it("toda opción tiene un plan resoluble por el planner central", () => {
    for (const key of SELECTOR_KEYS) {
      const plan = planRelationship(key);
      expect(["direct", "derived"]).toContain(plan.kind);
    }
  });
});

describe("cada opción habilitada genera un plan soportado", () => {
  const habilitadas = SELECTOR_KEYS.filter((k) => isAddRelativeSupported(k));

  it("hay al menos las 16 relaciones base habilitadas", () => {
    expect(habilitadas.length).toBe(16);
  });

  it("cada habilitada produce un primitivo canónico (parent|partner)", () => {
    for (const key of habilitadas) {
      const req = buildAddRelativeRequest(key as RelationType, "connector-id");
      expect(["parent", "partner"]).toContain(req.primitive);
    }
  });

  it("NUNCA persiste un parentesco derivado como relation_key", () => {
    const derivados = ["uncle", "aunt", "nephew", "niece", "cousin", "grandfather", "grandmother", "son_in_law", "daughter_in_law"];
    for (const key of habilitadas) {
      const req = buildAddRelativeRequest(key as RelationType, "connector-id");
      expect(derivados).not.toContain(req.backendRelationKey);
    }
  });

  it("abuelos/nietos viajan como cadena parent apoyada en el conector", () => {
    const abuelo = buildAddRelativeRequest("grandfather", "conector-1");
    expect(abuelo.primitive).toBe("parent");
    expect(abuelo.backendRelationKey).toBe("father");
    expect(abuelo.relatedPersonId).toBe("conector-1");

    const nieta = buildAddRelativeRequest("granddaughter", "conector-2");
    expect(nieta.primitive).toBe("parent");
    expect(nieta.backendRelationKey).toBe("daughter");
    expect(nieta.relatedPersonId).toBe("conector-2");
  });
});

describe("opciones aún no ejecutables — visibles pero deshabilitadas", () => {
  const noSoportadas: KinshipKey[] = [
    "uncle", "aunt", "nephew", "niece",
    "father_in_law", "mother_in_law", "son_in_law", "daughter_in_law",
    "brother_in_law", "sister_in_law",
  ];

  it("no están habilitadas (no se pueden ejecutar de forma segura todavía)", () => {
    for (const key of noSoportadas) {
      expect(isAddRelativeSupported(key), `${key} no debería estar habilitada`).toBe(false);
    }
  });

  it("pero SÍ existen en el catálogo — no se ocultan en silencio", () => {
    for (const key of noSoportadas) {
      expect(KINSHIP_CATALOG[key]).toBeDefined();
      expect(SELECTOR_KEYS).toContain(key);
    }
  });

  it("su plan es derivado y requiere selección de un familiar conector", () => {
    for (const key of noSoportadas) {
      const plan = planRelationship(key);
      expect(plan.kind).toBe("derived");
      if (plan.kind === "derived") expect(plan.requiresSelection).toBe(true);
    }
  });
});

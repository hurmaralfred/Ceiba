import { describe, it, expect } from "vitest";

import { computeImmediateFamily } from "./FamilyTreeGraph";
import type { FamilyMember, RelationType } from "@/lib/types";
import type { MemberLink } from "./FamilyTreeGraph";

// Bloque A2 — familia inmediata: padres, hijos, pareja, hermanos (un solo
// salto). Nunca abuelos, nietos, tíos, sobrinos, cuñados, suegros ni primos.
// Se calcula EXCLUSIVAMENTE con members/memberLinks — sin tocar graphAdapter.

function member(id: string, relation_type: RelationType, first_name: string): FamilyMember {
  return {
    id,
    added_by: "root",
    first_name,
    relation_type,
    relation_kind: "blood",
    invitation_sent: false,
    created_at: "",
  };
}

// Escenario: root = Alfredo.
//   Joselin (esposa) — madre de Elias y Ezequiel, no de Ashley.
//   Elias, Ezequiel, Ashley — hijos de Alfredo.
//   Jose Humberto (padre), Enna (madre) — padres de Alfredo.
//   Hugo (hermano de Alfredo, directo).
//   Patricio (abuelo paterno) — padre de Jose Humberto, NO hijo directo de root.
//   NietoTest — hijo de Elias (nieto de Alfredo).
const members: FamilyMember[] = [
  member("joselin", "wife", "Joselin"),
  member("elias", "son", "Elias"),
  member("ezequiel", "son", "Ezequiel"),
  member("ashley", "daughter", "Ashley"),
  member("jose", "father", "Jose Humberto"),
  member("enna", "mother", "Enna"),
  member("hugo", "brother", "Hugo"),
  member("patricio", "grandfather_paternal", "Patricio"),
];

const memberLinks: MemberLink[] = [
  { fromMemberId: "joselin", toMemberId: "elias", relation: "son" },
  { fromMemberId: "joselin", toMemberId: "ezequiel", relation: "son" },
  { fromMemberId: "patricio", toMemberId: "jose", relation: "son" },
  { fromMemberId: "elias", toMemberId: "nieto-test", relation: "son" },
];

describe("computeImmediateFamily — raíz seleccionada", () => {
  const result = computeImmediateFamily("root", members, memberLinks);

  it("incluye padres, hijos, pareja y hermano directo", () => {
    expect(result.has("jose")).toBe(true);
    expect(result.has("enna")).toBe(true);
    expect(result.has("elias")).toBe(true);
    expect(result.has("ezequiel")).toBe(true);
    expect(result.has("ashley")).toBe(true);
    expect(result.has("joselin")).toBe(true);
    expect(result.has("hugo")).toBe(true);
  });

  it("NO incluye abuelos ni nietos (más de un salto)", () => {
    expect(result.has("patricio")).toBe(false);
    expect(result.has("nieto-test")).toBe(false);
  });

  it("el tamaño del conjunto es exactamente 7", () => {
    expect(result.size).toBe(7);
  });
});

describe("computeImmediateFamily — persona no-raíz seleccionada (Elias)", () => {
  const result = computeImmediateFamily("elias", members, memberLinks);

  it("padres: root (Alfredo) y Joselin", () => {
    expect(result.has("root")).toBe(true);
    expect(result.has("joselin")).toBe(true);
  });

  it("hermanos por padre compartido: Ezequiel (con Joselin) y Ashley (con root)", () => {
    expect(result.has("ezequiel")).toBe(true);
    expect(result.has("ashley")).toBe(true);
  });

  it("hijos: nieto-test", () => {
    expect(result.has("nieto-test")).toBe(true);
  });

  it("no se incluye a sí mismo", () => {
    expect(result.has("elias")).toBe(false);
  });
});

describe("computeImmediateFamily — abuelo seleccionado (Jose Humberto)", () => {
  const result = computeImmediateFamily("jose", members, memberLinks);

  it("su padre (Patricio) es su familia inmediata desde su propia perspectiva", () => {
    expect(result.has("patricio")).toBe(true);
  });

  it("root (su hijo) también aparece", () => {
    expect(result.has("root")).toBe(true);
  });
});

describe("computeImmediateFamily — casos límite", () => {
  it("selectedId null → conjunto vacío", () => {
    expect(computeImmediateFamily(null, members, memberLinks).size).toBe(0);
  });

  it("persona sin ninguna relación registrada → conjunto vacío", () => {
    expect(computeImmediateFamily("persona-inexistente", members, memberLinks).size).toBe(0);
  });
});

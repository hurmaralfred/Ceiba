import { describe, it, expect } from "vitest";

import { applyGenderToRelation, edgeToRelationType, type EdgeNode } from "./graphAdapter";
import { RELATION_LABELS, type RelationType } from "./types";

// Distinción mínima matrimonio / unión libre.
// El enum canónico sigue siendo parent | partner | guardian: el matrimonio se
// declara en `union_kind`, NUNCA se infiere desde is_current ni desde la
// existencia de la arista.

const ME = "me-person-id";
const OTHER = "other-person-id";

function partnerEdge(union_kind: EdgeNode["union_kind"]): EdgeNode {
  return {
    id: "edge-1",
    person_a_id: ME,
    person_b_id: OTHER,
    relationship_type: "partner",
    union_kind,
  };
}

/** Etiqueta final tal como la ve el árbol: relación + género de la persona. */
function labelFor(union_kind: EdgeNode["union_kind"], gender: string | null): string {
  const relation = edgeToRelationType(partnerEdge(union_kind), ME, gender);
  const withGender = applyGenderToRelation(relation, gender);
  return RELATION_LABELS[withGender as RelationType];
}

describe("edgeToRelationType — matrimonio vs. pareja", () => {
  it("partner + union_kind='marriage' ⇒ spouse", () => {
    expect(edgeToRelationType(partnerEdge("marriage"), ME, null)).toBe("spouse");
  });

  it("partner + union_kind='partnership' ⇒ partner", () => {
    expect(edgeToRelationType(partnerEdge("partnership"), ME, null)).toBe("partner");
  });

  it("partner + union_kind null/ausente ⇒ partner", () => {
    expect(edgeToRelationType(partnerEdge(null), ME, null)).toBe("partner");
    expect(edgeToRelationType(partnerEdge(undefined), ME, null)).toBe("partner");
  });
});

describe("etiqueta final por género", () => {
  it("marriage + female ⇒ Esposa (caso Joselin)", () => {
    expect(labelFor("marriage", "female")).toBe("Esposa");
  });

  it("marriage + male ⇒ Esposo", () => {
    expect(labelFor("marriage", "male")).toBe("Esposo");
  });

  it("marriage + unknown ⇒ Esposo/a (no se fuerza un género)", () => {
    expect(labelFor("marriage", "unknown")).toBe("Esposo/a");
    expect(labelFor("marriage", null)).toBe("Esposo/a");
  });

  it("partnership o null ⇒ Pareja, con cualquier género", () => {
    expect(labelFor("partnership", "female")).toBe("Pareja");
    expect(labelFor("partnership", "male")).toBe("Pareja");
    expect(labelFor(null, "female")).toBe("Pareja");
    expect(labelFor(undefined, null)).toBe("Pareja");
  });
});

describe("no se contamina el resto del catálogo", () => {
  it("una unión sin declarar NUNCA se muestra como matrimonio", () => {
    expect(labelFor(null, "female")).not.toBe("Esposa");
    expect(labelFor("partnership", "male")).not.toBe("Esposo");
  });

  it("las etiquetas de unión son las esperadas", () => {
    expect(RELATION_LABELS.husband).toBe("Esposo");
    expect(RELATION_LABELS.wife).toBe("Esposa");
    expect(RELATION_LABELS.spouse).toBe("Esposo/a");
    expect(RELATION_LABELS.partner).toBe("Pareja");
  });
});

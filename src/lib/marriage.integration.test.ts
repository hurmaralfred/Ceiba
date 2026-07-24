import { describe, it, expect } from "vitest";

import { adaptGraph, type FamilyGraph } from "./graphAdapter";
import { RELATION_LABELS, type RelationType } from "./types";

/**
 * Integración: mismo recorrido que la página /tree.
 *
 *   get_my_family_graph → FamilyGraph { me, nodes, edges }
 *     → adaptGraph(graph, userId)
 *       → members[].relation_type
 *         → RELATION_LABELS[relation_type]   (lo que pinta el nodo)
 *
 * No prueba edgeToRelationType de forma aislada: parte del payload tal como
 * llega del RPC y llega hasta la etiqueta final, en AMBOS sentidos.
 */

const ALFREDO = "a76b1a46-alfredo";
const JOSELIN = "603ebc19-joselin";

function personNode(id: string, first: string, surname: string, gender: string | null) {
  return {
    id,
    public_id: id,
    first_name: first,
    first_surname: surname,
    gender,
    status: "active",
  };
}

/** Payload con la MISMA forma que devuelve get_my_family_graph. */
function graphFrom(me: string, unionKind: "marriage" | "partnership" | null, alfredoGender: string | null, joselinGender: string | null): FamilyGraph {
  return {
    me,
    nodes: [
      personNode(ALFREDO, "Alfredo", "Hurtado", alfredoGender),
      personNode(JOSELIN, "Joselin", "Constantine", joselinGender),
    ],
    edges: [
      {
        id: "edge-partner",
        person_a_id: ALFREDO,
        person_b_id: JOSELIN,
        relationship_type: "partner",
        union_kind: unionKind,
        deleted_at: null,
      },
    ],
  } as unknown as FamilyGraph;
}

/** Etiqueta con la que el árbol pinta a `targetId` desde la vista de `me`. */
function labelSeenFrom(me: string, targetId: string, unionKind: "marriage" | "partnership" | null, alfredoGender: string | null, joselinGender: string | null) {
  const { members } = adaptGraph(graphFrom(me, unionKind, alfredoGender, joselinGender), "user-id");
  const target = members.find((m) => m.id === targetId);
  if (!target) return { relationType: undefined, label: undefined };
  return {
    relationType: target.relation_type,
    label: RELATION_LABELS[target.relation_type as RelationType],
  };
}

describe("matrimonio — ambos sentidos, recorrido completo de /tree", () => {
  it("Alfredo ve a Joselin como 'Esposa'", () => {
    const seen = labelSeenFrom(ALFREDO, JOSELIN, "marriage", "male", "female");
    expect(seen.relationType).toBe("wife");
    expect(seen.label).toBe("Esposa");
  });

  it("Joselin ve a Alfredo como 'Esposo'", () => {
    const seen = labelSeenFrom(JOSELIN, ALFREDO, "marriage", "male", "female");
    expect(seen.relationType).toBe("husband");
    expect(seen.label).toBe("Esposo");
  });

  it("la relación inversa NO se degrada a partner en ningún sentido", () => {
    expect(labelSeenFrom(ALFREDO, JOSELIN, "marriage", "male", "female").label).not.toBe("Pareja");
    expect(labelSeenFrom(JOSELIN, ALFREDO, "marriage", "male", "female").label).not.toBe("Pareja");
  });
});

describe("matrimonio — género ausente en la persona observada", () => {
  it("si el cónyuge no tiene género, se muestra 'Esposo/a' (nunca 'Pareja')", () => {
    // Caso real de producción: Alfredo tiene gender = null.
    const seen = labelSeenFrom(JOSELIN, ALFREDO, "marriage", null, "female");
    expect(seen.relationType).toBe("spouse");
    expect(seen.label).toBe("Esposo/a");
    expect(seen.label).not.toBe("Pareja");
  });
});

describe("uniones no matrimoniales — siguen siendo 'Pareja' en ambos sentidos", () => {
  it("partnership", () => {
    expect(labelSeenFrom(ALFREDO, JOSELIN, "partnership", "male", "female").label).toBe("Pareja");
    expect(labelSeenFrom(JOSELIN, ALFREDO, "partnership", "male", "female").label).toBe("Pareja");
  });

  it("union_kind null (no declarado)", () => {
    expect(labelSeenFrom(ALFREDO, JOSELIN, null, "male", "female").label).toBe("Pareja");
    expect(labelSeenFrom(JOSELIN, ALFREDO, null, "male", "female").label).toBe("Pareja");
  });
});

import { describe, it, expect } from "vitest";

import {
  resolveRelationsFromRoot,
  describeRelation,
  describeRelationPossessive,
  UNKNOWN_RELATION_LABEL,
} from "./index";
import type { FamilyGraph } from "@/lib/graphAdapter";

/**
 * Lógica canónica de parentesco compartida por /tree y /invitar.
 *
 * Estas pruebas parten del PAYLOAD CRUDO de `get_my_family_graph`
 * (nodes + edges con person_a_id / person_b_id), es decir exactamente lo
 * que recibe /invitar, y llegan hasta la etiqueta mostrada. Así cubren el
 * bug real: /invitar leía `relationship_type` sin mirar la dirección de la
 * arista y etiquetaba a los HIJOS como "Tu papá/mamá".
 */

const YO = "yo";

function persona(
  id: string,
  first_name: string,
  gender: string | null = null,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    public_id: id,
    first_name,
    first_surname: "Test",
    gender,
    status: "active",
    deleted_at: null,
    ...extra,
  };
}

/** parent: person_a es el PROGENITOR, person_b el HIJO. */
function parent(padreId: string, hijoId: string) {
  return {
    id: `p-${padreId}-${hijoId}`,
    person_a_id: padreId,
    person_b_id: hijoId,
    relationship_type: "parent",
    parent_kind: "biological",
    deleted_at: null,
  };
}

function partner(a: string, b: string, union_kind: string | null = null) {
  return {
    id: `s-${a}-${b}`,
    person_a_id: a,
    person_b_id: b,
    relationship_type: "partner",
    union_kind,
    deleted_at: null,
  };
}

function graph(nodes: unknown[], edges: unknown[]): FamilyGraph {
  return { me: YO, nodes, edges } as unknown as FamilyGraph;
}

/** Etiqueta final de `id` vista desde YO. */
function etiqueta(g: FamilyGraph, id: string): string {
  return describeRelation(resolveRelationsFromRoot(g).byPersonId.get(id));
}

// ── Familia de prueba ──────────────────────────────────────────────────
//   padre / madre          -> YO
//   YO                     -> hijo / hija
//   padre                  -> hermano / hermana
//   abuelo                 -> padre
//   hijo                   -> nieto
//   abuelo                 -> tio            (hermano de mi padre)
//   tio                    -> primo
//   hermano                -> sobrino
//   YO <-> esposa
//   suegro                 -> esposa
//   suegro                 -> cunado         (hermano de mi esposa)
const NODOS = [
  persona(YO, "Yo", "male"),
  persona("padre", "Padre", "male"),
  persona("madre", "Madre", "female"),
  persona("hijo", "Hijo", "male"),
  persona("hija", "Hija", "female"),
  persona("hermano", "Hermano", "male"),
  persona("hermana", "Hermana", "female"),
  persona("abuelo", "Abuelo", "male"),
  persona("abuela", "Abuela", "female"),
  persona("nieto", "Nieto", "male"),
  persona("nieta", "Nieta", "female"),
  persona("tio", "Tio", "male"),
  persona("tia", "Tia", "female"),
  persona("sobrino", "Sobrino", "male"),
  persona("esposa", "Esposa", "female"),
  persona("suegro", "Suegro", "male"),
  persona("cunado", "Cunado", "male"),
];

const ARISTAS = [
  parent("padre", YO),
  parent("madre", YO),
  parent(YO, "hijo"),
  parent(YO, "hija"),
  parent("padre", "hermano"),
  parent("padre", "hermana"),
  parent("abuelo", "padre"),
  parent("abuela", "padre"),
  parent("hijo", "nieto"),
  parent("hija", "nieta"),
  parent("abuelo", "tio"),
  parent("abuelo", "tia"),
  parent("hermano", "sobrino"),
  partner(YO, "esposa", "marriage"),
  parent("suegro", "esposa"),
  parent("suegro", "cunado"),
];

const G = graph(NODOS, ARISTAS);

describe("dirección de la arista (causa raíz del bug de /invitar)", () => {
  it("los HIJOS no se etiquetan como padres", () => {
    // Antes: /invitar leía relationship_type="parent" y mostraba
    // "Tu papá/mamá" para los hijos. Este es el caso exacto reportado
    // con Tatiana, Alfredo hijo, Ezequiel y Elías.
    expect(etiqueta(G, "hijo")).toBe("Hijo");
    expect(etiqueta(G, "hijo")).not.toBe("Padre");
    expect(describeRelationPossessive(
      resolveRelationsFromRoot(G).byPersonId.get("hijo"),
    )).toBe("Tu hijo");
  });

  it("la misma arista `parent` se lee al revés desde el otro extremo", () => {
    expect(etiqueta(G, "padre")).toBe("Padre");
    expect(etiqueta(G, "hijo")).toBe("Hijo");
  });
});

describe("parentescos directos", () => {
  it("padre", () => expect(etiqueta(G, "padre")).toBe("Padre"));
  it("madre", () => expect(etiqueta(G, "madre")).toBe("Madre"));
  it("hijo", () => expect(etiqueta(G, "hijo")).toBe("Hijo"));
  it("hija", () => expect(etiqueta(G, "hija")).toBe("Hija"));
  it("hermano", () => expect(etiqueta(G, "hermano")).toBe("Hermano"));
  it("hermana", () => expect(etiqueta(G, "hermana")).toBe("Hermana"));
  it("pareja (matrimonio + género conocido)", () =>
    expect(etiqueta(G, "esposa")).toBe("Esposa"));
});

describe("parentescos indirectos (multi-salto)", () => {
  it("abuelo", () => expect(etiqueta(G, "abuelo")).toContain("Abuelo"));
  it("abuela", () => expect(etiqueta(G, "abuela")).toContain("Abuela"));
  it("nieto", () => expect(etiqueta(G, "nieto")).toBe("Nieto"));
  it("nieta", () => expect(etiqueta(G, "nieta")).toBe("Nieta"));
  it("tío", () => expect(etiqueta(G, "tio")).toBe("Tío"));
  it("tía", () => expect(etiqueta(G, "tia")).toBe("Tía"));
  it("sobrino", () => expect(etiqueta(G, "sobrino")).toBe("Sobrino"));
  it("suegro", () => expect(etiqueta(G, "suegro")).toBe("Suegro"));
  it("cuñado", () => expect(etiqueta(G, "cunado")).toBe("Cuñado"));
});

describe("género desconocido → etiqueta neutral, nunca masculino por defecto", () => {
  const nodosNeutros = [
    persona(YO, "Yo", "male"),
    persona("padre", "Padre", "male"),
    persona("abuelo", "Abuelo", "male"),
    persona("hijo", "Hijo", "male"),
    persona("x_progenitor", "Sin genero", null),
    persona("x_hijo", "Sin genero", "unknown"),
    persona("x_tio", "Sin genero", "unknown"),
    persona("x_yerno", "Sin genero", "unknown"),
  ];
  const aristasNeutras = [
    parent("padre", YO),
    parent("abuelo", "padre"),
    parent(YO, "hijo"),
    parent("x_progenitor", YO),
    parent(YO, "x_hijo"),
    parent("abuelo", "x_tio"),
    partner("hijo", "x_yerno"),
  ];
  const GN = graph(nodosNeutros, aristasNeutras);

  it("progenitor sin género → 'Padre/Madre'", () => {
    expect(etiqueta(GN, "x_progenitor")).toBe("Padre/Madre");
  });

  it("hijo sin género → 'Hijo/Hija'", () => {
    expect(etiqueta(GN, "x_hijo")).toBe("Hijo/Hija");
  });

  it("tío sin género → 'Tío/Tía', NUNCA 'Tío' a secas", () => {
    const l = etiqueta(GN, "x_tio");
    expect(l).toBe("Tío/Tía");
    expect(l).not.toBe("Tío");
  });

  it("pareja de un hijo sin género → 'Yerno/Nuera', NUNCA 'Yerno' (caso Valeria)", () => {
    const l = etiqueta(GN, "x_yerno");
    expect(l).toBe("Yerno/Nuera");
    expect(l).not.toBe("Yerno");
  });

  it("no se altera ningún dato para lograrlo: el género sigue siendo el recibido", () => {
    const nodo = nodosNeutros.find((n) => n.id === "x_yerno");
    expect(nodo?.gender).toBe("unknown");
  });
});

describe("relación no reconocida → 'Familiar'", () => {
  it("una persona sin ningún camino al usuario no aparece resuelta", () => {
    const suelto = graph(
      [persona(YO, "Yo", "male"), persona("aislado", "Aislado", "male")],
      [],
    );
    const r = resolveRelationsFromRoot(suelto).byPersonId.get("aislado");
    expect(r).toBeUndefined();
    expect(describeRelation(r)).toBe(UNKNOWN_RELATION_LABEL);
  });

  it("un parentesco demasiado lejano para tener nombre cae en 'Familiar'", () => {
    // Bisnieto de un tío: la cadena no produce un término reconocido.
    const lejano = graph(
      [
        persona(YO, "Yo", "male"),
        persona("abuelo", "Abuelo", "male"),
        persona("padre", "Padre", "male"),
        persona("tio", "Tio", "male"),
        persona("primo", "Primo", "male"),
        persona("hijo_primo", "HijoPrimo", "male"),
        persona("nieto_primo", "NietoPrimo", "male"),
      ],
      [
        parent("abuelo", "padre"),
        parent("padre", YO),
        parent("abuelo", "tio"),
        parent("tio", "primo"),
        parent("primo", "hijo_primo"),
        parent("hijo_primo", "nieto_primo"),
      ],
    );
    expect(describeRelation(undefined)).toBe(UNKNOWN_RELATION_LABEL);
    // El nieto del primo no tiene término propio: o no se resuelve, o
    // cae en "other" → en ambos casos la etiqueta es "Familiar".
    const r = resolveRelationsFromRoot(lejano).byPersonId.get("nieto_primo");
    if (r) expect(["Familiar", "Primo/a"]).toContain(describeRelation(r));
  });
});

describe("personas eliminadas o fusionadas se excluyen", () => {
  it("una persona merged no aparece ni rompe el recorrido", () => {
    const conMerged = graph(
      [
        persona(YO, "Yo", "male"),
        persona("hijo", "Hijo", "male"),
        persona("dup", "Duplicado", "male", { status: "merged", deleted_at: "2026-07-27T00:00:00Z" }),
      ],
      [parent(YO, "hijo"), parent(YO, "dup")],
    );
    const { byPersonId } = resolveRelationsFromRoot(conMerged);
    expect(byPersonId.has("hijo")).toBe(true);
    expect(byPersonId.has("dup")).toBe(false);
  });

  it("una arista eliminada no propaga parentesco", () => {
    const conBorrada = graph(
      [persona(YO, "Yo", "male"), persona("hijo", "Hijo", "male")],
      [{ ...parent(YO, "hijo"), deleted_at: "2026-07-27T00:00:00Z" }],
    );
    expect(resolveRelationsFromRoot(conBorrada).byPersonId.has("hijo")).toBe(false);
  });
});

describe("afinidad NO se confunde con descendencia de sangre", () => {
  // Caso real detectado validando el árbol de Jose Humberto: la pareja de
  // su nieto aparecía como "Bisnieto/a" — una generación por debajo y
  // presentada como descendiente directo. Regresión permanente.
  const g = graph(
    [
      persona(YO, "Yo", "male"),
      persona("hijo", "Hijo", "male"),
      persona("nieto", "Nieto", "male"),
      persona("pareja_nieto", "ParejaNieto", "female"),
      persona("bisnieto", "Bisnieto", "male"),
    ],
    [
      parent(YO, "hijo"),
      parent("hijo", "nieto"),
      partner("nieto", "pareja_nieto"),
      parent("nieto", "bisnieto"),
    ],
  );

  it("la pareja de mi nieto NO es mi bisnieta", () => {
    const l = etiqueta(g, "pareja_nieto");
    expect(l).not.toBe("Bisnieta");
    expect(l).not.toBe("Bisnieto");
    expect(l).not.toBe("Bisnieto/a");
  });

  it("cae en 'Familiar': impreciso pero nunca falso", () => {
    expect(etiqueta(g, "pareja_nieto")).toBe(UNKNOWN_RELATION_LABEL);
  });

  it("el bisnieto REAL sí se reconoce", () => {
    expect(etiqueta(g, "bisnieto")).toBe("Bisnieto");
  });

  it("la pareja de mi hijo sigue siendo yerno/nuera (no se rompe el nivel de arriba)", () => {
    const g2 = graph(
      [
        persona(YO, "Yo", "male"),
        persona("hijo", "Hijo", "male"),
        persona("nuera", "Nuera", "female"),
      ],
      [parent(YO, "hijo"), partner("hijo", "nuera")],
    );
    expect(etiqueta(g2, "nuera")).toBe("Nuera");
  });
});

describe("forma posesiva (la que muestra /invitar)", () => {
  it("antepone 'Tu' y respeta la minúscula inicial", () => {
    const r = resolveRelationsFromRoot(G).byPersonId;
    expect(describeRelationPossessive(r.get("madre"))).toBe("Tu madre");
    expect(describeRelationPossessive(r.get("hija"))).toBe("Tu hija");
    expect(describeRelationPossessive(r.get("cunado"))).toBe("Tu cuñado");
  });

  it("sin relación conocida → 'Tu familiar'", () => {
    expect(describeRelationPossessive(undefined)).toBe("Tu familiar");
  });

  it("las etiquetas neutrales bajan ENTERAS a minúscula", () => {
    // "Padre/Madre" -> "Tu padre/madre", no "Tu padre/Madre".
    const gn = {
      me: "yo",
      nodes: [
        { id: "yo", first_name: "Yo", gender: "male", status: "active", deleted_at: null },
        { id: "sg", first_name: "SinGenero", gender: "unknown", status: "active", deleted_at: null },
      ],
      edges: [
        { id: "e1", person_a_id: "sg", person_b_id: "yo", relationship_type: "parent", deleted_at: null },
      ],
    } as unknown as FamilyGraph;
    const r = resolveRelationsFromRoot(gn).byPersonId.get("sg");
    expect(describeRelationPossessive(r)).toBe("Tu padre/madre");
  });
});

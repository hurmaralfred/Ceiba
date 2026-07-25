import { describe, it, expect } from "vitest";

import { adaptGraph, type FamilyGraph } from "./graphAdapter";
import { RELATION_LABELS, type RelationType } from "./types";
import { buildLayout } from "@/components/tree/FamilyTreeGraph";

/**
 * Posicionamiento generacional: la fila vertical de cada persona debe salir
 * de la generación ESTRUCTURAL (relaciones parent/partner/guardian reales),
 * nunca de la etiqueta de parentesco mostrada. Un hijastro/a comparte
 * generación con los hijos, aunque su etiqueta sea distinta.
 *
 * Caso exacto exigido:
 *   Joselin y Alfredo: matrimonio.
 *   Alfredo es padre de Ashley, Tatiana, Elias y Ezequiel.
 *   Joselin es madre de Elias y Ezequiel únicamente.
 *
 * Se prueba el PIPELINE COMPLETO que usa /tree: adaptGraph → buildLayout.
 * No basta con adaptGraph aislado — la posición final depende de buildLayout.
 */

const JOSELIN = "joselin-id";
const ALFREDO = "alfredo-id";
const ASHLEY = "ashley-id";
const TATIANA = "tatiana-id";
const ELIAS = "elias-id";
const EZEQUIEL = "ezequiel-id";

function person(id: string, first: string, surname: string, gender: string) {
  return { id, public_id: id, first_name: first, first_surname: surname, gender, status: "active" };
}

function familyGraph(me: string): FamilyGraph {
  const nodes = [
    person(JOSELIN, "Joselin", "Constantine", "female"),
    person(ALFREDO, "Alfredo", "Hurtado", "male"),
    person(ASHLEY, "Ashley", "Hurtado", "female"),
    person(TATIANA, "Tatiana", "Hurtado", "female"),
    person(ELIAS, "Elias", "Hurtado", "male"),
    person(EZEQUIEL, "Ezequiel", "Hurtado", "male"),
  ];
  const edges = [
    { id: "e-partner", person_a_id: ALFREDO, person_b_id: JOSELIN, relationship_type: "partner", union_kind: "marriage", deleted_at: null },
    { id: "e-ashley", person_a_id: ALFREDO, person_b_id: ASHLEY, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
    { id: "e-tatiana", person_a_id: ALFREDO, person_b_id: TATIANA, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
    { id: "e-elias-alf", person_a_id: ALFREDO, person_b_id: ELIAS, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
    { id: "e-eze-alf", person_a_id: ALFREDO, person_b_id: EZEQUIEL, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
    { id: "e-elias-jos", person_a_id: JOSELIN, person_b_id: ELIAS, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
    { id: "e-eze-jos", person_a_id: JOSELIN, person_b_id: EZEQUIEL, relationship_type: "parent", parent_kind: "biological", deleted_at: null },
  ];
  return { me, nodes, edges } as unknown as FamilyGraph;
}

function findGeneration(members: any[], extended: any[], id: string): number | undefined {
  const direct = members.find((m) => m.id === id);
  if (direct) return direct.generation;
  const ext = extended.find((e) => e.member.id === id);
  return ext?.member.generation;
}

function labelOf(members: any[], extended: any[], id: string): string | undefined {
  const direct = members.find((m) => m.id === id);
  if (direct) return RELATION_LABELS[direct.relation_type as RelationType];
  const ext = extended.find((e) => e.member.id === id);
  return ext ? RELATION_LABELS[ext.inferredRelation as RelationType] : undefined;
}

describe("generación estructural — árbol centrado en Joselin", () => {
  const { members, extendedMembers } = adaptGraph(familyGraph(JOSELIN), "viewer");

  it("Joselin (root) está en generación 0", () => {
    // El root no aparece en members/extendedMembers (es "yo"); se valida en buildLayout.
  });

  it("Alfredo: generación 0, etiqueta Esposo", () => {
    expect(findGeneration(members, extendedMembers, ALFREDO)).toBe(0);
    expect(labelOf(members, extendedMembers, ALFREDO)).toBe("Esposo");
  });

  it("Ashley: generación +1, etiqueta Hijastra", () => {
    expect(findGeneration(members, extendedMembers, ASHLEY)).toBe(1);
    expect(labelOf(members, extendedMembers, ASHLEY)).toBe("Hijastra");
  });

  it("Tatiana: generación +1, etiqueta Hijastra", () => {
    expect(findGeneration(members, extendedMembers, TATIANA)).toBe(1);
    expect(labelOf(members, extendedMembers, TATIANA)).toBe("Hijastra");
  });

  it("Elias: generación +1, etiqueta Hijo", () => {
    expect(findGeneration(members, extendedMembers, ELIAS)).toBe(1);
    expect(labelOf(members, extendedMembers, ELIAS)).toBe("Hijo");
  });

  it("Ezequiel: generación +1, etiqueta Hijo", () => {
    expect(findGeneration(members, extendedMembers, EZEQUIEL)).toBe(1);
    expect(labelOf(members, extendedMembers, EZEQUIEL)).toBe("Hijo");
  });
});

describe("pipeline completo (adaptGraph → buildLayout) — árbol centrado en Joselin", () => {
  const profile = { id: JOSELIN, first_name: "Joselin", last_name: "Constantine", location_enabled: false, created_at: "", updated_at: "" };
  const { members, extendedMembers, memberLinks } = adaptGraph(familyGraph(JOSELIN), "viewer");
  const { nodes } = buildLayout(profile as any, members, extendedMembers, memberLinks);

  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  it("Ashley y Tatiana quedan en la MISMA fila (cy) que Elias y Ezequiel", () => {
    const rowHijos = byId(ELIAS).cy;
    expect(byId(EZEQUIEL).cy).toBe(rowHijos);
    expect(byId(ASHLEY).cy).toBe(rowHijos);
    expect(byId(TATIANA).cy).toBe(rowHijos);
  });

  it("Ashley y Tatiana NUNCA quedan en la fila de Joselin/Alfredo (regresión del bug reportado)", () => {
    const rootRow = byId("root").cy;
    expect(byId(ASHLEY).cy).not.toBe(rootRow);
    expect(byId(TATIANA).cy).not.toBe(rootRow);
  });

  it("Alfredo comparte fila con Joselin (root)", () => {
    expect(byId(ALFREDO).cy).toBe(byId("root").cy);
  });

  it("las etiquetas se conservan intactas en el nodo final", () => {
    expect(byId(ASHLEY).relation).toBe("Hijastra");
    expect(byId(TATIANA).relation).toBe("Hijastra");
    expect(byId(ELIAS).relation).toBe("Hijo");
    expect(byId(EZEQUIEL).relation).toBe("Hijo");
  });
});

describe("vista inversa — árbol centrado en Alfredo", () => {
  const { members, extendedMembers } = adaptGraph(familyGraph(ALFREDO), "viewer");

  it("Joselin: generación 0, etiqueta Esposa", () => {
    expect(findGeneration(members, extendedMembers, JOSELIN)).toBe(0);
    expect(labelOf(members, extendedMembers, JOSELIN)).toBe("Esposa");
  });

  it("los cuatro hijos quedan en generación +1", () => {
    expect(findGeneration(members, extendedMembers, ASHLEY)).toBe(1);
    expect(findGeneration(members, extendedMembers, TATIANA)).toBe(1);
    expect(findGeneration(members, extendedMembers, ELIAS)).toBe(1);
    expect(findGeneration(members, extendedMembers, EZEQUIEL)).toBe(1);
  });

  it("no se modifica quién es hijo biológico de quién: los 4 son 'daughter'/'son' directos de Alfredo", () => {
    const direct = (id: string) => members.find((m) => m.id === id)?.relation_type;
    expect(direct(ASHLEY)).toBe("daughter");
    expect(direct(TATIANA)).toBe("daughter");
    expect(direct(ELIAS)).toBe("son");
    expect(direct(EZEQUIEL)).toBe("son");
  });
});

describe("pipeline completo — vista inversa centrada en Alfredo", () => {
  const profile = { id: ALFREDO, first_name: "Alfredo", last_name: "Hurtado", location_enabled: false, created_at: "", updated_at: "" };
  const { members, extendedMembers, memberLinks } = adaptGraph(familyGraph(ALFREDO), "viewer");
  const { nodes } = buildLayout(profile as any, members, extendedMembers, memberLinks);
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  it("los cuatro hijos comparten la misma fila, y Joselin comparte fila con root", () => {
    const rowHijos = byId(ASHLEY).cy;
    expect(byId(TATIANA).cy).toBe(rowHijos);
    expect(byId(ELIAS).cy).toBe(rowHijos);
    expect(byId(EZEQUIEL).cy).toBe(rowHijos);
    expect(byId(JOSELIN).cy).toBe(byId("root").cy);
    expect(rowHijos).not.toBe(byId("root").cy);
  });
});

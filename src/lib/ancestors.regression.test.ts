import { describe, it, expect } from "vitest";

import { inferRelation } from "./relations";
import { RELATION_LABELS } from "./types";

// Regresión: generación de ascendientes y separación de ramas.
//   generación -1 = padre/madre
//   generación -2 = abuelo/abuela
//   generación -3 = bisabuelo/bisabuela
// La generación se deriva SIEMPRE de la cadena de relaciones parent reales,
// nunca de la posición visual ni de apellidos.

describe("generación -2 ⇒ abuelo/abuela", () => {
  it("padre/madre del padre ⇒ abuelo/abuela paterno", () => {
    expect(inferRelation("father", "father")).toBe("grandfather_paternal");
    expect(inferRelation("father", "mother")).toBe("grandmother_paternal");
  });

  it("padre/madre de la madre ⇒ abuelo/abuela materno", () => {
    expect(inferRelation("mother", "father")).toBe("grandfather_maternal");
    expect(inferRelation("mother", "mother")).toBe("grandmother_maternal");
  });

  it("se etiquetan como Abuelo/Abuela", () => {
    expect(RELATION_LABELS.grandfather_paternal).toBe("Abuelo");
    expect(RELATION_LABELS.grandmother_paternal).toBe("Abuela");
    expect(RELATION_LABELS.grandfather_maternal).toBe("Abuelo");
    expect(RELATION_LABELS.grandmother_maternal).toBe("Abuela");
  });
});

describe("generación -3 ⇒ bisabuelo/bisabuela", () => {
  it("padre/madre de un abuelo paterno ⇒ bisabuelo/bisabuela", () => {
    expect(inferRelation("grandfather_paternal", "father")).toBe("great_grandfather");
    expect(inferRelation("grandmother_paternal", "mother")).toBe("great_grandmother");
  });

  it("padre/madre de un abuelo materno ⇒ bisabuelo/bisabuela", () => {
    expect(inferRelation("grandfather_maternal", "father")).toBe("great_grandfather");
    expect(inferRelation("grandmother_maternal", "mother")).toBe("great_grandmother");
  });

  it("NO colapsa a abuelo (regresión del bug original)", () => {
    expect(inferRelation("grandmother_maternal", "father")).not.toBe("grandfather_maternal");
    expect(inferRelation("grandfather_paternal", "father")).not.toBe("grandfather_paternal");
  });

  it("se etiquetan como Bisabuelo/Bisabuela", () => {
    expect(RELATION_LABELS.great_grandfather).toBe("Bisabuelo");
    expect(RELATION_LABELS.great_grandmother).toBe("Bisabuela");
  });
});

describe("las ramas materna y paterna no se mezclan", () => {
  it("la rama del padre nunca produce una clave materna", () => {
    expect(inferRelation("father", "father")).not.toContain("maternal");
    expect(inferRelation("father", "mother")).not.toContain("maternal");
  });

  it("la rama de la madre nunca produce una clave paterna", () => {
    expect(inferRelation("mother", "father")).not.toContain("paternal");
    expect(inferRelation("mother", "mother")).not.toContain("paternal");
  });

  it("cada rama conserva su lado a lo largo de la cadena", () => {
    const abuelaMaterna = inferRelation("mother", "mother");
    const abueloPaterno = inferRelation("father", "father");
    expect(abuelaMaterna).toBe("grandmother_maternal");
    expect(abueloPaterno).toBe("grandfather_paternal");
    expect(abuelaMaterna).not.toBe(abueloPaterno);
  });
});

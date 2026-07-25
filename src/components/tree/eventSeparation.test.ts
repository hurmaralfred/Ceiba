import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { toggleExpandedSet, findRootNodeId, buildLayout } from "./FamilyTreeGraph";
import type { FamilyMember, RelationType } from "@/lib/types";

// Bloque A2 (corrección): seleccionar y expandir/colapsar deben ser
// eventos completamente independientes. Antes, un único onClick sobre
// todo el nodo (incluido el badge +N/−, hijo del mismo grupo) disparaba
// ambos comportamientos a la vez — esa era la causa exacta del bug.
//
// No hay entorno DOM configurado en este proyecto (vitest usa
// environment: "node"), así que en vez de montar el componente real se
// prueban directamente las reglas puras que usan sus handlers (misma
// lógica, no una reimplementación) más invariantes de código fuente para
// lo que sí requiere DOM/eventos reales.

const SOURCE = fs.readFileSync(
  path.join(__dirname, "FamilyTreeGraph.tsx"),
  "utf8",
);

describe("toggleExpandedSet — expandir nunca puede tocar selectedId", () => {
  it("su firma no recibe ni devuelve nada relacionado con selección", () => {
    // Prueba de tipo por construcción: solo acepta (Set<string>, string) y
    // devuelve Set<string> — no hay forma de que afecte selectedId.
    const result = toggleExpandedSet(new Set(), "elias");
    expect(result).toBeInstanceOf(Set);
  });

  it("agrega el id si no estaba expandido", () => {
    const result = toggleExpandedSet(new Set(), "elias");
    expect(result.has("elias")).toBe(true);
  });

  it("quita el id si ya estaba expandido (colapsa)", () => {
    const result = toggleExpandedSet(new Set(["elias"]), "elias");
    expect(result.has("elias")).toBe(false);
  });

  it("no toca otros ids ya expandidos", () => {
    const result = toggleExpandedSet(new Set(["ezequiel"]), "elias");
    expect(result.has("ezequiel")).toBe(true);
    expect(result.has("elias")).toBe(true);
  });

  it("no muta el set original (inmutable, seguro para setState)", () => {
    const original = new Set(["elias"]);
    toggleExpandedSet(original, "elias");
    expect(original.has("elias")).toBe(true);
  });
});

describe("findRootNodeId — ID de la raíz obtenido de los datos, no asumido", () => {
  it("con el pipeline real (buildLayout), hoy corresponde a 'root'", () => {
    const profile = { id: "profile-uuid", first_name: "Joselin", last_name: "C.", location_enabled: false, created_at: "", updated_at: "" };
    const { nodes } = buildLayout(profile as any, [], [], []);
    expect(findRootNodeId(nodes)).toBe("root");
  });

  it("funciona aunque el id real de la persona central sea un UUID", () => {
    const nodesConUuid = [
      { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", relationType: "root" },
      { id: "otro-id", relationType: "son" },
    ];
    expect(findRootNodeId(nodesConUuid)).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d479");
  });

  it("si no hay nodo raíz (caso defensivo), no lanza — cae a 'root'", () => {
    expect(findRootNodeId([{ id: "x", relationType: "son" }])).toBe("root");
  });
});

describe("invariantes de código fuente — separación de eventos", () => {
  it("handleSelect no referencia setExpandedParents", () => {
    const match = SOURCE.match(/const handleSelect = useCallback\(\(memberId: string\) => \{([\s\S]*?)\}, \[\]\);/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain("setExpandedParents");
  });

  it("handleToggleExpand no referencia setSelectedId", () => {
    const match = SOURCE.match(/const handleToggleExpand = useCallback\(\(memberId: string\) => \{([\s\S]*?)\}, \[\]\);/);
    expect(match).not.toBeNull();
    expect(match![1]).not.toContain("setSelectedId");
  });

  it("el nodo (cuerpo) llama a handleSelect en su onClick, no a handleToggleExpand", () => {
    expect(SOURCE).toMatch(/onClick=\{canSelect \? \(\) => handleSelect\(n\.memberId!\) : undefined\}/);
  });

  it("el badge +N/− detiene la propagación antes de expandir", () => {
    const badgeBlock = SOURCE.match(/\+N\/− expansion badge[\s\S]*?<\/g>\s*\)\}/);
    expect(badgeBlock).not.toBeNull();
    expect(badgeBlock![0]).toContain("e.stopPropagation()");
    expect(badgeBlock![0]).toContain("handleToggleExpand(n.memberId!)");
  });

  it("onNodeClick NO se invoca todavía en ningún punto del archivo", () => {
    // Se destructura del prop pero no se llama — la navegación se
    // resuelve en el Bloque C. Coincide solo la declaración/desestructuración.
    expect(SOURCE).not.toMatch(/onNodeClick\?\.\(/);
    expect(SOURCE).not.toMatch(/onNodeClick\(/);
  });

  it("no existe ninguna animación infinita (regresión del Bloque A1)", () => {
    expect(SOURCE.toLowerCase()).not.toContain("infinite");
  });
});

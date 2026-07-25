import { describe, it, expect } from "vitest";

import {
  decideExistingIdentityStep,
  getAddFamilyContinueLabel,
  isAddFamilyContinueEnabled,
} from "./onboardingFlow";

// Caso real: José Humberto fue agregado antes por Alfredo (padre, con 7
// relaciones activas). Al reclamar su identidad, el onboarding lo mandaba
// igual a "Construye tu árbol" — una pantalla que exigía 5/5 sin salida.

describe("decideExistingIdentityStep", () => {
  it("persona CON relaciones → saltar a /tree (escenario A)", () => {
    expect(decideExistingIdentityStep(true)).toBe("redirect_to_tree");
  });

  it("persona SIN relaciones → puede mostrar 'Construye tu árbol' (escenario B)", () => {
    expect(decideExistingIdentityStep(false)).toBe("show_add_family");
  });
});

describe("getAddFamilyContinueLabel — 0/5 es progreso recomendado, no requisito", () => {
  it("0 agregados → 'Omitir por ahora'", () => {
    expect(getAddFamilyContinueLabel(0)).toBe("Omitir por ahora");
  });

  it("1 o más agregados → 'Continuar al árbol'", () => {
    expect(getAddFamilyContinueLabel(1)).toBe("Continuar al árbol");
    expect(getAddFamilyContinueLabel(3)).toBe("Continuar al árbol");
    expect(getAddFamilyContinueLabel(5)).toBe("Continuar al árbol");
  });
});

describe("isAddFamilyContinueEnabled — nunca bloquea la salida (escenarios 7 y 8)", () => {
  it("habilitado en 0/5", () => {
    expect(isAddFamilyContinueEnabled(0)).toBe(true);
  });

  it("habilitado en cualquier conteo", () => {
    expect(isAddFamilyContinueEnabled(1)).toBe(true);
    expect(isAddFamilyContinueEnabled(5)).toBe(true);
    expect(isAddFamilyContinueEnabled(10)).toBe(true);
  });
});

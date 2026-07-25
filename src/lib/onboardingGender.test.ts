import { describe, it, expect } from "vitest";

import { ONBOARDING_GENDER_OPTIONS, isValidOnboardingGender, getProfileGenderFormState } from "./onboardingGender";

// Campo de género en el onboarding — solo estos tres valores son válidos y
// nunca se infiere por nombre. "Prefiero no decir" es una opción válida y
// completa, no un estado vacío.

describe("opciones exactas del selector", () => {
  it("Hombre → male, Mujer → female, Prefiero no decir → unknown", () => {
    expect(ONBOARDING_GENDER_OPTIONS).toEqual([
      { value: "male", label: "Hombre" },
      { value: "female", label: "Mujer" },
      { value: "unknown", label: "Prefiero no decir" },
    ]);
  });
});

describe("isValidOnboardingGender", () => {
  it("Hombre guarda male", () => {
    expect(isValidOnboardingGender("male")).toBe(true);
  });

  it("Mujer guarda female", () => {
    expect(isValidOnboardingGender("female")).toBe(true);
  });

  it("Prefiero no decir guarda unknown (opción válida, no un vacío)", () => {
    expect(isValidOnboardingGender("unknown")).toBe(true);
  });

  it("valor inválido es rechazado", () => {
    expect(isValidOnboardingGender("other")).toBe(false);
    expect(isValidOnboardingGender("Male")).toBe(false); // sensible a caso: solo los 3 valores exactos
    expect(isValidOnboardingGender("")).toBe(false);
    expect(isValidOnboardingGender(123)).toBe(false);
    expect(isValidOnboardingGender({})).toBe(false);
  });

  it("no se puede enviar el formulario sin seleccionar una opción (null/undefined = sin selección)", () => {
    expect(isValidOnboardingGender(null)).toBe(false);
    expect(isValidOnboardingGender(undefined)).toBe(false);
  });
});

// Estado del formulario — la MISMA función que usa el componente para el
// `disabled` del botón "Continuar" y para decidir qué valor se envía al RPC.
// No es el validador aislado: modela la decisión completa del formulario.
describe("getProfileGenderFormState — estado real del botón Continuar", () => {
  it("sin selección (null): Continuar deshabilitado, nada que enviar", () => {
    const state = getProfileGenderFormState(null);
    expect(state.canSubmit).toBe(false);
    expect(state.genderToSubmit).toBeNull();
  });

  it("sin selección (undefined, estado inicial del formulario): deshabilitado", () => {
    const state = getProfileGenderFormState(undefined);
    expect(state.canSubmit).toBe(false);
    expect(state.genderToSubmit).toBeNull();
  });

  it("Hombre seleccionado: Continuar habilitado, envía 'male'", () => {
    const state = getProfileGenderFormState("male");
    expect(state.canSubmit).toBe(true);
    expect(state.genderToSubmit).toBe("male");
  });

  it("Mujer seleccionada: Continuar habilitado, envía 'female'", () => {
    const state = getProfileGenderFormState("female");
    expect(state.canSubmit).toBe(true);
    expect(state.genderToSubmit).toBe("female");
  });

  it("'Prefiero no decir' seleccionado: Continuar HABILITADO (no es 'sin selección') y envía 'unknown'", () => {
    const state = getProfileGenderFormState("unknown");
    expect(state.canSubmit).toBe(true);
    expect(state.genderToSubmit).toBe("unknown");
  });

  it("'unknown' explícito nunca se trata como ausencia de selección", () => {
    const elegidoUnknown = getProfileGenderFormState("unknown");
    const sinElegir = getProfileGenderFormState(null);
    expect(elegidoUnknown.canSubmit).not.toBe(sinElegir.canSubmit);
    expect(elegidoUnknown.genderToSubmit).not.toBe(sinElegir.genderToSubmit);
  });
});

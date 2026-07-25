// Género capturado en el onboarding — módulo dedicado y aislado del resto del
// catálogo genealógico (RelationType/graphAdapter no se tocan). Solo estos
// tres valores son válidos, en el mismo orden en que se muestran en el
// formulario.
export type OnboardingGender = "male" | "female" | "unknown";

export const ONBOARDING_GENDER_OPTIONS: { value: OnboardingGender; label: string }[] = [
  { value: "male", label: "Hombre" },
  { value: "female", label: "Mujer" },
  { value: "unknown", label: "Prefiero no decir" },
];

export function isValidOnboardingGender(value: unknown): value is OnboardingGender {
  return value === "male" || value === "female" || value === "unknown";
}

/**
 * Estado real que gobierna el botón "Continuar" del paso de perfil: la
 * misma función que usa el componente para habilitar/deshabilitar el botón
 * y decidir qué valor se envía a complete_onboarding. `unknown` ("Prefiero
 * no decir") es una selección explícita y válida — nunca se confunde con
 * ausencia de selección (null/undefined), que es lo único que deshabilita.
 */
export interface ProfileGenderFormState {
  canSubmit: boolean;
  genderToSubmit: OnboardingGender | null;
}

export function getProfileGenderFormState(
  selected: OnboardingGender | null | undefined
): ProfileGenderFormState {
  const valid = isValidOnboardingGender(selected);
  return {
    canSubmit: valid,
    genderToSubmit: valid ? selected : null,
  };
}

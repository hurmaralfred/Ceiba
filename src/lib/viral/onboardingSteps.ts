// ============================================================
// CEIBA VIRAL LOOP — Cliente: Onboarding obligatorio de 3 pasos
// ------------------------------------------------------------
// Este archivo define la máquina de estados del onboarding.
// La app NO debe permitir salir hasta agregar al menos 5 familiares.
// ============================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { KinshipKey } from "@/domain/relationships";
import { trackEvent } from "./viralAnalytics";

// ------------------------------------------------------------
// Estados
// ------------------------------------------------------------

export type OnboardingStep =
  | "welcome"          // pantalla de bienvenida
  | "signup"           // email + contraseña o SSO
  | "profile"          // nombres, apellidos, fecha, ciudad, foto
  | "add_relatives"    // paso obligatorio: agregar al menos 5
  | "invite_relatives" // invitación batch
  | "done";

export interface OnboardingState {
  step: OnboardingStep;
  userId?: string;
  personId?: string;
  relativesAdded: number;
  invitesSent: number;
  startedAt: Date;
}

// Reglas de progresión
export const MINIMUM_RELATIVES_TO_ACTIVATE = 5;
export const MINIMUM_INVITES_ENCOURAGED = 3;

// ------------------------------------------------------------
// Máquina de estados
// ------------------------------------------------------------

export function nextStep(state: OnboardingState): OnboardingStep {
  switch (state.step) {
    case "welcome":     return "signup";
    case "signup":      return "profile";
    case "profile":     return "add_relatives";
    case "add_relatives":
      return state.relativesAdded >= MINIMUM_RELATIVES_TO_ACTIVATE
        ? "invite_relatives"
        : "add_relatives";
    case "invite_relatives": return "done";
    case "done":        return "done";
  }
}

export function canProceed(state: OnboardingState): boolean {
  if (state.step === "add_relatives") {
    return state.relativesAdded >= MINIMUM_RELATIVES_TO_ACTIVATE;
  }
  return true;
}

// ------------------------------------------------------------
// Sugerencias de familiares para el paso 3
// ------------------------------------------------------------

export interface SuggestedRelative {
  slot: string;             // 'mother','father','sibling_1','partner','child_1'
  relationship: KinshipKey; // clave de parentesco del dominio
  gender?: "M" | "F" | "X";
  label: string;            // texto amigable
  priority: number;
}

/**
 * Devuelve slots sugeridos al usuario para agregar rápido.
 * Un buen onboarding sugiere en este orden.
 */
export function suggestedFamilySlots(): SuggestedRelative[] {
  return [
    { slot: "mother",   relationship: "mother",  gender: "F", label: "Tu mamá",   priority: 1 },
    { slot: "father",   relationship: "father",  gender: "M", label: "Tu papá",   priority: 2 },
    { slot: "sibling_1",relationship: "sibling",              label: "Un hermano/a", priority: 3 },
    { slot: "partner",  relationship: "partner",              label: "Tu pareja", priority: 4 },
    { slot: "child_1",  relationship: "child",                label: "Un hijo/a", priority: 5 },
    { slot: "sibling_2",relationship: "sibling",              label: "Otro hermano/a", priority: 6 },
  ];
}

// ------------------------------------------------------------
// Aha moment: verificar activación
// ------------------------------------------------------------

export async function checkActivationStatus(
  supabase: SupabaseClient,
): Promise<{ activated: boolean; count: number }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { activated: false, count: 0 };

  const { data: me } = await supabase
    .from("persons")
    .select("id")
    .eq("linked_user_id", user.user.id)
    .single();

  if (!me) return { activated: false, count: 0 };

  const { count } = await supabase
    .from("relationships")
    .select("*", { count: "exact", head: true })
    .or(`person_a_id.eq.${me.id},person_b_id.eq.${me.id}`)
    .eq("status", "confirmed");

  return {
    activated: (count ?? 0) >= MINIMUM_RELATIVES_TO_ACTIVATE,
    count: count ?? 0,
  };
}

// ------------------------------------------------------------
// Handlers para tracking
// ------------------------------------------------------------

export function onStepEnter(state: OnboardingState) {
  trackEvent("onboarding_step_enter", {
    step: state.step,
    relatives_added: state.relativesAdded,
    elapsed_seconds: Math.round((Date.now() - state.startedAt.getTime()) / 1000),
  });
}

export function onOnboardingComplete(state: OnboardingState) {
  trackEvent("onboarding_completed", {
    duration_seconds: Math.round((Date.now() - state.startedAt.getTime()) / 1000),
    relatives_added: state.relativesAdded,
    invites_sent: state.invitesSent,
  });
}

// ------------------------------------------------------------
// Onboarding especial del INVITADO (menos pasos)
// ------------------------------------------------------------
// El invitado ya tiene un person pre-creado. Solo debe:
//   1) Ver el árbol
//   2) Confirmar "este soy yo" o "no soy yo"
//   3) Completar contraseña + foto opcional
//   4) Ver su árbol lleno
// ============================================================

export type InvitedStep =
  | "preview"         // ve su árbol precargado
  | "confirm_identity" // "¿este eres tú?"
  | "set_password"    // pone contraseña
  | "welcome_home";   // ¡bienvenido a tu árbol!

export const INVITED_ONBOARDING_MAX_SECONDS = 30;

export function trackInvitedOnboarding(step: InvitedStep, code: string) {
  trackEvent("invited_onboarding_step", {
    step,
    invitation_code: code,
  });
}

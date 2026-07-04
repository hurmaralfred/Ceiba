// ============================================================
// CEIBA VIRAL LOOP — Cliente: Analytics wrapper
// ------------------------------------------------------------
// Abstracción sobre Amplitude / PostHog / Mixpanel.
// Cambia UNA vez aquí y todos los eventos del loop se envían al proveedor.
// ============================================================

// Reemplazar con el SDK real:
// import { Amplitude } from "@amplitude/react-native";
// import { PostHog } from "posthog-react-native";

let analyticsInitialized = false;

export function initAnalytics(apiKey: string) {
  if (analyticsInitialized) return;

  // Amplitude:
  // Amplitude.getInstance().init(apiKey);

  // PostHog:
  // await PostHog.init(apiKey, { host: "https://us.i.posthog.com" });

  analyticsInitialized = true;
}

// ------------------------------------------------------------
// Catálogo tipado de eventos
// ------------------------------------------------------------

export type CeibaEvent =
  // Onboarding
  | "sign_up_start"
  | "sign_up_complete"
  | "onboarding_step_enter"
  | "onboarding_completed"

  // Relaciones
  | "relative_added"
  | "match_shown"
  | "match_confirmed"
  | "match_rejected"

  // Invitaciones
  | "invite_link_generated"
  | "invite_sent"
  | "invite_link_opened"
  | "invited_onboarding_step"
  | "invite_converted"

  // Deep links
  | "deeplink_opened"

  // Loops secundarios
  | "birthday_notification_opened"
  | "birthday_greeting_sent"
  | "sos_triggered"
  | "sos_response_sent"
  | "broadcast_sent"

  // Gamificación
  | "badge_earned"

  // Retención
  | "app_opened"
  | "app_backgrounded";

export function trackEvent(event: CeibaEvent, properties?: Record<string, any>) {
  if (!analyticsInitialized) {
    console.log("[analytics not init]", event, properties);
    return;
  }

  // Amplitude:
  // Amplitude.getInstance().logEvent(event, properties);

  // PostHog:
  // PostHog.capture(event, properties);

  // Log local para debug
  if ((globalThis as any).__DEV__) {
    console.log("[track]", event, properties);
  }
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  // Amplitude.getInstance().setUserId(userId);
  // PostHog.identify(userId, traits);
}

// ------------------------------------------------------------
// Funnels sugeridos
// ------------------------------------------------------------

/**
 * Funnel de activación:
 *  sign_up_start → sign_up_complete → relative_added (×5) → onboarding_completed
 *
 * Funnel de invitación:
 *  invite_link_generated → invite_sent → invite_link_opened → invite_converted
 *
 * Funnel de cumpleaños:
 *  birthday_notification_opened → birthday_greeting_sent
 */

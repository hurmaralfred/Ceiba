// ============================================================
// CEIBA — Analytics (Amplitude Browser SDK)
// ============================================================

import * as amplitude from "@amplitude/analytics-browser";

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY ?? "";

let initialized = false;

export function initAnalytics(userId?: string) {
  if (typeof window === "undefined" || !API_KEY || initialized) return;
  amplitude.init(API_KEY, userId, {
    defaultTracking: {
      pageViews: true,
      sessions: true,
      formInteractions: false,
      fileDownloads: false,
    },
    logLevel: process.env.NODE_ENV === "development" ? amplitude.Types.LogLevel.Warn : amplitude.Types.LogLevel.None,
  });
  initialized = true;
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  if (!initialized) return;
  amplitude.setUserId(userId);
  if (traits) {
    const identify = new amplitude.Identify();
    Object.entries(traits).forEach(([k, v]) => identify.set(k, v));
    amplitude.identify(identify);
  }
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
  | "app_backgrounded"

  // PWA
  | "pwa_install_prompted"
  | "pwa_install_accepted"
  | "pwa_install_dismissed";

export function trackEvent(event: CeibaEvent, properties?: Record<string, any>) {
  if (typeof window === "undefined") return;
  if (!initialized) {
    if (process.env.NODE_ENV === "development") {
      console.log("[ceiba:track]", event, properties);
    }
    return;
  }
  amplitude.track(event, properties);
}

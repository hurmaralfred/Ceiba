// ============================================================
// CEIBA VIRAL LOOP — Deep link handler (adaptado para Next.js)
// ------------------------------------------------------------
// Detecta si la URL actual es un link mágico y devuelve los datos
// necesarios para pre-cargar la pantalla del invitado.
// ============================================================

import { trackEvent } from "./viralAnalytics";

export interface DeeplinkResult {
  kind: "invite" | "sos" | "birthday" | "unknown";
  code?: string;
  personId?: string;
}

const INVITE_HANDLER_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co")}/invite-open-handler`
    : "https://txxdzxdzetqlfecqhxkl.functions.supabase.co/invite-open-handler";

export function parseDeeplink(url: string): DeeplinkResult {
  try {
    const u = new URL(url);

    // ceibapp.com/invite/A7X4M2
    if (u.pathname.startsWith("/invite/")) {
      const code = u.pathname.split("/")[2];
      if (code) return { kind: "invite", code };
    }

    // ceiba://invite?code=A7X4M2
    if (u.searchParams.get("code")) {
      return { kind: "invite", code: u.searchParams.get("code")! };
    }

    if (u.pathname.startsWith("/sos/")) {
      return { kind: "sos", personId: u.pathname.split("/")[2] };
    }

    if (u.pathname.startsWith("/birthday/")) {
      return { kind: "birthday", personId: u.pathname.split("/")[2] };
    }

    return { kind: "unknown" };
  } catch {
    return { kind: "unknown" };
  }
}

/**
 * Obtiene datos de la invitacion desde el Edge Function.
 * Llamar desde /invite/[code]/page.tsx
 */
export async function fetchInvitationData(code: string) {
  const res = await fetch(`${INVITE_HANDLER_URL}?code=${code}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Parsea la URL actual (browser) y emite el evento de analytics.
 * Llamar desde un useEffect en el layout raiz.
 */
export function handleCurrentUrl(): DeeplinkResult {
  if (typeof window === "undefined") return { kind: "unknown" };
  const result = parseDeeplink(window.location.href);
  if (result.kind !== "unknown") {
    trackEvent("deeplink_opened", { kind: result.kind, url: window.location.href });
  }
  return result;
}

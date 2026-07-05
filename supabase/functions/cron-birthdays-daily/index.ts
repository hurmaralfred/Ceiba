// ============================================================
// CEIBA — Edge Function: cron-birthdays-daily
// ------------------------------------------------------------
// Corre 1 vez al día (pg_cron 8:00 AM).
// Para cada usuario activo:
//   1) Obtiene cumpleaños en 0 y 7 días de su red familiar.
//   2) Envía push notification via FCM HTTP v1 API.
// Respeta notification_preferences.birthdays.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL     = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_PROJECT_ID   = Deno.env.get("FCM_PROJECT_ID")!;
const FCM_CLIENT_EMAIL = Deno.env.get("FCM_CLIENT_EMAIL")!;
// Private key comes stored with literal \n — replace before use
const FCM_PRIVATE_KEY  = (Deno.env.get("FCM_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── FCM v1 helpers ────────────────────────────────────────────

function base64url(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

/** Generate a short-lived OAuth2 access token using the service account. */
async function getFCMAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const headerB64  = base64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify({
    iss:   FCM_CLIENT_EMAIL,
    sub:   FCM_CLIENT_EMAIL,
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })));

  const signingInput = `${headerB64}.${payloadB64}`;

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuffer(FCM_PRIVATE_KEY),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`OAuth2 token error: ${err}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

/** Send a single FCM message via HTTP v1 API. */
async function sendFCMv1(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string>,
  accessToken: string,
): Promise<void> {
  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        message: {
          token: fcmToken,
          notification: { title, body },
          data,
          webpush: {
            notification: {
              title,
              body,
              icon:  "/icons/icon-192.png",
              badge: "/icons/badge-72.png",
              vibrate: [200, 100, 200],
            },
            fcm_options: { link: "https://ceibapp.com/tree" },
          },
          android: { priority: "high" },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    // Don't throw — log and continue so one bad token doesn't block others
    console.error(`FCM v1 error (token ${fcmToken.slice(0, 20)}…): ${err}`);
  }
}

// ── Main handler ──────────────────────────────────────────────

Deno.serve(async (_req) => {
  const startedAt = new Date().toISOString();

  // Pre-fetch OAuth2 token once, reuse for all messages
  let accessToken: string;
  try {
    accessToken = await getFCMAccessToken();
  } catch (e) {
    console.error("Could not obtain FCM access token:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 1) Usuarios con linked_user_id (cuentas activas)
  const { data: allPersons } = await admin
    .from("persons")
    .select("id, linked_user_id")
    .not("linked_user_id", "is", null);

  if (!allPersons) {
    return new Response(JSON.stringify({ ok: false, error: "no persons" }), { status: 500 });
  }

  // 2) Preferencias de notificación
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, birthdays");

  const disabled = new Set(
    (prefs ?? [])
      .filter((p: any) => p.birthdays === false)
      .map((p: any) => p.user_id),
  );

  let notifiedTotal = 0;

  for (const p of allPersons) {
    if (disabled.has(p.linked_user_id)) continue;

    // 3) Cumpleaños próximos (0 o 7 días)
    const { data: birthdays, error: bdError } = await admin.rpc(
      "_admin_birthdays_for_person",
      { p_person: p.id, p_days: 7 },
    );
    if (bdError) { console.error("birthdays rpc:", bdError); continue; }
    if (!birthdays || birthdays.length === 0) continue;

    // Regla de duelo: silenciar si hay fallecimiento en la red en los últimos 30 días
    const { data: recentDeaths } = await admin
      .from("family_events")
      .select("id")
      .eq("event_type", "death")
      .gte(
        "event_date",
        new Date(Date.now() - 30 * 86_400_000).toISOString().split("T")[0],
      )
      .limit(1);
    if (recentDeaths && recentDeaths.length > 0) continue;

    // 4) FCM tokens del usuario
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", p.linked_user_id);

    const tokenList = (tokens ?? []).map((t: any) => t.token as string);
    if (tokenList.length === 0) continue;

    // 5) Enviar solo en día 0 o día 7
    for (const b of birthdays as any[]) {
      const days = b.days_until as number;
      if (days !== 0 && days !== 7) continue;

      const title = days === 0
        ? `🎂 ¡Hoy cumple años ${b.full_name}!`
        : `🎂 En 7 días cumple ${b.full_name}`;
      const body = days === 0
        ? "Toca para felicitarle desde Ceiba."
        : "Prepara tu mensaje o sorpresa.";

      for (const token of tokenList) {
        await sendFCMv1(token, title, body, {
          type:       "birthday",
          person_id:  b.person_id,
          days_until: String(days),
        }, accessToken);
        notifiedTotal++;
      }
    }
  }

  return new Response(
    JSON.stringify({
      ok:          true,
      started_at:  startedAt,
      finished_at: new Date().toISOString(),
      notified:    notifiedTotal,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

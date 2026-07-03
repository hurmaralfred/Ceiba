// ============================================================
// CEIBA — Edge Function: cron-birthdays-daily
// ------------------------------------------------------------
// Corre 1 vez al día (llamado por pg_cron a las 8:00 AM).
// Para cada usuario activo:
//   1) Obtiene los cumpleaños de su red familiar en 0 y 7 días.
//   2) Envía push notification via FCM v1 API.
// Respeta notification_preferences.birthdays.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

// ── FCM v1 helpers ──────────────────────────────────────────

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64url(data: string | ArrayBuffer): string {
  const str =
    typeof data === "string"
      ? btoa(data)
      : btoa(String.fromCharCode(...new Uint8Array(data)));
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getAccessToken(sa: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const toSign = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(toSign),
  );
  const jwt = `${toSign}.${base64url(sig)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const { access_token } = await res.json();
  return access_token;
}

async function sendFCM(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
) {
  if (tokens.length === 0) return;
  try {
    const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
    const accessToken = await getAccessToken(sa);
    for (const token of tokens) {
      await fetch(
        `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title, body },
              android: {
                priority: "high",
                notification: { channel_id: "ceiba_notif", sound: "default" },
              },
              apns: { payload: { aps: { sound: "default" } } },
              data,
            },
          }),
        },
      );
    }
  } catch (e) {
    console.error("FCM error:", e);
  }
}

Deno.serve(async (_req) => {
  const startedAt = new Date().toISOString();

  // 1) Usuarios con notificaciones de cumpleaños activadas (o sin fila = default true)
  const { data: allPersons } = await admin
    .from("persons")
    .select("id, linked_user_id")
    .not("linked_user_id", "is", null);

  if (!allPersons) return new Response("no persons", { status: 500 });

  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("user_id, birthdays");

  const disabled = new Set(
    (prefs ?? []).filter((p: any) => p.birthdays === false).map((p: any) => p.user_id),
  );

  let notifiedTotal = 0;

  for (const p of allPersons) {
    if (disabled.has(p.linked_user_id)) continue;

    // 2) Cumpleaños próximos hasta 7 días
    const { data: birthdays, error: bdError } = await admin.rpc(
      "_admin_birthdays_for_person",
      { p_person: p.id, p_days: 7 },
    );
    if (bdError) {
      console.error("birthdays rpc error:", bdError);
      continue;
    }
    if (!birthdays || birthdays.length === 0) continue;

    // Regla emocional: silenciar cumpleaños de familias con duelo reciente (30 días)
    // Se verifica si hay algún fallecido en la red en los últimos 30 días.
    const { data: recentDeaths } = await admin
      .from("family_events")
      .select("id")
      .eq("event_type", "death")
      .gte("event_date", new Date(Date.now() - 30 * 86400 * 1000).toISOString().split("T")[0])
      .limit(1);
    if (recentDeaths && recentDeaths.length > 0) continue;

    // 3) Tokens push del usuario
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .eq("user_id", p.linked_user_id);
    const tokenList = (tokens ?? []).map((t: any) => t.token);
    if (tokenList.length === 0) continue;

    // 4) Enviar solo para 0 o 7 días exactos (no todos los días intermedios)
    for (const b of birthdays as any[]) {
      const days = b.days_until as number;
      if (days !== 0 && days !== 7) continue;

      const title = days === 0
        ? `🎂 ¡Hoy cumple años ${b.full_name}!`
        : `🎂 En 7 días cumple ${b.full_name}`;
      const body = days === 0
        ? "Toca para felicitarle desde Ceiba."
        : "Prepara tu mensaje o sorpresa.";
      await sendFCM(tokenList, title, body, {
        type: "birthday",
        person_id: b.person_id,
        days_until: String(days),
      });
      notifiedTotal++;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      notified: notifiedTotal,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});

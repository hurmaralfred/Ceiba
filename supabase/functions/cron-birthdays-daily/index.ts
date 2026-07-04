// ============================================================
// CEIBA — Edge Function: cron-birthdays-daily
// ------------------------------------------------------------
// Corre 1 vez al día (llamado por pg_cron a las 8:00 AM).
// Para cada usuario activo:
//   1) Obtiene los cumpleaños de su red familiar en 0 y 7 días.
//   2) Envía push notification via FCM.
// Respeta notification_preferences.birthdays.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendFCM(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, string>,
) {
  if (tokens.length === 0) return;
  try {
    await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Authorization": `key=${FCM_SERVER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: { title, body, sound: "default" },
        data,
        priority: "high",
      }),
    });
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

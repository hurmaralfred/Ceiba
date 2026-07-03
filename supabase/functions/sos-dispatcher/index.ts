// ============================================================
// CEIBA — Edge Function: sos-dispatcher
// ------------------------------------------------------------
// Se dispara vía webhook de la tabla sos_alerts (INSERT).
// Configuración en Supabase:
//   Database → Webhooks → Create webhook
//     Table: sos_alerts
//     Events: INSERT
//     Type: HTTP Request
//     URL: https://<ref>.functions.supabase.co/sos-dispatcher
//     HTTP Method: POST
//     Headers: Authorization: Bearer <service-role>
//
// Payload recibido:
// {
//   "type":"INSERT","table":"sos_alerts","record":{...},"schema":"public"
// }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendFCM(tokens: string[], title: string, body: string, data: Record<string, string>) {
  if (tokens.length === 0) return;
  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Authorization": `key=${FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: tokens,
      notification: {
        title,
        body,
        sound: "default",
        // iOS crítico:
        // apns-priority: 10, interruption-level: time-sensitive
      },
      android: {
        priority: "high",
        notification: { channel_id: "ceiba_sos", sound: "default" },
      },
      apns: {
        payload: {
          aps: {
            "interruption-level": "time-sensitive",
            sound: "default",
          },
        },
      },
      data,
      priority: "high",
    }),
  });
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const alert = body.record;
    if (!alert || !alert.sender_user_id) {
      return new Response("invalid payload", { status: 400 });
    }

    // 1) obtener person del emisor
    const { data: sender } = await admin
      .from("persons")
      .select("id, first_names, last_names")
      .eq("linked_user_id", alert.sender_user_id)
      .maybeSingle();
    if (!sender) return new Response("sender not found", { status: 404 });

    // 2) obtener la red hasta scope_degree (BFS por SQL)
    // Se usa RPC 'get_family_ids_up_to' que devuelve los person_ids.
    // Si prefieres inline, replicamos el CTE recursivo aquí como SQL crudo:
    const { data: netIds, error: netErr } = await admin.rpc(
      "get_family_ids_up_to",
      { p_person: sender.id, p_degree: alert.scope_degree }
    );
    if (netErr) return new Response(JSON.stringify(netErr), { status: 500 });

    const personIds = (netIds ?? []).map((r: any) => r.person_id).filter(
      (id: string) => id !== sender.id,
    );
    if (personIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }));
    }

    // 3) obtener linked_user_id de esos persons
    const { data: linked } = await admin
      .from("persons")
      .select("linked_user_id")
      .in("id", personIds)
      .not("linked_user_id", "is", null);

    const userIds = (linked ?? []).map((p: any) => p.linked_user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }));
    }

    // 4) filtrar por preferencias
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id, sos")
      .in("user_id", userIds);
    const wanted = new Set(
      (prefs ?? []).filter((p: any) => p.sos !== false).map((p: any) => p.user_id),
    );
    // usuarios sin fila de prefs → default true
    const eligibleUserIds = userIds.filter(
      (u: string) => wanted.has(u) || !(prefs ?? []).find((p: any) => p.user_id === u),
    );

    // 5) obtener tokens
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", eligibleUserIds);

    const tokenList = (tokens ?? []).map((t: any) => t.token);

    // 6) enviar
    const senderName = `${sender.first_names} ${sender.last_names}`;
    await sendFCM(
      tokenList,
      `🚨 ${senderName} activó una alerta SOS`,
      alert.message ?? "Toca para ver detalles y responder.",
      {
        type: "sos",
        sos_id: alert.id,
        lat: alert.lat?.toString() ?? "",
        lon: alert.lon?.toString() ?? "",
      },
    );

    return new Response(
      JSON.stringify({
        ok: true,
        sent: tokenList.length,
        eligible_users: eligibleUserIds.length,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});

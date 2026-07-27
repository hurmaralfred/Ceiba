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
//
// Resolución de identidad y destinatarios — modelo canónico:
//   auth.users.id -> person_claims.user_id -> person_claims.person_id -> persons.id
//   familia = otras personas en el mismo family_space (space_memberships)
// Nunca se usa persons.linked_user_id (no existe).
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

    // 1) Resolver la persona del emisor vía person_claims (nunca linked_user_id)
    const { data: senderClaim, error: senderClaimErr } = await admin
      .from("person_claims")
      .select("person_id")
      .eq("user_id", alert.sender_user_id)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .maybeSingle();

    if (senderClaimErr) {
      return new Response(JSON.stringify({ error: senderClaimErr.message }), { status: 500 });
    }
    if (!senderClaim) {
      return new Response("sender has no approved person_claim", { status: 404 });
    }

    const { data: sender, error: senderErr } = await admin
      .from("persons")
      .select("id, first_name, first_surname")
      .eq("id", senderClaim.person_id)
      .maybeSingle();

    if (senderErr) return new Response(JSON.stringify({ error: senderErr.message }), { status: 500 });
    if (!sender) return new Response("sender person not found", { status: 404 });

    // 2) Familia = otras personas en el/los mismo(s) family_space (space_memberships).
    // No se usa get_family_ids_up_to: esa RPC referencia relationships.status,
    // columna que no existe (la real es relationship_status) — bug independiente,
    // no corregido en este cambio; se evita por completo.
    const { data: mySpaces, error: mySpacesErr } = await admin
      .from("space_memberships")
      .select("space_id")
      .eq("person_id", sender.id);

    if (mySpacesErr) return new Response(JSON.stringify({ error: mySpacesErr.message }), { status: 500 });

    const spaceIds = (mySpaces ?? []).map((s: any) => s.space_id as string);
    if (spaceIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "sender_has_no_family_space" }));
    }

    const { data: spaceMembers, error: spaceMembersErr } = await admin
      .from("space_memberships")
      .select("person_id")
      .in("space_id", spaceIds)
      .neq("person_id", sender.id);

    if (spaceMembersErr) return new Response(JSON.stringify({ error: spaceMembersErr.message }), { status: 500 });

    const personIds = [...new Set((spaceMembers ?? []).map((m: any) => m.person_id as string))];
    if (personIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_connected_family" }));
    }

    // 3) Resolver user_id de esas personas vía person_claims (nunca linked_user_id)
    const { data: recipientClaims, error: recipientClaimsErr } = await admin
      .from("person_claims")
      .select("user_id")
      .in("person_id", personIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);

    if (recipientClaimsErr) {
      return new Response(JSON.stringify({ error: recipientClaimsErr.message }), { status: 500 });
    }

    const userIds = [...new Set((recipientClaims ?? []).map((c: any) => c.user_id as string))];
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no_recipients_with_account" }));
    }

    // 4) Filtrar por preferencias de notificación SOS
    const { data: prefs } = await admin
      .from("notification_preferences")
      .select("user_id, sos")
      .in("user_id", userIds);

    const optedOut = new Set(
      (prefs ?? []).filter((p: any) => p.sos === false).map((p: any) => p.user_id),
    );
    const eligibleUserIds = userIds.filter((u: string) => !optedOut.has(u));

    // 5) Tokens push
    const { data: tokens } = await admin
      .from("push_tokens")
      .select("token")
      .in("user_id", eligibleUserIds);

    const tokenList = (tokens ?? []).map((t: any) => t.token);

    // 6) Enviar
    const senderName = `${sender.first_name ?? ""} ${sender.first_surname ?? ""}`.trim() || "Un familiar";
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

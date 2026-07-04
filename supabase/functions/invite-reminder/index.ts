// ============================================================
// CEIBA VIRAL LOOP — Edge Function: invite-reminder
// ------------------------------------------------------------
// Corre 3 veces al día. Envía recordatorios inteligentes al invitado
// y también al inviter (para que reenvíe si el invitado no respondió).
//
// Lógica:
//   - 24h después de enviar → reminder suave al inviter
//   - 72h después → SMS/WhatsApp al invitado (fallback)
//   - 7 días → último intento antes de marcar como fría
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVER_KEY = Deno.env.get("FCM_SERVER_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendPushToUser(userId: string, title: string, body: string, data: Record<string, string>) {
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  const list = (tokens ?? []).map((t: any) => t.token);
  if (list.length === 0) return;

  await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      "Authorization": `key=${FCM_SERVER_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      registration_ids: list,
      notification: { title, body, sound: "default" },
      data,
      priority: "high",
    }),
  }).catch(console.error);
}

Deno.serve(async (_req) => {
  const now = new Date();
  let processed = 0;

  // ---------- Recordatorio 24h al inviter ----------
  {
    const { data } = await admin
      .from("invitations")
      .select("id, inviter_user_id, invited_person_id, code, created_at, reminders_sent")
      .in("status", ["sent", "opened"])
      .lt("created_at", new Date(now.getTime() - 24 * 3600 * 1000).toISOString())
      .gt("created_at", new Date(now.getTime() - 72 * 3600 * 1000).toISOString())
      .eq("reminders_sent", 0);

    for (const inv of data ?? []) {
      const { data: invitedPerson } = await admin
        .from("persons")
        .select("first_names")
        .eq("id", inv.invited_person_id)
        .single();

      await sendPushToUser(
        inv.inviter_user_id,
        `${invitedPerson?.first_names ?? "Tu familiar"} aún no se ha unido`,
        "Toca para reenviar la invitación.",
        { type: "invite_reminder", invitation_id: inv.id },
      );

      await admin
        .from("invitations")
        .update({ reminders_sent: 1, last_reminded_at: now.toISOString() })
        .eq("id", inv.id);

      await admin.from("invitation_events").insert({
        invitation_id: inv.id,
        event_type: "reminded",
        metadata: { stage: "24h_inviter" },
      });

      processed++;
    }
  }

  // ---------- Recordatorio 72h por SMS/WhatsApp al invitado ----------
  // Delegamos a sms-fallback (esa Edge Function envía SMS via Twilio).
  {
    const { data } = await admin
      .from("invitations")
      .select("id")
      .in("status", ["sent", "opened"])
      .lt("created_at", new Date(now.getTime() - 72 * 3600 * 1000).toISOString())
      .gt("created_at", new Date(now.getTime() - 168 * 3600 * 1000).toISOString())
      .eq("reminders_sent", 1);

    for (const inv of data ?? []) {
      // Llamar a sms-fallback
      await fetch(
        `${SUPABASE_URL.replace(".supabase.co", ".functions.supabase.co")}/sms-fallback`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ invitation_id: inv.id }),
        },
      ).catch(console.error);

      await admin
        .from("invitations")
        .update({ reminders_sent: 2, last_reminded_at: now.toISOString() })
        .eq("id", inv.id);

      processed++;
    }
  }

  // ---------- Último intento a 7 días ----------
  {
    const { data } = await admin
      .from("invitations")
      .select("id, inviter_user_id, invited_person_id")
      .in("status", ["sent", "opened"])
      .lt("created_at", new Date(now.getTime() - 168 * 3600 * 1000).toISOString())
      .lt("reminders_sent", 3);

    for (const inv of data ?? []) {
      const { data: invitedPerson } = await admin
        .from("persons")
        .select("first_names")
        .eq("id", inv.invited_person_id)
        .single();

      await sendPushToUser(
        inv.inviter_user_id,
        `Último recordatorio: ${invitedPerson?.first_names}`,
        "Hace 7 días enviaste la invitación. ¿Le mandas un mensajito?",
        { type: "invite_final_reminder", invitation_id: inv.id },
      );

      await admin
        .from("invitations")
        .update({ reminders_sent: 3, last_reminded_at: now.toISOString() })
        .eq("id", inv.id);

      processed++;
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed, run_at: now.toISOString() }),
    { headers: { "Content-Type": "application/json" } },
  );
});

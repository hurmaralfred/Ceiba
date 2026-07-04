// ============================================================
// CEIBA VIRAL LOOP — Edge Function: sms-fallback
// ------------------------------------------------------------
// Envía un SMS al invitado cuando no responde tras 72h.
// Requiere Twilio configurado con secretos:
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
//
// Body esperado:
//   { invitation_id: "uuid" }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID")!;
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN")!;
const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sendSMS(to: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`;
  const auth = btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`);

  const form = new URLSearchParams();
  form.append("To", to);
  form.append("From", TWILIO_FROM);
  form.append("Body", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  try {
    const { invitation_id } = await req.json();
    if (!invitation_id) {
      return new Response(JSON.stringify({ error: "missing invitation_id" }), { status: 400 });
    }

    const { data: inv } = await admin
      .from("invitations")
      .select("id, code, invited_person_id, inviter_user_id")
      .eq("id", invitation_id)
      .single();

    if (!inv) {
      return new Response(JSON.stringify({ error: "invitation not found" }), { status: 404 });
    }

    // Ubicar teléfono del invitado
    // Ceiba puede guardar phone en persons o en auth.users. Aquí buscamos primero
    // en persons (si tienes esa columna) y si no, ignoramos.
    // Requiere: alter table persons add column phone text;   (opcional)
    const { data: invitedPerson } = await admin
      .from("persons")
      .select("first_names, phone, email")
      .eq("id", inv.invited_person_id)
      .single();

    if (!invitedPerson?.phone) {
      return new Response(
        JSON.stringify({ ok: false, reason: "no_phone_available" }),
        { status: 200 },
      );
    }

    const { data: inviterPerson } = await admin
      .from("persons")
      .select("first_names")
      .eq("linked_user_id", inv.inviter_user_id)
      .maybeSingle();

    const link = `https://ceibapp.com/invite/${inv.code}`;
    const message =
      `Hola ${invitedPerson.first_names}, ` +
      `${inviterPerson?.first_names ?? "tu familia"} te agregó al árbol familiar en Ceiba. ` +
      `Abre este link y en 30 segundos vas a ver a toda la familia: ${link}`;

    const ok = await sendSMS(invitedPerson.phone, message);

    await admin.from("invitation_events").insert({
      invitation_id: inv.id,
      event_type: "reminded",
      metadata: { stage: "72h_sms", ok },
    });

    return new Response(
      JSON.stringify({ ok, sent_to: invitedPerson.phone }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

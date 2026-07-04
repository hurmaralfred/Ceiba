// ============================================================
// CEIBA VIRAL LOOP — Edge Function: invite-open-handler
// ------------------------------------------------------------
// Endpoint público. Se llama cuando alguien abre un link mágico.
// Registra el evento y devuelve datos para pre-cargar el onboarding.
//
// URL pública:
//   https://<ref>.functions.supabase.co/invite-open-handler?code=A7X4M2
//
// Respuesta:
//   { invitation, invited_person, inviter, preview_graph }
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

function detectPlatform(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  if (ua.includes("android")) return "android";
  return "web";
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response(JSON.stringify({ error: "missing code" }), { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") ?? "";
    const platform = detectPlatform(userAgent);
    const referer = req.headers.get("referer") ?? null;

    // 1) Buscar la invitación
    const { data: inv, error: invErr } = await admin
      .from("invitations")
      .select("*")
      .eq("code", code)
      .maybeSingle();

    if (invErr || !inv) {
      return new Response(JSON.stringify({ error: "invitation not found" }), { status: 404 });
    }

    if (new Date(inv.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "invitation expired" }), { status: 410 });
    }

    // 2) Registrar apertura
    await admin.rpc("record_invitation_event", {
      p_code: code,
      p_event: "opened",
      p_metadata: {
        platform,
        referer,
        user_agent: userAgent,
        first_open: inv.first_opened_at === null,
      },
    });

    // 3) Traer datos del invitado (person)
    const { data: invited } = await admin
      .from("persons")
      .select("id, first_names, last_names, profile_photo_url, birth_date, birth_city, gender")
      .eq("id", inv.invited_person_id)
      .single();

    // 4) Traer datos del que invita
    const { data: inviterPerson } = await admin
      .from("persons")
      .select("first_names, last_names, profile_photo_url")
      .eq("linked_user_id", inv.inviter_user_id)
      .maybeSingle();

    // 5) Preview del árbol: quiénes van a aparecer si acepta
    const { data: previewNet } = await admin.rpc("get_family_ids_up_to", {
      p_person: inv.invited_person_id,
      p_degree: 2,
    });
    const previewIds = (previewNet ?? [])
      .map((r: any) => r.person_id)
      .filter((id: string) => id !== inv.invited_person_id)
      .slice(0, 8);

    let previewMembers: any[] = [];
    if (previewIds.length > 0) {
      const { data } = await admin
        .from("persons")
        .select("id, first_names, last_names, profile_photo_url")
        .in("id", previewIds);
      previewMembers = data ?? [];
    }

    return new Response(
      JSON.stringify({
        invitation: {
          id: inv.id,
          code: inv.code,
          status: inv.status,
          first_opened: inv.first_opened_at === null,
        },
        invited_person: invited,
        inviter: inviterPerson,
        preview: {
          count: previewMembers.length,
          members: previewMembers,
        },
        deep_link: {
          scheme: `ceiba://invite?code=${code}`,
          universal: `https://ceibapp.com/invite/${code}`,
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});

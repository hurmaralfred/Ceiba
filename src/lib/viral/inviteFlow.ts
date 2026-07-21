// ============================================================
// CEIBA VIRAL LOOP — Cliente: Flujo completo de invitación
// ------------------------------------------------------------
// Cubre:
//   1) Crear invitación en Supabase
//   2) Generar link mágico con Branch.io o Firebase Dynamic Links
//   3) Compartir por WhatsApp / SMS / copiar
//   4) Registrar el evento de share
// ============================================================

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { trackEvent } from "./viralAnalytics";

// Configuración: pega tus claves aquí
const CEIBA_UNIVERSAL_LINK_DOMAIN = "https://ceibapp.com/invite";
const BRANCH_KEY = "key_live_xxxxx";              // si usas Branch.io
const FIREBASE_DYNAMIC_LINK_DOMAIN = "ceiba.page.link"; // si usas Firebase

// ------------------------------------------------------------
// Templates A/B (mismos IDs que en el catálogo de copy/)
// ------------------------------------------------------------

export type InviteTemplate =
  | "v1_direct"
  | "v2_emotional"
  | "v3_specific"
  | "v4_urgency"
  | "v5_short";

export interface InviteContext {
  inviterFirstName: string;
  invitedFirstName: string;
  invitedRelation: string;   // "mamá", "hermano", "tío"...
  previewMembers: string[];  // ["la abuela", "tus hermanos", "tus hijos"]
  familyLastName?: string;   // "Gómez"
}

export function buildInviteMessage(
  template: InviteTemplate,
  ctx: InviteContext,
  link: string,
): string {
  const members = ctx.previewMembers.slice(0, 3).join(", ");
  const family = ctx.familyLastName ? `los ${ctx.familyLastName}` : "la familia";

  switch (template) {
    case "v1_direct":
      return (
        `Hola ${ctx.invitedFirstName}, te agregué a nuestro árbol familiar en Ceiba. ` +
        `Cuando entres ya vas a ver a ${members}. Tardas 30 segundos: ${link}`
      );

    case "v2_emotional":
      return (
        `${ctx.invitedFirstName}, hice el árbol de ${family} en una app que se llama Ceiba. ` +
        `Ya somos varios adentro (${members}). Te dejo el link para que tú también estés: ${link}`
      );

    case "v3_specific":
      return (
        `Hola ${ctx.invitedFirstName} 👋 ` +
        `Estoy armando el árbol de la familia y me faltas tú. ` +
        `Cuando abras el link vas a ver el árbol ya listo con ${members}. ` +
        `Toma 30 segundos: ${link}`
      );

    case "v4_urgency":
      return (
        `${ctx.invitedFirstName}, se acerca un cumpleaños de la familia y quiero que ` +
        `todos recibamos el recordatorio en Ceiba. Entra por acá y en 30s estás adentro: ${link}`
      );

    case "v5_short":
      return `${ctx.invitedFirstName}, únete al árbol de ${family}: ${link}`;
  }
}

// ------------------------------------------------------------
// Wrapper de creación de link
// ------------------------------------------------------------

export interface InviteLinkResult {
  invitationId: string;
  code: string;
  universalLink: string;
  branchLink?: string;
}

/**
 * Crea una invitación en Supabase y genera el link universal.
 */
export async function createInviteLink(
  supabase: SupabaseClient,
  personId: string,
  template: InviteTemplate = "v1_direct",
): Promise<InviteLinkResult> {
  // 1) RPC para crear la invitación
  const { data, error } = await supabase.rpc("create_invitation", {
    p_person_id: personId,
    p_channel: null,          // se marca al momento de share
    p_template: template,
  });
  if (error) throw error;

  const code = data.code as string;
  const invitationId = data.id as string;

  // 2) Universal link (funciona para ambos: Branch y Firebase)
  const universalLink = `${CEIBA_UNIVERSAL_LINK_DOMAIN}/${code}`;

  // 3) (Opcional) Branch.io — genera un short link con analytics
  let branchLink: string | undefined;
  try {
    const res = await fetch("https://api2.branch.io/v1/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch_key: BRANCH_KEY,
        channel: "app",
        feature: "family_invite",
        data: {
          $canonical_url: universalLink,
          $desktop_url: universalLink,
          $android_url: universalLink,
          $ios_url: universalLink,
          invitation_code: code,
        },
      }),
    });
    if (res.ok) {
      const json = await res.json();
      branchLink = json.url;
    }
  } catch (_e) {
    // Silencioso: si Branch falla, usamos el universal link
  }

  trackEvent("invite_link_generated", {
    invitation_id: invitationId,
    code,
    template_id: template,
  });

  return {
    invitationId,
    code,
    universalLink,
    branchLink,
  };
}

// ------------------------------------------------------------
// Compartir por WhatsApp
// ------------------------------------------------------------

export async function shareInviteWhatsApp(
  supabase: SupabaseClient,
  invitationId: string,
  message: string,
  phoneNumber?: string,
) {
  // Marcar como enviada
  await supabase.rpc("mark_invitation_shared", {
    p_invitation: invitationId,
    p_channel: "whatsapp",
  });

  trackEvent("invite_sent", {
    invitation_id: invitationId,
    channel: "whatsapp",
  });

  // Abrir WhatsApp con mensaje precargado
  const encoded = encodeURIComponent(message);
  const url = phoneNumber
    ? `https://wa.me/${phoneNumber.replace(/[^\d]/g, "")}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;

  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }

  return url;
}

// ------------------------------------------------------------
// Compartir con el share sheet nativo (mobile)
// ------------------------------------------------------------

export async function shareInviteNative(
  supabase: SupabaseClient,
  invitationId: string,
  message: string,
  link: string,
) {
  await supabase.rpc("mark_invitation_shared", {
    p_invitation: invitationId,
    p_channel: "link",
  });

  trackEvent("invite_sent", {
    invitation_id: invitationId,
    channel: "native_share",
  });

  if (typeof navigator !== "undefined" && "share" in navigator) {
    await (navigator as any).share({
      title: "Ceiba",
      text: message,
      url: link,
    });
  }
}

// ------------------------------------------------------------
// Copiar al portapapeles
// ------------------------------------------------------------

export async function copyInviteLink(
  supabase: SupabaseClient,
  invitationId: string,
  link: string,
) {
  await supabase.rpc("mark_invitation_shared", {
    p_invitation: invitationId,
    p_channel: "link",
  });

  trackEvent("invite_sent", {
    invitation_id: invitationId,
    channel: "copy",
  });

  if (typeof navigator !== "undefined" && "clipboard" in navigator) {
    await navigator.clipboard.writeText(link);
  }
}

// ------------------------------------------------------------
// Invitar en batch: todos los familiares que aún no están registrados
// ------------------------------------------------------------

export interface BatchInviteTarget {
  personId: string;
  firstName: string;
  relation: string;
  phone?: string;
}

/**
 * Devuelve los familiares del usuario que aún no tienen linked_user_id.
 */
export async function listPendingInvitees(
  supabase: SupabaseClient,
): Promise<BatchInviteTarget[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return [];

  const graph = await supabase.rpc("get_my_family_graph", { p_depth: 2 });
  if (graph.error || !graph.data) return [];

  const nodes = graph.data.nodes as any[];
  const me = graph.data.me;

  return nodes
    .filter((n) => n.id !== me && !n.linked_user_id && n.is_living)
    .map((n) => ({
      personId: n.id,
      firstName: n.first_names,
      relation: "familiar",
      phone: n.phone ?? undefined,
    }));
}

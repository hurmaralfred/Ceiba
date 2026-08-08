import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolvePersonsByUserIds } from "@/lib/server/family";

/**
 * La pertenencia a la sala es la única puerta de acceso: tanto los grupos
 * (por family_space) como los directos tienen membresías reales en
 * chat_room_members. No hay salas globales de acceso implícito.
 */
async function assertMember(service: ReturnType<typeof getServiceClient>, roomId: string, userId: string) {
  const { data } = await service
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** GET /api/chat/rooms/[roomId]/messages — mensajes + remitente resuelto vía person_claims. */
export async function GET(_req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const isMember = await assertMember(service, params.roomId, user.id);
  if (!isMember) return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });

  const { data: messages, error } = await service
    .from("chat_messages")
    .select("id, room_id, sender_user_id, body, media_url, created_at")
    .eq("room_id", params.roomId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const senderIds = [...new Set((messages ?? []).map((m) => m.sender_user_id as string))];
  const people = await resolvePersonsByUserIds(service, senderIds);

  await service
    .from("chat_room_members")
    .update({ last_read_at: new Date().toISOString() })
    .eq("room_id", params.roomId)
    .eq("user_id", user.id);

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    sender: people.get(m.sender_user_id) ?? null,
  }));

  return NextResponse.json({ messages: enriched });
}

/** POST /api/chat/rooms/[roomId]/messages — Body: { body: string } */
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { body } = await req.json();
  if (!body || !body.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const service = getServiceClient();
  const isMember = await assertMember(service, params.roomId, user.id);
  if (!isMember) return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });

  const { data: message, error } = await service
    .from("chat_messages")
    .insert({ room_id: params.roomId, sender_user_id: user.id, body: body.trim() })
    .select("id, room_id, sender_user_id, body, media_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Push notifications — fire-and-forget, never blocks the response
  pushChatNotification(service, params.roomId, user.id, body.trim()).catch(() => {});

  return NextResponse.json({ message });
}

async function pushChatNotification(
  service: ReturnType<typeof getServiceClient>,
  roomId: string,
  senderUserId: string,
  messageBody: string,
) {
  const publicKey  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;

  // Other room members
  const { data: memberships } = await service
    .from("chat_room_members")
    .select("user_id")
    .eq("room_id", roomId)
    .neq("user_id", senderUserId);

  const otherIds = ((memberships ?? []) as any[]).map((m) => m.user_id as string);
  if (otherIds.length === 0) return;

  // Sender's display name
  const { data: senderClaim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", senderUserId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  let senderName = "Familiar";
  if (senderClaim?.person_id) {
    const { data: p } = await service
      .from("persons")
      .select("first_name")
      .eq("id", senderClaim.person_id)
      .maybeSingle();
    if (p?.first_name) senderName = p.first_name;
  }

  // Room type (group vs direct)
  const { data: room } = await service
    .from("chat_rooms")
    .select("type")
    .eq("id", roomId)
    .maybeSingle();
  const isGroup = (room as any)?.type === "group";

  // Push subscriptions for recipients
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .in("user_id", otherIds);

  if (!subs || subs.length === 0) return;

  webpush.setVapidDetails("mailto:ceiba-app@noreply.com", publicKey, privateKey);

  const payload = JSON.stringify({
    title: isGroup ? `💬 ${senderName} (familia)` : `💬 ${senderName}`,
    body:  messageBody.length > 120 ? messageBody.slice(0, 117) + "…" : messageBody,
    icon:  "/icons/icon-192.png",
    url:   "/chat",
  });

  await Promise.allSettled(
    (subs as any[]).map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
    )
  );
}

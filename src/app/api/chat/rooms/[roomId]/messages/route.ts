import { NextRequest, NextResponse } from "next/server";
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

  return NextResponse.json({ message });
}

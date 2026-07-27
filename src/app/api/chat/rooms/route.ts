import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient, resolvePersonsByUserIds, resolveOrCreateFamilyGroupRoom } from "@/lib/server/family";

/**
 * GET /api/chat/rooms
 * Lista el chat grupal de mi family_space + mis salas directas, con el otro
 * miembro resuelto vía person_claims y el último mensaje (chat_messages).
 */
export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();

  // Room grupal canónico de mi familia (aislado por family_space).
  const groupRoomId = await resolveOrCreateFamilyGroupRoom(service, user.id);

  const conversations: any[] = [];
  if (groupRoomId) {
    const { data: lastGroupMsg } = await service
      .from("chat_messages")
      .select("body, created_at")
      .eq("room_id", groupRoomId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    conversations.push({
      roomId: groupRoomId,
      type: "group",
      name: "Chat Familiar",
      lastMessage: lastGroupMsg?.body ?? null,
      lastAt: lastGroupMsg?.created_at ?? null,
      unread: false,
    });
  }

  const { data: memberOf } = await service
    .from("chat_room_members")
    .select("room_id, last_read_at")
    .eq("user_id", user.id);

  const roomIds = ((memberOf ?? []) as any[]).map((m) => m.room_id as string).filter((id) => id !== groupRoomId);

  if (roomIds.length > 0) {
    const { data: rooms } = await service.from("chat_rooms").select("id, type").in("id", roomIds).eq("type", "direct");
    const directRoomIds = ((rooms ?? []) as any[]).map((r) => r.id as string);

    const { data: allMembers } = await service
      .from("chat_room_members")
      .select("room_id, user_id")
      .in("room_id", directRoomIds);

    const otherUserByRoom = new Map<string, string>();
    for (const m of (allMembers ?? []) as any[]) {
      if (m.user_id !== user.id) otherUserByRoom.set(m.room_id, m.user_id);
    }

    const otherUserIds = [...new Set([...otherUserByRoom.values()])];
    const peopleMap = await resolvePersonsByUserIds(service, otherUserIds);

    for (const roomId of directRoomIds) {
      const otherUserId = otherUserByRoom.get(roomId);
      const person = otherUserId ? peopleMap.get(otherUserId) : undefined;

      const { data: lastMsg } = await service
        .from("chat_messages")
        .select("body, created_at")
        .eq("room_id", roomId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const myMembership = ((memberOf ?? []) as any[]).find((m) => m.room_id === roomId);
      const unread = !!(lastMsg && new Date(lastMsg.created_at) > new Date(myMembership?.last_read_at || 0));

      conversations.push({
        roomId,
        type: "direct",
        name: person ? `${person.first_name} ${person.last_name}`.trim() : "Familiar",
        avatar: person?.photo_path ?? null,
        lastMessage: lastMsg?.body ?? null,
        lastAt: lastMsg?.created_at ?? null,
        unread,
        otherUserId,
      });
    }
  }

  conversations.sort((a, b) => {
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
  });

  return NextResponse.json({ conversations });
}

/** POST /api/chat/rooms — Body: { otherUserId } — encuentra o crea una sala directa. */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { otherUserId } = await req.json();
  if (!otherUserId) return NextResponse.json({ error: "Falta otherUserId" }, { status: 400 });

  const service = getServiceClient();

  const { data: myRooms } = await service.from("chat_room_members").select("room_id").eq("user_id", user.id);
  const myRoomIds = ((myRooms ?? []) as any[]).map((r) => r.room_id as string);

  if (myRoomIds.length > 0) {
    const { data: otherRooms } = await service
      .from("chat_room_members")
      .select("room_id")
      .eq("user_id", otherUserId)
      .in("room_id", myRoomIds);
    const sharedRoomIds = ((otherRooms ?? []) as any[]).map((r) => r.room_id as string);

    if (sharedRoomIds.length > 0) {
      const { data: rooms } = await service
        .from("chat_rooms")
        .select("id")
        .in("id", sharedRoomIds)
        .eq("type", "direct");
      if (rooms && rooms.length > 0) {
        return NextResponse.json({ roomId: rooms[0].id });
      }
    }
  }

  const { data: room, error: roomErr } = await service
    .from("chat_rooms")
    .insert({ type: "direct", created_by: user.id })
    .select("id")
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: roomErr?.message ?? "No se pudo crear la sala" }, { status: 500 });
  }

  const { error: membersErr } = await service.from("chat_room_members").insert([
    { room_id: room.id, user_id: user.id },
    { room_id: room.id, user_id: otherUserId },
  ]);

  if (membersErr) {
    return NextResponse.json({ error: membersErr.message }, { status: 500 });
  }

  return NextResponse.json({ roomId: room.id });
}

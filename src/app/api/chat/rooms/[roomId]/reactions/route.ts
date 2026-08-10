import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

const ALLOWED_EMOJIS = ["👍","❤️","😂","😮","😢","🙏","🔥","✦"];

async function assertMember(service: ReturnType<typeof getServiceClient>, roomId: string, userId: string) {
  const { data } = await service
    .from("chat_room_members")
    .select("room_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

/** POST /api/chat/rooms/[roomId]/reactions — toggle an emoji reaction on a message. */
export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { messageId, emoji } = await req.json();
  if (!messageId || !emoji) return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  if (!ALLOWED_EMOJIS.includes(emoji)) return NextResponse.json({ error: "Emoji no permitido" }, { status: 400 });

  const service = getServiceClient();
  const isMember = await assertMember(service, params.roomId, user.id);
  if (!isMember) return NextResponse.json({ error: "No perteneces a esta sala" }, { status: 403 });

  // Verify the message belongs to this room
  const { data: msg } = await service
    .from("chat_messages")
    .select("room_id")
    .eq("id", messageId)
    .eq("room_id", params.roomId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Mensaje no encontrado" }, { status: 404 });

  // Toggle: delete if exists, insert if not
  const { data: existing } = await service
    .from("chat_message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", user.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await service.from("chat_message_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed" });
  } else {
    await service.from("chat_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
    return NextResponse.json({ action: "added" });
  }
}

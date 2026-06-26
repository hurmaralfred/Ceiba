"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Users, MessageCircle, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

const GROUP_ROOM_ID = "00000000-0000-0000-0000-000000000001";

interface Conversation {
  roomId: string;
  type: "group" | "direct";
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastAt?: string;
  unread: boolean;
  otherUserId?: string;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function ChatListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [familyMembers, setFamilyMembers] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);
    await Promise.all([loadConversations(user.id), loadFamilyMembers(user.id)]);
    setLoading(false);
  };

  const loadConversations = async (uid: string) => {
    const convs: Conversation[] = [];

    // 1. Group chat — always show
    const { data: lastGroupMsg } = await supabase
      .from("family_messages")
      .select("content, created_at")
      .eq("room_id", GROUP_ROOM_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    convs.push({
      roomId: GROUP_ROOM_ID,
      type: "group",
      name: "Chat Familiar",
      lastMessage: lastGroupMsg?.content,
      lastAt: lastGroupMsg?.created_at,
      unread: false,
    });

    // 2. DM rooms this user belongs to
    const { data: memberOf } = await supabase
      .from("chat_room_members")
      .select("room_id, last_read_at, room:chat_rooms!room_id(id, type, created_at)")
      .eq("user_id", uid);

    const dmRoomIds = (memberOf || [])
      .filter((m: any) => m.room?.type === "direct")
      .map((m: any) => m.room_id);

    for (const roomId of dmRoomIds) {
      // Get the other member's user_id (no join)
      const { data: others } = await supabase
        .from("chat_room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .neq("user_id", uid);

      const otherUserId = others?.[0]?.user_id;
      if (!otherUserId) continue;

      // Fetch profile separately
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", otherUserId)
        .maybeSingle();

      const { data: lastMsg } = await supabase
        .from("family_messages")
        .select("content, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const myMembership = memberOf?.find((m: any) => m.room_id === roomId);
      const unread = lastMsg
        ? new Date(lastMsg.created_at) > new Date(myMembership?.last_read_at || 0)
        : false;

      convs.push({
        roomId,
        type: "direct",
        name: profile ? `${profile.first_name} ${profile.last_name}` : "Familiar",
        avatar: profile?.avatar_url,
        lastMessage: lastMsg?.content,
        lastAt: lastMsg?.created_at,
        unread,
        otherUserId,
      });
    }

    convs.sort((a, b) => {
      if (!a.lastAt) return 1;
      if (!b.lastAt) return -1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });

    setConversations(convs);
  };

  const loadFamilyMembers = async (uid: string) => {
    // Step 1: get family members
    const { data: members } = await supabase
      .from("family_members")
      .select("profile_id, first_name, last_name")
      .eq("added_by", uid)
      .not("profile_id", "is", null);

    if (!members || members.length === 0) return;

    // Step 2: fetch profile data separately (avoids FK join issue)
    const profileIds = members.map(m => m.profile_id).filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", profileIds);

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    setFamilyMembers(
      members
        .filter(m => m.profile_id)
        .map(m => ({ ...m, profile: profileMap[m.profile_id] || null }))
    );
  };

  const startDM = async (otherUserId: string) => {
    if (!userId || !otherUserId) return;

    try {
      // Step 1: get rooms where current user is a member
      const { data: myRooms, error: myRoomsErr } = await supabase
        .from("chat_room_members")
        .select("room_id")
        .eq("user_id", userId);

      if (myRoomsErr) throw myRoomsErr;

      const myRoomIds = (myRooms || []).map(r => r.room_id);

      if (myRoomIds.length > 0) {
        // Step 2: rooms where the other user is also a member
        const { data: otherRooms } = await supabase
          .from("chat_room_members")
          .select("room_id")
          .eq("user_id", otherUserId)
          .in("room_id", myRoomIds);

        const sharedRoomIds = (otherRooms || []).map(r => r.room_id);

        if (sharedRoomIds.length > 0) {
          // Step 3: check which shared rooms are "direct" type
          const { data: rooms } = await supabase
            .from("chat_rooms")
            .select("id, type")
            .in("id", sharedRoomIds)
            .eq("type", "direct");

          if (rooms && rooms.length > 0) {
            router.push(`/chat/${rooms[0].id}`);
            return;
          }
        }
      }

      // Create new DM room
      const { data: room, error: roomErr } = await supabase
        .from("chat_rooms")
        .insert({ type: "direct", created_by: userId })
        .select("id")
        .single();

      if (roomErr || !room) {
        console.error("Error creating DM room:", roomErr);
        toast.error("Error al crear conversación. ¿Corriste el SQL de chat?");
        return;
      }

      const { error: membersErr } = await supabase.from("chat_room_members").insert([
        { room_id: room.id, user_id: userId },
        { room_id: room.id, user_id: otherUserId },
      ]);

      if (membersErr) {
        console.error("Error adding members:", membersErr);
        toast.error("Error al configurar conversación");
        return;
      }

      router.push(`/chat/${room.id}`);
    } catch (err) {
      console.error("startDM error:", err);
      toast.error("Error al abrir conversación");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold flex-1">
          <TreePine size={20} className="text-ceiba-300" /> Mensajes
        </div>
        <button
          onClick={() => setShowNewDM(!showNewDM)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> Nuevo mensaje
        </button>
      </nav>

      <div className="max-w-lg mx-auto pb-20">
        {/* New DM picker */}
        {showNewDM && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Enviar mensaje a:</p>
            {familyMembers.length === 0 ? (
              <p className="text-sm text-gray-400">Ningún familiar tiene Ceiba aún.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {familyMembers.map(m => (
                  <button
                    key={m.profile_id}
                    onClick={() => { setShowNewDM(false); startDM(m.profile_id); }}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-ceiba-50 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-ceiba-700 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                      {(m.profile as any)?.avatar_url
                        ? <img src={(m.profile as any).avatar_url} className="w-full h-full object-cover" alt="" />
                        : `${m.first_name[0]}${(m.last_name || "")[0]}`}
                    </div>
                    {m.first_name} {m.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="divide-y divide-gray-100">
          {conversations.map(conv => (
            <Link
              key={conv.roomId}
              href={`/chat/${conv.roomId}`}
              className="flex items-center gap-3 px-4 py-4 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
                conv.type === "group" ? "bg-ceiba-700" : "bg-blue-600"
              }`}>
                {conv.type === "group"
                  ? <Users size={22} className="text-white" />
                  : conv.avatar
                    ? <img src={conv.avatar} className="w-full h-full object-cover" alt="" />
                    : <span className="text-white font-bold text-sm">{conv.name[0]}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-gray-900 ${conv.unread ? "font-bold" : ""}`}>
                    {conv.name}
                  </span>
                  {conv.lastAt && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.lastAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm truncate ${conv.unread ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                    {conv.lastMessage || "Sin mensajes aún"}
                  </p>
                  {conv.unread && <div className="w-2 h-2 rounded-full bg-ceiba-600 flex-shrink-0" />}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="text-center py-20 px-6">
            <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-600 mb-2">Sin conversaciones</h3>
            <p className="text-gray-400 text-sm">Comienza un mensaje directo con un familiar o únete al chat grupal.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}

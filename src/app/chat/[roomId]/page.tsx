"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Send, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const GROUP_ROOM_ID = "00000000-0000-0000-0000-000000000001";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { first_name: string; last_name: string; avatar_url?: string };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

export default function ChatRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;
  const supabase = createClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Chat");
  const [roomType, setRoomType] = useState<"group" | "direct">("group");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    init().then(fn => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [roomId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    // Load room info
    if (roomId === GROUP_ROOM_ID) {
      setRoomName("Chat Familiar");
      setRoomType("group");
    } else {
      // Get other member's user_id (no FK join)
      const { data: members } = await supabase
        .from("chat_room_members")
        .select("user_id")
        .eq("room_id", roomId)
        .neq("user_id", user.id);
      const otherUserId = members?.[0]?.user_id;
      if (otherUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", otherUserId)
          .maybeSingle();
        if (profile) setRoomName(`${profile.first_name} ${profile.last_name}`);
      }
      setRoomType("direct");

      // Ensure user is a member of this room
      await supabase.from("chat_room_members").upsert({
        room_id: roomId,
        user_id: user.id,
        last_read_at: new Date().toISOString(),
      });
    }

    await loadMessages();

    // Mark as read
    await supabase.from("chat_room_members").update({
      last_read_at: new Date().toISOString(),
    }).eq("room_id", roomId).eq("user_id", user.id);

    // Realtime
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "family_messages",
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const { data: sender } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url")
          .eq("id", newMsg.sender_id)
          .single();
        setMessages(prev => [...prev, { ...newMsg, sender: sender || undefined }]);
        scrollToBottom();
        // Mark read
        await supabase.from("chat_room_members").update({
          last_read_at: new Date().toISOString(),
        }).eq("room_id", roomId).eq("user_id", user.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("family_messages")
      .select("*, sender:profiles!sender_id(first_name, last_name, avatar_url)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
    setLoading(false);
    scrollToBottom();
  };

  const send = async () => {
    const content = text.trim();
    if (!content || !userId) return;
    setSending(true);
    setText("");

    const { error } = await supabase.from("family_messages").insert({
      sender_id: userId,
      content,
      room_id: roomId,
    });

    if (error) {
      toast.error("Error al enviar");
      setText(content);
      setSending(false);
      return;
    }

    // Push notification to other room members
    const { data: members } = await supabase
      .from("chat_room_members")
      .select("user_id")
      .eq("room_id", roomId)
      .neq("user_id", userId);

    if (members && members.length > 0) {
      const { data: myProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", userId)
        .single();

      members.forEach(m => {
        fetch("/api/push/notify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-secret": process.env.NEXT_PUBLIC_INTERNAL_SECRET || "",
          },
          body: JSON.stringify({
            invitedBy: m.user_id,
            joinerName: myProfile ? `${myProfile.first_name} ${myProfile.last_name}` : "Un familiar",
            relationLabel: roomType === "group" ? "Chat familiar" : "mensaje directo",
            message: `te envió un mensaje: "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}"`,
          }),
        }).catch(() => {});
      });
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach(m => {
    const label = formatDateLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== label) grouped.push({ date: label, messages: [m] });
    else last.messages.push(m);
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="h-screen flex flex-col bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href="/chat" className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${roomType === "group" ? "bg-white/20" : "bg-white/20"}`}>
          {roomType === "group" ? <Users size={16} className="text-white" /> : <span className="text-white text-sm font-bold">{roomName[0]}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-white truncate">{roomName}</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-ceiba-300">En vivo</span>
          </div>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Send size={40} className="text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">
              {roomType === "group" ? "¡Sé el primero en escribir al grupo!" : "Envía tu primer mensaje"}
            </p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400 font-medium px-2">{group.date}</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>
            <div className="space-y-3">
              {group.messages.map((m, i) => {
                const isMe = m.sender_id === userId;
                const prev = group.messages[i - 1];
                const showAvatar = !isMe && (!prev || prev.sender_id !== m.sender_id);

                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMe && (
                      <div className="w-7 h-7 flex-shrink-0">
                        {showAvatar && (
                          <div className="w-7 h-7 rounded-full bg-ceiba-700 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                            {m.sender?.avatar_url
                              ? <img src={m.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                              : `${m.sender?.first_name?.[0]}${m.sender?.last_name?.[0]}`}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showAvatar && !isMe && (
                        <span className="text-xs text-gray-500 mb-1 ml-1">
                          {m.sender?.first_name} {m.sender?.last_name}
                        </span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe ? "bg-ceiba-700 text-white rounded-br-sm" : "bg-white text-gray-900 shadow-sm rounded-bl-sm"
                      }`}>
                        {m.content}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 mx-1">{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ceiba-400 max-h-28"
            rows={1}
            placeholder={`Mensaje ${roomType === "group" ? "al grupo" : `a ${roomName.split(" ")[0]}`}...`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 bg-ceiba-700 hover:bg-ceiba-800 disabled:opacity-40 text-white rounded-full flex items-center justify-center transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-300 mt-1">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </main>
  );
}

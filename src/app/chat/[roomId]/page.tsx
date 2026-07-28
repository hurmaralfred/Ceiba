"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Send, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Sender {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

interface Message {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  sender?: Sender | null;
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
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const loadMessages = useCallback(async (scroll = false) => {
    const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
    if (!res.ok) return;
    const { messages: data } = await res.json();
    const list: Message[] = data || [];
    setMessages(list);
    if (scroll || list.length !== lastCountRef.current) scrollToBottom();
    lastCountRef.current = list.length;
  }, [roomId, scrollToBottom]);

  useEffect(() => {
    init();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    // El tipo/nombre de la sala vienen de la lista canónica de conversaciones
    // (grupal por family_space o directa), no de un ID hardcodeado.
    const roomsRes = await fetch("/api/chat/rooms");
    if (roomsRes.ok) {
      const { conversations } = await roomsRes.json();
      const conv = (conversations || []).find((c: any) => c.roomId === roomId);
      if (conv) {
        setRoomName(conv.name);
        setRoomType(conv.type);
      }
    }

    await loadMessages(true);
    setLoading(false);

    // Recepción: polling ligero (chat_messages tiene RLS sin políticas de
    // cliente, así que Realtime no entrega estas filas — el servidor las
    // sirve vía /api/chat/rooms/[roomId]/messages).
    pollRef.current = setInterval(() => { loadMessages(false); }, 4000);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !userId) return;
    setSending(true);
    setText("");

    const res = await fetch(`/api/chat/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error || "Error al enviar");
      setText(body);
      setSending(false);
      return;
    }

    await loadMessages(true);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach(m => {
    const label = formatDateLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== label) grouped.push({ date: label, messages: [m] });
    else last.messages.push(m);
  });

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="h-screen flex flex-col bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href="/chat" className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/20">
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

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Send size={40} className="text-ceiba-200 mb-3" />
            <p className="text-ceiba-400 text-sm">
              {roomType === "group" ? "¡Sé el primero en escribir al grupo!" : "Envía tu primer mensaje"}
            </p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-cream-300 flex-1" />
              <span className="text-xs text-ceiba-400 font-medium px-2">{group.date}</span>
              <div className="h-px bg-cream-300 flex-1" />
            </div>
            <div className="space-y-3">
              {group.messages.map((m, i) => {
                const isMe = m.sender_user_id === userId;
                const prev = group.messages[i - 1];
                const showAvatar = !isMe && (!prev || prev.sender_user_id !== m.sender_user_id);

                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMe && (
                      <div className="w-7 h-7 flex-shrink-0">
                        {showAvatar && (
                          <div className="w-7 h-7 rounded-full bg-ceiba-700 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                            {m.sender?.photo_path
                              ? <img src={m.sender.photo_path} className="w-full h-full object-cover" alt="" />
                              : `${m.sender?.first_name?.[0] ?? ""}${m.sender?.last_name?.[0] ?? ""}`}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[72%] flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                      {showAvatar && !isMe && (
                        <span className="text-xs text-ceiba-500 mb-1 ml-1">
                          {m.sender?.first_name} {m.sender?.last_name}
                        </span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe ? "bg-ceiba-700 text-white rounded-br-sm" : "bg-white text-gray-900 shadow-sm rounded-bl-sm"
                      }`}>
                        {m.body}
                      </div>
                      <span className="text-[10px] text-ceiba-400 mt-1 mx-1">{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="bg-cream-50 border-t border-cream-300 px-4 py-3 flex-shrink-0">
        <div className="flex items-end gap-2 max-w-2xl mx-auto">
          <textarea
            ref={inputRef}
            className="flex-1 border border-cream-300 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ceiba-400 max-h-28 bg-cream-50 text-ceiba-900 placeholder-ceiba-400"
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
        <p className="text-center text-[10px] text-ceiba-400 mt-1">Enter para enviar · Shift+Enter para nueva línea</p>
      </div>
    </main>
  );
}

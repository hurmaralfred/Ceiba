"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Send, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
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

export default function ChatPage() {
  const router = useRouter();
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { init(); }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setMyProfile(profile);

    await loadMessages();

    // Realtime subscription
    const channel = supabase
      .channel("family-chat")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "family_messages",
      }, async (payload) => {
        const newMsg = payload.new as Message;
        // Fetch sender profile
        const { data: sender } = await supabase
          .from("profiles")
          .select("first_name, last_name, avatar_url")
          .eq("id", newMsg.sender_id)
          .single();
        setMessages(prev => [...prev, { ...newMsg, sender: sender || undefined }]);
        scrollToBottom();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const loadMessages = async () => {
    const { data } = await supabase
      .from("family_messages")
      .select("*, sender:profiles!sender_id(first_name, last_name, avatar_url)")
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
    });
    if (error) {
      toast.error("Error al enviar");
      setText(content);
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
      {/* Nav */}
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg flex-shrink-0">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold flex-1">
          <TreePine size={20} className="text-ceiba-300" /> Chat familiar
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-ceiba-200">En vivo</span>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle size={48} className="text-gray-300 mb-4" />
            <h3 className="font-bold text-gray-600 mb-1">¡Sé el primero en escribir!</h3>
            <p className="text-gray-400 text-sm">Este es el chat de tu familia en Ceiba.</p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            {/* Date divider */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-gray-200 flex-1" />
              <span className="text-xs text-gray-400 font-medium px-2">{group.date}</span>
              <div className="h-px bg-gray-200 flex-1" />
            </div>

            {/* Messages in group */}
            <div className="space-y-3">
              {group.messages.map((m, i) => {
                const isMe = m.sender_id === userId;
                const prevMsg = group.messages[i - 1];
                const showAvatar = !isMe && (!prevMsg || prevMsg.sender_id !== m.sender_id);
                const showName = showAvatar;

                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar */}
                    {!isMe && (
                      <div className="w-7 h-7 flex-shrink-0">
                        {showAvatar && (
                          <div className="w-7 h-7 rounded-full bg-ceiba-700 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                            {m.sender?.avatar_url
                              ? <img src={m.sender.avatar_url} className="w-full h-full object-cover" alt="" />
                              : `${m.sender?.first_name?.[0]}${m.sender?.last_name?.[0]}`
                            }
                          </div>
                        )}
                      </div>
                    )}

                    <div className={`max-w-[72%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                      {showName && !isMe && (
                        <span className="text-xs text-gray-500 mb-1 ml-1">
                          {m.sender?.first_name} {m.sender?.last_name}
                        </span>
                      )}
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        isMe
                          ? "bg-ceiba-700 text-white rounded-br-sm"
                          : "bg-white text-gray-900 shadow-sm rounded-bl-sm"
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
            placeholder="Escribe un mensaje..."
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

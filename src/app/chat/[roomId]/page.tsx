"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Users, CheckCheck, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import toast from "react-hot-toast";

interface Sender {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

interface Reaction { emoji: string; count: number; mine: boolean; }

interface Message {
  id: string;
  sender_user_id: string;
  body: string;
  created_at: string;
  sender?: Sender | null;
  reactions: Reaction[];
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
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("Chat");
  const [roomType, setRoomType] = useState<"group" | "direct">("group");
  const [partnerLastReadAt, setPartnerLastReadAt] = useState<string | null>(null);
  const [emojiTarget, setEmojiTarget] = useState<string | null>(null); // messageId for picker
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef(0);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onlineIds = useFamilyPresence(myUserId, otherUserId ? [otherUserId] : []);
  const otherIsOnline = otherUserId ? onlineIds.has(otherUserId) : false;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Clear app badge when entering any chat room
  useEffect(() => {
    if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => {});
  }, []);

  const loadMessages = useCallback(async (scroll = false) => {
    const res = await fetch(`/api/chat/rooms/${roomId}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    const list: Message[] = (data.messages || []).map((m: any) => ({ ...m, reactions: m.reactions ?? [] }));
    setMessages(list);
    if (data.partnerLastReadAt) setPartnerLastReadAt(data.partnerLastReadAt);
    if (scroll || list.length !== lastCountRef.current) scrollToBottom();
    lastCountRef.current = list.length;
  }, [roomId, scrollToBottom]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      setMyUserId(user.id);

      const roomsRes = await fetch("/api/chat/rooms");
      if (roomsRes.ok) {
        const { conversations } = await roomsRes.json();
        const conv = (conversations || []).find((c: any) => c.roomId === roomId);
        if (conv) {
          setRoomName(conv.name);
          setRoomType(conv.type);
          if (conv.otherUserId) setOtherUserId(conv.otherUserId);
        }
      }

      await loadMessages(true);
      setLoading(false);
      pollRef.current = setInterval(() => { loadMessages(false); }, 4000);
    })();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [roomId]);

  const send = async () => {
    const body = text.trim();
    if (!body || !myUserId) return;
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const EMOJIS = ["👍","❤️","😂","😮","😢","🙏","🔥","✦"];

  const toggleReaction = async (messageId: string, emoji: string) => {
    setEmojiTarget(null);
    await fetch(`/api/chat/rooms/${roomId}/reactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, emoji }),
    });
    await loadMessages(false);
  };

  const startLongPress = (messageId: string) => {
    longPressRef.current = setTimeout(() => setEmojiTarget(messageId), 500);
  };

  const cancelLongPress = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  };

  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach(m => {
    const label = formatDateLabel(m.created_at);
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== label) grouped.push({ date: label, messages: [m] });
    else last.messages.push(m);
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#030208", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Send size={32} style={{ color: "#d4af37", opacity: 0.5 }} />
    </div>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#030208", color: "#fff", overflow: "hidden", maxWidth: "100vw" }}>
      <style>{`
        @keyframes online-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}
        .chat-header{padding: calc(env(safe-area-inset-top, 20px) + 14px) 16px 14px !important;}
        .chat-input-bar{padding-bottom: max(env(safe-area-inset-bottom, 16px), 16px) !important;}
      `}</style>

      {/* Header */}
      <div className="chat-header" style={{
        display: "flex", alignItems: "center", gap: 12, padding: "52px 16px 14px",
        borderBottom: "0.5px solid rgba(212,175,55,0.14)", flexShrink: 0,
        background: "rgba(3,2,8,0.98)", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href="/chat">
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
          </div>
        </Link>

        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 13, background: "#0c0a18",
            border: "1.5px solid rgba(212,175,55,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#d4af37" }}>
            {roomType === "group" ? <Users size={18} style={{ color: "rgba(212,175,55,0.7)" }} /> : roomName[0].toUpperCase()}
          </div>
          {roomType === "direct" && otherIsOnline && (
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 10, height: 10,
              borderRadius: "50%", background: "#22c55e", border: "2px solid #030208",
              animation: "online-pulse 2s infinite" }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", overflow: "hidden",
            textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{roomName}</div>
          {roomType === "direct" && (
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 1 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%",
                background: otherIsOnline ? "#22c55e" : "rgba(255,255,255,0.2)" }} />
              <span style={{ fontSize: 11, color: otherIsOnline ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.3)" }}>
                {otherIsOnline ? "En línea ahora" : "Desconectado"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", minHeight: 0, padding: "16px 16px 8px" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            height: "100%", textAlign: "center", gap: 8 }}>
            <Send size={36} style={{ color: "rgba(212,175,55,0.3)" }} />
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)" }}>
              {roomType === "group" ? "¡Sé el primero en escribir!" : "Envía tu primer mensaje"}
            </p>
          </div>
        )}

        {grouped.map(group => (
          <div key={group.date}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <div style={{ flex: 1, height: 0.5, background: "rgba(212,175,55,0.12)" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(212,175,55,0.4)",
                letterSpacing: "0.08em", textTransform: "uppercase" }}>{group.date}</span>
              <div style={{ flex: 1, height: 0.5, background: "rgba(212,175,55,0.12)" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {group.messages.map((m, i) => {
                const isMe = m.sender_user_id === myUserId;
                const prev = group.messages[i - 1];
                const showSender = !isMe && (!prev || prev.sender_user_id !== m.sender_user_id);
                const isRead = isMe && partnerLastReadAt !== null && partnerLastReadAt >= m.created_at;

                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "flex-end", gap: 8,
                    flexDirection: isMe ? "row-reverse" : "row" }}>
                    {/* Avatar */}
                    {!isMe && (
                      <div style={{ width: 28, height: 28, flexShrink: 0 }}>
                        {showSender && (
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1030",
                            border: "1.5px solid rgba(212,175,55,0.2)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 10, fontWeight: 800, color: "#d4af37", overflow: "hidden" }}>
                            {m.sender?.photo_path
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={m.sender.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                              : `${m.sender?.first_name?.[0] ?? ""}${m.sender?.last_name?.[0] ?? ""}`}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column",
                      alignItems: isMe ? "flex-end" : "flex-start" }}>
                      {showSender && !isMe && (
                        <span style={{ fontSize: 10, color: "rgba(212,175,55,0.5)", marginBottom: 3, marginLeft: 2 }}>
                          {m.sender?.first_name} {m.sender?.last_name}
                        </span>
                      )}

                      {/* Bubble */}
                      <div
                        onMouseDown={() => startLongPress(m.id)}
                        onMouseUp={cancelLongPress}
                        onMouseLeave={cancelLongPress}
                        onTouchStart={() => startLongPress(m.id)}
                        onTouchEnd={cancelLongPress}
                        style={{
                          padding: "9px 13px", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          fontSize: 14, lineHeight: 1.5, userSelect: "none",
                          wordBreak: "break-word", overflowWrap: "break-word",
                          background: isMe ? "#c9a820" : "#0c0a18",
                          color: isMe ? "#030208" : "#fff",
                          fontWeight: isMe ? 600 : 400,
                          borderTop: isMe ? "1.5px solid #f5e060" : "1px solid rgba(212,175,55,0.15)",
                          borderBottom: isMe ? "3px solid #6a5600" : "2px solid rgba(0,0,0,0.4)",
                          boxShadow: isMe ? "0 5px 0 #4a3c00, 0 8px 16px rgba(0,0,0,0.5)" : "0 3px 0 #000, 0 5px 12px rgba(0,0,0,0.4)",
                        }}>
                        {m.body}
                      </div>

                      {/* Reactions row */}
                      {m.reactions.length > 0 && (
                        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap",
                          justifyContent: isMe ? "flex-end" : "flex-start" }}>
                          {m.reactions.map(r => (
                            <button
                              key={r.emoji}
                              onClick={() => toggleReaction(m.id, r.emoji)}
                              style={{
                                display: "flex", alignItems: "center", gap: 3,
                                background: r.mine ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.07)",
                                border: r.mine ? "1px solid rgba(212,175,55,0.4)" : "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 10, padding: "2px 7px", cursor: "pointer",
                                fontSize: 12, color: "#fff",
                              }}>
                              {r.emoji}
                              <span style={{ fontSize: 10, fontWeight: 700, color: r.mine ? "#d4af37" : "rgba(255,255,255,0.55)" }}>
                                {r.count}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Time + read receipt */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3,
                        marginLeft: isMe ? 0 : 4, marginRight: isMe ? 4 : 0,
                        flexDirection: isMe ? "row-reverse" : "row" }}>
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                          {formatTime(m.created_at)}
                        </span>
                        {isMe && (
                          isRead
                            ? <CheckCheck size={12} style={{ color: "#d4af37" }} />
                            : <Check size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker overlay */}
      {emojiTarget && (
        <div
          onClick={() => setEmojiTarget(null)}
          style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)" }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
              background: "#0e0b1f", border: "1px solid rgba(212,175,55,0.25)",
              borderRadius: 20, padding: "12px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
              display: "flex", gap: 8,
            }}>
            {EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => toggleReaction(emojiTarget, e)}
                style={{
                  fontSize: 22, background: "none", border: "none", cursor: "pointer",
                  padding: "4px 2px", borderRadius: 8,
                  transition: "transform 0.1s",
                }}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="chat-input-bar" style={{ padding: "10px 14px 28px", borderTop: "0.5px solid rgba(212,175,55,0.14)",
        background: "rgba(3,2,8,0.98)", backdropFilter: "blur(10px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
          <textarea
            ref={inputRef}
            rows={1}
            placeholder={`Mensaje${roomType === "direct" ? ` a ${roomName.split(" ")[0]}` : " al grupo"}…`}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, background: "#0c0a18", border: "none", borderRadius: 16, padding: "10px 14px",
              borderTop: "1px solid rgba(212,175,55,0.2)", borderBottom: "2px solid #000",
              borderLeft: "1px solid rgba(212,175,55,0.1)", borderRight: "1px solid rgba(0,0,0,0.4)",
              boxShadow: "0 4px 0 #000, 0 6px 12px rgba(0,0,0,0.5)",
              color: "#fff", fontSize: 14, outline: "none", resize: "none",
              maxHeight: 112, lineHeight: 1.5,
            }}
          />
          <button onClick={send} disabled={!text.trim() || sending} style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0, cursor: text.trim() ? "pointer" : "default",
            background: text.trim() ? "#c9a820" : "#0c0a18",
            borderTop: "2px solid " + (text.trim() ? "#f5e060" : "rgba(212,175,55,0.1)"),
            borderBottom: "3px solid " + (text.trim() ? "#6a5600" : "#000"),
            borderLeft: "1px solid rgba(255,240,100,0.3)", borderRight: "1px solid rgba(0,0,0,0.4)",
            boxShadow: text.trim() ? "0 6px 0 #4a3c00, 0 10px 20px rgba(0,0,0,0.6)" : "0 3px 0 #000",
            color: text.trim() ? "#030208" : "rgba(212,175,55,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.15s ease", opacity: sending ? 0.6 : 1,
          }}>
            <Send size={17} strokeWidth={2.5} />
          </button>
        </div>
        <p style={{ textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 6 }}>
          Enter para enviar · Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}

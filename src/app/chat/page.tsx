"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MessageCircle, Plus, ChevronRight, Users, ArrowLeft, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CosmicNav } from "@/components/ui/cosmic";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import toast from "react-hot-toast";

interface Conversation {
  roomId: string;
  type: "group" | "direct";
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastAt?: string | null;
  unread: boolean;
  otherUserId?: string;
}

interface RosterMember {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
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
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [familyMembers, setFamilyMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  const familyUserIds = familyMembers.map(m => m.user_id);
  const onlineIds = useFamilyPresence(myUserId, familyUserIds);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/rooms");
    if (!res.ok) return;
    const { conversations } = await res.json();
    setConversations(conversations || []);
  }, []);

  const loadFamilyMembers = useCallback(async () => {
    const res = await fetch("/api/family/roster");
    if (!res.ok) return;
    const { members } = await res.json();
    setFamilyMembers(members || []);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }
      setMyUserId(user.id);
      await Promise.all([loadConversations(), loadFamilyMembers()]);
      setLoading(false);
    })();
  }, []);

  const startDM = async (member: RosterMember) => {
    if (starting) return;
    setStarting(member.user_id);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: member.user_id }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || "Error al abrir conversación"); return; }
      router.push(`/chat/${body.roomId}`);
    } finally {
      setStarting(null);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#030208", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <MessageCircle size={36} style={{ color: "#d4af37", opacity: 0.6 }} />
    </div>
  );

  const onlineFamily = familyMembers.filter(m => onlineIds.has(m.user_id));

  return (
    <div style={{ minHeight: "100vh", background: "#030208", color: "#fff", paddingBottom: 100 }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "52px 20px 14px",
        borderBottom: "0.5px solid rgba(212,175,55,0.14)",
      }}>
        <Link href="/home">
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
          </div>
        </Link>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: 0.3 }}>Mensajes</div>
        <button
          onClick={() => setShowNewDM(v => !v)}
          style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          {showNewDM ? <X size={16} style={{ color: "rgba(212,175,55,0.75)" }} /> : <Plus size={17} style={{ color: "rgba(212,175,55,0.75)" }} />}
        </button>
      </div>

      {/* New DM sheet */}
      {showNewDM && (
        <div style={{ padding: "14px 16px", borderBottom: "0.5px solid rgba(212,175,55,0.1)", background: "#0a0818" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(212,175,55,0.5)", marginBottom: 12 }}>Enviar mensaje a:</p>
          {familyMembers.length === 0 ? (
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>Ningún familiar tiene Ceiba aún.</p>
          ) : (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {familyMembers.map(m => {
                const isOnline = onlineIds.has(m.user_id);
                const initials = `${m.first_name[0] ?? ""}${(m.last_name || "")[0] ?? ""}`.toUpperCase();
                return (
                  <button key={m.person_id} disabled={!!starting} onClick={() => startDM(m)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px 7px 7px",
                      borderRadius: 100, background: "#0c0a1a", cursor: starting ? "wait" : "pointer",
                      border: "1px solid rgba(212,175,55,0.2)", opacity: starting === m.user_id ? 0.6 : 1 }}>
                    <div style={{ position: "relative", width: 26, height: 26, flexShrink: 0 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#1a1030",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10, fontWeight: 800, color: "#d4af37", overflow: "hidden" }}>
                        {m.photo_path
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : initials}
                      </div>
                      {isOnline && (
                        <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8,
                          borderRadius: "50%", background: "#22c55e", border: "1.5px solid #030208" }} />
                      )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.first_name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Online now banner */}
      {onlineFamily.length > 0 && (
        <div style={{ padding: "12px 16px 10px", borderBottom: "0.5px solid rgba(212,175,55,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
              boxShadow: "0 0 0 0 rgba(34,197,94,0.4)", animation: "online-pulse 2s infinite" }} />
            <style>{`@keyframes online-pulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}`}</style>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(34,197,94,0.8)", letterSpacing: "0.1em",
              textTransform: "uppercase" }}>En línea ahora</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {onlineFamily.map(m => (
              <button key={m.user_id} onClick={() => startDM(m)} disabled={!!starting}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  background: "none", border: "none", cursor: "pointer" }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#1a1030",
                    border: "2px solid rgba(34,197,94,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15, fontWeight: 800, color: "#d4af37", overflow: "hidden" }}>
                    {m.photo_path
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.photo_path} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : `${m.first_name[0] ?? ""}${(m.last_name || "")[0] ?? ""}`.toUpperCase()}
                  </div>
                  <div style={{ position: "absolute", bottom: 1, right: 1, width: 10, height: 10,
                    borderRadius: "50%", background: "#22c55e", border: "2px solid #030208",
                    animation: "online-pulse 2s infinite" }} />
                </div>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{m.first_name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Conversations list */}
      <div style={{ padding: "8px 0" }}>
        {conversations.length === 0 && !showNewDM ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#0c0a18",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
              border: "1px solid rgba(212,175,55,0.18)" }}>
              <MessageCircle size={26} style={{ color: "rgba(212,175,55,0.4)" }} />
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Sin conversaciones</p>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 20, lineHeight: 1.6 }}>
              Toca el + para enviar un mensaje a un familiar.
            </p>
            <button onClick={() => setShowNewDM(true)}
              style={{ background: "#c9a820", border: "none", borderRadius: 12, padding: "10px 22px",
                color: "#030208", fontWeight: 700, fontSize: 13, cursor: "pointer",
                borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                boxShadow: "0 6px 0 #4a3c00" }}>
              Nuevo mensaje
            </button>
          </div>
        ) : (
          conversations.map(conv => {
            const isOnline = conv.otherUserId ? onlineIds.has(conv.otherUserId) : false;
            return (
              <Link key={conv.roomId} href={`/chat/${conv.roomId}`} style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px",
                  borderBottom: "0.5px solid rgba(212,175,55,0.06)",
                  background: conv.unread ? "rgba(212,175,55,0.04)" : "transparent" }}>
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: "#0c0a18",
                      border: "1.5px solid rgba(212,175,55,0.2)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, fontWeight: 800, color: "#d4af37", overflow: "hidden" }}>
                      {conv.type === "group"
                        ? <Users size={22} style={{ color: "rgba(212,175,55,0.7)" }} />
                        : conv.avatar
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={conv.avatar} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : conv.name[0].toUpperCase()}
                    </div>
                    {isOnline && (
                      <div style={{ position: "absolute", bottom: 1, right: 1, width: 11, height: 11,
                        borderRadius: "50%", background: "#22c55e", border: "2px solid #030208",
                        animation: "online-pulse 2s infinite" }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 14, fontWeight: conv.unread ? 700 : 600, color: "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.name}
                      </span>
                      {conv.lastAt && (
                        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", flexShrink: 0, marginLeft: 8 }}>
                          {timeAgo(conv.lastAt)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p style={{ fontSize: 13, color: conv.unread ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1,
                        fontWeight: conv.unread ? 600 : 400, margin: 0 }}>
                        {conv.lastMessage || "Sin mensajes aún"}
                      </p>
                      {conv.unread && (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#d4af37", flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: "rgba(212,175,55,0.25)", flexShrink: 0 }} />
                </div>
              </Link>
            );
          })
        )}
      </div>

      <CosmicNav />
    </div>
  );
}

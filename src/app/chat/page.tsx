"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, X, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CosmicNav } from "@/components/ui/cosmic";
import { useFamilyPresence } from "@/hooks/useFamilyPresence";
import toast from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

// ── Keyframes & global styles ──────────────────────────────────────────────────

const CSS = `
  @keyframes chat-star-pulse {
    0%,100% { opacity:0.55; transform:scale(1); }
    50%      { opacity:1;    transform:scale(1.25); filter:drop-shadow(0 0 6px rgba(242,180,60,0.9)); }
  }
  @keyframes chat-card-in {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes chat-nebula-drift {
    0%,100% { opacity:0.6; transform:scale(1) translateY(0); }
    50%      { opacity:1;   transform:scale(1.06) translateY(-8px); }
  }
  @keyframes chat-twinkle {
    0%,100% { opacity:0.8; } 50% { opacity:0.2; }
  }
  @keyframes chat-group-spin {
    from { transform:rotate(0deg); }
    to   { transform:rotate(360deg); }
  }
`;

// ── Star background ────────────────────────────────────────────────────────────

function SpaceBackground() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
      <div style={{ position:"absolute", inset:0,
        background:"radial-gradient(ellipse 110% 70% at 50% 0%, #1a062e 0%, #0c0418 38%, #060212 65%, #030208 100%)" }} />
      <div style={{ position:"absolute", top:-80, left:-60, width:320, height:320, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(90,25,200,0.20) 0%, transparent 68%)", filter:"blur(36px)",
        animation:"chat-nebula-drift 55s ease-in-out infinite" }} />
      <div style={{ position:"absolute", top:-30, right:-70, width:260, height:260, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(20,55,190,0.14) 0%, transparent 68%)", filter:"blur(28px)",
        animation:"chat-nebula-drift 42s ease-in-out infinite 8s" }} />
      <div style={{ position:"absolute", top:"35%", left:"10%", width:380, height:200, borderRadius:"50%",
        background:"radial-gradient(ellipse, rgba(212,175,55,0.08) 0%, transparent 65%)", filter:"blur(22px)",
        animation:"chat-nebula-drift 60s ease-in-out infinite 15s" }} />
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} aria-hidden>
        {[
          [28,14,0.5],[72,9,0.42],[132,19,0.52],[194,8,0.38],[256,16,0.46],[316,11,0.44],
          [18,52,0.40],[88,40,0.35],[158,56,0.44],[228,44,0.36],[302,50,0.41],
          [44,96,0.38],[112,82,0.44],[182,100,0.36],[254,88,0.42],[332,94,0.38],
        ].map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.6" fill="white" opacity={o} />)}
        <circle cx="168" cy="11"  r="1.2" fill="#d4af37" opacity="0.95"
          style={{ animation:"chat-twinkle 4.2s ease-in-out infinite" }} />
        <circle cx="58"  cy="28"  r="1.0" fill="white"   opacity="0.88"
          style={{ animation:"chat-twinkle 3.1s ease-in-out infinite 0.9s" }} />
        <circle cx="342" cy="46"  r="1.1" fill="#b8c8f4"  opacity="0.75"
          style={{ animation:"chat-twinkle 2.8s ease-in-out infinite 1.8s" }} />
      </svg>
    </div>
  );
}

// ── Luminous sphere avatar ─────────────────────────────────────────────────────

function ConvAvatar({ conv, size = 52, isOnline }: { conv: Conversation; size?: number; isOnline: boolean }) {
  if (conv.type === "group") {
    // Constellation-style group avatar
    return (
      <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
        {/* Outer rotating arc */}
        <div style={{ position:"absolute", inset:-4, borderRadius:"50%",
          border:"0.5px dashed rgba(184,160,216,0.30)",
          animation:"chat-group-spin 22s linear infinite", pointerEvents:"none" }} />
        {/* Core */}
        <div style={{ width:size, height:size, borderRadius:"50%",
          background:`radial-gradient(circle at 38% 28%, rgba(184,160,216,0.22) 0%, rgba(8,5,18,0.97) 65%)`,
          border:"1px solid rgba(184,160,216,0.28)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`0 0 ${size*0.4}px rgba(184,160,216,0.18), inset 0 2px 12px rgba(80,30,180,0.22)` }}>
          {/* Three mini orbs in a triangle */}
          <div style={{ position:"relative", width:size*0.58, height:size*0.52 }}>
            {[
              { x:"50%", y:0,     color:"rgba(242,180,60,0.9)",  s:size*0.22 },
              { x:0,     y:"60%", color:"rgba(123,175,212,0.9)", s:size*0.19 },
              { x:"72%", y:"60%", color:"rgba(184,160,216,0.9)", s:size*0.17 },
            ].map((o,i) => (
              <div key={i} style={{ position:"absolute", left:o.x, top:o.y,
                width:o.s, height:o.s, borderRadius:"50%",
                background:`radial-gradient(circle at 33% 28%, rgba(255,255,255,0.35) 0%, ${o.color} 70%)`,
                transform:"translate(-50%,-50%)",
                boxShadow:`0 0 ${o.s*0.6}px ${o.color}` }} />
            ))}
          </div>
        </div>
        {/* Online star */}
        {isOnline && (
          <div style={{ position:"absolute", bottom:-1, right:-1, fontSize:11,
            animation:"chat-star-pulse 2.2s ease-in-out infinite",
            filter:"drop-shadow(0 0 4px rgba(242,180,60,0.8))", lineHeight:1 }}>✦</div>
        )}
      </div>
    );
  }

  // Direct — same luminous sphere as invitar/tree
  const initial = conv.name[0]?.toUpperCase() ?? "?";
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      {/* Ambient glow */}
      <div style={{ position:"absolute", inset:-size*0.28, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(242,180,60,0.22) 0%, transparent 68%)",
        filter:"blur(5px)", opacity:0.7 }} />
      {/* Sphere */}
      {conv.avatar ? (
        <div style={{ position:"relative", width:size, height:size }}>
          <div style={{ position:"absolute", inset:-3, borderRadius:"50%",
            background:"conic-gradient(from 0deg, rgba(242,180,60,0.55), rgba(200,120,48,0.25), rgba(212,175,55,0.55))",
            filter:"blur(2px)", opacity:0.55 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={conv.avatar} alt={conv.name}
            style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", position:"relative",
              boxShadow:"0 0 0 1px rgba(242,180,60,0.20)" }} />
        </div>
      ) : (
        <div style={{ width:size, height:size, borderRadius:"50%",
          background:`radial-gradient(circle at 35% 26%, rgba(242,180,60,0.22) 0%, rgba(8,5,18,0.97) 65%)`,
          border:"1px solid rgba(242,180,60,0.25)",
          display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:`inset 0 2px 12px rgba(120,60,220,0.18), 0 0 ${size*0.35}px rgba(242,180,60,0.10)` }}>
          <span style={{ fontSize:size*0.36, color:"#F2B43C", fontWeight:300, letterSpacing:"0.04em" }}>
            {initial}
          </span>
        </div>
      )}
      {/* Online star */}
      {isOnline && (
        <div style={{ position:"absolute", bottom:-1, right:-1, fontSize:12,
          animation:"chat-star-pulse 2.2s ease-in-out infinite",
          filter:"drop-shadow(0 0 4px rgba(242,180,60,0.8))", lineHeight:1 }}>✦</div>
      )}
    </div>
  );
}

// ── Conversation card ──────────────────────────────────────────────────────────

function ConvCard({ conv, isOnline, delay }: { conv: Conversation; isOnline: boolean; delay: number }) {
  const isGroup = conv.type === "group";
  return (
    <Link href={`/chat/${conv.roomId}`} style={{ textDecoration:"none", display:"block" }}>
      <div style={{
        background: isGroup
          ? "rgba(10,6,24,0.88)"
          : conv.unread ? "rgba(12,8,22,0.90)" : "rgba(8,5,18,0.82)",
        backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
        border:`0.5px solid ${isGroup ? "rgba(184,160,216,0.18)" : "rgba(242,180,60,0.10)"}`,
        borderTop:`0.5px solid ${isGroup ? "rgba(184,160,216,0.32)" : conv.unread ? "rgba(242,180,60,0.35)" : "rgba(242,180,60,0.20)"}`,
        borderRadius:20,
        padding:"18px 16px 16px",
        display:"flex", alignItems:"flex-start", gap:14,
        animation:`chat-card-in 0.4s ease ${delay}ms both`,
        boxShadow: conv.unread ? "0 0 0 0.5px rgba(242,180,60,0.08), 0 8px 32px rgba(0,0,0,0.5)" : "0 4px 20px rgba(0,0,0,0.4)",
      }}>
        <ConvAvatar conv={conv} size={50} isOnline={isOnline} />

        <div style={{ flex:1, minWidth:0 }}>
          {/* Row 1: name + time */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
            <span style={{ fontSize:15, fontWeight: conv.unread ? 700 : 600, color:"#F5EDD8",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"65%" }}>
              {conv.name}
            </span>
            {conv.lastAt && (
              <span style={{ fontSize:10, color:"rgba(242,180,60,0.40)", flexShrink:0, marginLeft:8,
                letterSpacing:"0.04em" }}>
                {timeAgo(conv.lastAt)}
              </span>
            )}
          </div>

          {/* Row 2: relation label for group */}
          {isGroup && (
            <div style={{ fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase",
              color:"rgba(184,160,216,0.50)", marginBottom:6 }}>
              Constelación familiar
            </div>
          )}

          {/* Row 3: last message + unread dot */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <p style={{ fontSize:12, color: conv.unread ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.30)",
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1,
              fontWeight: conv.unread ? 500 : 400, margin:0, fontStyle: conv.lastMessage ? "normal" : "italic" }}>
              {conv.lastMessage || "Sin mensajes aún"}
            </p>
            {conv.unread && (
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#F2B43C", flexShrink:0,
                boxShadow:"0 0 8px rgba(242,180,60,0.7)" }} />
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Mini sphere for DM picker ──────────────────────────────────────────────────

function MiniSphere({ member, isOnline, onClick, disabled }: {
  member: RosterMember; isOnline: boolean; onClick: () => void; disabled: boolean;
}) {
  const init = `${member.first_name[0] ?? ""}${(member.last_name || "")[0] ?? ""}`.toUpperCase();
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 14px 8px 8px",
        borderRadius:100, background:"rgba(8,5,18,0.85)",
        border:"0.5px solid rgba(242,180,60,0.20)",
        borderTop:"0.5px solid rgba(242,180,60,0.35)",
        cursor:disabled ? "wait" : "pointer", opacity:disabled ? 0.5 : 1,
        backdropFilter:"blur(12px)" }}>
      <div style={{ position:"relative", width:30, height:30, flexShrink:0 }}>
        <div style={{ width:30, height:30, borderRadius:"50%",
          background:`radial-gradient(circle at 35% 28%, rgba(242,180,60,0.20) 0%, rgba(8,5,18,0.97) 65%)`,
          border:"1px solid rgba(242,180,60,0.25)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:11, fontWeight:600, color:"#F2B43C", overflow:"hidden" }}>
          {member.photo_path
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={member.photo_path} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
            : init}
        </div>
        {isOnline && (
          <div style={{ position:"absolute", bottom:-1, right:-1, fontSize:9,
            animation:"chat-star-pulse 2.2s ease-in-out infinite", lineHeight:1 }}>✦</div>
        )}
      </div>
      <span style={{ fontSize:13, fontWeight:600, color:"rgba(255,255,255,0.85)" }}>{member.first_name}</span>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ChatListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [myUserId,       setMyUserId]       = useState<string | null>(null);
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [familyMembers,  setFamilyMembers]  = useState<RosterMember[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [showNewDM,      setShowNewDM]      = useState(false);
  const [starting,       setStarting]       = useState<string | null>(null);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onlineFamily = familyMembers.filter(m => onlineIds.has(m.user_id));
  const activeCount  = conversations.length;

  // ── Loading ──

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#030208", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{CSS}</style>
      <SpaceBackground />
      <div style={{ fontSize:22, color:"rgba(242,180,60,0.4)", position:"relative", zIndex:5,
        animation:"chat-star-pulse 2s ease-in-out infinite" }}>✦</div>
    </div>
  );

  return (
    <>
      <style>{CSS}</style>
      <SpaceBackground />

      <div style={{ minHeight:"100vh", color:"#fff", paddingBottom:100, position:"relative", zIndex:5 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ background:"rgba(4,2,12,0.88)", backdropFilter:"blur(18px)",
          WebkitBackdropFilter:"blur(18px)", borderBottom:"0.5px solid rgba(242,180,60,0.10)",
          padding:"52px 20px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <Link href="/home">
              <div style={{ width:36, height:36, borderRadius:11, background:"rgba(8,5,18,0.95)",
                borderTop:"1px solid rgba(242,180,60,0.28)", borderBottom:"2px solid rgba(0,0,0,0.8)",
                borderLeft:"1px solid rgba(242,180,60,0.12)", borderRight:"1px solid rgba(0,0,0,0.6)",
                boxShadow:"0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
                display:"flex", alignItems:"center", justifyContent:"center" }}>
                <ArrowLeft size={17} style={{ color:"rgba(242,180,60,0.75)" }} />
              </div>
            </Link>

            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#fff", letterSpacing:"-0.01em" }}>
                Conversaciones
              </div>
              <div style={{ fontSize:10, color:"rgba(242,180,60,0.40)", letterSpacing:"0.06em", marginTop:2 }}>
                Tu universo familiar
              </div>
            </div>

            <button onClick={() => setShowNewDM(v => !v)}
              style={{ width:36, height:36, borderRadius:11, background:"rgba(8,5,18,0.95)",
                borderTop:"1px solid rgba(242,180,60,0.28)", borderBottom:"2px solid rgba(0,0,0,0.8)",
                borderLeft:"1px solid rgba(242,180,60,0.12)", borderRight:"1px solid rgba(0,0,0,0.6)",
                boxShadow:"0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
                display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              {showNewDM
                ? <X size={16}    style={{ color:"rgba(242,180,60,0.75)" }} />
                : <Plus size={17} style={{ color:"rgba(242,180,60,0.75)" }} />}
            </button>
          </div>

          {/* Context line */}
          <div style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.25)",
            letterSpacing:"0.02em" }}>
            {activeCount > 0
              ? `${activeCount} conversación${activeCount !== 1 ? "es" : ""} activa${activeCount !== 1 ? "s" : ""}`
              : "Sin conversaciones aún"}
            {familyMembers.length > 0 && (
              <span style={{ color:"rgba(242,180,60,0.30)" }}>
                {" · "}{familyMembers.length} familiares conectados
              </span>
            )}
          </div>
        </div>

        {/* ── New DM picker ───────────────────────────────────────────────── */}
        {showNewDM && (
          <div style={{ background:"rgba(6,3,16,0.95)", backdropFilter:"blur(20px)",
            borderBottom:"0.5px solid rgba(242,180,60,0.10)", padding:"16px 16px 18px" }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.16em", textTransform:"uppercase",
              color:"rgba(242,180,60,0.40)", marginBottom:12 }}>Enviar mensaje a:</p>
            {familyMembers.length === 0 ? (
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.30)", fontStyle:"italic" }}>
                Ningún familiar tiene Ceiba aún.
              </p>
            ) : (
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {familyMembers.map(m => (
                  <MiniSphere key={m.person_id} member={m}
                    isOnline={onlineIds.has(m.user_id)}
                    onClick={() => startDM(m)}
                    disabled={!!starting} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Online now ─────────────────────────────────────────────────── */}
        {onlineFamily.length > 0 && (
          <div style={{ padding:"14px 16px 12px", borderBottom:"0.5px solid rgba(242,180,60,0.07)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
              <div style={{ fontSize:11, animation:"chat-star-pulse 2s ease-in-out infinite",
                filter:"drop-shadow(0 0 4px rgba(242,180,60,0.7))" }}>✦</div>
              <span style={{ fontSize:10, fontWeight:700, letterSpacing:"0.12em", textTransform:"uppercase",
                color:"rgba(242,180,60,0.60)" }}>En línea ahora</span>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {onlineFamily.map(m => {
                const init = `${m.first_name[0] ?? ""}${(m.last_name || "")[0] ?? ""}`.toUpperCase();
                return (
                  <button key={m.user_id} onClick={() => startDM(m)} disabled={!!starting}
                    style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5,
                      background:"none", border:"none", cursor:"pointer" }}>
                    <div style={{ position:"relative", width:42, height:42 }}>
                      <div style={{ width:42, height:42, borderRadius:"50%",
                        background:"radial-gradient(circle at 35% 28%, rgba(242,180,60,0.18) 0%, rgba(8,5,18,0.97) 65%)",
                        border:"1px solid rgba(242,180,60,0.30)",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:14, fontWeight:600, color:"#F2B43C", overflow:"hidden" }}>
                        {m.photo_path
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.photo_path} style={{ width:"100%", height:"100%", objectFit:"cover" }} alt="" />
                          : init}
                      </div>
                      <div style={{ position:"absolute", bottom:-1, right:-1, fontSize:11,
                        animation:"chat-star-pulse 2.2s ease-in-out infinite",
                        filter:"drop-shadow(0 0 4px rgba(242,180,60,0.8))", lineHeight:1 }}>✦</div>
                    </div>
                    <span style={{ fontSize:10, color:"rgba(255,255,255,0.45)", fontWeight:500 }}>{m.first_name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Conversations ──────────────────────────────────────────────── */}
        <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:10 }}>
          {conversations.length === 0 && !showNewDM ? (
            <div style={{ textAlign:"center", padding:"70px 24px" }}>
              <div style={{ fontSize:36, marginBottom:18, opacity:0.5,
                animation:"chat-star-pulse 3s ease-in-out infinite" }}>✦</div>
              <p style={{ fontSize:18, fontWeight:700, color:"rgba(255,255,255,0.80)", marginBottom:8 }}>
                Tu universo está en silencio
              </p>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.30)", marginBottom:24, lineHeight:1.75 }}>
                Empieza una conversación con alguien<br/>de tu constelación familiar.
              </p>
              <button onClick={() => setShowNewDM(true)}
                style={{ background:"rgba(242,180,60,0.12)",
                  border:"0.5px solid rgba(242,180,60,0.45)",
                  borderTop:"0.5px solid rgba(242,180,60,0.65)",
                  borderRadius:16, padding:"12px 28px",
                  color:"#F2B43C", fontWeight:600, fontSize:14,
                  cursor:"pointer", letterSpacing:"0.05em" }}>
                ✨ Nuevo mensaje
              </button>
            </div>
          ) : (
            conversations.map((conv, i) => (
              <ConvCard
                key={conv.roomId}
                conv={conv}
                isOnline={conv.otherUserId ? onlineIds.has(conv.otherUserId) : false}
                delay={i * 60}
              />
            ))
          )}
        </div>

        <CosmicNav />
      </div>
    </>
  );
}

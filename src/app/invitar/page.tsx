"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TreePine, ChevronLeft, Check, Users,
  Phone, Copy, Send, Plus, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createInviteLink, buildInviteMessage, shareInviteWhatsApp,
  copyInviteLink, InviteTemplate,
} from "@/lib/viral/inviteFlow";
import { trackEvent } from "@/lib/viral/viralAnalytics";
import {
  resolveRelationsFromRoot,
  describeRelation,
  describeRelationPossessive,
  UNKNOWN_RELATION_LABEL,
} from "@/lib/genealogy";
import type { FamilyGraph } from "@/lib/graphAdapter";
import toast, { Toaster } from "react-hot-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FamilyMember {
  id: string;
  first_names: string;
  last_names: string;
  profile_photo_url?: string | null;
  phone?: string | null;
  linked_user_id?: string | null;
  is_living?: boolean;
  relation?: string;
  relationPlain?: string;
  joined?: boolean;
}

type CardState = "idle" | "loading" | "sent" | "adding_phone";

// ── Keyframes ──────────────────────────────────────────────────────────────────

const CSS = `
@keyframes confettiDrop {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(60px) rotate(720deg); opacity: 0; }
}
@keyframes starPulse {
  0%,100% { opacity:0.5; transform:scale(1); }
  50%      { opacity:1;   transform:scale(1.08); }
}
@keyframes cardSlideUp {
  from { opacity:0; transform:translateY(14px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
.confetti-particle {
  position:absolute; width:7px; height:7px; border-radius:2px;
  animation: confettiDrop 0.8s ease-out forwards;
  pointer-events:none;
}
`;

const CONFETTI_COLORS = ["#F2B43C","#c87830","#7BAFD4","#B8A0D8","#d4af37","#F5EDD8"];

function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: x + (Math.random() - 0.5) * 100,
    top: y,
    delay: Math.random() * 0.2,
  }));
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:999 }}>
      {particles.map(p => (
        <div key={p.id} className="confetti-particle"
          style={{ left:p.left, top:p.top, background:p.color, animationDelay:`${p.delay}s` }} />
      ))}
    </div>
  );
}

// ── Star avatar — same visual language as the universe tree ───────────────────

function StarAvatar({ member, size = 52 }: { member: FamilyMember; size?: number }) {
  const initial = member.first_names?.[0]?.toUpperCase() ?? "?";
  if (member.profile_photo_url) {
    return (
      <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
        <div style={{ position:"absolute", inset:-4, borderRadius:"50%",
          background:"conic-gradient(from 0deg, rgba(242,180,60,0.6), rgba(200,120,48,0.3), rgba(212,175,55,0.6))",
          filter:"blur(3px)", opacity:0.6, animation:"starPulse 3.5s ease-in-out infinite" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={member.profile_photo_url} alt={member.first_names}
          style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", position:"relative",
            boxShadow:"0 0 0 1px rgba(242,180,60,0.25)" }} />
      </div>
    );
  }
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <div style={{ position:"absolute", inset:-size*0.35, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(242,180,60,0.28) 0%, transparent 68%)",
        filter:"blur(6px)", animation:"starPulse 3.5s ease-in-out infinite" }} />
      <div style={{ width:size, height:size, borderRadius:"50%", position:"relative",
        background:`radial-gradient(circle at 33% 26%, rgba(242,180,60,0.22) 0%, rgba(8,5,18,0.97) 65%)`,
        border:"1px solid rgba(242,180,60,0.28)",
        display:"flex", alignItems:"center", justifyContent:"center",
        boxShadow:"inset 0 2px 12px rgba(120,60,220,0.18), 0 0 16px rgba(242,180,60,0.10)" }}>
        <span style={{ fontSize:size*0.36, color:"#F2B43C", fontWeight:300, letterSpacing:"0.04em" }}>
          {initial}
        </span>
      </div>
    </div>
  );
}

// ── Star background (CSS-only, no canvas) ─────────────────────────────────────

function StarBackground() {
  const stars = [
    [22,12,0.5],[68,8,0.4],[140,18,0.55],[220,6,0.42],[298,22,0.38],[358,10,0.48],
    [44,44,0.38],[112,36,0.45],[188,28,0.40],[264,48,0.35],[320,38,0.44],
    [18,88,0.42],[80,74,0.38],[158,94,0.45],[236,80,0.36],[310,92,0.40],
    [38,138,0.40],[106,126,0.35],[182,148,0.42],[252,132,0.38],[344,140,0.36],
  ];
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
      {/* Deep nebula gradient */}
      <div style={{ position:"absolute", inset:0,
        background:"radial-gradient(ellipse 120% 80% at 50% 0%, #1a062e 0%, #0d0518 35%, #060312 65%, #030208 100%)" }} />
      {/* Nebula blobs */}
      <div style={{ position:"absolute", top:-80, left:-60, width:340, height:340, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(80,30,200,0.18) 0%, transparent 70%)", filter:"blur(40px)" }} />
      <div style={{ position:"absolute", top:-40, right:-80, width:280, height:280, borderRadius:"50%",
        background:"radial-gradient(circle, rgba(20,60,180,0.14) 0%, transparent 70%)", filter:"blur(32px)" }} />
      <div style={{ position:"absolute", top:"30%", left:"15%", width:360, height:200, borderRadius:"50%",
        background:"radial-gradient(ellipse, rgba(180,100,10,0.10) 0%, transparent 65%)", filter:"blur(24px)" }} />
      <div style={{ position:"absolute", bottom:"10%", right:"5%", width:260, height:160, borderRadius:"50%",
        background:"radial-gradient(ellipse, rgba(60,15,90,0.12) 0%, transparent 70%)", filter:"blur(20px)" }} />
      {/* Star field */}
      <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} aria-hidden>
        {stars.map(([x,y,o],i) => <circle key={i} cx={x} cy={y} r="0.6" fill="white" opacity={o} />)}
        <circle cx="160" cy="14" r="1.3" fill="#d4af37" opacity="0.95"
          style={{ animation:"starPulse 4s ease-in-out infinite" }} />
        <circle cx="52" cy="30" r="1.0" fill="white" opacity="0.88"
          style={{ animation:"starPulse 3.2s ease-in-out infinite 0.8s" }} />
        <circle cx="330" cy="52" r="1.1" fill="#b8c8f0" opacity="0.80"
          style={{ animation:"starPulse 2.8s ease-in-out infinite 1.5s" }} />
      </svg>
    </div>
  );
}

// ── Member card — galactic style ───────────────────────────────────────────────

function MemberCard({
  member, batchMode, isSelected, inviterFirstName, previewNames, template, onSent, onToggleSelect, animDelay,
}: {
  member: FamilyMember;
  batchMode: boolean;
  isSelected: boolean;
  inviterFirstName: string;
  previewNames: string[];
  template: InviteTemplate;
  onSent: (memberId: string, event: React.MouseEvent) => void;
  onToggleSelect: (memberId: string) => void;
  animDelay: number;
}) {
  const supabase = createClient();
  const [state, setState] = useState<CardState>("idle");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);

  const handleInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState("loading");
    // Open blank window synchronously BEFORE any await — mobile browsers block
    // window.open() called after an async gap because the user gesture is gone.
    const win = typeof window !== "undefined" ? window.open("", "_blank") : null;
    try {
      const ctx = {
        inviterFirstName,
        invitedFirstName: member.first_names,
        invitedRelation: member.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(),
        previewMembers: previewNames,
      };
      const result = await createInviteLink(supabase, member.id, template);
      const message = buildInviteMessage(template, ctx, result.universalLink);
      await shareInviteWhatsApp(supabase, result.invitationId, message, phone || undefined, win);
      setState("sent");
      onSent(member.id, e);
    } catch (err: any) {
      if (win && !win.closed) win.close();
      toast.error(err.message ?? "Error al enviar invitación");
      setState("idle");
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState("loading");
    try {
      const result = await createInviteLink(supabase, member.id, template);
      const ctx = {
        inviterFirstName,
        invitedFirstName: member.first_names,
        invitedRelation: member.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(),
        previewMembers: previewNames,
      };
      buildInviteMessage(template, ctx, result.universalLink);
      await copyInviteLink(supabase, result.invitationId, result.universalLink);
      toast.success("✦ Link copiado");
      setState("sent");
    } catch (err: any) {
      toast.error(err.message ?? "Error");
      setState("idle");
    }
  };

  const savePhone = async () => {
    if (!phone.trim()) return;
    await supabase.from("persons").update({ phone }).eq("id", member.id);
    setEditingPhone(false);
    toast.success("Número guardado");
  };

  const isSent = state === "sent";

  return (
    <div
      style={{
        background: member.joined ? "rgba(8,22,18,0.85)" : isSent ? "rgba(12,30,18,0.85)" : "rgba(8,5,18,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `0.5px solid ${member.joined ? "rgba(60,200,160,0.20)" : isSent ? "rgba(60,180,100,0.25)" : "rgba(242,180,60,0.12)"}`,
        borderTop: `0.5px solid ${member.joined ? "rgba(60,200,160,0.30)" : isSent ? "rgba(60,180,100,0.35)" : "rgba(242,180,60,0.22)"}`,
        borderRadius: 20,
        padding: "18px 16px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        animation: `cardSlideUp 0.45s ease ${animDelay}ms both`,
        cursor: batchMode ? "pointer" : "default",
        outline: batchMode && isSelected ? "1.5px solid rgba(242,180,60,0.45)" : "none",
        transition: "border-color 0.3s ease",
      }}
      onClick={() => batchMode && onToggleSelect(member.id)}
    >
      <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
        <StarAvatar member={member} size={50} />

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:16, fontWeight:600, color:"#F5EDD8", letterSpacing:"-0.01em",
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            {member.first_names}
          </div>
          {member.relation && (
            <div style={{ fontSize:9, color:"rgba(242,180,60,0.55)", letterSpacing:"0.12em",
              textTransform:"uppercase", marginTop:3 }}>
              {member.relation}
            </div>
          )}

          {/* Estado */}
          <div style={{ fontSize:10, marginTop:7, letterSpacing:"0.04em",
            color: member.joined ? "rgba(100,220,180,0.85)" : isSent ? "rgba(100,220,130,0.70)" : "rgba(255,255,255,0.28)" }}>
            {member.joined ? "✓ Ya se unió" : isSent ? "✦ Invitación enviada" : "🌑 Sin invitar"}
          </div>

          {/* Teléfono (discreto) */}
          {!isSent && !member.joined && (
            editingPhone ? (
              <div style={{ display:"flex", gap:6, marginTop:8 }} onClick={e => e.stopPropagation()}>
                <input type="tel" value={phone} autoFocus
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                  style={{ flex:1, fontSize:11, background:"rgba(255,255,255,0.06)",
                    border:"0.5px solid rgba(242,180,60,0.25)", borderRadius:8,
                    padding:"5px 8px", color:"#fff", outline:"none" }} />
                <button onClick={e => { e.stopPropagation(); savePhone(); }}
                  style={{ fontSize:11, background:"rgba(242,180,60,0.15)",
                    border:"0.5px solid rgba(242,180,60,0.35)", borderRadius:8,
                    padding:"5px 10px", color:"#F2B43C", cursor:"pointer" }}>
                  OK
                </button>
              </div>
            ) : (
              <button onClick={e => { e.stopPropagation(); setEditingPhone(true); }}
                style={{ display:"flex", alignItems:"center", gap:5, marginTop:7,
                  background:"none", border:"none", cursor:"pointer", padding:0,
                  color:"rgba(242,180,60,0.32)", fontSize:10, letterSpacing:"0.04em" }}>
                {phone ? <><Phone size={9}/> {phone}</> : <><Plus size={9}/> Añadir número</>}
              </button>
            )
          )}
        </div>

        {/* Acciones discretas — copy + batch checkbox */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, flexShrink:0 }}>
          {batchMode ? (
            <div style={{ width:18, height:18, borderRadius:5,
              border:`1.5px solid rgba(242,180,60,${isSelected ? "0.8" : "0.25"})`,
              background: isSelected ? "rgba(242,180,60,0.20)" : "transparent",
              display:"flex", alignItems:"center", justifyContent:"center" }}>
              {isSelected && <div style={{ width:8, height:8, borderRadius:2, background:"#F2B43C" }}/>}
            </div>
          ) : (
            !isSent && (
              <button onClick={handleCopyLink}
                style={{ background:"none", border:"none", cursor:"pointer",
                  color:"rgba(242,180,60,0.22)", padding:4,
                  transition:"color 0.2s ease" }}>
                <Copy size={13} />
              </button>
            )
          )}
        </div>
      </div>

      {/* CTA */}
      {!batchMode && !member.joined && (
        isSent ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6,
              color:"rgba(100,220,130,0.70)", fontSize:12, fontWeight:500 }}>
              <Check size={13} />
              Enviada
            </div>
            <button onClick={e => { e.stopPropagation(); setState("idle"); }}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"rgba(242,180,60,0.40)", fontSize:11, letterSpacing:"0.04em" }}>
              Reenviar
            </button>
          </div>
        ) : (
          <button onClick={handleInvite} disabled={state === "loading"}
            style={{
              width:"100%", padding:"12px 0",
              borderRadius:14, cursor:"pointer",
              background: state === "loading" ? "rgba(242,180,60,0.06)" : "rgba(242,180,60,0.10)",
              border: "0.5px solid rgba(242,180,60,0.35)",
              borderTop: "0.5px solid rgba(242,180,60,0.55)",
              color:"#F2B43C", fontWeight:600, fontSize:13,
              letterSpacing:"0.06em",
              transition:"background 0.2s ease",
            }}>
            {state === "loading" ? "✦ Enviando..." : "✨  Invitar"}
          </button>
        )
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function InvitarPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightPersonId = searchParams.get("person") ?? null;

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [meFirstName, setMeFirstName] = useState("");
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sentCount, setSentCount] = useState(0);
  const [confettiBurst, setConfettiBurst] = useState<{ x: number; y: number } | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [template] = useState<InviteTemplate>(() => {
    const templates: InviteTemplate[] = ["v1_direct", "v2_emotional", "v3_specific", "v4_urgency", "v5_short"];
    return templates[Math.floor(Math.random() * templates.length)];
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      const { data: graph, error: graphError } = await supabase.rpc("get_my_family_graph", { p_depth: 2 });
      if (graphError) throw graphError;
      if (!graph) { setMembers([]); return; }

      const nodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges: any[] = Array.isArray(graph.edges) ? graph.edges : [];
      const myId: string | null = graph.me ?? null;

      const personIds = nodes.map((n: any) => n.id).filter((id: any): id is string => Boolean(id));
      const claimedPersonIds = new Set<string>();

      if (personIds.length > 0) {
        const { data: claims } = await supabase
          .from("person_claims")
          .select("person_id")
          .in("person_id", personIds)
          .eq("claim_status", "approved")
          .is("revoked_at", null);
        for (const claim of claims ?? []) {
          if (claim.person_id) claimedPersonIds.add(claim.person_id);
        }
      }

      const me = nodes.find((n: any) => n.id === myId);
      if (me?.first_name) setMeFirstName(me.first_name);

      const { byPersonId: relationsById } = resolveRelationsFromRoot({ me: myId, nodes, edges } as unknown as FamilyGraph);

      const toMember = (n: any, joined: boolean): FamilyMember => ({
        id: n.id,
        first_names: [n.first_name, n.middle_name].filter(Boolean).join(" "),
        last_names: [n.first_surname, n.second_surname].filter(Boolean).join(" "),
        profile_photo_url: n.photo_path ?? null,
        phone: null,
        linked_user_id: null,
        is_living: n.is_deceased !== true,
        relation: describeRelationPossessive(relationsById.get(n.id)),
        relationPlain: describeRelation(relationsById.get(n.id)).toLowerCase(),
        joined,
      });

      const pending: FamilyMember[] = nodes
        .filter((n: any) => n.id !== myId && n.deleted_at == null && n.is_deceased !== true && !claimedPersonIds.has(n.id))
        .map((n: any) => toMember(n, false));

      const joinedMembers: FamilyMember[] = nodes
        .filter((n: any) => n.id !== myId && n.deleted_at == null && claimedPersonIds.has(n.id))
        .map((n: any) => toMember(n, true));

      const active = joinedMembers.slice(0, 3).map(m => m.first_names.split(" ")[0]).filter(Boolean);
      setPreviewNames(active);

      const highlightId = searchParams.get("person");
      if (highlightId) {
        const idx = pending.findIndex(m => m.id === highlightId);
        if (idx > 0) { const [hit] = pending.splice(idx, 1); pending.unshift(hit); }
      }
      setMembers([...pending, ...joinedMembers]);
    } catch (err) {
      console.error("Error cargando familiares:", err);
      toast.error("No se pudieron cargar los familiares");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, router, searchParams]);

  useEffect(() => {
    trackEvent("invite_picker_opened" as any, {});
    loadData();
  }, [loadData]);

  const handleSent = (memberId: string, e: React.MouseEvent) => {
    const newCount = sentCount + 1;
    setSentCount(newCount);
    setConfettiBurst({ x: e.clientX, y: e.clientY });
    setTimeout(() => setConfettiBurst(null), 900);
    if (newCount === 5) setTimeout(() => setShowModal(true), 700);
    trackEvent("invite_sent" as any, { channel: "whatsapp" });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBatchInvite = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Se abrirá WhatsApp ${selected.size} ${selected.size === 1 ? "vez" : "veces"}. ¿Continuar?`
    );
    if (!confirmed) return;
    for (const id of selected) {
      const m = members.find(mb => mb.id === id);
      if (!m) continue;
      try {
        const result = await createInviteLink(supabase, id, template);
        const ctx = { inviterFirstName: meFirstName, invitedFirstName: m.first_names,
          invitedRelation: m.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(), previewMembers: previewNames };
        const msg = buildInviteMessage(template, ctx, result.universalLink);
        await shareInviteWhatsApp(supabase, result.invitationId, msg, m.phone || undefined);
        setSentCount(n => n + 1);
        await new Promise(r => setTimeout(r, 600));
      } catch { /* continuar */ }
    }
    setBatchMode(false);
    setSelected(new Set());
    toast.success(`✦ ${selected.size} invitaciones enviadas`);
  };

  const GOAL = 5;
  const starsLeft = Math.max(0, GOAL - sentCount);

  // ── Empty state ──

  if (!loading && members.filter(m => !m.joined).length === 0 && members.length === 0) {
    return (
      <div style={{ minHeight:"100vh", background:"#030208", display:"flex", flexDirection:"column" }}>
        <StarBackground />
        <header style={{ position:"relative", zIndex:10, padding:"calc(env(safe-area-inset-top,20px) + 14px) 20px 16px",
          display:"flex", alignItems:"center", gap:12,
          borderBottom:"0.5px solid rgba(242,180,60,0.10)", backdropFilter:"blur(12px)" }}>
          <button onClick={() => router.back()}
            style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(242,180,60,0.55)", padding:4 }}>
            <ChevronLeft size={22} />
          </button>
          <span style={{ fontSize:16, fontWeight:600, color:"#fff" }}>Tu universo</span>
        </header>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", gap:18, padding:"0 24px", textAlign:"center", position:"relative", zIndex:5 }}>
          <div style={{ fontSize:48, filter:"drop-shadow(0 0 20px rgba(242,180,60,0.5))" }}>⭐</div>
          <h2 style={{ fontSize:22, fontWeight:700, color:"#fff", letterSpacing:"-0.02em" }}>
            Tu constelación está completa
          </h2>
          <p style={{ color:"rgba(255,255,255,0.38)", maxWidth:260, fontSize:13, lineHeight:1.7 }}>
            Toda tu familia directa ya brilla dentro de Ceiba.
          </p>
          <Link href="/tree" style={{ textDecoration:"none" }}>
            <div style={{ display:"flex", alignItems:"center", gap:8,
              background:"rgba(242,180,60,0.12)", border:"0.5px solid rgba(242,180,60,0.40)",
              borderRadius:18, color:"#F2B43C", fontWeight:600, fontSize:14,
              padding:"13px 24px", letterSpacing:"0.04em" }}>
              Explorar mi universo
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <>
      <style>{CSS}</style>
      <Toaster position="top-center" toastOptions={{
        style: { background:"rgba(8,5,18,0.96)", border:"0.5px solid rgba(242,180,60,0.25)",
          color:"#F5EDD8", backdropFilter:"blur(20px)", borderRadius:14, fontSize:13 },
      }} />
      {confettiBurst && <ConfettiBurst x={confettiBurst.x} y={confettiBurst.y} />}
      <StarBackground />

      {/* Modal celebración */}
      {showModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
          backdropFilter:"blur(8px)", zIndex:50,
          display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div style={{ background:"rgba(8,5,18,0.98)", borderRadius:26, padding:"28px 24px",
            maxWidth:320, width:"100%", textAlign:"center",
            border:"0.5px solid rgba(242,180,60,0.25)",
            borderTop:"0.5px solid rgba(242,180,60,0.50)",
            boxShadow:"0 24px 80px rgba(0,0,0,0.9), 0 0 80px rgba(242,180,60,0.08)" }}>
            <div style={{ fontSize:40, marginBottom:16, filter:"drop-shadow(0 0 20px rgba(242,180,60,0.6))" }}>⭐</div>
            <h2 style={{ fontSize:19, fontWeight:700, color:"#fff", marginBottom:10, letterSpacing:"-0.01em" }}>
              Estás encendiendo estrellas
            </h2>
            <p style={{ color:"rgba(255,255,255,0.40)", fontSize:13, marginBottom:24, lineHeight:1.7 }}>
              Cuando 3 de ellos entren, ganas la insignia{" "}
              <strong style={{ color:"#d4af37" }}>Conector</strong>.
            </p>
            <button onClick={() => setShowModal(false)}
              style={{ width:"100%", background:"rgba(242,180,60,0.12)",
                border:"0.5px solid rgba(242,180,60,0.45)",
                borderTop:"0.5px solid rgba(242,180,60,0.65)",
                borderRadius:16, color:"#F2B43C",
                fontWeight:600, fontSize:15, padding:"13px 0",
                cursor:"pointer", letterSpacing:"0.04em" }}>
              Continuar ✦
            </button>
          </div>
        </div>
      )}

      <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column",
        maxWidth:480, margin:"0 auto", width:"100%", position:"relative", zIndex:5 }}>

        {/* Header */}
        <header style={{ background:"rgba(6,3,14,0.85)", backdropFilter:"blur(16px)",
          WebkitBackdropFilter:"blur(16px)",
          borderBottom:"0.5px solid rgba(242,180,60,0.10)",
          padding:"calc(env(safe-area-inset-top,20px) + 14px) 20px 14px", position:"sticky", top:0, zIndex:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <button onClick={() => router.back()}
              style={{ background:"none", border:"none", cursor:"pointer",
                color:"rgba(242,180,60,0.50)", padding:4, flexShrink:0 }}>
              <ChevronLeft size={22} />
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:15, fontWeight:600, color:"rgba(255,255,255,0.90)", letterSpacing:"-0.01em" }}>
                Tu constelación
              </div>
              <div style={{ fontSize:10, color:"rgba(242,180,60,0.40)", letterSpacing:"0.08em",
                textTransform:"uppercase", marginTop:2 }}>
                Haz crecer tu universo
              </div>
            </div>
            <button
              onClick={() => { setBatchMode(!batchMode); setSelected(new Set()); }}
              style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:500,
                padding:"6px 10px", borderRadius:9, cursor:"pointer",
                background: batchMode ? "rgba(242,180,60,0.10)" : "transparent",
                border:`0.5px solid ${batchMode ? "rgba(242,180,60,0.30)" : "rgba(255,255,255,0.08)"}`,
                color:"rgba(242,180,60,0.55)", letterSpacing:"0.04em" }}>
              <Users size={12} />
              {batchMode ? "Cancelar" : "Varios"}
            </button>
          </div>
        </header>

        {/* Hero */}
        <div style={{ padding:"36px 20px 28px", textAlign:"center", borderBottom:"0.5px solid rgba(242,180,60,0.08)" }}>
          <p style={{ fontSize:10, letterSpacing:"0.16em", textTransform:"uppercase",
            color:"rgba(242,180,60,0.45)", marginBottom:14 }}>
            Tu familia
          </p>
          <h1 style={{ fontSize:26, fontWeight:700, color:"#fff", letterSpacing:"-0.02em",
            lineHeight:1.2, marginBottom:12 }}>
            Haz crecer<br/>tu universo
          </h1>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", lineHeight:1.75,
            maxWidth:260, margin:"0 auto 20px" }}>
            Cada familiar que acepta ilumina una nueva<br/>
            estrella dentro de tu constelación.
          </p>
          {!loading && (
            <div style={{ display:"inline-flex", alignItems:"center", gap:9, padding:"9px 18px",
              borderRadius:20, background:"rgba(242,180,60,0.07)",
              border:"0.5px solid rgba(242,180,60,0.18)" }}>
              <span style={{ fontSize:13, color:"rgba(242,180,60,0.65)" }}>✦</span>
              <span style={{ fontSize:14, fontWeight:700, color:"#F2B43C" }}>{members.filter(m => !m.joined).length}</span>
              <span style={{ fontSize:12, color:"rgba(255,255,255,0.40)", letterSpacing:"0.02em" }}>
                estrellas esperan ser descubiertas
              </span>
            </div>
          )}
        </div>

        {/* Cards */}
        <div style={{ flex:1, padding:"16px 14px", display:"flex", flexDirection:"column",
          gap:10, paddingBottom:160 }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height:110, borderRadius:20,
                  background:"rgba(242,180,60,0.04)", border:"0.5px solid rgba(242,180,60,0.08)" }} />
              ))
            : members.map((m, i) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  batchMode={batchMode}
                  isSelected={selected.has(m.id)}
                  inviterFirstName={meFirstName}
                  previewNames={previewNames}
                  template={template}
                  onSent={handleSent}
                  onToggleSelect={toggleSelect}
                  animDelay={i * 55}
                />
              ))}
        </div>

        {/* Footer flotante */}
        <div style={{ position:"fixed", bottom:0, left:0, right:0, maxWidth:480, margin:"0 auto",
          background:"rgba(4,2,12,0.92)", backdropFilter:"blur(24px)",
          WebkitBackdropFilter:"blur(24px)",
          borderTop:"0.5px solid rgba(242,180,60,0.12)",
          padding:"16px 16px 32px" }}>

          {/* Batch CTA */}
          {batchMode && selected.size > 0 && (
            <button onClick={handleBatchInvite}
              style={{ width:"100%", display:"flex", alignItems:"center", justifyContent:"center",
                gap:8, background:"rgba(242,180,60,0.14)",
                border:"0.5px solid rgba(242,180,60,0.45)",
                borderRadius:18, color:"#F2B43C",
                fontWeight:700, fontSize:14, padding:"14px 0",
                cursor:"pointer", letterSpacing:"0.06em", marginBottom:10 }}>
              <Send size={15} />
              Invitar a {selected.size} estrellas
            </button>
          )}

          {/* Constelación progress */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase",
                color:"rgba(242,180,60,0.40)" }}>
                Próxima constelación
              </span>
              <span style={{ fontSize:10, color:"rgba(242,180,60,0.55)" }}>
                {sentCount} / {GOAL}
              </span>
            </div>
            <div style={{ display:"flex", gap:5, marginBottom:8 }}>
              {Array.from({ length: GOAL }).map((_, i) => (
                <div key={i} style={{ flex:1, height:2, borderRadius:1,
                  background: i < sentCount ? "#F2B43C" : "rgba(242,180,60,0.12)",
                  transition:"background 0.4s ease" }} />
              ))}
            </div>
            {starsLeft > 0 ? (
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.28)", lineHeight:1.5 }}>
                {starsLeft === 1 ? "Te falta 1 familiar" : `Te faltan ${starsLeft} familiares`} para la{" "}
                <span style={{ color:"rgba(242,180,60,0.60)" }}>Constelación del Conector</span>.
              </p>
            ) : (
              <p style={{ fontSize:11, color:"rgba(100,200,130,0.65)", lineHeight:1.5 }}>
                ✦ ¡Constelación del Conector desbloqueada!
              </p>
            )}
          </div>

          <Link href="/tree"
            style={{ display:"block", textAlign:"center", color:"rgba(242,180,60,0.28)",
              fontSize:11, letterSpacing:"0.06em", textDecoration:"none" }}>
            Invitar más tarde
          </Link>
        </div>
      </div>
    </>
  );
}

export default function InvitarPage() {
  return (
    <Suspense>
      <InvitarPageInner />
    </Suspense>
  );
}

"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  TreePine, ChevronLeft, Check, Users,
  Phone, Copy, CheckSquare, Square, Send,
  ChevronRight, AlertCircle, Smile, X, Plus
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

// ============================================================
// Tipos
// ============================================================

interface FamilyMember {
  id: string;
  first_names: string;
  last_names: string;
  profile_photo_url?: string | null;
  phone?: string | null;
  linked_user_id?: string | null;
  is_living?: boolean;
  /** Etiqueta posesiva ya resuelta ("Tu madre"). Ver @/lib/genealogy. */
  relation?: string;
  /** Misma relación sin posesivo ("madre"), para el texto del mensaje. */
  relationPlain?: string;
}

type CardState = "idle" | "loading" | "sent" | "adding_phone";

// ============================================================
// Helpers
// ============================================================

function Avatar({
  person, size = 48,
}: { person: FamilyMember; size?: number }) {
  if (person.profile_photo_url) {
    return (
      <Image
        src={person.profile_photo_url}
        alt={person.first_names}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-ceiba-600 flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {person.first_names?.[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// Confetti CSS — pure CSS animation
const confettiStyle = `
@keyframes confettiDrop {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(60px) rotate(720deg); opacity: 0; }
}
.confetti-particle {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  animation: confettiDrop 0.8s ease-out forwards;
  pointer-events: none;
}
`;

const CONFETTI_COLORS = ["#22c55e","#86efac","#fbbf24","#f472b6","#60a5fa","#a78bfa"];

function ConfettiBurst({ x, y }: { x: number; y: number }) {
  const particles = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: x + (Math.random() - 0.5) * 80,
    top: y,
    delay: Math.random() * 0.2,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: p.left,
            top: p.top,
            background: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================
// Componente tarjeta de familiar
// ============================================================

function MemberCard({
  member,
  batchMode,
  isSelected,
  inviterFirstName,
  previewNames,
  template,
  onSent,
  onToggleSelect,
}: {
  member: FamilyMember;
  batchMode: boolean;
  isSelected: boolean;
  inviterFirstName: string;
  previewNames: string[];
  template: InviteTemplate;
  onSent: (memberId: string, event: React.MouseEvent) => void;
  onToggleSelect: (memberId: string) => void;
}) {
  const supabase = createClient();
  const [state, setState] = useState<CardState>("idle");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [editingPhone, setEditingPhone] = useState(false);

  const handleInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setState("loading");
    try {
      const ctx = {
        inviterFirstName,
        invitedFirstName: member.first_names,
        invitedRelation: member.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(),
        previewMembers: previewNames,
      };
      const result = await createInviteLink(supabase, member.id, template);
      const message = buildInviteMessage(template, ctx, result.universalLink);
      await shareInviteWhatsApp(supabase, result.invitationId, message, phone || undefined);
      setState("sent");
      onSent(member.id, e);
    } catch (err: any) {
      toast.error(err.message ?? "Error al enviar invitación");
      setState("idle");
    }
  };

  const handleCopyLink = async () => {
    setState("loading");
    try {
      const result = await createInviteLink(supabase, member.id, template);
      const ctx = {
        inviterFirstName,
        invitedFirstName: member.first_names,
        invitedRelation: member.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(),
        previewMembers: previewNames,
      };
      const message = buildInviteMessage(template, ctx, result.universalLink);
      await copyInviteLink(supabase, result.invitationId, result.universalLink);
      toast.success("¡Link copiado!");
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

  return (
    <div
      className={`relative bg-cream-50 rounded-2xl shadow-sm border p-4 transition-all ${
        state === "sent" ? "border-green-300 bg-green-50" : "border-cream-200"
      } ${batchMode && isSelected ? "ring-2 ring-ceiba-500" : ""}`}
      onClick={() => batchMode && onToggleSelect(member.id)}
    >
      {/* Checkbox (batch mode) */}
      {batchMode && (
        <button
          className="absolute top-3 right-3 text-ceiba-600"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(member.id); }}
        >
          {isSelected ? <CheckSquare size={22} /> : <Square size={22} />}
        </button>
      )}

      <div className="flex items-start gap-3">
        <Avatar person={member} size={52} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ceiba-900 truncate">
            {member.first_names} {member.last_names}
          </p>
          {member.relation && (
            <p className="text-ceiba-500 text-sm">{member.relation}</p>
          )}

          {/* Teléfono */}
          {state !== "sent" && (
            <>
              {editingPhone ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+57 300 123 4567"
                    className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-ceiba-400"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); savePhone(); }}
                    className="text-sm bg-ceiba-500 text-white px-3 py-1.5 rounded-lg font-medium"
                  >
                    OK
                  </button>
                </div>
              ) : phone ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingPhone(true); }}
                  className="flex items-center gap-1 text-ceiba-400 text-xs mt-1 hover:text-ceiba-600"
                >
                  <Phone size={12} />
                  {phone}
                </button>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingPhone(true); }}
                  className="flex items-center gap-1 text-ceiba-600 text-xs mt-1 hover:text-ceiba-800"
                >
                  <Plus size={12} />
                  Añadir WhatsApp
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Acciones */}
      {!batchMode && (
        <div className="mt-3 flex gap-2">
          {state === "sent" ? (
            <div className="flex-1 flex items-center gap-2 text-green-600 text-sm font-medium">
              <Check size={16} />
              Invitación enviada
              <button
                onClick={(e) => { e.stopPropagation(); setState("idle"); }}
                className="ml-auto text-ceiba-400 hover:text-ceiba-600 text-xs underline"
              >
                Reenviar
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleInvite}
                disabled={state === "loading"}
                className="flex-1 flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5c] active:bg-[#18a854] disabled:opacity-50 text-white text-sm font-bold py-2.5 rounded-xl transition-colors"
              >
                {state === "loading" ? (
                  "Enviando..."
                ) : (
                  <>
                    <Send size={15} />
                    Invitar por WhatsApp
                  </>
                )}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}
                disabled={state === "loading"}
                title="Copiar link"
                className="flex items-center justify-center w-10 h-10 rounded-xl border border-cream-300 text-ceiba-500 hover:bg-cream-100 transition-colors"
              >
                <Copy size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Página principal
// ============================================================

function InvitarPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightPersonId = searchParams.get("person") ?? null;

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [meFirstName, setMeFirstName] = useState("");
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Progreso
  const [sentCount, setSentCount] = useState(0);

  // Confetti
  const [confettiBurst, setConfettiBurst] = useState<{ x: number; y: number } | null>(null);

  // Modal celebración
  const [showModal, setShowModal] = useState(false);

  // Template A/B (asignado aleatoriamente, en prod vendría del server)
  const [template] = useState<InviteTemplate>(() => {
    const templates: InviteTemplate[] = ["v1_direct", "v2_emotional", "v3_specific", "v4_urgency", "v5_short"];
    return templates[Math.floor(Math.random() * templates.length)];
  });

  // ============================================================
  // Carga de datos
  // ============================================================

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
        return;
      }

      // Cargar el grafo familiar canónico.
      const { data: graph, error: graphError } = await supabase.rpc(
        "get_my_family_graph",
        { p_depth: 2 }
      );

      if (graphError) {
        throw graphError;
      }

      if (!graph) {
        setMembers([]);
        return;
      }

      const nodes: any[] = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges: any[] = Array.isArray(graph.edges) ? graph.edges : [];
      const myId: string | null = graph.me ?? null;

      // Obtener las personas que ya tienen una identidad reclamada.
      const personIds = nodes
        .map((node) => node.id)
        .filter((id): id is string => Boolean(id));

      const claimedPersonIds = new Set<string>();

      if (personIds.length > 0) {
        const { data: claims, error: claimsError } = await supabase
          .from("person_claims")
          .select("person_id")
          .in("person_id", personIds)
          .eq("claim_status", "approved")
          .is("revoked_at", null);

        if (claimsError) {
          throw claimsError;
        }

        for (const claim of claims ?? []) {
          if (claim.person_id) {
            claimedPersonIds.add(claim.person_id);
          }
        }
      }

      // Nombre de la persona autenticada.
      const me = nodes.find((node) => node.id === myId);

      if (me?.first_name) {
        setMeFirstName(me.first_name);
      }

      // Parentesco: se delega en la ÚNICA lógica canónica, la misma que
      // usa /tree (resolveRelationsFromRoot). Antes se leía
      // `edge.relationship_type` en crudo sin mirar la dirección de la
      // arista, así que en una relación `parent` los HIJOS quedaban
      // etiquetados como "Tu papá/mamá" (person_a es el progenitor y
      // person_b el hijo: quién es quién depende de desde dónde se mire).
      const { byPersonId: relationsById } = resolveRelationsFromRoot({
        me: myId,
        nodes,
        edges,
      } as unknown as FamilyGraph);

      // Personas vivas, distintas del usuario y todavía sin cuenta vinculada.
      const pending: FamilyMember[] = nodes
        .filter(
          (node) =>
            node.id !== myId &&
            node.deleted_at == null &&
            node.is_deceased !== true &&
            !claimedPersonIds.has(node.id)
        )
        .map((node) => {
          const givenNames = [node.first_name, node.middle_name]
            .filter(Boolean)
            .join(" ");

          const surnames = [node.first_surname, node.second_surname]
            .filter(Boolean)
            .join(" ");

          return {
            id: node.id,
            first_names: givenNames,
            last_names: surnames,
            profile_photo_url: node.photo_path ?? null,
            phone: null,
            linked_user_id: null,
            is_living: node.is_deceased !== true,
            relation: describeRelationPossessive(relationsById.get(node.id)),
            relationPlain: describeRelation(relationsById.get(node.id)).toLowerCase(),
          };
        });

      // Personas del grafo que ya tienen una cuenta activa.
      const active = nodes
        .filter(
          (node) =>
            node.id !== myId &&
            node.deleted_at == null &&
            claimedPersonIds.has(node.id)
        )
        .slice(0, 3)
        .map((node) => node.first_name)
        .filter(Boolean);

      setPreviewNames(active);
      // Put the person from ?person= param first if they appear in the list
      const highlightId = searchParams.get("person");
      if (highlightId) {
        const idx = pending.findIndex(m => m.id === highlightId);
        if (idx > 0) {
          const [hit] = pending.splice(idx, 1);
          pending.unshift(hit);
        }
      }
      setMembers(pending);
    } catch (error) {
      console.error("Error cargando familiares para invitar:", error);
      toast.error("No se pudieron cargar los familiares");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, router]);

  useEffect(() => {
    trackEvent("invite_picker_opened" as any, {});
    loadData();
  }, [loadData]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleSent = (memberId: string, e: React.MouseEvent) => {
    const newCount = sentCount + 1;
    setSentCount(newCount);

    // Confetti
    setConfettiBurst({ x: e.clientX, y: e.clientY });
    setTimeout(() => setConfettiBurst(null), 900);

    // Modal celebración cada 5 enviadas
    if (newCount === 5) setTimeout(() => setShowModal(true), 700);

    trackEvent("invite_sent" as any, { channel: "whatsapp" });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchInvite = async () => {
    if (selected.size === 0) return;
    const confirmed = window.confirm(
      `Se abrirá WhatsApp ${selected.size} ${selected.size === 1 ? "vez" : "veces"}, una por cada familiar. ¿Continuar?`
    );
    if (!confirmed) return;

    for (const id of selected) {
      const m = members.find((mb) => mb.id === id);
      if (!m) continue;
      try {
        const result = await createInviteLink(supabase, id, template);
        const ctx = {
          inviterFirstName: meFirstName,
          invitedFirstName: m.first_names,
          invitedRelation: m.relationPlain ?? UNKNOWN_RELATION_LABEL.toLowerCase(),
          previewMembers: previewNames,
        };
        const msg = buildInviteMessage(template, ctx, result.universalLink);
        await shareInviteWhatsApp(supabase, result.invitationId, msg, m.phone || undefined);
        setSentCount((n) => n + 1);
        // Pequeña pausa para no spam
        await new Promise((r) => setTimeout(r, 600));
      } catch (_e) {
        // continuar con el siguiente
      }
    }
    setBatchMode(false);
    setSelected(new Set());
    toast.success(`¡${selected.size} invitaciones enviadas!`);
  };

  const GOAL = 5;
  const progressPct = Math.min((sentCount / GOAL) * 100, 100);

  // ============================================================
  // Empty states
  // ============================================================

  if (!loading && members.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#030208", display: "flex", flexDirection: "column" }}>
        <header style={{ background: "#0c0a18", borderBottom: "0.5px solid rgba(212,175,55,0.14)",
          padding: "52px 20px 16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(212,175,55,0.6)", padding: 4 }}>
            <ChevronLeft size={22} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TreePine size={18} style={{ color: "rgba(212,175,55,0.6)" }} />
            <h1 style={{ fontWeight: 700, fontSize: 17, color: "#fff" }}>Invita a los tuyos</h1>
          </div>
        </header>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", gap: 16, padding: "0 24px", textAlign: "center" }}>
          <Smile size={48} style={{ color: "rgba(212,175,55,0.4)" }} />
          <h2 style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>¡Toda tu familia directa ya está en Ceiba!</h2>
          <p style={{ color: "rgba(212,175,55,0.5)", maxWidth: 280, fontSize: 13, lineHeight: 1.6 }}>
            Puedes agregar a más familiares extendidos — tíos, primos, abuelos.
          </p>
          <Link href="/tree" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#c9a820",
              borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
              boxShadow: "0 6px 0 #4a3c00", borderRadius: 18,
              color: "#030208", fontWeight: 700, fontSize: 14, padding: "13px 24px", border: "none" }}>
              Agregar familiar <ChevronRight size={16} />
            </div>
          </Link>
        </div>
      </div>
    );
  }

  // ============================================================
  // Render principal
  // ============================================================

  return (
    <>
      <style>{confettiStyle}</style>
      <Toaster position="top-center" />
      {confettiBurst && <ConfettiBurst x={confettiBurst.x} y={confettiBurst.y} />}

      {/* Modal celebración */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 50,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#0c0a18", borderRadius: 24, padding: 24, maxWidth: 340, width: "100%",
            textAlign: "center", border: "1px solid rgba(212,175,55,0.15)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🌱</div>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Eres el sembrador de tu rama</h2>
            <p style={{ color: "rgba(212,175,55,0.5)", fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              Cuando 3 de ellos entren, ganas la insignia <strong style={{ color: "#d4af37" }}>Conector</strong>.
            </p>
            <button onClick={() => setShowModal(false)}
              style={{ width: "100%", background: "#c9a820", border: "none",
                borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                boxShadow: "0 6px 0 #4a3c00", borderRadius: 18, color: "#030208",
                fontWeight: 700, fontSize: 15, padding: "13px 0", cursor: "pointer" }}>
              Seguir
            </button>
          </div>
        </div>
      )}

      <div style={{ minHeight: "100vh", background: "#030208", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", width: "100%" }}>
        {/* Header */}
        <header style={{ background: "rgba(12,10,24,0.97)", borderBottom: "0.5px solid rgba(212,175,55,0.14)",
          padding: "52px 20px 14px", position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(10px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <button onClick={() => router.back()} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(212,175,55,0.6)", padding: 4, flexShrink: 0 }}>
              <ChevronLeft size={22} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TreePine size={16} style={{ color: "rgba(212,175,55,0.6)" }} />
                <h1 style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Invita a los tuyos</h1>
              </div>
              <p style={{ color: "rgba(212,175,55,0.4)", fontSize: 11, marginTop: 2 }}>Cuando entren, ya verán el árbol lleno.</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#d4af37" }}>{sentCount} / {GOAL}</p>
              <p style={{ fontSize: 10, color: "rgba(212,175,55,0.4)" }}>enviadas</p>
            </div>
          </div>
          <div style={{ width: "100%", height: 3, background: "rgba(212,175,55,0.1)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "#c9a820", borderRadius: 100,
              transition: "width 0.5s ease", width: `${progressPct}%` }} />
          </div>
        </header>

        {/* Subheader acciones */}
        <div style={{ background: "#0a0816", borderBottom: "0.5px solid rgba(212,175,55,0.1)",
          padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 13, color: "rgba(212,175,55,0.5)" }}>
            <strong style={{ color: "#fff" }}>{members.length}</strong> sin registrar
          </p>
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelected(new Set());
              if (!batchMode) trackEvent("batch_invite_opened" as any, {});
            }}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
              padding: "7px 12px", borderRadius: 9, cursor: "pointer",
              background: batchMode ? "rgba(212,175,55,0.12)" : "transparent",
              border: `1px solid ${batchMode ? "rgba(212,175,55,0.25)" : "transparent"}`,
              color: "rgba(212,175,55,0.6)" }}
          >
            <Users size={14} />
            {batchMode ? "Cancelar" : "Seleccionar varios"}
          </button>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, padding: "16px 16px", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 120 }}>
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 100, borderRadius: 18, background: "#0c0a18", opacity: 0.4 }} />
              ))
            : members.map((m, i) => (
                <div key={m.id}>
                  {i === 0 && highlightPersonId && m.id === highlightPersonId && (
                    <p className="text-xs font-semibold text-ceiba-600 mb-1 px-1">
                      Seleccionado desde el árbol
                    </p>
                  )}
                  <MemberCard
                    member={m}
                    batchMode={batchMode}
                    isSelected={selected.has(m.id)}
                    inviterFirstName={meFirstName}
                    previewNames={previewNames}
                    template={template}
                    onSent={handleSent}
                    onToggleSelect={toggleSelect}
                  />
                </div>
              ))}
        </div>

        {/* Footer flotante */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
          background: "rgba(12,10,24,0.97)", borderTop: "0.5px solid rgba(212,175,55,0.14)",
          padding: "12px 16px 28px", display: "flex", flexDirection: "column", gap: 8,
          backdropFilter: "blur(12px)" }}>
          {batchMode && selected.size > 0 ? (
            <button onClick={handleBatchInvite}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, background: "#25D366", border: "none", borderRadius: 18, color: "#fff",
                fontWeight: 700, fontSize: 15, padding: "14px 0", cursor: "pointer" }}>
              <Send size={17} />
              Invitar a {selected.size} por WhatsApp
            </button>
          ) : sentCount >= 3 ? (
            <Link href="/tree" style={{ textDecoration: "none" }}>
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
                boxShadow: "0 6px 0 #4a3c00", borderRadius: 18, color: "#030208",
                fontWeight: 700, fontSize: 15, padding: "13px 0" }}>
                <TreePine size={17} /> Ver mi árbol <ChevronRight size={17} />
              </div>
            </Link>
          ) : (
            <p style={{ textAlign: "center", color: "rgba(212,175,55,0.4)", fontSize: 12, padding: "4px 0" }}>
              Invita a 3 personas para desbloquear la insignia Conector 🌿
            </p>
          )}
          <Link href="/tree"
            style={{ textAlign: "center", color: "rgba(212,175,55,0.35)", fontSize: 12,
              padding: "4px 0", textDecoration: "none", display: "block" }}>
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

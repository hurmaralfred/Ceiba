"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  relation?: string;          // relación relativa al usuario
}

type CardState = "idle" | "loading" | "sent" | "adding_phone";

// ============================================================
// Helpers
// ============================================================

function relationLabel(rel: string): string {
  const map: Record<string, string> = {
    parent: "Tu papá/mamá",
    child: "Tu hijo/a",
    sibling: "Tu hermano/a",
    spouse: "Tu pareja",
    grandparent: "Tu abuelo/a",
    grandchild: "Tu nieto/a",
    uncle_aunt: "Tu tío/a",
    nephew_niece: "Tu sobrino/a",
    cousin: "Tu primo/a",
    family: "Tu familiar",
  };
  return map[rel] ?? "Tu familiar";
}

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
        invitedRelation: member.relation ?? "familiar",
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
        invitedRelation: member.relation ?? "familiar",
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
            <p className="text-ceiba-500 text-sm">{relationLabel(member.relation)}</p>
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

export default function InvitarPage() {
  const supabase = createClient();
  const router = useRouter();

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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth/login"); return; }

      // Mi persona
      const { data: me } = await supabase
        .from("persons")
        .select("first_names, last_names")
        .eq("linked_user_id", user.id)
        .maybeSingle();
      if (me) setMeFirstName(me.first_names);

      // Grafo familiar
      const { data: graph } = await supabase.rpc("get_my_family_graph", { depth: 2 });
      if (!graph) { setLoading(false); return; }

      const nodes: any[] = graph.nodes ?? [];
      const edges: any[] = graph.edges ?? [];
      const myId = graph.me;

      // Mapear relaciones para cada nodo
      const relationMap = new Map<string, string>();
      for (const e of edges) {
        if (e.person_a_id === myId) relationMap.set(e.person_b_id, e.relation_type ?? "family");
        else if (e.person_b_id === myId) relationMap.set(e.person_a_id, e.relation_type ?? "family");
      }

      // Filtrar: no vinculados, vivos, no son yo
      const pending = nodes
        .filter((n) => n.id !== myId && !n.linked_user_id && n.is_living !== false)
        .map((n) => ({
          id: n.id,
          first_names: n.first_names,
          last_names: n.last_names ?? "",
          profile_photo_url: n.profile_photo_url ?? null,
          phone: n.phone ?? null,
          linked_user_id: n.linked_user_id,
          is_living: n.is_living,
          relation: relationMap.get(n.id) ?? "family",
        }));

      // Preview: nombres de los que SÍ están activos
      const active = nodes
        .filter((n) => n.id !== myId && n.linked_user_id)
        .slice(0, 3)
        .map((n) => n.first_names);
      setPreviewNames(active);

      setMembers(pending);
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
          invitedRelation: m.relation ?? "familiar",
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
      <div className="min-h-screen bg-cream-100 flex flex-col">
        <header className="bg-cream-50 border-b px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-ceiba-500 hover:text-ceiba-900">
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <TreePine size={20} className="text-ceiba-600" />
            <h1 className="font-bold text-lg text-ceiba-900">Invita a los tuyos</h1>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Smile size={48} className="text-ceiba-500" />
          <h2 className="text-xl font-bold text-ceiba-900">¡Toda tu familia directa ya está en Ceiba!</h2>
          <p className="text-ceiba-500 max-w-xs">
            Puedes agregar a más familiares extendidos — tíos, primos, abuelos.
          </p>
          <Link
            href="/tree"
            className="flex items-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-3 px-6 rounded-2xl"
          >
            Agregar familiar
            <ChevronRight size={18} />
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-cream-50 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl">
            <div className="text-4xl mb-3">🌱</div>
            <h2 className="text-xl font-bold mb-2">Eres el sembrador de tu rama</h2>
            <p className="text-ceiba-500 text-sm mb-5">
              Cuando 3 de ellos entren, ganas la insignia <strong>Conector</strong>.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-3 rounded-2xl"
            >
              Seguir
            </button>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-cream-100 flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <header className="bg-cream-50 border-b px-4 pt-4 pb-3 sticky top-0 z-20">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => router.back()} className="text-ceiba-500 hover:text-ceiba-900">
              <ChevronLeft size={24} />
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <TreePine size={18} className="text-ceiba-600" />
                <h1 className="font-bold text-lg text-ceiba-900">Invita a los tuyos</h1>
              </div>
              <p className="text-ceiba-500 text-xs">Cuando entren, ya verán el árbol lleno.</p>
            </div>
            {/* Contador */}
            <div className="text-right">
              <p className="text-sm font-bold text-ceiba-700">
                {sentCount} / {GOAL}
              </p>
              <p className="text-xs text-ceiba-400">enviadas</p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-ceiba-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        {/* Subheader acciones */}
        <div className="bg-cream-50 border-b px-4 py-2 flex items-center justify-between">
          <p className="text-sm text-ceiba-500">
            <strong className="text-ceiba-800">{members.length}</strong> sin registrar
          </p>
          <button
            onClick={() => {
              setBatchMode(!batchMode);
              setSelected(new Set());
              if (!batchMode) trackEvent("batch_invite_opened" as any, {});
            }}
            className={`flex items-center gap-1.5 text-sm font-medium py-1.5 px-3 rounded-lg transition-colors ${
              batchMode
                ? "bg-ceiba-100 text-ceiba-700"
                : "text-ceiba-600 hover:bg-ceiba-50"
            }`}
          >
            <Users size={15} />
            {batchMode ? "Cancelar" : "Seleccionar varios"}
          </button>
        </div>

        {/* Lista */}
        <div className="flex-1 px-4 py-4 flex flex-col gap-3 pb-32">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-cream-50 rounded-2xl h-28 animate-pulse" />
              ))
            : members.map((m) => (
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
                />
              ))}
        </div>

        {/* Footer flotante */}
        <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-cream-50 border-t px-4 py-4 flex flex-col gap-2 shadow-xl">
          {batchMode && selected.size > 0 ? (
            <button
              onClick={handleBatchInvite}
              className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5c] text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              <Send size={18} />
              Invitar a {selected.size} por WhatsApp
            </button>
          ) : sentCount >= 3 ? (
            <Link
              href="/tree"
              className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              <TreePine size={18} />
              Ver mi árbol
              <ChevronRight size={18} />
            </Link>
          ) : (
            <p className="text-center text-ceiba-400 text-sm py-1">
              Invita a 3 personas para desbloquear la insignia Conector 🌿
            </p>
          )}
          <Link
            href="/tree"
            className="w-full text-center text-ceiba-400 hover:text-ceiba-600 text-sm py-1"
          >
            Invitar más tarde
          </Link>
        </div>
      </div>
    </>
  );
}

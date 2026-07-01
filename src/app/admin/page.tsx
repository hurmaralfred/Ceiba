"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserCheck, GitFork, Trash2, Link2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS } from "@/lib/types";
import type { RelationType } from "@/lib/types";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

// ── Normalization helper ──────────────────────────────────────
const norm = (s: string) =>
  (s || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim();

const normW = (s: string) => norm(s).split(" ")[0];

const label = (rel: string) =>
  RELATION_LABELS[rel as RelationType] ?? rel;

// ── Types ─────────────────────────────────────────────────────
interface Member {
  id: string;
  first_name: string;
  last_name: string | null;
  relation_type: string;
  profile_id: string | null;
  parent_member_id: string | null;
  is_deceased: boolean | null;
  person_id: string | null;
}

interface SamePersonCandidate {
  direct: Member;
  ext: { id: string; first_name: string; last_name: string | null; relation_type: string; added_by: string; person_id: string | null };
  connectorName: string;
}

interface ProfileCandidate {
  member: Member;
  profile: { id: string; first_name: string; last_name: string | null; avatar_url: string | null };
}

interface OrphanEntry {
  member: Member;
  candidates: Member[]; // possible parents (siblings, uncles of user)
}

interface DupEntry {
  a: Member;
  b: Member;
}

const NEEDS_PARENT: RelationType[] = ["nephew", "niece", "grandson", "granddaughter"];

// ── Main page ─────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"unlinked" | "orphans" | "dupes" | "same_person">("unlinked");
  const [unlinked, setUnlinked] = useState<ProfileCandidate[]>([]);
  const [orphans, setOrphans] = useState<OrphanEntry[]>([]);
  const [dupes, setDupes] = useState<DupEntry[]>([]);
  const [samePerson, setSamePerson] = useState<SamePersonCandidate[]>([]);
  const [working, setWorking] = useState<string | null>(null);
  const [myMembers, setMyMembers] = useState<Member[]>([]);

  useEffect(() => { loadAll(); }, []);

  // ── Load ───────────────────────────────────────────────────
  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    // All user's direct members
    const { data: members } = await supabase
      .from("family_members")
      .select("id, first_name, last_name, relation_type, profile_id, parent_member_id, is_deceased, person_id")
      .eq("added_by", user.id);

    if (!members) { setLoading(false); return; }
    setMyMembers(members);

    // ── 1. Sin vincular: profile_id null but name matches a Ceiba profile ──
    const unlinkedMembers = members.filter(m => !m.profile_id);
    const candidateList: ProfileCandidate[] = [];

    for (const m of unlinkedMembers) {
      const fn = normW(m.first_name);
      if (fn.length < 3) continue;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .ilike("first_name", `${m.first_name.split(" ")[0]}%`)
        .neq("id", user.id)
        .limit(5);

      const match = (profiles || []).find(p => {
        const pfn = normW(p.first_name || "");
        const pln = normW(p.last_name || "");
        const mfn = normW(m.first_name);
        const mln = normW(m.last_name || "");
        return pfn === mfn && (mln.length < 2 || pln.length < 2 || pln === mln);
      });

      if (match) candidateList.push({ member: m, profile: match });
    }
    setUnlinked(candidateList);

    // ── 2. Sin padre: nephew/niece/grandson/granddaughter sin parent_member_id ──
    const PARENT_TYPES = new Set(["brother", "sister", "half_brother", "half_sister",
      "uncle", "aunt", "son", "daughter", "father", "mother"]);

    const orphanList: OrphanEntry[] = members
      .filter(m => NEEDS_PARENT.includes(m.relation_type as RelationType) && !m.parent_member_id)
      .map(m => ({
        member: m,
        candidates: members.filter(pm => PARENT_TYPES.has(pm.relation_type) && pm.id !== m.id),
      }));
    setOrphans(orphanList);

    // ── 3. Duplicados en árbol propio (misma primera palabra del nombre) ──
    const seen = new Map<string, Member>();
    const dupeList: DupEntry[] = [];
    for (const m of members) {
      const key = `${normW(m.first_name)}|${normW(m.last_name || "")}`;
      if (seen.has(key)) {
        dupeList.push({ a: seen.get(key)!, b: m });
      } else {
        seen.set(key, m);
      }
    }
    setDupes(dupeList);

    // ── 4. Misma persona: direct member vs. extended member with same name ──
    // Cross-tree duplicates: someone appears in my direct tree AND in a connected tree.
    const joinedProfileIds = members.filter(m => m.profile_id).map(m => m.profile_id!);
    if (joinedProfileIds.length > 0) {
      const { data: extMembers } = await supabase
        .from("family_members")
        .select("id, first_name, last_name, relation_type, added_by, person_id")
        .in("added_by", joinedProfileIds);

      const candidates: SamePersonCandidate[] = [];
      const seen = new Set<string>(); // avoid showing same pair twice

      for (const direct of members) {
        const dfn = normW(direct.first_name);
        const dln = normW(direct.last_name || "");
        if (dfn.length < 3) continue;

        for (const ext of extMembers || []) {
          // Already linked to same person — not a candidate
          if (direct.person_id && ext.person_id && direct.person_id === ext.person_id) continue;
          const efn = normW(ext.first_name);
          const eln = normW(ext.last_name || "");
          // Name match: first word of first name must match; last name must match if both present
          if (dfn !== efn) continue;
          if (dln.length >= 3 && eln.length >= 3 && dln !== eln) continue;

          const pairKey = [direct.id, ext.id].sort().join("|");
          if (seen.has(pairKey)) continue;
          seen.add(pairKey);

          const connector = members.find(m => m.profile_id === ext.added_by);
          candidates.push({
            direct,
            ext,
            connectorName: connector
              ? `${connector.first_name}${connector.last_name ? " " + connector.last_name : ""}`
              : "un familiar",
          });
        }
      }
      setSamePerson(candidates);
    } else {
      setSamePerson([]);
    }

    setLoading(false);
  };

  // ── Actions ────────────────────────────────────────────────
  const linkProfile = async (memberId: string, profileId: string) => {
    setWorking(memberId);
    const { error } = await supabase
      .from("family_members")
      .update({ profile_id: profileId })
      .eq("id", memberId);
    if (error) { toast.error("Error al vincular"); }
    else { toast.success("Vinculado correctamente ✓"); await loadAll(); }
    setWorking(null);
  };

  const assignParent = async (memberId: string, parentId: string) => {
    setWorking(memberId);
    const { error } = await supabase
      .from("family_members")
      .update({ parent_member_id: parentId })
      .eq("id", memberId);
    if (error) { toast.error("Error al asignar"); }
    else { toast.success("Padre asignado ✓"); await loadAll(); }
    setWorking(null);
  };

  const linkPersons = async (directId: string, extId: string) => {
    const key = directId + extId;
    setWorking(key);
    const { error } = await supabase.rpc("link_persons", { member_id_a: directId, member_id_b: extId });
    if (error) { toast.error("Error: " + error.message); }
    else { toast.success("Vinculados como la misma persona ✓"); await loadAll(); }
    setWorking(null);
  };

  const dismissSamePerson = (directId: string, extId: string) => {
    setSamePerson(prev => prev.filter(c => !(c.direct.id === directId && c.ext.id === extId)));
  };

  const deleteMember = async (memberId: string) => {
    if (!confirm("¿Eliminar este familiar de tu árbol?")) return;
    setWorking(memberId);
    const { error } = await supabase
      .from("family_members")
      .delete()
      .eq("id", memberId);
    if (error) { toast.error("Error al eliminar"); }
    else { toast.success("Eliminado ✓"); await loadAll(); }
    setWorking(null);
  };

  // ── UI ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw size={28} className="text-ceiba-600 animate-spin" />
    </div>
  );

  const tabs = [
    { id: "unlinked",    label: "Sin vincular",   count: unlinked.length },
    { id: "orphans",     label: "Sin padre",      count: orphans.length },
    { id: "dupes",       label: "Duplicados",     count: dupes.length },
    { id: "same_person", label: "Misma persona",  count: samePerson.length },
  ] as const;

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg sticky top-0 z-10">
        <Link href="/tree" className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="font-display text-lg font-bold">Reparar árbol</div>
          <div className="text-ceiba-300 text-xs">Corrige conexiones rotas</div>
        </div>
        <button onClick={loadAll} className="ml-auto p-2 rounded-lg hover:bg-ceiba-700 text-ceiba-300">
          <RefreshCw size={16} />
        </button>
      </nav>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100 px-4 gap-1 sticky top-[68px] z-10">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === t.id
                ? "border-ceiba-600 text-ceiba-700"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold ${
                tab === t.id ? "bg-ceiba-100 text-ceiba-700" : "bg-gray-100 text-gray-500"
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">

        {/* ── TAB 1: Sin vincular ─────────────────────────────── */}
        {tab === "unlinked" && (
          <>
            {unlinked.length === 0 ? (
              <EmptyState
                icon={<UserCheck size={32} className="text-ceiba-500" />}
                title="Todo vinculado"
                desc="Todos tus familiares registrados en Ceiba están correctamente conectados."
              />
            ) : (
              <>
                <p className="text-xs text-gray-500 px-1">
                  Estos familiares ya se registraron en Ceiba pero su perfil no está enlazado a tu árbol.
                  Al vincularlos, sus familias aparecerán en tu red extendida y el árbol se actualizará.
                </p>
                {unlinked.map(({ member: m, profile: p }) => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-ceiba-100 flex items-center justify-center text-ceiba-700 font-bold text-sm flex-shrink-0">
                        {p.avatar_url
                          ? <img src={p.avatar_url} className="w-full h-full rounded-full object-cover" />
                          : (p.first_name[0] + (p.last_name?.[0] || "")).toUpperCase()
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {m.first_name} {m.last_name}
                        </div>
                        <div className="text-xs text-gray-400">{label(m.relation_type)}</div>
                      </div>
                      {/* Badge */}
                      <div className="text-xs text-ceiba-600 font-semibold bg-ceiba-50 px-2 py-1 rounded-lg flex-shrink-0">
                        En Ceiba
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 text-xs text-gray-500">
                        Perfil encontrado: <span className="font-semibold text-gray-700">{p.first_name} {p.last_name}</span>
                      </div>
                      <button
                        onClick={() => linkProfile(m.id, p.id)}
                        disabled={working === m.id}
                        className="flex items-center gap-1.5 bg-ceiba-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-ceiba-700 disabled:opacity-50 transition-colors"
                      >
                        <Link2 size={13} />
                        {working === m.id ? "Vinculando..." : "Vincular"}
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── TAB 2: Sin padre ────────────────────────────────── */}
        {tab === "orphans" && (
          <>
            {orphans.length === 0 ? (
              <EmptyState
                icon={<GitFork size={32} className="text-ceiba-500" />}
                title="Conexiones completas"
                desc="Todos tus sobrinos, nietos y similares tienen su familiar de referencia asignado."
              />
            ) : (
              <>
                <p className="text-xs text-gray-500 px-1">
                  Estos familiares no tienen padre/madre de referencia. Sin eso, el árbol no sabe de qué rama vienen.
                  Asigna quién es el padre o hermano por el que se conectan.
                </p>
                {orphans.map(({ member: m, candidates }) => (
                  <div key={m.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    <div>
                      <div className="font-semibold text-gray-900">{m.first_name} {m.last_name}</div>
                      <div className="text-xs text-gray-400">{label(m.relation_type)} · sin rama asignada</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1.5">¿Por quién se conecta?</div>
                      <div className="flex flex-wrap gap-2">
                        {candidates.slice(0, 8).map(c => (
                          <button
                            key={c.id}
                            onClick={() => assignParent(m.id, c.id)}
                            disabled={working === m.id}
                            className="text-xs font-semibold bg-gray-100 hover:bg-ceiba-100 hover:text-ceiba-700 text-gray-600 px-3 py-1.5 rounded-xl transition-colors disabled:opacity-50"
                          >
                            {c.first_name} ({label(c.relation_type)})
                          </button>
                        ))}
                        {candidates.length === 0 && (
                          <span className="text-xs text-gray-400">No hay candidatos — agrega primero al padre/madre</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── TAB 3: Duplicados ───────────────────────────────── */}
        {tab === "dupes" && (
          <>
            {dupes.length === 0 ? (
              <EmptyState
                icon={<Trash2 size={32} className="text-ceiba-500" />}
                title="Sin duplicados"
                desc="No hay personas repetidas en tu árbol directo."
              />
            ) : (
              <>
                <p className="text-xs text-gray-500 px-1">
                  Estas personas aparecen dos veces en tu árbol. Elimina la que tiene menos información.
                </p>
                {dupes.map(({ a, b }) => (
                  <div key={`${a.id}-${b.id}`} className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 space-y-3">
                    <div className="text-xs font-semibold text-amber-700 mb-1">⚠️ Posible duplicado</div>
                    {[a, b].map(m => (
                      <div key={m.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-800 text-sm">{m.first_name} {m.last_name}</div>
                          <div className="text-xs text-gray-400">
                            {label(m.relation_type)}
                            {m.profile_id && <span className="ml-2 text-ceiba-600">· En Ceiba</span>}
                            {m.is_deceased && <span className="ml-2 text-gray-400">· Fallecido</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteMember(m.id)}
                          disabled={working === m.id}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 disabled:opacity-50 transition-colors"
                          title="Eliminar este registro"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-400">
                      Mantén el que tiene más datos o está vinculado a Ceiba. El otro puedes eliminarlo.
                    </p>
                  </div>
                ))}
              </>
            )}
          </>
        )}

        {/* ── TAB 4: Misma persona ────────────────────────────── */}
        {tab === "same_person" && (
          <>
            {samePerson.length === 0 ? (
              <EmptyState
                icon={<Link2 size={32} className="text-ceiba-500" />}
                title="Sin duplicados cruzados"
                desc="No se detectaron personas que aparezcan tanto en tu árbol como en el árbol de tus familiares."
              />
            ) : (
              <>
                <p className="text-xs text-gray-500 px-1">
                  Estas personas aparecen en <strong>tu árbol directo</strong> y también en el árbol de un familiar.
                  Si son la misma persona real, vincúlalas — así solo aparecen una vez en el árbol.
                </p>
                {samePerson.map(({ direct: d, ext: e, connectorName }) => {
                  const key = d.id + e.id;
                  return (
                    <div key={key} className="bg-white rounded-2xl p-4 shadow-sm border border-ceiba-100 space-y-3">
                      <div className="text-xs font-semibold text-ceiba-700 mb-1">🔗 Posible persona duplicada</div>

                      {/* Direct member */}
                      <div className="bg-ceiba-50 rounded-xl px-3 py-2.5">
                        <div className="text-[10px] font-bold text-ceiba-600 uppercase tracking-wide mb-1">En tu árbol</div>
                        <div className="font-semibold text-gray-900 text-sm">{d.first_name} {d.last_name}</div>
                        <div className="text-xs text-gray-500">{label(d.relation_type)}</div>
                      </div>

                      {/* Extended member */}
                      <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">En el árbol de {connectorName}</div>
                        <div className="font-semibold text-gray-900 text-sm">{e.first_name} {e.last_name}</div>
                        <div className="text-xs text-gray-500">{label(e.relation_type)}</div>
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => linkPersons(d.id, e.id)}
                          disabled={working === key}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-ceiba-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-ceiba-700 disabled:opacity-50 transition-colors"
                        >
                          <Link2 size={13} />
                          {working === key ? "Vinculando..." : "Son la misma persona"}
                        </button>
                        <button
                          onClick={() => dismissSamePerson(d.id, e.id)}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                        >
                          No, son distintas
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

      </div>
      <BottomNav />
    </main>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
      <div className="w-16 h-16 rounded-2xl bg-ceiba-50 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <div className="font-bold text-gray-800 mb-1">{title}</div>
        <div className="text-sm text-gray-400 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
}

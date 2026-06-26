"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TreePine, MapPin, Users, Share2, LogOut, User, Send, List, GitFork, Plus, X, Pencil, Map } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RelationType, RELATION_LABELS } from "@/lib/types";
import { ExtendedEntry } from "@/components/tree/FamilyTreeGraph";

// Infer my relation to an extended member based on the parent's relation to me
function inferRelation(parentRelation: RelationType, childRelation: string): string | null {
  switch (parentRelation) {
    case "spouse": case "partner":
      if (childRelation === "son") return "son";
      if (childRelation === "daughter") return "daughter";
      if (childRelation === "stepchild") return "stepchild";
      break;
    case "brother": case "sister":
    case "half_brother": case "half_sister":
      if (childRelation === "son") return "nephew";
      if (childRelation === "daughter") return "niece";
      break;
    case "father": case "mother":
      if (childRelation === "son") return "brother";
      if (childRelation === "daughter") return "sister";
      break;
    case "son": case "daughter":
      if (childRelation === "son") return "grandson";
      if (childRelation === "daughter") return "granddaughter";
      break;
    case "uncle": case "aunt":
      if (childRelation === "son" || childRelation === "daughter") return "cousin";
      break;
    case "grandfather_paternal": case "grandfather_maternal":
    case "grandmother_paternal": case "grandmother_maternal":
      if (childRelation === "son") return "uncle";
      if (childRelation === "daughter") return "aunt";
      break;
  }
  return null;
}
import InstallBanner from "@/components/InstallBanner";
import SuggestionCards from "@/components/SuggestionCards";
import NameMatchCards from "@/components/NameMatchCards";
import toast from "react-hot-toast";

const FamilyTreeGraph = dynamic(
  () => import("@/components/tree/FamilyTreeGraph"),
  { ssr: false, loading: () => <div className="w-full h-[520px] rounded-2xl bg-gray-100 animate-pulse" /> }
);

const MapView = dynamic(
  () => import("@/components/map/MapView"),
  { ssr: false, loading: () => <div className="w-full h-[520px] rounded-2xl bg-gray-100 animate-pulse" /> }
);

const RELATION_GROUPS = [
  {
    label: "Familia directa (sangre)",
    kind: "blood" as const,
    options: ["father","mother","brother","sister","half_brother","half_sister","son","daughter","grandfather_paternal","grandmother_paternal","grandfather_maternal","grandmother_maternal","grandson","granddaughter","uncle","aunt","cousin"] as RelationType[],
  },
  {
    label: "Familia política (afinidad)",
    kind: "affinity" as const,
    options: ["spouse","partner","father_in_law","mother_in_law","brother_in_law","sister_in_law","stepfather","stepmother","stepchild"] as RelationType[],
  },
];

const EMPTY_FORM = { first_name: "", last_name: "", email: "", relation_type: "father" as RelationType };

export default function TreePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [extendedMembers, setExtendedMembers] = useState<ExtendedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"graph" | "list" | "map">("graph");
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") { subscribeUser(); return; }
    if (Notification.permission === "denied") return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") subscribeUser();
  };

  const subscribeUser = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {}
  };

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const [{ data: profileData }, { data: membersData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("family_members").select("*").eq("added_by", user.id),
    ]);

    const myMembers = membersData || [];
    setProfile(profileData);

    // Enrich members with profile data (avatar, social_link) for those who've joined
    const profileIds = myMembers.map(m => m.profile_id).filter(Boolean) as string[];
    let enrichedMembers = myMembers;
    if (profileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, avatar_url, social_link, latitude, longitude, city, country")
        .in("id", profileIds);
      if (profilesData) {
        const profileMap = Object.fromEntries(profilesData.map(p => [p.id, p]));
        enrichedMembers = myMembers.map(m => ({
          ...m,
          profile: m.profile_id ? profileMap[m.profile_id] : undefined,
        }));
      }
    }
    setMembers(enrichedMembers);

    // Load extended network: family members of family who've joined Ceiba
    const joinedMembers = myMembers.filter(m => m.profile_id);
    if (joinedMembers.length > 0) {
      const joinedProfileIds = joinedMembers.map(m => m.profile_id!);
      const { data: extData } = await supabase
        .from("family_members")
        .select("*")
        .in("added_by", joinedProfileIds);

      if (extData && extData.length > 0) {
        const myMemberIds = new Set(myMembers.map(m => m.profile_id).filter(Boolean));
        const myMemberNames = new Set(
          myMembers.map(m => `${m.first_name.toLowerCase()}|${(m.last_name || "").toLowerCase()}`)
        );
        const extended: ExtendedEntry[] = extData
          .filter(em => {
            if (em.profile_id === user.id) return false;
            if (myMemberIds.has(em.profile_id)) return false;
            const nameKey = `${em.first_name.toLowerCase()}|${(em.last_name || "").toLowerCase()}`;
            if (myMemberNames.has(nameKey)) return false;
            return true;
          })
          .map(em => {
            const parentMember = joinedMembers.find(m => m.profile_id === em.added_by);
            const inferredRelation = parentMember
              ? inferRelation(parentMember.relation_type as RelationType, em.relation_type)
              : null;
            return {
              member: em as FamilyMember,
              parentMemberId: parentMember!.id,
              inferredRelation,
            };
          });
        setExtendedMembers(extended);
      }
    }

    setLoading(false);
  };

  const saveMember = async () => {
    if (!form.first_name.trim()) { toast.error("El nombre es obligatorio"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);
    const kind = RELATION_GROUPS[0].options.includes(form.relation_type) ? "blood" : "affinity";
    const { data: inserted, error } = await supabase.from("family_members").insert({
      added_by: user.id,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      relation_type: form.relation_type,
      relation_kind: kind,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }

    // Generate suggestions for connected family members
    if (inserted) {
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || "",
          relation_type: form.relation_type,
          family_member_id: inserted.id,
        }),
      }).catch(() => {});
    }

    toast.success("Familiar agregado");
    setShowModal(false);
    setForm(EMPTY_FORM);
    loadData();
  };

  const openEdit = (member: FamilyMember) => {
    setEditingMember(member);
    setForm({
      first_name: member.first_name,
      last_name: member.last_name || "",
      email: member.email || "",
      relation_type: member.relation_type as RelationType,
    });
    setShowModal(true);
  };

  const updateMember = async () => {
    if (!editingMember || !form.first_name.trim()) return;
    setSaving(true);
    const kind = RELATION_GROUPS[0].options.includes(form.relation_type) ? "blood" : "affinity";
    const { error } = await supabase.from("family_members").update({
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim() || null,
      email: form.email.trim() || null,
      relation_type: form.relation_type,
      relation_kind: kind,
    }).eq("id", editingMember.id);
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Familiar actualizado");
    setShowModal(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
    loadData();
  };

  const deleteMember = async () => {
    if (!editingMember) return;
    if (!confirm(`¿Eliminar a ${editingMember.first_name} ${editingMember.last_name || ""}?`)) return;
    const { error } = await supabase.from("family_members").delete().eq("id", editingMember.id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Familiar eliminado");
    setShowModal(false);
    setEditingMember(null);
    setForm(EMPTY_FORM);
    loadData();
  };

  const sendInvite = async (member: FamilyMember) => {
    if (!member.email) { toast.error("Este familiar no tiene correo registrado"); return; }
    const { data, error } = await supabase
      .from("invitations")
      .insert({ invited_by: profile!.id, family_member_id: member.id, email: member.email, relation_type: member.relation_type })
      .select("token").single();
    if (error) { toast.error("Error al generar invitación"); return; }
    const inviteLink = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("¡Enlace copiado! Compártelo con tu familiar.");
    await supabase.from("family_members").update({ invitation_sent: true, invitation_sent_at: new Date().toISOString() }).eq("id", member.id);
    loadData();
  };

  const logout = async () => { await supabase.auth.signOut(); router.push("/"); };

  const activateMap = () => {
    setView("map");
    if (myLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setMyLocation(loc);
        // Save location to profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({
            latitude: loc[0],
            longitude: loc[1],
            location_enabled: true,
            location_updated_at: new Date().toISOString(),
          }).eq("id", user.id);
        }
      },
      () => {} // denied — no problem, map shows relatives only
    );
  };

  if (loading) return <LoadingScreen />;

  const bloodMembers = members.filter(m => m.relation_kind === "blood");
  const affinityMembers = members.filter(m => m.relation_kind === "affinity");
  const joinedMembers = members.filter(m => m.profile_id);
  const pendingMembers = members.filter(m => !m.profile_id);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-ceiba-800 text-white px-6 py-4 flex items-center justify-between shadow-lg">
        <Link href="/tree" className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={24} className="text-ceiba-300" /> Ceiba
        </Link>
        <div className="flex items-center gap-3">
          <InstallBanner />
          <Link href="/map" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <MapPin size={16} /> Mapa
          </Link>
          <Link href="/invite" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Share2 size={16} /> Invitar
          </Link>
          <Link href="/profile" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <User size={16} />
          </Link>
          <button onClick={logout} className="text-ceiba-400 hover:text-white transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Profile header */}
        {profile && (
          <div className="card mb-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-ceiba-700 flex-shrink-0 overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.first_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                  {profile.first_name[0]}{profile.last_name[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-gray-900">{profile.first_name} {profile.last_name}</h1>
              {profile.city && <p className="text-gray-500 text-sm">{profile.city}{profile.country ? `, ${profile.country}` : ""}</p>}
              {profile.social_link && (
                <a href={profile.social_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline truncate block">
                  🔗 {profile.social_link.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                </a>
              )}
              <div className="flex gap-3 mt-2 text-sm">
                <span className="text-ceiba-700 font-semibold">{members.length} familiares</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{joinedMembers.length} en Ceiba</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{pendingMembers.length} por unirse</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-ceiba-100 text-ceiba-800 hover:bg-ceiba-200 font-semibold text-sm px-3 py-2 rounded-xl transition-colors"
              >
                <Plus size={16} /> Agregar
              </button>
              <Link href="/invite" className="btn-primary text-sm flex items-center gap-2">
                <Share2 size={16} /> Invitar
              </Link>
            </div>
          </div>
        )}

        {/* Suggestions */}
        <NameMatchCards onAccepted={loadData} />
        <SuggestionCards onAccepted={loadData} />

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Familiares directos" value={bloodMembers.length} color="ceiba" />
          <StatCard label="Familia política" value={affinityMembers.length} color="earth" />
          <StatCard label="En Ceiba" value={joinedMembers.length} color="blue" />
        </div>

        {/* Family list / graph */}
        {members.length === 0 ? (
          <div className="card text-center py-12">
            <Users size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Tu árbol está vacío</h3>
            <p className="text-gray-400 mb-6">Agrega familiares para empezar a construir tu red.</p>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Agregar familiar
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* View toggle + add button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-ceiba-700 text-white hover:bg-ceiba-800 font-semibold text-sm px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={15} /> Agregar familiar
              </button>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setView("graph")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === "graph" ? "bg-ceiba-700 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <GitFork size={15} /> Árbol
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === "list" ? "bg-ceiba-700 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <List size={15} /> Lista
                </button>
                <button
                  onClick={activateMap}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    view === "map" ? "bg-ceiba-700 text-white" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Map size={15} /> Mapa
                </button>
              </div>
            </div>

            {view === "graph" && profile && (
              <FamilyTreeGraph profile={profile} members={members} extendedMembers={extendedMembers} />
            )}

            {view === "list" && (
              <div className="space-y-6">
                {bloodMembers.length > 0 && (
                  <MemberGroup title="Familia de sangre" members={bloodMembers} onInvite={sendInvite} onEdit={openEdit} kind="blood" />
                )}
                {affinityMembers.length > 0 && (
                  <MemberGroup title="Familia política" members={affinityMembers} onInvite={sendInvite} onEdit={openEdit} kind="affinity" />
                )}
              </div>
            )}

            {view === "map" && (
              <div className="rounded-2xl overflow-hidden" style={{ height: "520px" }}>
                <MapView
                  myLocation={myLocation}
                  relatives={[
                    ...(profile?.latitude && profile?.longitude ? [{
                      profile_id: profile.id,
                      first_name: profile.first_name,
                      last_name: profile.last_name,
                      avatar_url: profile.avatar_url,
                      latitude: profile.latitude,
                      longitude: profile.longitude,
                      city: profile.city,
                      country: profile.country,
                      relation_path: [],
                      depth: 0,
                      location_enabled: true,
                    }] : []),
                    ...members
                      .filter(m => (m as any).profile?.latitude && (m as any).profile?.longitude)
                      .map(m => ({
                        profile_id: m.profile_id || m.id,
                        first_name: m.first_name,
                        last_name: m.last_name || "",
                        latitude: (m as any).profile.latitude,
                        longitude: (m as any).profile.longitude,
                        city: (m as any).profile.city,
                        country: (m as any).profile.country,
                        relation_path: [m.relation_type],
                        depth: 1,
                        location_enabled: true,
                      })),
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit Member Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMember ? "Editar familiar" : "Agregar familiar"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingMember(null); setForm(EMPTY_FORM); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="Nombre"
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Apellido</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="Apellido"
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Correo (para invitarlo)</label>
                <input
                  type="email"
                  className="input-field text-sm"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Parentesco *</label>
                <select
                  className="input-field text-sm"
                  value={form.relation_type}
                  onChange={e => setForm(f => ({ ...f, relation_type: e.target.value as RelationType }))}
                >
                  {RELATION_GROUPS.map(group => (
                    <optgroup key={group.kind} label={group.label}>
                      {group.options.map(opt => (
                        <option key={opt} value={opt}>{RELATION_LABELS[opt]}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              {editingMember ? (
                <>
                  <button onClick={deleteMember} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50">
                    Eliminar
                  </button>
                  <button onClick={updateMember} disabled={saving} className="flex-1 btn-primary">
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); }} className="flex-1 btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={saveMember} disabled={saving} className="flex-1 btn-primary">
                    {saving ? "Guardando..." : "Agregar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap = {
    ceiba: "text-ceiba-700 bg-ceiba-50",
    earth: "text-earth-700 bg-earth-50",
    blue: "text-blue-700 bg-blue-50",
  } as Record<string, string>;
  return (
    <div className={`rounded-2xl p-4 ${colorMap[color]}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-1 opacity-80">{label}</div>
    </div>
  );
}

function MemberGroup({ title, members, onInvite, onEdit, kind }: {
  title: string; members: FamilyMember[]; onInvite: (m: FamilyMember) => void;
  onEdit: (m: FamilyMember) => void; kind: string;
}) {
  return (
    <div className="card">
      <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${kind === "blood" ? "bg-ceiba-500" : "bg-earth-500"}`} />
        {title}
      </h2>
      <div className="divide-y divide-gray-100">
        {members.map(m => (
          <div key={m.id} className="py-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden ${
              m.profile_id ? "bg-ceiba-700" : "bg-gray-200"
            }`}>
              {(m as any).profile?.avatar_url ? (
                <img src={(m as any).profile.avatar_url} alt={m.first_name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${
                  m.profile_id ? "text-white" : "text-gray-600"
                }`}>
                  {m.first_name[0]}{m.last_name ? m.last_name[0] : ""}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-gray-900 truncate">{m.first_name} {m.last_name}</div>
              <div className="text-xs text-gray-500 flex items-center gap-2 flex-wrap">
                <span>{RELATION_LABELS[m.relation_type]}</span>
                {m.profile_id && <span className="text-ceiba-600 font-medium">· En Ceiba</span>}
                {m.invitation_sent && !m.profile_id && <span className="text-amber-600">· Invitado</span>}
                {(m as any).profile?.social_link && (
                  <a
                    href={(m as any).profile.social_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline truncate max-w-[120px]"
                    onClick={e => e.stopPropagation()}
                  >
                    🔗 Red social
                  </a>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => onEdit(m)}
                className="p-1.5 text-gray-400 hover:text-ceiba-700 hover:bg-ceiba-50 rounded-lg transition-colors"
                title="Editar"
              >
                <Pencil size={14} />
              </button>
              {!m.profile_id && (
                <button
                  onClick={() => onInvite(m)}
                  className="flex items-center gap-1 text-ceiba-700 hover:text-ceiba-900 text-xs font-semibold border border-ceiba-200 rounded-lg px-3 py-1.5 hover:bg-ceiba-50 transition-colors"
                >
                  <Send size={12} /> {m.email ? "Invitar" : "Sin correo"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <TreePine size={40} className="text-ceiba-600 mx-auto mb-3 animate-pulse" />
        <p className="text-gray-500">Cargando tu árbol...</p>
      </div>
    </div>
  );
}

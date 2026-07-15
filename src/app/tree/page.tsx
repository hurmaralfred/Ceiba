"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TreePine, MapPin, Users, Share2, LogOut, User, Send, List, GitFork, Plus, X, Pencil, Map as MapIcon, Image, Calendar, MessageCircle, Megaphone, Camera, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RelationType, RELATION_LABELS } from "@/lib/types";
import { adaptGraph, relationTypeToGraphType, type FamilyGraph } from "@/lib/graphAdapter";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";
import InstallBanner from "@/components/InstallBanner";
import TreeErrorBoundary from "@/components/TreeErrorBoundary";
import SuggestionCards from "@/components/SuggestionCards";
import NameMatchCards from "@/components/NameMatchCards";
import FamilyDiscoveryWizard from "@/components/FamilyDiscoveryWizard";
import BirthdayWidget from "@/components/BirthdayWidget";
import TodayWidget from "@/components/TodayWidget";
import NetworkBanner from "@/components/NetworkBanner";
import BottomNav from "@/components/BottomNav";
import { usePushNotifications } from "@/hooks/usePushNotifications";
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
    options: ["father","mother","brother","sister","half_brother","half_sister","son","daughter","nephew","niece","grandfather_paternal","grandmother_paternal","grandfather_maternal","grandmother_maternal","grandson","granddaughter","uncle","aunt","cousin"] as RelationType[],
  },
  {
    label: "Familia política (afinidad)",
    kind: "affinity" as const,
    options: ["spouse","partner","father_in_law","mother_in_law","brother_in_law","sister_in_law","stepfather","stepmother","stepchild"] as RelationType[],
  },
];

const EMPTY_FORM = { primer_nombre: "", segundo_nombre: "", primer_apellido: "", segundo_apellido: "", first_name: "", last_name: "", email: "", birth_date: "", birth_city: "", birth_country: "", relation_type: "father" as RelationType, is_deceased: false, parent_member_id: "" };
export default function TreePage() {
  const router = useRouter();
  const supabase = createClient();
  usePushNotifications(); // Registra FCM token si el usuario da permiso
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [extendedMembers, setExtendedMembers] = useState<ExtendedEntry[]>([]);
  const [memberLinks, setMemberLinks] = useState<MemberLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list" | "map">("graph");
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [pendingMatchCount, setPendingMatchCount] = useState(0);
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("default");
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    candidate_id: string;
    matchedName: string;       // nombre de la persona ya existente
    score: number;
  } | null>(null);
  const modalPhotoRef = useRef<HTMLInputElement>(null);
  const [modalPhotoFile, setModalPhotoFile] = useState<File | null>(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null);
  const [sosSending, setSosSending] = useState(false);
  const [sosActive, setSosActive] = useState(false);

  useEffect(() => {
    loadData();
    if (!("Notification" in window)) {
      setNotifPermission("unsupported");
    } else {
      setNotifPermission(Notification.permission);
      if (Notification.permission === "granted") subscribeUser();
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "granted") { subscribeUser(); setNotifPermission("granted"); return; }
    if (Notification.permission === "denied") { setNotifPermission("denied"); return; }
    const permission = await Notification.requestPermission();
    setNotifPermission(permission);
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
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    // Fire-and-forget: presencia + auto-link si nuevo usuario
    fetch("/api/auth/post-register", { method: "POST" }).catch(() => {});
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});

    // -- Nuevo grafo familiar ------------------------------------------------
    const { data: graphData, error: graphError } = await supabase.rpc("get_my_family_graph", { depth: 4 });
    if (graphError) throw graphError;

    const graph = graphData as FamilyGraph | null;
    if (!graph || !graph.me) {
      // Usuario nuevo sin nodo en persons todavía — mostrar árbol vacío
      setLoading(false);
      return;
    }

    const { profile, members, extendedMembers, memberLinks } = adaptGraph(graph, user.id);
    setProfile(profile);
    setMembers(members);
    setExtendedMembers(extendedMembers);
    setMemberLinks(memberLinks);

    // Pendientes de confirmación de coincidencias
    const { data: matchData } = await supabase
      .from("match_candidates")
      .select("id")
      .eq("proposed_by_user_id", user.id)
      .eq("status", "pending");
    setPendingMatchCount((matchData || []).length);

    // Ubicación del usuario (de persons)
    const myNode = (graph.nodes || []).find((n: any) => n.id === graph.me);
    // (location está en profiles por ahora, no en persons)

    } catch (err: any) {
      console.error("loadData error:", err);
      setLoadError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // -- LEGACY: funciones que solo usaba el flujo antiguo (family_members) --
  // Vincula persona existente detectada como coincidencia (flujo de confirmación)
  const saveLinkedMember = async () => {
    if (!duplicateWarning) return;
    setSaving(true);
    try {
      // Si el warning tiene un candidate_id, confirmar vía RPC; si no, solo cerrar
      if ((duplicateWarning as any).candidate_id) {
        const { error } = await supabase.rpc("confirm_match", {
          p_candidate_id: (duplicateWarning as any).candidate_id,
        });
        if (error) throw error;
      }
      toast.success("Familiar vinculado correctamente");
      setShowModal(false);
      setForm(EMPTY_FORM);
      setDuplicateWarning(null);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al vincular");
    } finally {
      setSaving(false);
    }
  };

  const saveMember = async (_force = false) => {
    if (!form.primer_nombre.trim()) { toast.error("El primer nombre es obligatorio"); return; }
    if (!form.primer_apellido.trim()) { toast.error("El primer apellido es obligatorio"); return; }    if (!form.birth_date) { toast.error("La fecha de nacimiento es obligatoria"); return; }
    const first_names = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_names = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setDuplicateWarning(null);
    setSaving(true);
    try {
      // add_relative maneja detección de duplicados + creación atómica + relación
      const { data: result, error } = await supabase.rpc("add_relative", {
        p_payload: {
          first_names,
          last_names: last_names || null,
          email: form.email.trim() || null,
          birth_date: form.birth_date || null,            birth_city: form.birth_city.trim() || null,
            birth_country: form.birth_country.trim() || null,
          is_living: !form.is_deceased,
        },
        p_relationship: relationTypeToGraphType(form.relation_type as RelationType),
      });
      if (error) throw error;

      // Si el RPC encontró duplicado fuerte → pedir confirmación al usuario
      if ((result as any)?.needs_confirmation) {
        const mp = (result as any)?.match?.matched_person;
        const matchedName = mp
          ? `${mp.first_names || ""} ${mp.last_names || ""}`.trim()
          : "Persona desconocida";
        setDuplicateWarning({
          candidate_id: (result as any).candidate_id,
          matchedName,
          score: (result as any)?.match?.score ?? 0,
        });
        setSaving(false);
        return;
      }

      // Subir foto si el usuario la eligió (personas se guardan con id = result.person_id)
      const personId = (result as any)?.person_id;
      if (modalPhotoFile && personId) {
        const ext = modalPhotoFile.name.split(".").pop() ?? "jpg";
        const path = `member-photos/${user.id}/${personId}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars").upload(path, modalPhotoFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
          await supabase.from("persons")
            .update({ profile_photo_url: urlData.publicUrl }).eq("id", personId);
        }
        setModalPhotoFile(null);
        setModalPhotoPreview(null);
      }

      toast.success("Familiar agregado");
      setShowModal(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (member: FamilyMember) => {
    setEditingMember(member);
    const nameParts = (member.first_name || "").split(" ");
    const lastParts = (member.last_name || "").split(" ");
    setForm({
      primer_nombre: nameParts[0] || "",
      segundo_nombre: nameParts[1] || "",
      primer_apellido: lastParts[0] || "",
      segundo_apellido: lastParts[1] || "",
      first_name: member.first_name,
      last_name: member.last_name || "",
      email: member.email || "",
      birth_date: (member as any).birth_date || "",
      relation_type: member.relation_type as RelationType,
      is_deceased: !!(member as any).is_deceased,
      parent_member_id: (member as any).parent_member_id || "",
    });
    setShowModal(true);
  };

  const updateMember = async () => {
    if (!editingMember || !form.primer_nombre.trim()) return;
    const first_names = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_names = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    setSaving(true);
    try {
      // Actualizar el nodo persons (editingMember.id es el person.id)
      const { error } = await supabase.from("persons").update({
        first_names,
        last_names: last_names || null,
        email: form.email.trim() || null,
        birth_date: form.birth_date || null,
        is_living: !form.is_deceased,
      }).eq("id", editingMember.id);
      if (error) throw error;
      toast.success("Familiar actualizado");
      setShowModal(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const deleteMember = async () => {
    if (!editingMember) return;
    if (!confirm(`¿Eliminar a ${editingMember.first_name} ${editingMember.last_name || ""}?`)) return;
    try {
      // Eliminar todas las relaciones donde aparece esta persona
      const { error } = await supabase.from("relationships")
        .delete()
        .or(`person_a_id.eq.${editingMember.id},person_b_id.eq.${editingMember.id}`);
      if (error) throw error;
      // No eliminamos el nodo persons para preservar historia; si el usuario quiere
      // borrar la persona completa puede hacerlo desde su perfil.
      toast.success("Familiar eliminado del árbol");
      setShowModal(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al eliminar");
    }
  };

  const sendInvite = async (member: FamilyMember) => {
    if (!member.email) { toast.error("Este familiar no tiene correo registrado"); return; }
    const { data, error } = await supabase
      .from("invitations")
      .insert({ invited_by: profile!.id, email: member.email, relation_type: member.relation_type })
      .select("token").single();
    if (error) { toast.error("Error al generar invitación"); return; }
    const inviteLink = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(inviteLink);
    toast.success("¡Enlace copiado! Compártelo con tu familiar.");
    // invitation_sent ya no se trackea en family_members — se refleja vía invitations table
    loadData();
  };

  const logout = async () => { await supabase.auth.signOut(); router.push("/"); };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastSending(true);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: broadcastMsg.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      toast.success(`📢 Mensaje enviado a ${data.recipients} familiar${data.recipients !== 1 ? "es" : ""}`);
      setBroadcastMsg("");
      setShowBroadcast(false);
    } catch (err: any) {
      toast.error(err.message || "No se pudo enviar");
    } finally {
      setBroadcastSending(false);
    }
  };

  const triggerSOS = async () => {
    if (sosSending || sosActive) return;
    setSosSending(true);
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 });
      });
      const { data, error } = await supabase.rpc("trigger_sos", {
        p_lat: pos?.coords.latitude ?? null,
        p_lon: pos?.coords.longitude ?? null,
        p_message: null,
        p_scope: 2,
      });
      if (error) {
        if (error.message?.includes("cooldown")) {
          toast.error("SOS en cooldown — ya hay una alerta activa.");
        } else {
          toast.error("Error al enviar SOS: " + error.message);
        }
        return;
      }
      setSosActive(true);
      toast.success("🚨 SOS enviado a tu red familiar.", { duration: 6000 });
      // Auto-reset visual after 5 min
      setTimeout(() => setSosActive(false), 5 * 60 * 1000);
    } catch (e) {
      toast.error("No se pudo enviar el SOS.");
    } finally {
      setSosSending(false);
    }
  };

  const shareTree = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get existing token or create one
    let { data: existing } = await supabase
      .from("shared_trees")
      .select("token")
      .eq("profile_id", user.id)
      .single();

    if (!existing) {
      const { data: created, error } = await supabase
        .from("shared_trees")
        .insert({ profile_id: user.id })
        .select("token")
        .single();
      if (error || !created) { toast.error("Error al generar link"); return; }
      existing = created;
    }

    const link = `${window.location.origin}/share/${existing.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("¡Link copiado! Compártelo con tu familia.");
  };

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
  if (loadError) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 max-w-lg w-full">
        <p className="text-red-700 font-bold mb-2">Error al cargar</p>
        <p className="text-red-600 text-sm break-all">{loadError}</p>
      </div>
    </div>
  );

  const bloodMembers = members.filter(m => m.relation_kind === "blood");
  const affinityMembers = members.filter(m => m.relation_kind === "affinity");
  const joinedMembers = members.filter(m => m.profile_id);
  const pendingMembers = members.filter(m => !m.profile_id);

  return (
    <div className="min-h-screen bg-cream-100">
      {/* Nav */}
      <nav className="bg-ceiba-900 text-white px-6 py-4 flex items-center justify-between shadow-lg" style={{borderBottom:"2px solid #4a6342"}}>
        <Link href="/tree" className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={24} className="text-ceiba-300" /> Ceiba
        </Link>
        <div className="flex items-center gap-3">
          <InstallBanner />
          <Link href="/map" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <MapPin size={16} /> Mapa
          </Link>
          <Link href="/photos" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Image size={16} /> Fotos
          </Link>
          <Link href="/events" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Calendar size={16} /> Historia
          </Link>
          <Link href="/chat" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <MessageCircle size={16} /> Chat
          </Link>
          <Link href="/invitar" className="flex items-center gap-1 bg-ceiba-600 hover:bg-ceiba-500 text-white text-sm font-semibold px-3 py-1 rounded-lg transition-colors">
            <Send size={15} /> Invitar
          </Link>
          <button onClick={shareTree} className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Share2 size={16} /> Compartir
          </button>
          <Link href="/settings" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <User size={16} />
          </Link>
          <button
            onClick={triggerSOS}
            disabled={sosSending}
            className={`flex items-center gap-1 text-sm font-bold px-3 py-1 rounded-lg transition-colors ${
              sosActive
                ? "bg-red-700 text-white animate-pulse"
                : "bg-red-500 hover:bg-red-400 text-white"
            }`}
            title="Enviar alerta SOS a tu familia"
          >
            <AlertTriangle size={15} />
            {sosSending ? "..." : sosActive ? "SOS activo" : "SOS"}
          </button>
        </div>
      </nav>

      {/* Notification permission banner */}
      {!notifDismissed && notifPermission !== "granted" && notifPermission !== "unsupported" && (
        <div className={`px-4 py-2.5 flex items-center gap-3 text-sm ${
          notifPermission === "denied"
            ? "bg-gray-700 text-gray-200"
            : "bg-amber-500 text-white"
        }`}>
          <span className="text-base">🔔</span>
          <span className="flex-1">
            {notifPermission === "denied"
              ? "Notificaciones bloqueadas — no recibirás anuncios ni alertas familiares. Actívalas en ajustes."
              : "Activa las notificaciones para no perderte anuncios, cumpleaños y avisos de tu familia."}
          </span>
          {notifPermission !== "denied" && (
            <button
              onClick={requestNotificationPermission}
              className="bg-white text-amber-600 font-bold px-3 py-1 rounded-lg text-xs hover:bg-amber-50 transition-colors flex-shrink-0"
            >
              Activar
            </button>
          )}
          <button
            onClick={() => setNotifDismissed(true)}
            className="opacity-70 hover:opacity-100 transition-opacity flex-shrink-0 text-lg leading-none"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 py-3 pb-24">
        {/* SLIM profile strip */}
        {profile && (
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-xl bg-ceiba-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
              {profile.avatar_url
                ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                : `${profile.first_name[0]}${profile.last_name?.[0] || ""}`}
            </div>
            <span className="font-semibold text-gray-800 flex-1 truncate">{profile.first_name} {profile.last_name}</span>
            <span className="text-xs text-gray-400 flex-shrink-0">{members.length} familiares · {joinedMembers.length} en Ceiba</span>
            <Link href="/admin" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors flex-shrink-0" title="Reparar árbol">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            </Link>
            <button onClick={shareTree} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0" title="Compartir árbol">
              <Share2 size={16} />
            </button>
          </div>
        )}

        {/* Red familiar progress — stays compact */}
        <NetworkBanner
          totalMembers={members.length}
          joinedMembers={members.filter(m => m.profile_id).length}
        />

        {/* Family list / graph */}
        {members.length === 0 ? (
          <div className="card text-center py-10 px-6">
            <div className="w-20 h-20 rounded-3xl bg-ceiba-50 flex items-center justify-center mx-auto mb-5">
              <TreePine size={40} className="text-ceiba-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Tu árbol familiar te espera</h3>
            <p className="text-gray-500 mb-6 max-w-xs mx-auto leading-relaxed">
              Agrega a tu mamá, papá, hermanos o pareja. Cuando ellos se registren, sus familiares se conectarán solos a tu árbol.
            </p>
            <button onClick={() => setShowModal(true)} className="btn-primary mb-4">
              <Plus size={16} className="inline mr-1" /> Agregar primer familiar
            </button>
            <p className="text-xs text-gray-400">💡 Empieza por quien más conoces de tu familia</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Action bar — 1 CTA dominante */}
            <div className="flex items-center gap-2">
              {/* PRIMARY: Agregar familiar */}
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 bg-earth-500 hover:bg-earth-600 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm transition-colors flex-1"
              >
                <Plus size={16} /> Agregar familiar
              </button>
              {/* SECONDARY: Anunciar — icono only */}
              {joinedMembers.length > 0 && (
                <button
                  onClick={() => setShowBroadcast(true)}
                  className="p-2 rounded-xl border border-amber-200 text-amber-500 hover:bg-amber-50 transition-colors flex-shrink-0"
                  title="Anunciar a la familia"
                >
                  <Megaphone size={18} />
                </button>
              )}
              {/* View toggles — segmented control */}
              <div className="flex items-center bg-gray-100 rounded-xl p-0.5 gap-0.5 flex-shrink-0">
                <button
                  onClick={() => setView("graph")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "graph" ? "bg-white shadow text-ceiba-700" : "text-gray-400 hover:text-gray-600"}`}
                  title="Árbol"
                ><GitFork size={15} /></button>
                <button
                  onClick={() => setView("list")}
                  className={`p-1.5 rounded-lg transition-colors ${view === "list" ? "bg-white shadow text-ceiba-700" : "text-gray-400 hover:text-gray-600"}`}
                  title="Lista"
                ><List size={15} /></button>
                <button
                  onClick={activateMap}
                  className={`p-1.5 rounded-lg transition-colors ${view === "map" ? "bg-white shadow text-ceiba-700" : "text-gray-400 hover:text-gray-600"}`}
                  title="Mapa"
                ><MapIcon size={15} /></button>
              </div>
            </div>

            {view === "graph" && profile && (
              <TreeErrorBoundary>
                <FamilyTreeGraph
                  profile={profile}
                  members={members}
                  extendedMembers={extendedMembers}
                  memberLinks={memberLinks}
                  onNodeClick={(memberId) => router.push(`/member/${memberId}`)}
                />
              </TreeErrorBoundary>
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

            {view === "map" && (() => {
              const mapRelatives = [
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
              ];
              if (!myLocation && mapRelatives.length === 0) {
                return (
                  <div className="card text-center py-10">
                    <MapPin size={40} className="text-gray-300 mx-auto mb-4" />
                    <h3 className="font-bold text-gray-700 mb-2">Sin ubicaciones aún</h3>
                    <p className="text-gray-400 text-sm max-w-xs mx-auto">
                      Permite el acceso a tu ubicación para aparecer en el mapa. Tu familia también debe activarlo desde su perfil.
                    </p>
                  </div>
                );
              }
              return (
                <div className="rounded-2xl overflow-hidden" style={{ height: "520px" }}>
                  <MapView myLocation={myLocation} relatives={mapRelatives} />
                </div>
              );
            })()}
          </div>

          {/* Engagement widgets — BELOW the tree so el árbol es el héroe */}
          <div className="space-y-3 mt-4">
            {profile && <TodayWidget userId={profile.id} />}
            {profile && <BirthdayWidget userId={profile.id} />}
            {/* Discovery banner: shown when someone already added this user */}
            {pendingMatchCount > 0 && !showDiscovery && (
              <button
                onClick={() => setShowDiscovery(true)}
                className="w-full flex items-center gap-3 bg-gradient-to-r from-ceiba-800 to-ceiba-700 text-white rounded-2xl px-4 py-3.5 shadow-md hover:from-ceiba-700 hover:to-ceiba-600 transition-all"
              >
                <div className="w-9 h-9 bg-ceiba-600/60 rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🌳</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-sm leading-tight">
                    {pendingMatchCount === 1
                      ? "Alguien ya te agregó a su árbol"
                      : `${pendingMatchCount} personas ya te agregaron`}
                  </p>
                  <p className="text-ceiba-300 text-xs mt-0.5">
                    Confirma y tu árbol se construye solo
                  </p>
                </div>
                <span className="text-ceiba-400 text-lg">›</span>
              </button>
            )}
            <SuggestionCards onAccepted={loadData} />
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📢</span>
                <h2 className="text-lg font-bold text-gray-900">Mensaje familiar</h2>
              </div>
              <button onClick={() => { setShowBroadcast(false); setBroadcastMsg(""); }}>
                <X size={20} className="text-gray-400 hover:text-gray-600" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Todos los familiares en Ceiba recibirán una notificación con tu mensaje.
            </p>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              rows={4}
              maxLength={300}
              placeholder="Ej: Reunión familiar este domingo a las 2pm en casa de abuela 🏠"
              value={broadcastMsg}
              onChange={e => setBroadcastMsg(e.target.value)}
              autoFocus
            />
            <div className="flex items-center justify-between mt-1 mb-4">
              <span className="text-xs text-gray-400">{broadcastMsg.length}/300</span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBroadcast(false); setBroadcastMsg(""); }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={sendBroadcast}
                disabled={broadcastSending || !broadcastMsg.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Megaphone size={15} />
                {broadcastSending ? "Enviando..." : "Enviar a todos"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                {editingMember ? "Editar familiar" : "Agregar familiar"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingMember(null); setForm(EMPTY_FORM); setDuplicateWarning(null); setModalPhotoFile(null); setModalPhotoPreview(null); }} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Foto del familiar */}
              {!editingMember && (
                <div className="flex items-center gap-3 pb-1">
                  <div
                    onClick={() => modalPhotoRef.current?.click()}
                    className="w-14 h-14 rounded-full flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden border-2 border-dashed border-ceiba-200 hover:border-ceiba-400 bg-ceiba-50 transition-colors"
                  >
                    {modalPhotoPreview
                      ? <img src={modalPhotoPreview} className="w-full h-full object-cover" alt="" />
                      : <Camera size={20} className="text-ceiba-400" />}
                  </div>
                  <div>
                    <button type="button" onClick={() => modalPhotoRef.current?.click()}
                      className="text-sm font-medium text-ceiba-700 hover:text-ceiba-800 transition-colors">
                      {modalPhotoPreview ? "Cambiar foto" : "Añadir foto"}
                    </button>
                    <p className="text-xs text-gray-400">Aparecerá en el árbol hasta que se registre</p>
                  </div>
                  <input ref={modalPhotoRef} type="file" accept="image/*" className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 5 * 1024 * 1024) { toast.error("Foto menor a 5MB"); return; }
                      setModalPhotoFile(f);
                      setModalPhotoPreview(URL.createObjectURL(f));
                    }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primer nombre <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Hugo"
                    value={form.primer_nombre}
                    onChange={e => setForm(f => ({ ...f, primer_nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Segundo nombre</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Armando"
                    value={form.segundo_nombre}
                    onChange={e => setForm(f => ({ ...f, segundo_nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Primer apellido <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Hurtado"
                    value={form.primer_apellido}
                    onChange={e => setForm(f => ({ ...f, primer_apellido: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Segundo apellido</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Martínez"
                    value={form.segundo_apellido}
                    onChange={e => setForm(f => ({ ...f, segundo_apellido: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ciudad de nacimiento</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Bogotá"
                    value={form.birth_city}
                    onChange={e => setForm(f => ({ ...f, birth_city: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">País de nacimiento</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Colombia"
                    value={form.birth_country}
                    onChange={e => setForm(f => ({ ...f, birth_country: e.target.value }))}
                  />
                </div>
              </div>
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={form.birth_date}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
              </div>
              {/* Deceased toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={form.is_deceased}
                    onChange={e => setForm(f => ({ ...f, is_deceased: e.target.checked }))}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${form.is_deceased ? "bg-gray-500" : "bg-gray-200"}`} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_deceased ? "translate-x-5" : ""}`} />
                </div>
                <span className="text-sm text-gray-700">
                  Fallecido(a){" "}
                  <span className="text-gray-400 font-normal">— aparecerá con † en el árbol</span>
                </span>
              </label>

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

              {/* Parent selector — solo para sobrinos/sobrinas */}
              {(form.relation_type === "nephew" || form.relation_type === "niece") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    ¿Hijo/a de cuál hermano/a? <span className="text-gray-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    className="input-field text-sm"
                    value={form.parent_member_id}
                    onChange={e => setForm(f => ({ ...f, parent_member_id: e.target.value }))}
                  >
                    <option value="">— No especificar —</option>
                    {members
                      .filter(m => ["brother","sister","half_brother","half_sister"].includes(m.relation_type))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.first_name} {s.last_name || ""}
                        </option>
                      ))
                    }
                  </select>
                </div>
              )}
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
                  {/* Duplicate warning */}
                  {duplicateWarning && (
                    <div className="w-full mb-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Posible duplicado detectado</p>
                      <p className="text-xs text-amber-700 leading-relaxed mb-3">
                        <span className="font-bold">{duplicateWarning.matchedName}</span> ya existe en Ceiba.
                        {" "}¿Es la misma persona que estás agregando?
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setDuplicateWarning(null); saveMember(true); }}
                          className="flex-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          No, son diferentes
                        </button>
                        <button
                          onClick={saveLinkedMember}
                          disabled={saving}
                          className="flex-1 text-xs font-semibold bg-ceiba-700 text-white hover:bg-ceiba-800 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {saving ? "Vinculando..." : "Sí, es la misma"}
                        </button>
                      </div>
                    </div>
                  )}
                  <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setDuplicateWarning(null); }} className="flex-1 btn-secondary">
                    Cancelar
                  </button>
                  <button onClick={() => saveMember()} disabled={saving} className="flex-1 btn-primary">
                    {saving ? "Guardando..." : "Agregar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      <BottomNav />

      {/* Family Discovery Wizard — full-screen overlay */}
      {showDiscovery && profile && (
        <FamilyDiscoveryWizard
          userId={profile.id}
          myFirstName={profile.first_name}
          myLastName={profile.last_name}
          onDone={(count) => {
            setShowDiscovery(false);
            setPendingMatchCount(0);
            if (count > 0) loadData();
          }}
          onSkip={() => {
            setShowDiscovery(false);
          }}
        />
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
            <Link href={`/member/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
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
            </Link>
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
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <div className="text-center">
        <TreePine size={40} className="text-ceiba-600 mx-auto mb-3 animate-pulse" />
        <p className="text-gray-500">Cargando tu árbol...</p>
      </div>
    </div>
  );
}

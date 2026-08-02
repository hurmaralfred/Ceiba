"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import lazyLoad from "next/dynamic";
import { TreePine, MapPin, Users, Share2, LogOut, User, Send, List, GitFork, Plus, X, Pencil, Map as MapIcon, Image, Calendar, MessageCircle, Megaphone, Camera, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RelationType, RELATION_LABELS } from "@/lib/types";
import { adaptGraph, buildAddRelativeRequest, isAddRelativeSupported, relationRequiresConnector, type FamilyGraph } from "@/lib/graphAdapter";
import { KINSHIP_CATALOG, type KinshipKey } from "@/domain/relationships";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";
import { FamilyUniverse as FamilyUniverseComponent } from "@/components/universe/FamilyUniverse";
import { buildVisibleMembers } from "@/lib/visibleMembers";
import { resolveMemberForEdit } from "@/lib/resolveMemberForEdit";
import InstallBanner from "@/components/InstallBanner";
import TreeErrorBoundary from "@/components/TreeErrorBoundary";
import BirthdayWidget from "@/components/BirthdayWidget";
import TodayWidget from "@/components/TodayWidget";
import NetworkBanner from "@/components/NetworkBanner";
import {
  parseGrowthStats,
  formatFamilyLine,
  formatGrowthLine,
  type CeibaGrowthStats,
} from "@/lib/growthStats";
import BottomNav from "@/components/BottomNav";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import toast from "react-hot-toast";

const FamilyTreeGraph = lazyLoad(
  () => import("@/components/tree/FamilyTreeGraph"),
  { ssr: false, loading: () => <div className="w-full h-[520px] rounded-2xl bg-gray-100 animate-pulse" /> }
);

const PremiumFamilyTree = lazyLoad(
  () => import("@/components/tree/premium/PremiumFamilyTree"),
  { ssr: false, loading: () => <div className="w-full rounded-2xl animate-pulse" style={{ height: "calc(100vh - 120px)", background: "#07111c" }} /> }
);

const PREMIUM_TREE_RENDERER_ENABLED = true;
const UNIVERSE_RENDERER_ENABLED = true;

const MapView = lazyLoad(
  () => import("@/components/map/MapView"),
  { ssr: false, loading: () => <div className="w-full h-[520px] rounded-2xl bg-gray-100 animate-pulse" /> }
);

// Catálogo genealógico v1 — el selector se construye desde el CATÁLOGO CENTRAL
// (KINSHIP_CATALOG). Aquí solo se define el orden y el agrupado visual: las
// etiquetas salen del catálogo, nunca se duplican en el componente.
//
// Las opciones que `buildAddRelativeRequest` todavía no sabe traducir a
// relaciones canónicas se muestran DESHABILITADAS con una explicación visible;
// no se ocultan en silencio ni se guardan como parentesco derivado.
const RELATION_GROUPS: { label: string; keys: KinshipKey[] }[] = [
  {
    label: "Ascendientes",
    keys: ["father", "mother", "grandfather", "grandmother", "great_grandfather", "great_grandmother", "great_great_grandfather", "great_great_grandmother"],
  },
  { label: "Hermanos", keys: ["brother", "sister"] },
  { label: "Pareja", keys: ["spouse", "partner"] },
  {
    label: "Descendientes",
    keys: ["son", "daughter", "grandson", "granddaughter", "great_grandson", "great_granddaughter", "great_great_grandson", "great_great_granddaughter"],
  },
  { label: "Tíos y sobrinos", keys: ["uncle", "aunt", "nephew", "niece"] },
  {
    label: "Familia política",
    keys: ["father_in_law", "mother_in_law", "son_in_law", "daughter_in_law", "brother_in_law", "sister_in_law"],
  },
];

const UNSUPPORTED_SUFFIX = " — próximamente";

const EMPTY_FORM = { primer_nombre: "", segundo_nombre: "", primer_apellido: "", segundo_apellido: "", first_name: "", last_name: "", email: "", birth_date: "", birth_city: "", birth_country: "", relation_type: "father" as RelationType, is_deceased: false, parent_member_id: "" };
export default function TreePage() {
  return <TreePageContent />;
}

function TreePageContent() {
  const router = useRouter();
  const supabase = createClient();
  usePushNotifications(); // Registra FCM token si el usuario da permiso
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [extendedMembers, setExtendedMembers] = useState<ExtendedEntry[]>([]);
  const [memberLinks, setMemberLinks] = useState<MemberLink[]>([]);
  const [visibleMembers, setVisibleMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list" | "map">("graph");
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
  // Error real de add_relative, visible en el propio modal (no solo en toast).
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    candidates: Array<{ person_id: string; first_name: string; first_surname: string; confidence: number }>;
    matchedName: string;
    score: number;
  } | null>(null);
  const modalPhotoRef = useRef<HTMLInputElement>(null);
  const [modalPhotoFile, setModalPhotoFile] = useState<File | null>(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null);
  const [sosSending, setSosSending] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  // Contador global. `null` = no disponible -> se oculta solo esa línea,
  // el árbol sigue cargando con normalidad.
  const [growthStats, setGrowthStats] = useState<CeibaGrowthStats | null>(null);
  const [canEditMember, setCanEditMember] = useState(false);
  const [checkingEditPermission, setCheckingEditPermission] = useState(false);
  const [pendingCollabRequests, setPendingCollabRequests] = useState<Array<{ id: string; request_type: string; requester_user_id: string }>>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // El contador global es informativo: nunca debe impedir que el árbol
  // cargue. Si la RPC falla se registra en consola y se oculta la línea,
  // sin toast invasivo.
  const loadGrowthStats = async () => {
    try {
      const { data, error } = await supabase.rpc("get_ceiba_growth_stats");
      if (error) throw error;
      setGrowthStats(parseGrowthStats(data));
    } catch (err) {
      console.error("get_ceiba_growth_stats falló; se oculta el contador global:", err);
      setGrowthStats(null);
    }
  };

  useEffect(() => {
    loadData();
    loadGrowthStats();
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
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});

    // -- Nuevo grafo familiar ------------------------------------------------
    console.log("① Antes RPC");
const { data: graphData, error: graphError } = await supabase.rpc("get_my_family_graph", { p_depth: 4 });
console.log("② Después RPC");
    if (graphError) throw graphError;

    console.log("get_my_family_graph response:", graphData);

    console.log("③ Antes adaptGraph");
const graph = graphData as FamilyGraph | null;
    if (!graph || !graph.me) {
      // Usuario nuevo sin nodo en persons todavía — mostrar árbol vacío
      setLoading(false);
      return;
    }

    const { profile, members, extendedMembers, memberLinks } = adaptGraph(graph, user.id);
console.log("④ Después adaptGraph");
    const unified = buildVisibleMembers(members, extendedMembers);
console.log("④.5 Conjunto unificado:", unified.length, "miembros");
    setProfile(profile);
    setMembers(members);
    setExtendedMembers(extendedMembers);
    setMemberLinks(memberLinks);
    setVisibleMembers(unified);
console.log("⑤ Datos cargados");

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
    if (!duplicateWarning?.candidates?.[0]) return;
    setSaving(true);
    try {
      const top = duplicateWarning.candidates[0];
      const relRequest = buildAddRelativeRequest(
        form.relation_type as RelationType,
        form.parent_member_id || null
      );
      const { error } = await supabase.rpc("add_relative", {
        p_payload: {
          first_name: form.primer_nombre.trim(),
          middle_name: form.segundo_nombre.trim() || null,
          first_surname: form.primer_apellido.trim(),
          second_surname: form.segundo_apellido.trim() || null,
          birth_date: form.birth_date || null,
          birth_city: form.birth_city.trim() || null,
          birth_country: form.birth_country.trim() || null,
          is_deceased: form.is_deceased,
          related_person_id: relRequest.relatedPersonId || null,
          relation_key: relRequest.backendRelationKey,
          parent_kind: relRequest.parentKind,
          gender: relRequest.gender,
          link_person_id: top.person_id,
        },
        p_relationship: relRequest.primitive,
      });
      if (error) throw error;
      toast.success("Familiar vinculado correctamente");
      setShowModal(false);
      setForm(EMPTY_FORM);
      setDuplicateWarning(null);
      loadData();
      loadGrowthStats();
    } catch (err: any) {
      toast.error(err?.message || "Error al vincular");
    } finally {
      setSaving(false);
    }
  };

  const saveMember = async (force = false) => {
    if (!form.primer_nombre.trim()) { toast.error("El primer nombre es obligatorio"); return; }
    if (!form.primer_apellido.trim()) { toast.error("El primer apellido es obligatorio"); return; }    if (!form.birth_date) { toast.error("La fecha de nacimiento es obligatoria"); return; }
    // Catálogo genealógico v1: abuelos/bisabuelos/nietos/bisnietos exigen el
    // familiar conector (no se crean personas intermedias ficticias).
    if (relationRequiresConnector(form.relation_type as RelationType) && !form.parent_member_id) {
      toast.error("Selecciona el familiar que conecta este parentesco");
      return;
    }
    const first_names = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_names = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setDuplicateWarning(null);
    setSaveError(null);
    setSaving(true);
    try {
      // Catálogo genealógico v1: traduce el parentesco elegido al payload real
      // de add_relative. Los derivados (abuelos/bisabuelos/nietos/bisnietos)
      // viajan como cadena parent apoyada en el conector (related_person_id).
      const relRequest = buildAddRelativeRequest(
        form.relation_type as RelationType,
        form.parent_member_id || null
      );

      // add_relative maneja detección de duplicados + creación atómica + relación
      const { data: result, error } = await supabase.rpc("add_relative", {
        p_payload: {
          first_name: form.primer_nombre.trim(),
          middle_name: form.segundo_nombre.trim() || null,
          first_surname: form.primer_apellido.trim(),
          second_surname: form.segundo_apellido.trim() || null,
          birth_date: form.birth_date || null,
          birth_city: form.birth_city.trim() || null,
          birth_country: form.birth_country.trim() || null,
          is_deceased: form.is_deceased,
          related_person_id: relRequest.relatedPersonId || null,
          relation_key: relRequest.backendRelationKey,
          parent_kind: relRequest.parentKind,
          gender: relRequest.gender,
          confirm_create_duplicate: force || undefined,
        },
        p_relationship: relRequest.primitive,
      });
      if (error) throw error;

      // Si el RPC encontró duplicado fuerte → pedir confirmación al usuario
      if ((result as any)?.needs_confirmation) {
        const candidates: Array<{ person_id: string; first_name: string; first_surname: string; confidence: number }> =
          (result as any).candidates || [];
        const top = candidates[0];
        const matchedName = top
          ? `${top.first_name || ""} ${top.first_surname || ""}`.trim()
          : "Persona desconocida";
        setDuplicateWarning({
          candidates,
          matchedName,
          score: top?.confidence ?? 0,
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
            .update({ photo_path: urlData.publicUrl }).eq("id", personId);
        }
        setModalPhotoFile(null);
        setModalPhotoPreview(null);
      }

      toast.success("Familiar agregado");
      setShowModal(false);
      setForm(EMPTY_FORM);
      loadData();
      loadGrowthStats();
    } catch (err: any) {
      // Se muestra el error REAL devuelto por add_relative (p. ej. permisos o
      // espacio familiar), no un mensaje genérico que oculte la causa.
      const real = err?.message || err?.details || err?.hint || String(err);
      setSaveError(real);
      toast.error(real);
    } finally {
      setSaving(false);
    }
  };

  // Catálogo genealógico v1 — texto del selector de conector según parentesco.
  const connectorLabel = (rt: RelationType): string => {
    if (rt === "grandfather" || rt === "grandmother") return "¿Padre o madre de cuál de tus padres?";
    if (rt === "great_grandfather" || rt === "great_grandmother") return "¿Padre o madre de cuál de tus abuelos?";
    if (rt === "great_great_grandfather" || rt === "great_great_grandmother") return "¿Padre o madre de cuál de tus bisabuelos?";
    if (rt === "grandson" || rt === "granddaughter") return "¿Hijo o hija de cuál de tus hijos?";
    if (rt === "great_grandson" || rt === "great_granddaughter") return "¿Hijo o hija de cuál de tus nietos?";
    return "";
  };

  // Familiares elegibles como conector, filtrados por su relación inferida.
  const connectorCandidates = (rt: RelationType): Array<{ id: string; name: string }> => {
    let allowed: string[] = [];
    if (rt === "grandfather" || rt === "grandmother") {
      allowed = ["father", "mother"];
    } else if (rt === "great_grandfather" || rt === "great_grandmother") {
      allowed = [
        "grandfather", "grandmother",
        "grandfather_paternal", "grandmother_paternal",
        "grandfather_maternal", "grandmother_maternal",
      ];
    } else if (rt === "great_great_grandfather" || rt === "great_great_grandmother") {
      allowed = ["great_grandfather", "great_grandmother"];
    } else if (rt === "great_great_grandson" || rt === "great_great_granddaughter") {
      allowed = ["great_grandson", "great_granddaughter"];
    } else if (rt === "grandson" || rt === "granddaughter") {
      allowed = ["son", "daughter"];
    } else if (rt === "great_grandson" || rt === "great_granddaughter") {
      allowed = ["grandson", "granddaughter"];
    }
    const allowedSet = new Set(allowed);
    const seen = new Set<string>();
    const out: Array<{ id: string; name: string }> = [];
    const push = (id: string, first: string, last?: string | null) => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ id, name: `${first} ${last || ""}`.trim() });
    };
    members
      .filter((m) => allowedSet.has(m.relation_type))
      .forEach((m) => push(m.id, m.first_name, m.last_name));
    extendedMembers
      .filter((e) => e.inferredRelation != null && allowedSet.has(e.inferredRelation))
      .forEach((e) => push(e.member.id, e.member.first_name, e.member.last_name));
    return out;
  };

  const openEdit = async (member: FamilyMember) => {
    setEditingMember(member);
    setCheckingEditPermission(true);
    setCanEditMember(false);

    try {
      const res = await fetch(`/api/members/${member.id}/can-edit`);
      if (res.ok) {
        const data = await res.json();
        setCanEditMember(data.can_edit === true);
        if (!data.can_edit) {
          setCheckingEditPermission(false);
          router.push(`/collab/${member.id}`);
          return;
        }
      } else {
        // API error — allow edit optimistically (the user added this member)
        setCanEditMember(true);
      }
    } catch (err) {
      console.error("Error checking edit permission:", err);
      setCanEditMember(false);
      setCheckingEditPermission(false);
      toast.error("Error al verificar permisos");
      return;
    }

    // Cargar solicitudes de colaboración pendientes (el usuario es el dueño)
    try {
      const { data: requests } = await supabase
        .from("collab_requests")
        .select("id, request_type, requester_user_id")
        .eq("person_id", member.id)
        .eq("status", "pending");
      setPendingCollabRequests(requests || []);
    } catch {
      setPendingCollabRequests([]);
    }

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
      birth_city: (member as any).birth_city || "",
      birth_country: (member as any).birth_country || "",
      relation_type: member.relation_type as RelationType,
      is_deceased: !!(member as any).is_deceased,
      parent_member_id: (member as any).parent_member_id || "",
    });
    setShowModal(true);
    setCheckingEditPermission(false);
  };

  const updateMember = async () => {
    if (!editingMember || !form.primer_nombre.trim()) return;

    setSaving(true);

    try {
      const res = await fetch(`/api/members/${editingMember.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: form.primer_nombre.trim(),
          middle_name: form.segundo_nombre.trim() || null,
          first_surname: form.primer_apellido.trim() || null,
          second_surname: form.segundo_apellido.trim() || null,
          birth_date: form.birth_date || null,
          birth_city: form.birth_city.trim() || null,
          birth_country: form.birth_country.trim() || null,
          is_deceased: form.is_deceased,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Error al guardar");
      }

      toast.success("Familiar actualizado");
      setShowModal(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);
      setPendingCollabRequests([]);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const resolveCollabRequest = async (requestId: string, action: "approve" | "reject") => {
    setProcessingRequestId(requestId);
    const res = await fetch(`/api/collab/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setProcessingRequestId(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      toast.error(b.error || "Error al procesar la solicitud");
      return;
    }
    toast.success(action === "approve" ? "Solicitud aprobada" : "Solicitud rechazada");
    setPendingCollabRequests(prev => prev.filter(r => r.id !== requestId));
  };

  const deleteMember = async () => {
    if (!editingMember || !profile) return;

    const confirmed = confirm(
      `¿Quitar a ${editingMember.first_name} ${editingMember.last_name || ""} de tu árbol?`
    );

    if (!confirmed) return;

    setSaving(true);

    try {
      const { data: relationships, error: lookupError } = await supabase
        .from("relationships")
        .select("id")
        .or(
          `and(person_a_id.eq.${profile.id},person_b_id.eq.${editingMember.id}),` +
          `and(person_a_id.eq.${editingMember.id},person_b_id.eq.${profile.id})`
        )
        .is("deleted_at", null);

      if (lookupError) throw lookupError;

      if (!relationships || relationships.length === 0) {
        throw new Error(
          "No se encontró una relación directa entre estas personas."
        );
      }

      for (const relationship of relationships) {
        const { data: removed, error: removeError } = await supabase.rpc(
          "remove_relationship",
          {
            p_relationship_id: relationship.id,
          }
        );

        if (removeError) throw removeError;

        if (!removed) {
          throw new Error("La relación no pudo ser eliminada.");
        }
      }

      toast.success("Familiar retirado del árbol");
      setShowModal(false);
      setEditingMember(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al retirar al familiar");
    } finally {
      setSaving(false);
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

  const bloodMembers = visibleMembers.filter(m => m.relation_kind === "blood");
  const affinityMembers = visibleMembers.filter(m => m.relation_kind === "affinity");
  const joinedMembers = visibleMembers.filter(m => m.profile_id);
  const pendingMembers = visibleMembers.filter(m => !m.profile_id);

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

      <div className={`max-w-4xl mx-auto px-3 py-3 ${view === "graph" ? "pb-4" : "pb-24"}`}>
        {/* SLIM profile strip — hidden in graph view (canvas has its own top bar) */}
        {view !== "graph" && profile && (
          <div className="mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-ceiba-700 flex-shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
                {profile.avatar_url
                  ? <img src={profile.avatar_url} className="w-full h-full object-cover" alt="" />
                  : `${profile.first_name[0]}${profile.last_name?.[0] || ""}`}
              </div>
              <span className="font-semibold text-gray-800 flex-1 truncate">{profile.first_name} {profile.last_name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">
                {formatFamilyLine(visibleMembers.length, joinedMembers.length)}
              </span>
              <button onClick={shareTree} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0" title="Compartir árbol">
                <Share2 size={16} />
              </button>
            </div>

            {/* Contador global de crecimiento. Segunda línea discreta;
                se oculta por completo si la RPC no respondió. */}
            {growthStats && (
              <p className="text-[11px] text-gray-400 mt-0.5 pl-11 truncate">
                <span className="hidden sm:inline">{formatGrowthLine(growthStats, "desktop")}</span>
                <span className="sm:hidden">{formatGrowthLine(growthStats, "mobile")}</span>
              </p>
            )}
          </div>
        )}

        {/* Red familiar progress — hidden in graph view */}
        {view !== "graph" && (
          <NetworkBanner
            totalMembers={visibleMembers.length}
            joinedMembers={visibleMembers.filter(m => m.profile_id).length}
          />
        )}

        {/* Family list / graph */}
        {visibleMembers.length === 0 ? (
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
            {/* Action bar — hidden in graph view (view switcher lives inside the canvas) */}
            {view !== "graph" && <div className="flex items-center gap-2">
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
                  className="p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
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
            </div>}

            {view === "graph" && profile && (
              <>
                <TreeErrorBoundary>
                  {UNIVERSE_RENDERER_ENABLED ? (
                    <div style={{ height: "calc(100vh - 140px)", borderRadius: 16, overflow: "hidden", background: "#07111c" }}>
                      <FamilyUniverseComponent
                        profile={profile}
                        members={members}
                        extendedMembers={extendedMembers}
                        memberLinks={memberLinks}
                        onEditMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) {
                            openEdit(member);
                          } else {
                            if (process.env.NODE_ENV === 'development') {
                              console.error('[Universe] onEditMember: member not found for id', memberId);
                            }
                            toast.error('No pudimos abrir este familiar para editarlo');
                          }
                        }}
                        onInviteMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) sendInvite(member);
                        }}
                      />
                    </div>
                  ) : PREMIUM_TREE_RENDERER_ENABLED ? (
                    <div style={{ margin: "0 -0.75rem" }}>
                      <PremiumFamilyTree
                        profile={profile}
                        members={members}
                        extendedMembers={extendedMembers}
                        memberLinks={memberLinks}
                        onNodeClick={(memberId) => router.push(`/member/${memberId}`)}
                        onEditMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) openEdit(member);
                        }}
                        onInviteMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) sendInvite(member);
                        }}
                        onShareTree={shareTree}
                        onSwitchToList={() => setView("list")}
                        onSwitchToMap={activateMap}
                        familyCount={visibleMembers.length}
                      />
                    </div>
                  ) : (
                    <FamilyTreeGraph
                      profile={profile}
                      members={members}
                      extendedMembers={extendedMembers}
                      memberLinks={memberLinks}
                      onNodeClick={(memberId) => router.push(`/member/${memberId}`)}
                    />
                  )}
                </TreeErrorBoundary>
              </>
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

          {/* Engagement widgets — only in list/map views */}
          {view !== "graph" && (
            <div className="space-y-3 mt-4">
              {profile && <TodayWidget userId={profile.id} />}
              {profile && <BirthdayWidget userId={profile.id} />}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Broadcast Modal */}
      {showBroadcast && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-cream-50 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📢</span>
                <h2 className="text-lg font-bold text-ceiba-900">Mensaje familiar</h2>
              </div>
              <button onClick={() => { setShowBroadcast(false); setBroadcastMsg(""); }}>
                <X size={20} className="text-ceiba-400 hover:text-ceiba-600" />
              </button>
            </div>
            <p className="text-sm text-ceiba-500 mb-4">
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
          <div className="bg-cream-50 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-ceiba-900">
                {editingMember ? "Editar familiar" : "Agregar familiar"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingMember(null); setForm(EMPTY_FORM); setDuplicateWarning(null); setModalPhotoFile(null); setModalPhotoPreview(null); setPendingCollabRequests([]); }} className="text-ceiba-400 hover:text-ceiba-600">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Solicitudes de colaboración pendientes (visible solo al dueño) */}
              {editingMember && canEditMember && pendingCollabRequests.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    {pendingCollabRequests.length === 1 ? "1 solicitud pendiente" : `${pendingCollabRequests.length} solicitudes pendientes`}
                  </p>
                  {pendingCollabRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-amber-700">
                        {req.request_type === "edit" ? "Co-edición" : "Transferencia"}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => resolveCollabRequest(req.id, "approve")}
                          disabled={processingRequestId === req.id}
                          className="text-xs text-green-700 font-semibold px-2 py-1 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => resolveCollabRequest(req.id, "reject")}
                          disabled={processingRequestId === req.id}
                          className="text-xs text-red-600 font-semibold px-2 py-1 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
                  onChange={e => setForm(f => ({ ...f, relation_type: e.target.value as RelationType, parent_member_id: "" }))}
                >
                  {RELATION_GROUPS.map(group => (
                    <optgroup key={group.label} label={group.label}>
                      {group.keys.map(key => {
                        // Etiqueta desde el catálogo central; deshabilitada si
                        // todavía no se puede ejecutar de forma segura.
                        const supported = isAddRelativeSupported(key);
                        return (
                          <option key={key} value={key} disabled={!supported}>
                            {KINSHIP_CATALOG[key].label}{supported ? "" : UNSUPPORTED_SUFFIX}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Selector de familiar conector — abuelos/bisabuelos/nietos/bisnietos */}
              {relationRequiresConnector(form.relation_type) && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {connectorLabel(form.relation_type)} <span className="text-red-400">*</span>
                  </label>
                  {connectorCandidates(form.relation_type).length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">
                      Primero agrega el familiar intermedio (el {(form.relation_type.startsWith("great_grand") ? "abuelo/a o nieto/a" : "padre/madre o hijo/a")} correspondiente) para poder conectar este parentesco.
                    </p>
                  ) : (
                    <select
                      className="input-field text-sm"
                      value={form.parent_member_id}
                      onChange={e => setForm(f => ({ ...f, parent_member_id: e.target.value }))}
                    >
                      <option value="">— Selecciona un familiar —</option>
                      {connectorCandidates(form.relation_type).map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              {editingMember ? (
                <>
                  <button
                    onClick={deleteMember}
                    disabled={saving || !canEditMember}
                    className="btn-secondary text-red-500 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={updateMember}
                    disabled={saving || !canEditMember}
                    className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingEditPermission ? "Verificando..." : saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <>
                  {/* Error real devuelto por add_relative — sin ocultar la causa */}
                  {saveError && (
                    <div className="w-full mb-2 bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-xs font-semibold text-red-800 mb-1">No se pudo agregar</p>
                      <p className="text-xs text-red-700 leading-relaxed break-words">{saveError}</p>
                    </div>
                  )}
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
      {/* Floating 3D "Agregar familiar" button */}
      <style>{`
        @keyframes ceiba-fab-breathe {
          0%, 100% { box-shadow: 0 6px 20px rgba(94,138,80,0.45), 0 2px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22); }
          50%       { box-shadow: 0 8px 28px rgba(94,138,80,0.55), 0 3px 8px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.22); }
        }
        .ceiba-fab {
          position: fixed;
          right: 20px;
          bottom: calc(112px + env(safe-area-inset-bottom));
          width: 62px;
          height: 62px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #7daa72 0%, #6e9464 45%, #5c7a52 100%);
          box-shadow: 0 6px 20px rgba(94,138,80,0.45), 0 2px 6px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.22);
          color: white;
          z-index: 40;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          animation: ceiba-fab-breathe 4s ease-in-out infinite;
          outline-offset: 3px;
        }
        .ceiba-fab:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 12px 32px rgba(94,138,80,0.55), 0 4px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22);
        }
        .ceiba-fab:active {
          transform: translateY(0px) scale(0.95);
          box-shadow: 0 3px 10px rgba(94,138,80,0.35), 0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .ceiba-fab:focus-visible {
          outline: 2px solid #6e9464;
          outline-offset: 3px;
        }
        @media (min-width: 768px) {
          .ceiba-fab {
            width: 70px;
            height: 70px;
            bottom: calc(80px + env(safe-area-inset-bottom));
            right: 28px;
          }
        }
        @media (min-width: 1024px) {
          .ceiba-fab {
            bottom: 32px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .ceiba-fab {
            animation: none;
            transition: none;
          }
          .ceiba-fab:hover { transform: none; }
          .ceiba-fab:active { transform: none; }
        }
      `}</style>
      <button
        className="ceiba-fab"
        onClick={() => setShowModal(true)}
        aria-label="Agregar familiar"
        title="Agregar familiar"
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>

      <BottomNav />

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

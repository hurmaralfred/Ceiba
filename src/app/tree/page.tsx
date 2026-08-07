"use client";
import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import lazyLoad from "next/dynamic";
import { TreePine, MapPin, Users, Share2, LogOut, User, Send, List, GitFork, Plus, X, Pencil, Map as MapIcon, Image, Calendar, MessageCircle, Megaphone, Camera, AlertTriangle, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RelationType, RELATION_LABELS } from "@/lib/types";
import { adaptGraph, buildAddRelativeRequest, isAddRelativeSupported, relationRequiresConnector, type FamilyGraph } from "@/lib/graphAdapter";
import { KINSHIP_CATALOG, type KinshipKey } from "@/domain/relationships";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";
import { FamilyUniverse as FamilyUniverseComponent } from "@/components/universe/FamilyUniverse";
import { GalaxyOrbitView } from "@/components/universe/GalaxyOrbitView";
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
import { CosmicNav } from "@/components/ui/cosmic";
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
const GALAXY_ORBIT_ENABLED = false;

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
  return (
    <Suspense>
      <TreePageContent />
    </Suspense>
  );
}

function TreePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  usePushNotifications(); // Registra FCM token si el usuario da permiso
  const [showWelcome, setShowWelcome] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [extendedMembers, setExtendedMembers] = useState<ExtendedEntry[]>([]);
  const [memberLinks, setMemberLinks] = useState<MemberLink[]>([]);
  const [visibleMembers, setVisibleMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<"graph" | "list" | "map">("graph");
  const [useClassicView, setUseClassicView] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ceiba_view") === "classic";
  });
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
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
    candidates: Array<{ person_id: string; first_name: string; first_surname: string; confidence: number; is_claimed: boolean }>;
    matchedName: string;
    score: number;
  } | null>(null);
  const [pendingConnectionRequests, setPendingConnectionRequests] = useState<Array<{
    id: string; requester_person_id: string; relation_key: string; created_at: string;
    requester: { first_name: string; first_surname: string } | null;
  }>>([]);
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
  const [showSearch, setShowSearch] = useState(false);
  const [invitePrompt, setInvitePrompt] = useState<{ name: string; firstName: string } | null>(null);

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
    if (searchParams.get("welcome") === "1") {
      setShowWelcome(true);
      // Limpiar param de la URL sin recargar
      window.history.replaceState({}, "", "/tree");
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
    const { data: graphData, error: graphError } = await supabase.rpc("get_my_family_graph", { p_depth: 4 });
    if (graphError) throw graphError;

    const graph = graphData as FamilyGraph | null;
    if (!graph || !graph.me) {
      setLoading(false);
      return;
    }

    const { profile, members, extendedMembers, memberLinks } = adaptGraph(graph, user.id);

    // Load avatar_config separately (not in adaptGraph)
    const { data: avatarRow } = await supabase
      .from('profiles')
      .select('avatar_config')
      .eq('id', user.id)
      .single()
    const profileWithConfig = avatarRow?.avatar_config
      ? ({ ...profile, avatar_config: avatarRow.avatar_config } as typeof profile)
      : profile

    // Enrich avatars from profiles table (service role) so galaxy nodes show
    // photos even when persons.photo_path is stale or missing
    const personIds = (graph.nodes || []).map((n: any) => n.id as string);
    let photoMap = new Map<string, string>();
    try {
      const res = await fetch("/api/members/avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personIds }),
      });
      if (res.ok) {
        const { avatars } = await res.json();
        photoMap = new Map(Object.entries(avatars as Record<string, string>));
      }
    } catch { /* non-critical, fall back to RPC data */ }

    const enrichMember = (m: any) => {
      const url = photoMap.get(m.id) ?? m.profile?.avatar_url ?? null;
      if (!url || url === m.profile?.avatar_url) return m;
      return { ...m, profile: { ...(m.profile ?? {}), avatar_url: url } };
    };
    const enrichedMembers = members.map(enrichMember);
    const enrichedExtended = extendedMembers.map((e: any) => ({ ...e, member: enrichMember(e.member) }));

    const rootUrl = photoMap.get(graph.me ?? "") ?? profileWithConfig?.avatar_url ?? null;
    const enrichedProfile = rootUrl
      ? ({ ...profileWithConfig, avatar_url: rootUrl } as typeof profileWithConfig)
      : profileWithConfig;

    const unified = buildVisibleMembers(enrichedMembers, enrichedExtended);

    setProfile(enrichedProfile);
    setMembers(enrichedMembers);
    setExtendedMembers(enrichedExtended);
    setMemberLinks(memberLinks);
    setVisibleMembers(unified);

    // Ubicación del usuario (de persons)
    const myNode = (graph.nodes || []).find((n: any) => n.id === graph.me);
    // (location está en profiles por ahora, no en persons)

    } catch (err: any) {
      console.error("loadData error:", err);
      setLoadError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
    // Cargar solicitudes de conexión familiar entrantes (el usuario es el destinatario)
    try {
      const { data: connReqs } = await supabase
        .from("family_connection_requests")
        .select("id, requester_person_id, relation_key, created_at")
        .eq("status", "pending");
      if (connReqs && connReqs.length > 0) {
        const personIds = connReqs.map((r: any) => r.requester_person_id);
        const { data: personRows } = await supabase
          .from("persons")
          .select("id, first_name, first_surname")
          .in("id", personIds);
        const personMap = new Map((personRows || []).map((p: any) => [p.id, p]));
        setPendingConnectionRequests(connReqs.map((r: any) => ({
          ...r,
          requester: personMap.get(r.requester_person_id) || null,
        })));
      } else {
        setPendingConnectionRequests([]);
      }
    } catch {
      setPendingConnectionRequests([]);
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

  // Envía solicitud de conexión cuando el candidato ya tiene cuenta registrada.
  // En lugar de vincular de inmediato, notifica al destinatario para que acepte.
  const sendConnectionRequest = async () => {
    if (!duplicateWarning?.candidates?.[0]) return;
    setSaving(true);
    try {
      const top = duplicateWarning.candidates[0];
      const relRequest = buildAddRelativeRequest(
        form.relation_type as RelationType,
        form.parent_member_id || null
      );
      const { error } = await supabase.rpc("request_family_connection", {
        p_target_person_id:  top.person_id,
        p_relation_key:      relRequest.backendRelationKey,
        p_relationship_type: relRequest.primitive,
        p_parent_kind:       relRequest.parentKind || "unknown",
      });
      if (error) throw error;
      toast.success(`Solicitud enviada — ${top.first_name} debe confirmar`);
      setShowModal(false);
      setForm(EMPTY_FORM);
      setDuplicateWarning(null);
    } catch (err: any) {
      toast.error(err?.message || "Error al enviar la solicitud");
    } finally {
      setSaving(false);
    }
  };

  // Responde (aprueba o rechaza) una solicitud de conexión entrante.
  const respondToConnectionRequest = async (requestId: string, action: "approve" | "reject") => {
    try {
      const { error } = await supabase.rpc("respond_to_family_request", {
        p_request_id: requestId,
        p_action:     action,
      });
      if (error) throw error;
      toast.success(action === "approve" ? "Conexión aceptada — ya estás en el árbol" : "Solicitud rechazada");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar la solicitud");
    }
  };

  const saveMember = async (force = false) => {
    if (!form.primer_nombre.trim()) { toast.error("El primer nombre es obligatorio"); return; }
    if (!form.primer_apellido.trim()) { toast.error("El primer apellido es obligatorio"); return; }
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
        const candidates: Array<{ person_id: string; first_name: string; first_surname: string; confidence: number; is_claimed: boolean }> =
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

      const addedName = `${form.primer_nombre.trim()} ${form.primer_apellido.trim()}`.trim();
      toast.success(`${addedName} agregado al árbol`);
      setShowModal(false);
      setForm(EMPTY_FORM);
      loadData();
      loadGrowthStats();
      // Invite prompt — show after 600ms so modal close animation finishes
      setTimeout(() => setInvitePrompt({ name: addedName, firstName: form.primer_nombre.trim() }), 600);
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

    // Usar Web Share API en móvil (abre WhatsApp, Instagram, etc.)
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Mi árbol familiar en Ceiba",
          text: "Te comparto mi árbol familiar 🌳 — únete para ver toda la familia conectada.",
          url: link,
        });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // usuario canceló
      }
    }

    // Fallback: copiar al clipboard
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
    <div style={{ minHeight: "100vh", background: "#030208", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#160208", border: "1px solid rgba(220,60,80,0.25)", borderRadius: 20, padding: 24, maxWidth: 480, width: "100%" }}>
        <p style={{ color: "#fff", fontWeight: 700, marginBottom: 8 }}>Error al cargar</p>
        <p style={{ color: "rgba(220,60,80,0.7)", fontSize: 13, wordBreak: "break-all" }}>{loadError}</p>
      </div>
    </div>
  );

  const bloodMembers = visibleMembers.filter(m => m.relation_kind === "blood");
  const affinityMembers = visibleMembers.filter(m => m.relation_kind === "affinity");
  const joinedMembers = visibleMembers.filter(m => m.profile_id);
  const pendingMembers = visibleMembers.filter(m => !m.profile_id);

  return (
    <div style={{ minHeight: "100vh", background: "#030208" }}>

      {/* ── Solicitudes de conexión familiar entrantes ── */}
      {pendingConnectionRequests.length > 0 && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 180,
          background: "rgba(12,10,24,0.97)",
          borderBottom: "1px solid rgba(212,175,55,0.35)",
          padding: "calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px",
        }}>
          {pendingConnectionRequests.map(req => {
            const name = req.requester
              ? `${req.requester.first_name} ${req.requester.first_surname}`.trim()
              : "Alguien";
            return (
              <div key={req.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", flex: 1, minWidth: 0 }}>
                  🔗 <strong style={{ color: "#d4af37" }}>{name}</strong> quiere conectarse contigo como familiar
                </span>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => respondToConnectionRequest(req.id, "reject")}
                    style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
                  >
                    Rechazar
                  </button>
                  <button
                    onClick={() => respondToConnectionRequest(req.id, "approve")}
                    style={{ fontSize: 12, fontWeight: 700, color: "#030208", background: "#d4af37", border: "none", borderRadius: 8, padding: "5px 14px", cursor: "pointer" }}
                  >
                    Aceptar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Overlay bienvenida primer uso ── */}
      {showWelcome && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(3,2,8,0.88)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
        }}>
          <div style={{
            width: "100%", maxWidth: 480, margin: "0 auto",
            background: "#0c0a18",
            borderTop: "1.5px solid rgba(212,175,55,0.45)",
            borderLeft: "1px solid rgba(212,175,55,0.18)",
            borderRight: "1px solid rgba(0,0,0,0.6)",
            borderRadius: "24px 24px 0 0",
            padding: "28px 24px 40px",
            boxShadow: "0 -12px 40px rgba(0,0,0,0.8), 0 0 40px rgba(212,175,55,0.1)",
          }}>
            {/* Barra de arrastre */}
            <div style={{ width: 40, height: 4, borderRadius: 2, background: "rgba(212,175,55,0.2)", margin: "0 auto 24px" }} />

            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌳</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>
                ¡Tu árbol familiar está vivo!
              </h2>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                Cuando tus familiares entren, el árbol ya estará listo para ellos.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                onClick={() => {
                  setShowWelcome(false);
                  if (profile?.id) {
                    const msg = `Hola, te invito a Ceiba — la app donde nuestra familia se mantiene conectada. Entra aquí: https://ceibapp.com`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }
                }}
                style={{
                  width: "100%", padding: "14px 0", borderRadius: 14,
                  background: "#25D366",
                  borderTop: "2px solid #3de87d", borderLeft: "1.5px solid rgba(100,255,150,0.4)",
                  borderBottom: "4px solid #148a3e", borderRight: "1.5px solid rgba(0,0,0,0.4)",
                  boxShadow: "0 8px 0 #0d6b2e, 0 12px 24px rgba(0,0,0,0.5)",
                  color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer", border: "none",
                }}
              >
                Invitar familia por WhatsApp
              </button>

              <button
                onClick={() => setShowWelcome(false)}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 14,
                  background: "transparent",
                  border: "1px solid rgba(212,175,55,0.22)",
                  color: "rgba(212,175,55,0.7)", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                Explorar mi árbol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header galaxy */}
      <nav style={{
        background: "rgba(3,2,8,0.97)", backdropFilter: "blur(12px)",
        borderBottom: "0.5px solid rgba(212,175,55,0.18)",
        padding: "52px 18px 12px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 40,
      }}>
        {/* Logo */}
        <Link href="/tree" style={{ display: "flex", alignItems: "center", gap: 7, textDecoration: "none" }}>
          <span style={{ color: "#d4af37", fontSize: 18, lineHeight: 1 }}>✦</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#d4af37", letterSpacing: "0.02em" }}>Ceiba</span>
        </Link>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Buscar */}
          <button onClick={() => setShowSearch(true)} style={{
            width: 44, height: 44, borderRadius: 12, background: "#0c0a1a", border: "none",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <Search size={17} style={{ color: "rgba(212,175,55,0.7)" }} />
          </button>

          {/* Invitar */}
          <Link href="/invitar" style={{ textDecoration: "none" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "#c9a820", borderRadius: 12, padding: "8px 14px",
              borderTop: "1.5px solid #f5e060", borderBottom: "2.5px solid #6a5600",
              boxShadow: "0 5px 0 #4a3c00, 0 8px 16px rgba(0,0,0,0.6)",
              fontSize: 13, fontWeight: 700, color: "#030208", minHeight: 44,
            }}>
              <Send size={14} /> Invitar
            </div>
          </Link>

          {/* Compartir */}
          <button onClick={shareTree} style={{
            width: 44, height: 44, borderRadius: 12, background: "#0c0a1a", border: "none",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
          }}>
            <Share2 size={17} style={{ color: "rgba(212,175,55,0.7)" }} />
          </button>

          {/* Perfil */}
          <Link href="/profile">
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: "#0c0a1a",
              borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
              boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <User size={17} style={{ color: "rgba(212,175,55,0.7)" }} />
            </div>
          </Link>

          {/* SOS */}
          <button
            onClick={triggerSOS}
            disabled={sosSending}
            title="Enviar alerta SOS a tu familia"
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none", cursor: "pointer",
              background: sosActive ? "#7f1d1d" : "#dc2626",
              borderTop: "1px solid rgba(255,100,100,0.4)", borderBottom: "2px solid #7f1d1d",
              boxShadow: "0 4px 0 #450a0a, 0 6px 12px rgba(0,0,0,0.6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: sosActive ? "pulse 2s infinite" : "none",
            }}
          >
            <AlertTriangle size={17} style={{ color: "#fff" }} />
          </button>
        </div>
      </nav>

      {/* Notification permission banner */}
      {!notifDismissed && notifPermission !== "granted" && notifPermission !== "unsupported" && (
        <div style={{
          padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, fontSize: 12,
          background: notifPermission === "denied" ? "rgba(40,40,50,0.9)" : "rgba(180,120,0,0.85)",
          borderBottom: "0.5px solid rgba(212,175,55,0.15)",
        }}>
          <span>🔔</span>
          <span style={{ flex: 1, color: "rgba(255,255,255,0.85)", lineHeight: 1.4 }}>
            {notifPermission === "denied"
              ? "Notificaciones bloqueadas. Actívalas en ajustes para recibir alertas familiares."
              : "Activa notificaciones para cumpleaños, anuncios y alertas."}
          </span>
          {notifPermission !== "denied" && (
            <button onClick={requestNotificationPermission} style={{
              background: "#d4af37", border: "none", borderRadius: 8, padding: "5px 10px",
              color: "#030208", fontWeight: 700, fontSize: 11, cursor: "pointer", flexShrink: 0,
            }}>
              Activar
            </button>
          )}
          <button onClick={() => setNotifDismissed(true)} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.5)",
            fontSize: 18, cursor: "pointer", lineHeight: 1, flexShrink: 0, padding: 0,
          }}>×</button>
        </div>
      )}

      <div style={view === "graph"
        ? { padding: 0 }
        : { maxWidth: 896, margin: "0 auto", padding: "0 14px 96px" }
      }>
        {/* SLIM profile strip — hidden in graph view */}
        {view !== "graph" && profile && (
          <div style={{ marginBottom: 12, paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 11, background: "#0c0a1a", flexShrink: 0,
                border: "1.5px solid rgba(212,175,55,0.35)", overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#d4af37", fontWeight: 800, fontSize: 13,
              }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : `${profile.first_name[0]}${profile.last_name?.[0] || ""}`}
              </div>
              <span style={{ fontWeight: 700, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {profile.first_name} {profile.last_name}
              </span>
              <span style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", flexShrink: 0 }}>
                {formatFamilyLine(visibleMembers.length, joinedMembers.length)}
              </span>
              <button onClick={shareTree} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, flexShrink: 0 }}>
                <Share2 size={15} style={{ color: "rgba(212,175,55,0.5)" }} />
              </button>
            </div>
            {growthStats && (
              <p style={{ fontSize: 11, color: "rgba(212,175,55,0.35)", marginTop: 2, paddingLeft: 46, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {formatGrowthLine(growthStats, "mobile")}
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
          <div style={{ textAlign: "center", padding: "40px 24px", borderRadius: 20,
            background: "#0c0a18", border: "0.5px solid rgba(212,175,55,0.12)", marginTop: 16 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(212,175,55,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <TreePine size={36} style={{ color: "rgba(212,175,55,0.4)" }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Tu árbol familiar te espera</h3>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24, maxWidth: 280, margin: "0 auto 24px", lineHeight: 1.6 }}>
              Agrega a tu mamá, papá, hermanos o pareja. Cuando ellos se registren, sus familiares se conectarán solos a tu árbol.
            </p>
            <button onClick={() => setShowModal(true)} style={{
              background: "#c9a820", border: "none", borderRadius: 12, padding: "12px 24px",
              borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
              boxShadow: "0 6px 0 #4a3c00, 0 10px 20px rgba(0,0,0,0.6)",
              color: "#030208", fontWeight: 800, fontSize: 14, cursor: "pointer",
            }}>
              <Plus size={15} style={{ display: "inline", marginRight: 6 }} /> Agregar primer familiar
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Action bar — hidden in graph view */}
            {view !== "graph" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 12 }}>
                {joinedMembers.length > 0 && (
                  <button onClick={() => setShowBroadcast(true)} style={{
                    width: 44, height: 44, borderRadius: 12, background: "#0c0a1a", border: "none",
                    borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
                    boxShadow: "0 4px 0 #02010a", display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", flexShrink: 0,
                  }}>
                    <Megaphone size={18} style={{ color: "rgba(212,175,55,0.7)" }} />
                  </button>
                )}
                {/* View toggle */}
                <div style={{ display: "flex", alignItems: "center", background: "#0c0a1a",
                  borderRadius: 12, padding: 3, gap: 2, flexShrink: 0,
                  border: "0.5px solid rgba(212,175,55,0.14)" }}>
                  {([
                    { v: "graph", Icon: GitFork, label: "Árbol" },
                    { v: "list",  Icon: List,    label: "Lista" },
                    { v: "map",   Icon: MapIcon, label: "Mapa" },
                  ] as const).map(({ v, Icon, label }) => (
                    <button key={v}
                      onClick={() => v === "map" ? activateMap() : setView(v as any)}
                      title={label}
                      style={{
                        padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer",
                        background: view === v ? "#1a1428" : "transparent",
                        boxShadow: view === v ? "0 2px 6px rgba(0,0,0,0.5)" : "none",
                      }}>
                      <Icon size={14} style={{ color: view === v ? "#d4af37" : "rgba(212,175,55,0.3)" }} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {view === "graph" && profile && (
              <>
                <TreeErrorBoundary>
                  {GALAXY_ORBIT_ENABLED && !useClassicView && !isMobile ? (
                    <div style={{ position: "relative", height: "calc(100svh - 80px)", overflow: "hidden", background: "#030208" }}>
                      <GalaxyOrbitView
                        profile={profile}
                        members={members}
                        extendedMembers={extendedMembers}
                        memberLinks={memberLinks}
                        onViewMember={(memberId) => router.push(`/member/${memberId}`)}
                        onEditMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) openEdit(member);
                        }}
                        onInviteMember={(memberId) => {
                          const member = resolveMemberForEdit(memberId, members, extendedMembers);
                          if (member) sendInvite(member);
                        }}
                        onAddMember={() => setShowModal(true)}
                      />
                      {/* Stats pill */}
                      <div style={{
                        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
                        display: "flex", alignItems: "center", gap: 10,
                        background: "rgba(8,4,2,0.72)", backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(242,180,60,0.22)", borderRadius: 30,
                        padding: "5px 16px", zIndex: 900, pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}>
                        <span style={{ fontSize: 11, color: "rgba(242,228,208,0.65)", letterSpacing: "0.04em" }}>
                          Tu galaxia familiar
                        </span>
                        <span style={{ color: "rgba(242,180,60,0.25)", fontSize: 14, lineHeight: 1 }}>·</span>
                        <span style={{ fontSize: 11, color: "rgba(242,228,208,0.75)", letterSpacing: "0.02em" }}>
                          <span style={{ color: "#F2B43C", fontWeight: 700 }}>{visibleMembers.length}</span>
                          {" personas"}
                        </span>
                      </div>
                      {/* Classic view toggle — discrete, bottom-left */}
                      <button
                        onClick={() => {
                          setUseClassicView(true);
                          localStorage.setItem("ceiba_view", "classic");
                        }}
                        style={{
                          position: "absolute", bottom: 24, left: 20, zIndex: 20,
                          background: "rgba(8,5,18,0.72)", backdropFilter: "blur(12px)",
                          border: "0.5px solid rgba(212,175,55,0.18)", borderRadius: 10,
                          padding: "5px 10px", cursor: "pointer",
                          color: "rgba(212,175,55,0.45)", fontSize: 9,
                          letterSpacing: "0.10em", textTransform: "uppercase",
                        }}>
                        Vista clásica
                      </button>
                    </div>
                  ) : UNIVERSE_RENDERER_ENABLED ? (
                    <div style={{ position: "relative", height: "calc(100svh - 80px)", overflow: "hidden", background: "#030208" }}>
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
                        onAddMember={() => setShowModal(true)}
                      />
                      {/* Stats pill — family count + global Ceiba growth */}
                      <div style={{
                        position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)",
                        display: "flex", alignItems: "center", gap: 10,
                        background: "rgba(8,4,2,0.72)", backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        border: "1px solid rgba(242,180,60,0.22)", borderRadius: 30,
                        padding: "5px 16px", zIndex: 900, pointerEvents: "none",
                        whiteSpace: "nowrap",
                      }}>
                        <span style={{ fontSize: 11, color: "rgba(242,228,208,0.65)", letterSpacing: "0.04em" }}>
                          Tu universo familiar
                        </span>
                        <span style={{ color: "rgba(242,180,60,0.25)", fontSize: 14, lineHeight: 1 }}>·</span>
                        <span style={{ fontSize: 11, color: "rgba(242,228,208,0.75)", letterSpacing: "0.02em" }}>
                          <span style={{ color: "#F2B43C", fontWeight: 700 }}>{visibleMembers.length}</span>
                          {" personas"}
                        </span>
                      </div>
                      {/* Return to galaxy view */}
                      <button
                        onClick={() => {
                          setUseClassicView(false);
                          localStorage.setItem("ceiba_view", "galaxy");
                        }}
                        style={{
                          position: "absolute", bottom: 24, left: 20, zIndex: 20,
                          background: "rgba(8,5,18,0.72)", backdropFilter: "blur(12px)",
                          border: "0.5px solid rgba(212,175,55,0.18)", borderRadius: 10,
                          padding: "5px 10px", cursor: "pointer",
                          color: "rgba(212,175,55,0.45)", fontSize: 9,
                          letterSpacing: "0.10em", textTransform: "uppercase",
                        }}>
                        ✦ Vista galaxia
                      </button>
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
        <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: "rgba(2,1,10,0.82)", backdropFilter: "blur(6px)" }}>
          <style>{`
            .modal-dark .input-field {
              background: rgba(6,4,18,0.80) !important;
              border: 1px solid rgba(212,175,55,0.25) !important;
              color: rgba(255,255,255,0.88) !important;
              border-radius: 10px !important;
            }
            .modal-dark .input-field::placeholder { color: rgba(255,255,255,0.22) !important; }
            .modal-dark .input-field:focus {
              border-color: rgba(212,175,55,0.55) !important;
              box-shadow: 0 0 0 2px rgba(212,175,55,0.12) !important;
              outline: none !important;
            }
            .modal-dark select.input-field option { background: #0c0a18; color: rgba(255,255,255,0.85); }
            .modal-dark select.input-field optgroup { background: #0c0a18; color: rgba(212,175,55,0.6); }
          `}</style>
          <div className="modal-dark rounded-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: "linear-gradient(160deg, #0e0b1f 0%, #07060f 100%)",
              border: "1px solid rgba(212,175,55,0.20)",
              boxShadow: "0 0 60px rgba(0,0,0,0.9), 0 0 0 0.5px rgba(212,175,55,0.08), inset 0 1px 0 rgba(212,175,55,0.12)",
            }}>
            <div className="flex items-center justify-between mb-5">
              <h2 style={{ fontSize: 17, fontWeight: 800, color: "#d4af37", letterSpacing: 0.3 }}>
                {editingMember ? "Editar familiar" : "Agregar familiar"}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingMember(null); setForm(EMPTY_FORM); setDuplicateWarning(null); setModalPhotoFile(null); setModalPhotoPreview(null); setPendingCollabRequests([]); }}
                style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {/* Solicitudes de colaboración pendientes (visible solo al dueño) */}
              {editingMember && canEditMember && pendingCollabRequests.length > 0 && (
                <div style={{ background: "rgba(180,120,0,0.12)", border: "1px solid rgba(212,175,55,0.30)", borderRadius: 12, padding: "10px 12px" }} className="space-y-2">
                  <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.9)" }}>
                    {pendingCollabRequests.length === 1 ? "1 solicitud pendiente" : `${pendingCollabRequests.length} solicitudes pendientes`}
                  </p>
                  {pendingCollabRequests.map(req => (
                    <div key={req.id} className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 11, color: "rgba(212,175,55,0.65)" }}>
                        {req.request_type === "edit" ? "Co-edición" : "Transferencia"}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => resolveCollabRequest(req.id, "approve")}
                          disabled={processingRequestId === req.id}
                          style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", padding: "3px 8px", background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.25)", borderRadius: 7 }}
                          className="disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          onClick={() => resolveCollabRequest(req.id, "reject")}
                          disabled={processingRequestId === req.id}
                          style={{ fontSize: 11, fontWeight: 600, color: "#f87171", padding: "3px 8px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)", borderRadius: 7 }}
                          className="disabled:opacity-50"
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
                    style={{ width: 56, height: 56, borderRadius: "50%", flexShrink: 0, cursor: "pointer", overflow: "hidden",
                      border: "2px dashed rgba(212,175,55,0.35)", background: "rgba(212,175,55,0.05)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    {modalPhotoPreview
                      ? <img src={modalPhotoPreview} className="w-full h-full object-cover" alt="" />
                      : <Camera size={20} style={{ color: "rgba(212,175,55,0.5)" }} />}
                  </div>
                  <div>
                    <button type="button" onClick={() => modalPhotoRef.current?.click()}
                      style={{ fontSize: 13, fontWeight: 600, color: "rgba(212,175,55,0.85)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {modalPhotoPreview ? "Cambiar foto" : "Añadir foto"}
                    </button>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>Aparecerá en el árbol hasta que se registre</p>
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
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Primer nombre <span style={{ color: "#f87171" }}>*</span></label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Hugo"
                    value={form.primer_nombre}
                    onChange={e => setForm(f => ({ ...f, primer_nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Segundo nombre</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Armando"
                    value={form.segundo_nombre}
                    onChange={e => setForm(f => ({ ...f, segundo_nombre: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Primer apellido <span style={{ color: "#f87171" }}>*</span></label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Hurtado"
                    value={form.primer_apellido}
                    onChange={e => setForm(f => ({ ...f, primer_apellido: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Segundo apellido</label>
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
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Correo (para invitarlo)</label>
                  <input
                    type="email"
                    className="input-field text-sm"
                    placeholder="correo@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Fecha de nacimiento</label>              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Ciudad de nacimiento</label>
                  <input
                    type="text"
                    className="input-field text-sm"
                    placeholder="ej. Bogotá"
                    value={form.birth_city}
                    onChange={e => setForm(f => ({ ...f, birth_city: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>País de nacimiento</label>
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
                  <div style={{ width: 40, height: 20, borderRadius: 10, transition: "background 0.2s",
                    background: form.is_deceased ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.12)" }} />
                  <div style={{ position: "absolute", top: 3, left: 3, width: 14, height: 14,
                    borderRadius: "50%", background: form.is_deceased ? "#d4af37" : "rgba(255,255,255,0.5)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.5)", transition: "transform 0.2s, background 0.2s",
                    transform: form.is_deceased ? "translateX(20px)" : "translateX(0)" }} />
                </div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                  Fallecido(a){" "}
                  <span style={{ color: "rgba(255,255,255,0.30)", fontWeight: 400 }}>— aparecerá con † en el árbol</span>
                </span>
              </label>

              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>Parentesco *</label>
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
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(212,175,55,0.6)", marginBottom: 4, letterSpacing: "0.04em" }}>
                    {connectorLabel(form.relation_type)} <span style={{ color: "#f87171" }}>*</span>
                  </label>
                  {connectorCandidates(form.relation_type).length === 0 ? (
                    <p style={{ fontSize: 11, color: "rgba(212,175,55,0.75)", background: "rgba(180,120,0,0.10)", border: "1px solid rgba(212,175,55,0.22)", borderRadius: 8, padding: "8px 10px" }}>
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
            <div style={{ display: "flex", gap: 10, marginTop: 20, borderTop: "1px solid rgba(212,175,55,0.10)", paddingTop: 18 }}>
              {editingMember ? (
                <>
                  <button
                    onClick={deleteMember}
                    disabled={saving || !canEditMember}
                    style={{ padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                      color: "#f87171", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)",
                      cursor: "pointer" }}
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Eliminar
                  </button>
                  <button
                    onClick={updateMember}
                    disabled={saving || !canEditMember}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                      color: "#0c0a18", background: "linear-gradient(135deg,#f0c040 0%,#c8902a 100%)",
                      border: "none", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.25)" }}
                    className="disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {checkingEditPermission ? "Verificando..." : saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <>
                  {/* Error real devuelto por add_relative — sin ocultar la causa */}
                  {saveError && (
                    <div style={{ width: "100%", marginBottom: 8, background: "rgba(220,60,60,0.10)", border: "1px solid rgba(248,113,113,0.30)", borderRadius: 12, padding: "10px 12px" }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#f87171", marginBottom: 3 }}>No se pudo agregar</p>
                      <p style={{ fontSize: 11, color: "rgba(248,113,113,0.75)", lineHeight: 1.5, wordBreak: "break-word" }}>{saveError}</p>
                    </div>
                  )}
                  {/* Duplicate warning */}
                  {duplicateWarning && (() => {
                    const top = duplicateWarning.candidates[0];
                    const isClaimed = top?.is_claimed ?? false;
                    return (
                      <div style={{ width: "100%", marginBottom: 8, background: "rgba(180,120,0,0.12)", border: "1px solid rgba(212,175,55,0.28)", borderRadius: 12, padding: "10px 12px" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.9)", marginBottom: 3 }}>⚠️ Posible duplicado detectado</p>
                        <p style={{ fontSize: 11, color: "rgba(212,175,55,0.70)", lineHeight: 1.5, marginBottom: 4 }}>
                          <span style={{ fontWeight: 700 }}>{duplicateWarning.matchedName}</span>
                          {isClaimed ? " ya tiene cuenta en Ceiba." : " ya existe en Ceiba."}
                          {" "}¿Es la misma persona que estás agregando?
                        </p>
                        {isClaimed && (
                          <p style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", marginBottom: 10 }}>
                            Tiene su propio perfil — recibirá una solicitud para confirmar el parentesco.
                          </p>
                        )}
                        {!isClaimed && <div style={{ marginBottom: 10 }} />}
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setDuplicateWarning(null); saveMember(true); }}
                            style={{ flex: 1, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)", padding: "6px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, cursor: "pointer" }}
                          >
                            No, son diferentes
                          </button>
                          {isClaimed ? (
                            <button
                              onClick={sendConnectionRequest}
                              disabled={saving}
                              style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#0c0a18", padding: "6px 10px", background: "linear-gradient(135deg,#f0c040,#c8902a)", border: "none", borderRadius: 8, cursor: "pointer" }}
                              className="disabled:opacity-50"
                            >
                              {saving ? "Enviando..." : "Sí — enviar solicitud"}
                            </button>
                          ) : (
                            <button
                              onClick={saveLinkedMember}
                              disabled={saving}
                              style={{ flex: 1, fontSize: 11, fontWeight: 700, color: "#0c0a18", padding: "6px 10px", background: "linear-gradient(135deg,#f0c040,#c8902a)", border: "none", borderRadius: 8, cursor: "pointer" }}
                              className="disabled:opacity-50"
                            >
                              {saving ? "Vinculando..." : "Sí, es la misma"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  <button onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setDuplicateWarning(null); }}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                      color: "rgba(255,255,255,0.50)", background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.10)", cursor: "pointer" }}>
                    Cancelar
                  </button>
                  <button onClick={() => saveMember()} disabled={saving}
                    style={{ flex: 1, padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 700,
                      color: "#0c0a18", background: "linear-gradient(135deg,#f0c040 0%,#c8902a 100%)",
                      border: "none", cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(212,175,55,0.35), inset 0 1px 0 rgba(255,255,255,0.25)" }}
                    className="disabled:opacity-50">
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
        @keyframes ceiba-fab-pulse {
          0%, 100% {
            transform: scale(1) translateY(0);
            box-shadow: 0 8px 0 #4a3c00, 0 10px 28px rgba(212,175,55,0.50), 0 0 0 0 rgba(212,175,55,0.35);
          }
          40% {
            transform: scale(1.11) translateY(-4px);
            box-shadow: 0 10px 0 #4a3c00, 0 20px 40px rgba(212,175,55,0.75), 0 0 0 10px rgba(212,175,55,0.15);
          }
          55% {
            transform: scale(1.11) translateY(-4px);
            box-shadow: 0 10px 0 #4a3c00, 0 20px 40px rgba(212,175,55,0.75), 0 0 0 18px rgba(212,175,55,0);
          }
        }
        .ceiba-fab {
          position: fixed;
          right: 20px;
          bottom: calc(132px + env(safe-area-inset-bottom));
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border-top: 1.5px solid #fff9c4;
          border-bottom: 3px solid #6a5600;
          border-left: 1px solid rgba(255,240,100,0.4);
          border-right: 1px solid rgba(0,0,0,0.35);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(145deg, #f5e060 0%, #d4af37 45%, #b8950a 100%);
          box-shadow: 0 5px 0 #4a3c00, 0 7px 18px rgba(212,175,55,0.40), 0 0 0 0 rgba(212,175,55,0.25);
          color: #030208;
          z-index: 55;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          animation: ceiba-fab-pulse 2.2s ease-in-out infinite;
          outline-offset: 3px;
        }
        .ceiba-fab::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at 36% 22%, rgba(255,255,255,0.55) 0%, transparent 58%);
          pointer-events: none;
        }
        .ceiba-fab:hover {
          animation: none;
          transform: scale(1.12) translateY(-4px);
          box-shadow: 0 10px 0 #4a3c00, 0 22px 44px rgba(212,175,55,0.80);
        }
        .ceiba-fab:active {
          animation: none;
          transform: scale(0.94) translateY(2px);
          box-shadow: 0 4px 0 #4a3c00, 0 6px 14px rgba(212,175,55,0.40);
          border-bottom-width: 2px;
        }
        .ceiba-fab:focus-visible {
          outline: 2.5px solid #f5e060;
          outline-offset: 4px;
        }
        @media (min-width: 768px) {
          .ceiba-fab {
            width: 46px;
            height: 46px;
            bottom: calc(104px + env(safe-area-inset-bottom));
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
        <Plus size={18} strokeWidth={2.2} />
      </button>

      {invitePrompt && (
        <>
          <div
            onClick={() => setInvitePrompt(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 70,
              background: "rgba(3,2,8,0.72)", backdropFilter: "blur(6px)",
            }}
          />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 71,
            background: "#0c0a18",
            borderTop: "1.5px solid rgba(212,175,55,0.35)",
            borderRadius: "20px 20px 0 0",
            padding: "28px 24px 40px",
            boxShadow: "0 -10px 40px rgba(0,0,0,0.9), 0 0 30px rgba(212,175,55,0.08)",
          }}>
            <div style={{
              width: 36, height: 4, borderRadius: 2,
              background: "rgba(212,175,55,0.3)", margin: "0 auto 24px",
            }} />
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "rgba(212,175,55,0.45)", marginBottom: 10 }}>
              Familiar agregado
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {invitePrompt.name}
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 28, lineHeight: 1.5 }}>
              ¿Le invitarías a ver y completar el árbol familiar en Ceiba?
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola ${invitePrompt.firstName}, te agregué al árbol familiar en Ceiba. Únetenos para ver a toda la familia en un solo lugar 🌳\n\nceibapp.com/invitar`)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setInvitePrompt(null)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                width: "100%", padding: "15px 0", borderRadius: 14, marginBottom: 12,
                background: "#25D366",
                borderTop: "2px solid #4ce88a",
                borderLeft: "1.5px solid rgba(255,255,255,0.2)",
                borderBottom: "4px solid #128C47",
                borderRight: "1.5px solid rgba(0,0,0,0.3)",
                boxShadow: "0 8px 0 #0a5c2e, 0 14px 24px rgba(0,0,0,0.7)",
                color: "#fff", fontSize: 15, fontWeight: 800,
                letterSpacing: "0.02em", textDecoration: "none",
              }}
            >
              <Share2 size={18} strokeWidth={2.5} />
              Invitar por WhatsApp
            </a>
            <button
              onClick={() => setInvitePrompt(null)}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 14,
                background: "transparent",
                border: "1px solid rgba(212,175,55,0.2)",
                color: "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Ahora no
            </button>
          </div>
        </>
      )}

      <CosmicNav />

      {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}

    </div>
  );
}

// ── Buscador global ───────────────────────────────────────────────────────────
function SearchModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`);
      if (res.ok) { const { results: r } = await res.json(); setResults(r ?? []); }
      setLoading(false);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(3,2,8,0.92)", backdropFilter: "blur(16px)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "52px 16px 12px",
        borderBottom: "0.5px solid rgba(212,175,55,0.18)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            color: "rgba(212,175,55,0.5)", pointerEvents: "none",
          }} />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Buscar persona en Ceiba…"
            style={{
              width: "100%", background: "#0c0a1a", border: "none",
              borderTop: "1px solid rgba(212,175,55,0.28)",
              borderLeft: "1px solid rgba(212,175,55,0.12)",
              borderBottom: "2px solid #000",
              borderRight: "1px solid rgba(0,0,0,0.5)",
              boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.5)",
              borderRadius: 12, padding: "11px 12px 11px 38px",
              color: "#fff", fontSize: 15, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
        <button onClick={onClose} style={{
          width: 44, height: 44, borderRadius: 12, background: "#0c0a1a", border: "none",
          borderTop: "1px solid rgba(212,175,55,0.2)", borderBottom: "2px solid #000",
          boxShadow: "0 4px 0 #02010a", display: "flex", alignItems: "center",
          justifyContent: "center", cursor: "pointer", flexShrink: 0,
        }}>
          <X size={17} style={{ color: "rgba(212,175,55,0.6)" }} />
        </button>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px 100px" }}>
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 64, borderRadius: 14, background: "#0c0a18", opacity: 0.4 }} />
            ))}
          </div>
        )}

        {!loading && q.length >= 2 && results.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.3)", fontSize: 14 }}>
            Sin resultados para "{q}"
          </div>
        )}

        {!loading && q.length < 2 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(212,175,55,0.3)", fontSize: 13 }}>
            Escribe al menos 2 letras para buscar
          </div>
        )}

        {!loading && results.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {results.map((p: any) => {
              const name = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(" ");
              const initials = [p.first_name, p.first_surname].filter(Boolean).map((w: string) => w[0]).join("").toUpperCase();
              const detail = [p.birth_city, p.birth_country].filter(Boolean).join(", ");
              const year = p.birth_date ? new Date(p.birth_date).getFullYear() : null;
              return (
                <Link key={p.id} href={`/persona/${p.id}`} onClick={onClose} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#0c0a18", borderRadius: 14, padding: "12px 13px",
                    borderTop: "1px solid rgba(212,175,55,0.18)",
                    borderLeft: "1px solid rgba(212,175,55,0.08)",
                    borderBottom: "2px solid #000",
                    boxShadow: "0 5px 0 #040300, 0 8px 16px rgba(0,0,0,0.7)",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                      background: "rgba(212,175,55,0.1)", border: "1.5px solid rgba(212,175,55,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, fontWeight: 800, color: "#d4af37",
                    }}>{initials}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                      {p.family_name && (
                        <p style={{ fontSize: 11, color: "rgba(212,175,55,0.55)", margin: "2px 0 0",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.family_name}
                        </p>
                      )}
                      {(detail || year) && (
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", margin: "1px 0 0" }}>
                          {[year, detail].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
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
    <div style={{ minHeight: "100vh", background: "#030208", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <TreePine size={40} style={{ color: "#d4af37", opacity: 0.6, display: "block", margin: "0 auto 12px" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Cargando tu árbol...</p>
      </div>
    </div>
  );
}

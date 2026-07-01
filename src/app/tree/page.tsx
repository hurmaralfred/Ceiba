"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { TreePine, MapPin, Users, Share2, LogOut, User, Send, List, GitFork, Plus, X, Pencil, Map as MapIcon, Image, Calendar, MessageCircle, Megaphone, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Profile, FamilyMember, RelationType, RELATION_LABELS } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";

// ── Reverse relation ──────────────────────────────────────────
// If person P added member M with relation_type R (P says "M is my R"),
// then from M's perspective, P is M's reverseRelation(R).
// Used for reverse lookup: when P is in the tree because P added one of
// the user's direct family members to P's own tree.
function reverseRelation(rel: string): string {
  switch (rel) {
    case "father":                   return "son";
    case "mother":                   return "son";
    case "son":                      return "father";
    case "daughter":                 return "father";
    case "brother":                  return "brother";
    case "sister":                   return "brother";
    case "half_brother":             return "brother";
    case "half_sister":              return "brother";
    case "spouse":                   return "spouse";
    case "partner":                  return "partner";
    case "uncle":                    return "nephew";
    case "aunt":                     return "nephew";
    case "nephew":                   return "uncle";
    case "niece":                    return "uncle";
    case "cousin":                   return "cousin";
    case "grandfather_paternal":     return "grandson";
    case "grandmother_paternal":     return "grandson";
    case "grandfather_maternal":     return "grandson";
    case "grandmother_maternal":     return "grandson";
    case "grandson":                 return "grandfather_paternal";
    case "granddaughter":            return "grandfather_paternal";
    case "father_in_law":            return "son";   // they see me as child-in-law ≈ son/daughter
    case "mother_in_law":            return "son";
    case "brother_in_law":           return "brother";
    case "sister_in_law":            return "brother";
    case "stepfather":               return "stepchild";
    case "stepmother":               return "stepchild";
    case "stepchild":                return "stepfather";
    default:                         return rel;
  }
}

// Infer my relation to an extended member based on the connector's relation to me.
// parentRelation = how the connector is related to ME
// childRelation  = how the extended member is related to the CONNECTOR
function inferRelation(parentRelation: RelationType, childRelation: string): string | null {
  switch (parentRelation) {

    // ── My spouse / partner ───────────────────────────────────
    case "spouse": case "partner":
      if (childRelation === "son")        return "son";
      if (childRelation === "daughter")   return "daughter";
      if (childRelation === "stepchild")  return "stepchild";
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (childRelation === "father")     return "father_in_law";
      if (childRelation === "mother")     return "mother_in_law";
      if (childRelation === "nephew")     return "nephew";
      if (childRelation === "niece")      return "niece";
      break;

    // ── My siblings ───────────────────────────────────────────
    case "brother": case "sister":
    case "half_brother": case "half_sister":
      if (childRelation === "son")              return "nephew";
      if (childRelation === "daughter")         return "niece";
      if (childRelation === "stepchild")        return "nephew";
      if (childRelation === "nephew")           return "nephew";
      if (childRelation === "niece")            return "niece";
      if (childRelation === "grandson")         return "nephew";
      if (childRelation === "granddaughter")    return "niece";
      if (["spouse","partner"].includes(childRelation)) return "brother_in_law";
      if (["father","stepfather"].includes(childRelation)) return "father";
      if (["mother","stepmother"].includes(childRelation)) return "mother";
      if (["brother","half_brother"].includes(childRelation)) return "brother";
      if (["sister","half_sister"].includes(childRelation))   return "sister";
      if (["uncle","father_in_law"].includes(childRelation)) return "uncle";
      if (["aunt","mother_in_law"].includes(childRelation))  return "aunt";
      if (childRelation === "cousin") return "cousin";
      break;

    // ── My in-law siblings ────────────────────────────────────
    case "brother_in_law": case "sister_in_law":
      if (childRelation === "son")       return "nephew";
      if (childRelation === "daughter")  return "niece";
      if (childRelation === "stepchild") return "nephew";
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (["spouse","partner"].includes(childRelation))       return "brother_in_law";
      if (childRelation === "father") return "father_in_law";
      if (childRelation === "mother") return "mother_in_law";
      if (childRelation === "nephew") return "nephew";
      if (childRelation === "niece")  return "niece";
      break;

    // ── My parents & step-parents ─────────────────────────────
    case "father": case "mother":
    case "stepfather": case "stepmother":
      if (childRelation === "son")            return "brother";
      if (childRelation === "daughter")       return "sister";
      if (childRelation === "stepchild")      return "brother";
      // Father/mother's siblings = my uncles/aunts
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      // Father/mother's parents = my grandparents
      if (childRelation === "father")         return "grandfather_paternal";
      if (childRelation === "mother")         return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      // Father/mother's spouse (other than me) = step-parent
      if (["spouse","partner"].includes(childRelation)) return parentRelation === "father" ? "stepmother" : "stepfather";
      // Parent's nephew/niece = my cousin; parent's cousin = also cousin
      if (childRelation === "nephew")         return "cousin";
      if (childRelation === "niece")          return "cousin";
      if (childRelation === "cousin")         return "cousin";
      // Parent's uncle/aunt = my great-uncle/aunt (labeled as uncle/aunt)
      if (childRelation === "uncle")          return "uncle";
      if (childRelation === "aunt")           return "aunt";
      // Parent's grandchildren (siblings' kids) = my nephews/nieces
      if (childRelation === "grandson")       return "nephew";
      if (childRelation === "granddaughter")  return "niece";
      break;

    // ── My in-law parents ─────────────────────────────────────
    case "father_in_law": case "mother_in_law":
      if (["brother","half_brother"].includes(childRelation)) return "brother_in_law";
      if (["sister","half_sister"].includes(childRelation))   return "sister_in_law";
      if (childRelation === "son")       return "brother_in_law";
      if (childRelation === "daughter")  return "sister_in_law";
      break;

    // ── My cousins ────────────────────────────────────────────
    case "cousin":
      // Cousin's children = second cousins (show as cousins — closest label)
      if (childRelation === "son" || childRelation === "daughter") return "cousin";
      if (childRelation === "stepchild")  return "cousin";
      if (childRelation === "grandson" || childRelation === "granddaughter") return "cousin";
      // Cousin's siblings = also my cousins
      if (["brother","half_brother","sister","half_sister"].includes(childRelation)) return "cousin";
      // Cousin's spouse = cousin-in-law (show as cousin — no exact label)
      if (["spouse","partner"].includes(childRelation)) return "cousin";
      // Cousin's parents = my uncle/aunt
      if (childRelation === "father") return "uncle";
      if (childRelation === "mother") return "aunt";
      // Cousin's uncle/aunt = also my uncle/aunt (shared grandparents)
      if (childRelation === "uncle") return "uncle";
      if (childRelation === "aunt")  return "aunt";
      // Cousin's nephew/niece = second cousin
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      break;

    // ── My children ───────────────────────────────────────────
    case "son": case "daughter": case "stepchild":
      if (childRelation === "son")            return "grandson";
      if (childRelation === "daughter")       return "granddaughter";
      if (childRelation === "stepchild")      return "grandson";
      if (childRelation === "grandson")       return "grandson";
      if (childRelation === "granddaughter")  return "granddaughter";
      if (["spouse","partner"].includes(childRelation)) return "son"; // hijo/a político/a
      break;

    // ── My grandchildren ──────────────────────────────────────
    case "grandson": case "granddaughter":
      if (childRelation === "son")            return "grandson";
      if (childRelation === "daughter")       return "granddaughter";
      if (["spouse","partner"].includes(childRelation)) return "grandson";
      break;

    // ── My uncles / aunts ─────────────────────────────────────
    case "uncle": case "aunt":
      if (childRelation === "son" || childRelation === "daughter") return "cousin";
      if (childRelation === "stepchild")    return "cousin";
      if (childRelation === "grandson" || childRelation === "granddaughter") return "cousin";
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      if (childRelation === "cousin")       return "cousin";
      // Uncle's siblings = also my uncles/aunts
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      // Uncle's spouse = also my uncle/aunt (by marriage)
      if (["spouse","partner"].includes(childRelation)) return parentRelation === "uncle" ? "aunt" : "uncle";
      // Uncle's parents = my grandparents
      if (childRelation === "father") return "grandfather_paternal";
      if (childRelation === "mother") return "grandmother_paternal";
      // Uncle's grandparents = my great-grandparents (shown as abuelos, closest label we have)
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      break;

    // ── My grandparents ───────────────────────────────────────
    case "grandfather_paternal": case "grandfather_maternal":
    case "grandmother_paternal": case "grandmother_maternal":
      if (childRelation === "son")          return "uncle";
      if (childRelation === "daughter")     return "aunt";
      if (childRelation === "stepchild")    return "uncle";
      // Grandparent's grandchildren (not me) = uncles/aunts
      if (childRelation === "grandson")     return "uncle";
      if (childRelation === "granddaughter") return "aunt";
      if (childRelation === "nephew" || childRelation === "niece") return "cousin";
      if (childRelation === "cousin")       return "uncle";
      // Grandparent's siblings = also my great-uncles/aunts (show as uncle/aunt, closest label)
      if (["brother","half_brother"].includes(childRelation)) return "uncle";
      if (["sister","half_sister"].includes(childRelation))   return "aunt";
      // Grandparent's parents = my great-grandparents (show as grandparent, closest label we have)
      if (childRelation === "father") return "grandfather_paternal";
      if (childRelation === "mother") return "grandmother_paternal";
      if (["grandfather_paternal","grandfather_maternal"].includes(childRelation)) return "grandfather_paternal";
      if (["grandmother_paternal","grandmother_maternal"].includes(childRelation)) return "grandmother_paternal";
      break;

    // ── My nephews / nieces ───────────────────────────────────
    case "nephew": case "niece":
      if (childRelation === "son")            return "nephew";
      if (childRelation === "daughter")       return "niece";
      if (childRelation === "stepchild")      return "nephew";
      if (childRelation === "grandson")       return "nephew";
      if (childRelation === "granddaughter")  return "niece";
      if (["spouse","partner"].includes(childRelation)) return "nephew";
      // Nephew/niece's parents = my siblings
      if (["father","stepfather"].includes(childRelation)) return "brother";
      if (["mother","stepmother"].includes(childRelation)) return "sister";
      // Nephew/niece's uncle/aunt = my sibling (same generation as me)
      if (childRelation === "uncle")          return "brother";
      if (childRelation === "aunt")           return "sister";
      // Nephew/niece's siblings = also my nephews/nieces
      if (["brother","half_brother"].includes(childRelation)) return "nephew";
      if (["sister","half_sister"].includes(childRelation))   return "niece";
      // Nephew/niece's cousin = my cousin (or second nephew — use cousin as closest label)
      if (childRelation === "cousin")         return "cousin";
      break;

    // ── My spouse's extended family (not covered above) ───────
    case "spouse": case "partner":
      if (childRelation === "grandfather_paternal") return "grandfather_paternal";
      if (childRelation === "grandfather_maternal") return "grandfather_paternal";
      if (childRelation === "grandmother_paternal") return "grandmother_paternal";
      if (childRelation === "grandmother_maternal") return "grandmother_paternal";
      if (childRelation === "uncle")     return "uncle";
      if (childRelation === "aunt")      return "aunt";
      if (childRelation === "cousin")    return "cousin";
      if (childRelation === "nephew")    return "nephew";
      if (childRelation === "niece")     return "niece";
      break;
  }
  return null;
}
import InstallBanner from "@/components/InstallBanner";
import TreeErrorBoundary from "@/components/TreeErrorBoundary";
import SuggestionCards from "@/components/SuggestionCards";
import NameMatchCards from "@/components/NameMatchCards";
import BirthdayWidget from "@/components/BirthdayWidget";
import TodayWidget from "@/components/TodayWidget";
import NetworkBanner from "@/components/NetworkBanner";
import BottomNav from "@/components/BottomNav";
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

const EMPTY_FORM = { primer_nombre: "", segundo_nombre: "", primer_apellido: "", segundo_apellido: "", first_name: "", last_name: "", email: "", birth_date: "", relation_type: "father" as RelationType, is_deceased: false, parent_member_id: "" };

export default function TreePage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [extendedMembers, setExtendedMembers] = useState<ExtendedEntry[]>([]);
  const [memberLinks, setMemberLinks] = useState<MemberLink[]>([]);
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
  const [duplicateWarning, setDuplicateWarning] = useState<{
    connectedMember: { first_name: string; last_name: string; relation_type: string };
    matchedName: string;
    matchedRelation: string;
    matchedProfileId: string | null;
    matchedFamilyMemberId: string | null;
  } | null>(null);
  const modalPhotoRef = useRef<HTMLInputElement>(null);
  const [modalPhotoFile, setModalPhotoFile] = useState<File | null>(null);
  const [modalPhotoPreview, setModalPhotoPreview] = useState<string | null>(null);

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

    // Global auto-link + update last_seen (fire-and-forget)
    fetch("/api/auth/post-register", { method: "POST" }).catch(() => {});
    fetch("/api/presence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});

    const [{ data: profileData }, { data: membersData }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("family_members").select("*").eq("added_by", user.id),
    ]);

    // Deduplicate my own members by first name (keep the one with profile_id, or the first)
    const normName = (s: string) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().split(" ")[0];
    const seenNames = new Map<string, any>();
    for (const m of membersData || []) {
      const key = `${normName(m.first_name)}|${normName(m.last_name || "")}`;
      if (!seenNames.has(key) || (!seenNames.get(key).profile_id && m.profile_id)) {
        seenNames.set(key, m);
      }
    }
    let myMembers = Array.from(seenNames.values());
    setProfile(profileData);

    // Auto-link members who registered independently (match by email OR name+apellido)
    const unlinked = myMembers.filter(m => !m.profile_id);
    if (unlinked.length > 0) {
      // Load all registered profiles to match against
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .neq("id", user.id);

      if (allProfiles && allProfiles.length > 0) {
        const updates: Promise<any>[] = [];

        for (const member of unlinked) {
          const mFn = normName(member.first_name);
          const mLn = normName(member.last_name || "");

          // Match by email (exact) OR by name (first+last when available, first-only when no last)
          const match = allProfiles.find(p => {
            if (member.email && p.email && member.email.toLowerCase() === p.email.toLowerCase()) return true;
            const pFn = normName(p.first_name || "");
            const pLn = normName(p.last_name || "");
            if (!mFn || pFn !== mFn) return false;
            // Both have last name: require last name match too
            if (mLn && pLn) return pLn === mLn;
            // At least one side has no last name: first name match is enough
            return true;
          });

          if (match) {
            updates.push(
              supabase.from("family_members").update({ profile_id: match.id }).eq("id", member.id)
            );
          }
        }

        if (updates.length > 0) {
          await Promise.all(updates);
          // Refresh members after linking
          const { data: refreshed } = await supabase.from("family_members").select("*").eq("added_by", user.id);
          const seen2 = new Map<string, any>();
          for (const m of refreshed || []) {
            const key = `${normName(m.first_name)}|${normName(m.last_name || "")}`;
            if (!seen2.has(key) || (!seen2.get(key).profile_id && m.profile_id)) seen2.set(key, m);
          }
          myMembers = Array.from(seen2.values());
        }
      }
    }

    // ── Auto-link via confirmed relationships table ────────────
    // If a family member confirmed a bidirectional relationship via invitation
    // but profile_id wasn't saved, use the relationships table to link them.
    {
      const stillUnlinked = myMembers.filter(m => !m.profile_id);
      if (stillUnlinked.length > 0) {
        const { data: confirmedRels } = await supabase
          .from("relationships")
          .select("profile_a, profile_b, relation_from_a, relation_from_b")
          .or(`profile_a.eq.${user.id},profile_b.eq.${user.id}`)
          .eq("confirmed", true);

        if (confirmedRels && confirmedRels.length > 0) {
          const theirIds = confirmedRels.map(r => r.profile_a === user.id ? r.profile_b : r.profile_a);
          const { data: relProfiles } = await supabase
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", theirIds);
          const relProfileMap = Object.fromEntries((relProfiles || []).map(p => [p.id, p]));

          const relUpdates: Promise<any>[] = [];
          for (const rel of confirmedRels) {
            const theirId  = rel.profile_a === user.id ? rel.profile_b : rel.profile_a;
            const myRelType = rel.profile_a === user.id ? rel.relation_from_a : rel.relation_from_b;
            if (myMembers.some(m => m.profile_id === theirId)) continue; // already linked
            const theirProfile = relProfileMap[theirId];
            if (!theirProfile) continue;
            const tFn = normName(theirProfile.first_name || "");
            const tLn = normName(theirProfile.last_name || "");
            // Find unlinked member with matching relation + name
            const candidates = stillUnlinked.filter(m => m.relation_type === myRelType && !m.profile_id);
            const match = candidates.find(m => {
              const mFn = normName(m.first_name); const mLn = normName(m.last_name || "");
              if (mFn !== tFn) return false;
              if (mLn && tLn) return mLn === tLn;
              return true;
            }) ?? (candidates.length === 1 ? candidates[0] : null);
            if (match && !match.profile_id) {
              match.profile_id = theirId;
              relUpdates.push(supabase.from("family_members").update({ profile_id: theirId }).eq("id", match.id));
            }
          }
          if (relUpdates.length > 0) await Promise.all(relUpdates);
        }
      }
    }

    // Enrich members with profile data (avatar, social_link) for those who've joined
    const profileIds = myMembers.map(m => m.profile_id).filter(Boolean) as string[];
    let enrichedMembers = myMembers;
    if (profileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, avatar_url, social_link, latitude, longitude, city, country, last_seen_at")
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
        // Person-IDs: shared UUID that identifies the same real-world person across trees.
        // More reliable than name matching — works even when names are stored differently.
        const myPersonIds = new Set<string>(myMembers.map(m => (m as any).person_id).filter(Boolean));

        // Normalize: remove accents, lowercase, collapse spaces
        const norm = (s: string) =>
          (s || "").toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ").trim();

        // Build multiple name keys per member for fuzzy matching:
        // full name, first+firstlast, firstword-only when member has NO last name
        const myNameKeys = new Set<string>();
        // Set of first-name first-words (≥4 chars) for no-last-name fuzzy check
        const myFirstWords = new Set<string>();
        myMembers.forEach(m => {
          const fn = norm(m.first_name);
          const ln = norm(m.last_name || "");
          myNameKeys.add(`${fn}|${ln}`);                                    // full: "jose humberto|hurtado cifuentes"
          const fn0 = fn.split(" ")[0]; const ln0 = ln.split(" ")[0];
          if (fn0 && ln0) myNameKeys.add(`${fn0}|${ln0}`);                 // first words: "jose|hurtado"
          // When this member has NO last name, add first-name-only key
          // so extended members with same first name but added last name are still deduped
          if (!ln && fn0.length >= 4) myNameKeys.add(`${fn0}|__nolast__`);
          // Always track first words so we can catch extended members stored WITHOUT last name
          if (fn0.length >= 4) myFirstWords.add(fn0);
        });

        // For peer link detection: build a map from norm-name key → direct member
        const myMemberByName = new Map<string, any>();
        myMembers.forEach(m => {
          const fn = norm(m.first_name).split(" ")[0];
          const ln = norm(m.last_name || "").split(" ")[0];
          myMemberByName.set(`${fn}|${ln}`, m);
          myMemberByName.set(`${fn}|`, m);
        });

        const crossLinks: MemberLink[] = [];

        const extended: ExtendedEntry[] = extData
          .filter(em => {
            if (em.profile_id === user.id) return false;
            if (em.profile_id && myMemberIds.has(em.profile_id)) return false;
            // person_id is the canonical "same real-world person" key (reliable, no name matching)
            if ((em as any).person_id && myPersonIds.has((em as any).person_id)) return false;
            const fn = norm(em.first_name);
            const ln = norm(em.last_name || "");
            // Check multiple key formats
            if (fn.length >= 3) {
              const fn0 = fn.split(" ")[0];
              const ln0 = ln.split(" ")[0];
              // Only mark as duplicate when both first+last name match
              // Avoid false positives by never matching on first name alone
              const isDuplicate =
                myNameKeys.has(`${fn}|${ln}`) ||
                (ln0.length > 0 && myNameKeys.has(`${fn0}|${ln0}`)) ||
                // Extended has last name but direct was stored without one:
                (fn0.length >= 4 && myNameKeys.has(`${fn0}|__nolast__`)) ||
                // Extended has NO last name but direct member has same first name:
                // e.g. extended "Rosa" matches direct "Rosa Cifuentes"
                (ln === "" && fn0.length >= 4 && myFirstWords.has(fn0));
              if (isDuplicate) {
                // This extended member IS a direct member — create a peer link
                const directMember = myMemberByName.get(`${fn0}|${ln0}`) || myMemberByName.get(`${fn0}|`);
                const parentMember = joinedMembers.find(m => m.profile_id === em.added_by);
                if (directMember && parentMember && directMember.id !== parentMember.id) {
                  // Avoid duplicate links
                  const alreadyExists = crossLinks.some(
                    l => (l.fromMemberId === parentMember.id && l.toMemberId === directMember.id) ||
                         (l.fromMemberId === directMember.id && l.toMemberId === parentMember.id)
                  );
                  if (!alreadyExists) {
                    crossLinks.push({
                      fromMemberId: parentMember.id,
                      toMemberId: directMember.id,
                      relation: em.relation_type,
                    });
                  }
                }
                return false; // still filter from extended nodes
              }
            }
            return true;
          })
          .map(em => {
            const parentMember = joinedMembers.find(m => m.profile_id === em.added_by);
            if (!parentMember) return null; // skip orphaned entries
            const inferredRelation = inferRelation(parentMember.relation_type as RelationType, em.relation_type);
            return {
              member: em as FamilyMember,
              parentMemberId: parentMember.id,
              inferredRelation,
            };
          })
          .filter((e): e is ExtendedEntry => {
            if (e === null) return false;
            // If relation couldn't be inferred, use "other" as fallback
            // so legitimate family members are never silently dropped.
            if (e.inferredRelation === null) e.inferredRelation = "other";
            return true;
          })
          // Deduplicate within the extended set by normalized name
          // (handles cases where the same person was added and deleted multiple times)
          .reduce<ExtendedEntry[]>((acc, e) => {
            const fn = norm(e.member.first_name).split(" ")[0];
            const ln = norm(e.member.last_name || "").split(" ")[0];
            const key = `${fn}|${ln}|${e.inferredRelation}`;
            if (!acc.some(x => {
              const xfn = norm(x.member.first_name).split(" ")[0];
              const xln = norm(x.member.last_name || "").split(" ")[0];
              return `${xfn}|${xln}|${x.inferredRelation}` === key;
            })) {
              acc.push(e);
            }
            return acc;
          }, []);
        // ── Reverse lookup ─────────────────────────────────────
        // Find people who have added one of MY joined direct members to THEIR tree.
        // Example: cuñado added esposa as "sister" → cuñado is my brother_in_law.
        //          primo added tío as "uncle" → primo is my cousin.
        // This catches connections that the forward lookup misses.
        const { data: revData } = await supabase
          .from("family_members")
          .select("id, added_by, profile_id, relation_type, relation_kind, first_name, last_name")
          .in("profile_id", joinedProfileIds);

        if (revData && revData.length > 0) {
          // Collect connector profile IDs (people who added my family members)
          const connectorIds = [...new Set(
            revData
              .map(r => r.added_by as string)
              .filter(id => id && id !== user.id && !myMemberIds.has(id))
          )];

          // Fetch their profiles so we can display them as nodes
          const { data: connectorProfiles } = connectorIds.length > 0
            ? await supabase.from("profiles").select("id, first_name, last_name, avatar_url").in("id", connectorIds)
            : { data: [] };

          const connectorProfileMap = Object.fromEntries(
            (connectorProfiles || []).map(p => [p.id, p])
          );

          // Build a set of profile_ids already in the extended array (avoid duplicates)
          const alreadyExtendedProfileIds = new Set(
            extended.map(e => (e.member as any).profile_id).filter(Boolean)
          );

          for (const rev of revData) {
            const connectorProfileId = rev.added_by as string;
            if (!connectorProfileId) continue;
            if (connectorProfileId === user.id) continue;
            if (myMemberIds.has(connectorProfileId)) continue;  // already a direct member
            if (alreadyExtendedProfileIds.has(connectorProfileId)) continue; // already found via forward

            const connProfile = connectorProfileMap[connectorProfileId];
            if (!connProfile) continue; // connector is not a Ceiba user

            // Which direct member did the connector add?
            const directMember = joinedMembers.find(m => m.profile_id === rev.profile_id);
            if (!directMember) continue;

            // Rev says "direct member is my {rel}" → from direct member's POV, connector is their {reverse}
            const connRelToDirectMember = reverseRelation(rev.relation_type);
            // From user's POV: user's relation to connector
            const userRelToConnector = inferRelation(directMember.relation_type as RelationType, connRelToDirectMember) ?? "other";

            // Name-dedup: skip if connector's name already exists in extended
            const cfn = norm(connProfile.first_name || "").split(" ")[0];
            const cln = norm(connProfile.last_name || "").split(" ")[0];
            const nameKey = `${cfn}|${cln}|${userRelToConnector}`;
            if (extended.some(e => {
              const efn = norm(e.member.first_name).split(" ")[0];
              const eln = norm(e.member.last_name || "").split(" ")[0];
              return `${efn}|${eln}|${e.inferredRelation}` === nameKey;
            })) continue;

            // Skip if connector is already a direct member (by name — require last name match too)
            if (myNameKeys.has(`${cfn}|${cln}`)) continue;

            alreadyExtendedProfileIds.add(connectorProfileId);

            // Create a synthetic FamilyMember-like object for the connector
            const syntheticMember = {
              id: connectorProfileId,          // use profile_id as stable node id
              first_name: connProfile.first_name || rev.first_name,
              last_name: connProfile.last_name || rev.last_name,
              relation_type: connRelToDirectMember,
              relation_kind: rev.relation_kind ?? "blood",
              profile_id: connectorProfileId,
              added_by: connectorProfileId,
              profile: { avatar_url: connProfile.avatar_url },
            } as unknown as FamilyMember;

            extended.push({
              member: syntheticMember,
              parentMemberId: directMember.id,
              inferredRelation: userRelToConnector,
            });
          }
        }

        // ── Tercer salto: familia de primos/cuñados que ya están en Ceiba ──
        // Ejemplo: hijos de Ramiro (primo) → aparecen como primos segundos/sobrinos
        const joinedExtended = extended.filter(e => !!(e.member as any).profile_id);
        const extProfileIds = [...new Set(
          joinedExtended.map(e => (e.member as any).profile_id as string).filter(Boolean)
        )];

        if (extProfileIds.length > 0) {
          const { data: ext2Data } = await supabase
            .from("family_members")
            .select("*")
            .in("added_by", extProfileIds);

          if (ext2Data && ext2Data.length > 0) {
            const allExtendedProfileIds = new Set(
              extended.map(e => (e.member as any).profile_id).filter(Boolean)
            );

            for (const em of ext2Data) {
              if (em.profile_id === user.id) continue;
              if (myMemberIds.has(em.profile_id)) continue;
              if (em.profile_id && allExtendedProfileIds.has(em.profile_id)) continue;

              const parentExt = joinedExtended.find(
                e => (e.member as any).profile_id === em.added_by
              );
              if (!parentExt || !parentExt.inferredRelation) continue;

              const level3Relation = inferRelation(
                parentExt.inferredRelation as RelationType,
                em.relation_type
              ) ?? "other";

              // Dedup by name + relation
              const fn3 = norm(em.first_name).split(" ")[0];
              const ln3 = norm(em.last_name || "").split(" ")[0];
              const key3 = `${fn3}|${ln3}|${level3Relation}`;
              if (extended.some(x => {
                const xfn = norm(x.member.first_name).split(" ")[0];
                const xln = norm(x.member.last_name || "").split(" ")[0];
                return `${xfn}|${xln}|${x.inferredRelation}` === key3;
              })) continue;

              if (em.profile_id) allExtendedProfileIds.add(em.profile_id);
              extended.push({
                member: em as FamilyMember,
                parentMemberId: parentExt.member.id,
                inferredRelation: level3Relation,
              });
            }
          }
        }

        // ── Peer links entre primos hermanos ───────────────────────
        // Tres casos posibles:
        // A) Dos extended cousins comparten el mismo tío/tía (parentMemberId igual)
        // B) Un extended cousin tiene como padre al primo DIRECTO (primo agregó a su hermana)
        // C) Un extended cousin y un primo directo comparten el mismo tío via dedup crossLink

        const CHILD_TYPES = new Set(["son", "daughter", "stepchild"]);
        const addPeerLink = (idA: string, idB: string) => {
          if (idA === idB) return;
          if (!crossLinks.some(l =>
            (l.fromMemberId === idA && l.toMemberId === idB) ||
            (l.fromMemberId === idB && l.toMemberId === idA)
          )) {
            crossLinks.push({ fromMemberId: idA, toMemberId: idB, relation: "sibling" });
          }
        };

        // Caso A: extended ↔ extended con mismo tío padre y relación hijo/primo
        const parentGroupMap = new Map<string, ExtendedEntry[]>();
        for (const e of extended) {
          if (!CHILD_TYPES.has(e.member.relation_type)) continue;
          if (e.inferredRelation !== "cousin") continue;
          if (!parentGroupMap.has(e.parentMemberId)) parentGroupMap.set(e.parentMemberId, []);
          parentGroupMap.get(e.parentMemberId)!.push(e);
        }
        for (const siblings of parentGroupMap.values()) {
          if (siblings.length < 2) continue;
          for (let i = 0; i < siblings.length; i++)
            for (let j = i + 1; j < siblings.length; j++)
              addPeerLink(siblings[i].member.id, siblings[j].member.id);
        }

        // Caso B: primo directo → extended cousin cuyo parentMemberId = el primo directo
        // (el primo directo está unido y agregó a su hermana a su propio árbol)
        const directCousins = myMembers.filter(m => m.relation_type === "cousin");
        for (const e of extended) {
          if (e.inferredRelation !== "cousin") continue;
          const parentDirect = directCousins.find(m => m.id === e.parentMemberId);
          if (parentDirect) addPeerLink(parentDirect.id, e.member.id);
        }

        // Caso C: primo directo que salió del dedup (tío lo tenía en su árbol)
        // → conectar con los otros extended cousins del mismo tío
        // El dedup generó: crossLink { fromMemberId: tíoId, toMemberId: primoDirectoId }
        // Karina tiene parentMemberId = tíoId → unirla con primoDirectoId
        const snapshotLinks = crossLinks.filter(l => l.relation !== "sibling");
        const tioToDirectCousin = new Map<string, string[]>();
        for (const link of snapshotLinks) {
          // Solo nos interesan links donde el "from" es tío/tía y el "to" es primo directo
          const parentM = myMembers.find(m => m.id === link.fromMemberId);
          const childM  = myMembers.find(m => m.id === link.toMemberId);
          if (!parentM || !childM) continue;
          if (!["uncle","aunt"].includes(parentM.relation_type)) continue;
          if (childM.relation_type !== "cousin") continue;
          if (!tioToDirectCousin.has(link.fromMemberId)) tioToDirectCousin.set(link.fromMemberId, []);
          tioToDirectCousin.get(link.fromMemberId)!.push(link.toMemberId);
        }
        for (const e of extended) {
          if (e.inferredRelation !== "cousin") continue;
          const directSiblings = tioToDirectCousin.get(e.parentMemberId) || [];
          for (const sibId of directSiblings) addPeerLink(sibId, e.member.id);
        }

        // ── Final safety dedup ─────────────────────────────────
        // Strips any extended entry that is actually a direct member.
        // Catches duplicates from reverse lookup and tercer salto which only
        // do profile_id-based dedup — missing the name-based check for
        // deceased/unregistered members (profile_id = null).
        const finalExtended = extended.filter(e => {
          if (e.member.profile_id && myMemberIds.has(e.member.profile_id)) return false;
          if ((e.member as any).person_id && myPersonIds.has((e.member as any).person_id)) return false;
          const fn = norm(e.member.first_name);
          const ln = norm(e.member.last_name || "");
          if (fn.length >= 3) {
            const fn0 = fn.split(" ")[0];
            const ln0 = ln.split(" ")[0];
            if (myNameKeys.has(`${fn}|${ln}`)) return false;
            if (ln0.length > 0 && myNameKeys.has(`${fn0}|${ln0}`)) return false;
            if (fn0.length >= 4 && myNameKeys.has(`${fn0}|__nolast__`)) return false;
            if (ln === "" && fn0.length >= 4 && myFirstWords.has(fn0)) return false;
          }
          return true;
        });
        setExtendedMembers(finalExtended);
        setMemberLinks(crossLinks);
      }
    }

    } catch (err: any) {
      console.error("loadData error:", err);
      setLoadError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  // Check if the name being added already exists in a connected family member's tree.
  // Two-pass: (1) connected trees via profile_id, (2) broader Ceiba profile name search.
  const checkExtendedDuplicate = async (first_name: string, last_name: string, userId: string) => {
    const normW = (s: string) =>
      (s || "").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim().split(" ")[0];

    const fn = normW(first_name);
    const ln = normW(last_name);
    if (fn.length < 3) return null;

    // \u2500\u2500 Pass 1: scan trees of directly linked Ceiba members \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const { data: myMembers } = await supabase
      .from("family_members")
      .select("profile_id, first_name, last_name, relation_type")
      .eq("added_by", userId)
      .not("profile_id", "is", null);

    for (const member of (myMembers || [])) {
      const { data: theirMembers } = await supabase
        .from("family_members")
        .select("id, first_name, last_name, relation_type, profile_id")
        .eq("added_by", member.profile_id);

      const match = (theirMembers || []).find(m => {
        const mfn = normW(m.first_name || "");
        const mln = normW(m.last_name || "");
        return mfn === fn && (ln.length < 2 || mln === ln || mln.length < 2);
      });

      if (match) {
        return {
          connectedMember: member,
          matchedName: `${match.first_name} ${match.last_name || ""}`.trim(),
          matchedRelation: match.relation_type,
          matchedProfileId: match.profile_id || null,
          matchedFamilyMemberId: match.id,
        };
      }
    }

    // ── Pass 2: buscar por nombre en perfiles de Ceiba ───────────────────
    // Catches cases where the person IS on Ceiba but their family entry
    // wasn't linked (profile_id null in the connector's tree).
    const { data: profileMatches } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .ilike("first_name", `${first_name.split(" ")[0]}%`)
      .neq("id", userId)
      .limit(15);

    for (const profile of (profileMatches || [])) {
      const pfn = normW(profile.first_name || "");
      const pln = normW(profile.last_name || "");
      if (pfn !== fn) continue;
      if (ln.length >= 2 && pln.length >= 2 && pln !== ln) continue;

      // This Ceiba user matches the name — check if they're in my family network
      // Option A: they're already in MY tree
      const { data: myEntry } = await supabase
        .from("family_members")
        .select("id, first_name, last_name, relation_type")
        .eq("added_by", userId)
        .eq("profile_id", profile.id)
        .maybeSingle();
      if (myEntry) {
        return {
          connectedMember: myEntry,
          matchedName: `${profile.first_name} ${profile.last_name || ""}`.trim(),
          matchedRelation: myEntry.relation_type,
          matchedProfileId: profile.id,
          matchedFamilyMemberId: myEntry.id,
        };
      }

      // Option B: a connected family member added them to their own tree
      const { data: networkEntries } = await supabase
        .from("family_members")
        .select("id, first_name, last_name, relation_type, added_by")
        .eq("profile_id", profile.id)
        .neq("added_by", userId)
        .limit(10);

      for (const entry of (networkEntries || [])) {
        const { data: connector } = await supabase
          .from("family_members")
          .select("first_name, last_name, relation_type")
          .eq("added_by", userId)
          .eq("profile_id", entry.added_by)
          .maybeSingle();
        if (connector) {
          return {
            connectedMember: connector,
            matchedName: `${profile.first_name} ${profile.last_name || ""}`.trim(),
            matchedRelation: entry.relation_type,
            matchedProfileId: profile.id,
            matchedFamilyMemberId: entry.id,
          };
        }
      }
    }

    return null;
  };

  // Save linking to an existing person in another tree (same real human, no duplicate)
  const saveLinkedMember = async () => {
    if (!duplicateWarning) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setSaving(true);

    // Fetch exact name/profile_id from the original matched record
    let exactFirstName = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    let exactLastName = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    let linkedProfileId = duplicateWarning.matchedProfileId;

    if (duplicateWarning.matchedFamilyMemberId) {
      const { data: orig } = await supabase
        .from("family_members")
        .select("first_name, last_name, profile_id, person_id")
        .eq("id", duplicateWarning.matchedFamilyMemberId)
        .maybeSingle();
      if (orig) {
        exactFirstName = orig.first_name;
        exactLastName = orig.last_name || "";
        linkedProfileId = orig.profile_id;
      }
    }

    // Check if this person already exists in MY tree to avoid creating a 2nd entry
    const { data: existing } = await supabase
      .from("family_members")
      .select("id")
      .eq("added_by", user.id)
      .ilike("first_name", exactFirstName)
      .limit(1);

    if (existing && existing.length > 0) {
      // Already in my tree — just update relation if needed, don't insert again
      await supabase
        .from("family_members")
        .update({ relation_type: form.relation_type, profile_id: linkedProfileId || null })
        .eq("id", existing[0].id);
      toast.success("Familiar vinculado correctamente");
    } else {
      const kind = RELATION_GROUPS[0].options.includes(form.relation_type) ? "blood" : "affinity";
      const { error } = await supabase.from("family_members").insert({
        added_by: user.id,
        first_name: exactFirstName,
        last_name: exactLastName || null,
        email: form.email.trim() || null,
        birth_date: form.birth_date || null,
        relation_type: form.relation_type,
        relation_kind: kind,
        is_deceased: form.is_deceased,
        profile_id: linkedProfileId || null,
        // Share the same person_id so this entry deduplicates in all connected trees
        person_id: (orig as any)?.person_id || duplicateWarning.matchedFamilyMemberId || undefined,
      });
      if (error) { toast.error("Error al guardar"); setSaving(false); return; }
      toast.success("Familiar vinculado correctamente");
    }

    setSaving(false);
    setShowModal(false);
    setForm(EMPTY_FORM);
    setDuplicateWarning(null);
    loadData();
  };

  const saveMember = async (force = false) => {
    if (!form.primer_nombre.trim()) { toast.error("El primer nombre es obligatorio"); return; }
    if (!form.primer_apellido.trim()) { toast.error("El primer apellido es obligatorio"); return; }
    const first_name = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_name = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Hard limit: prevent runaway trees
    const MAX_MEMBERS = 150;
    if (members.length >= MAX_MEMBERS) {
      toast.error(`Límite de ${MAX_MEMBERS} familiares alcanzado`);
      return;
    }

    // Check for duplicates in extended family (only on first attempt)
    if (!force) {
      const dup = await checkExtendedDuplicate(first_name, last_name, user.id);
      if (dup) {
        setDuplicateWarning(dup);
        return; // Show warning, don't save yet
      }
    }
    setDuplicateWarning(null);
    setSaving(true);
    const kind = RELATION_GROUPS[0].options.includes(form.relation_type) ? "blood" : "affinity";
    const { data: inserted, error } = await supabase.from("family_members").insert({
      added_by: user.id,
      first_name,
      last_name: last_name || null,
      email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      relation_type: form.relation_type,
      relation_kind: kind,
      is_deceased: form.is_deceased,
      parent_member_id: form.parent_member_id || null,
      // Every new member gets their own UUID as canonical identity.
      // This gets shared with other trees when duplicate is confirmed via admin page.
      person_id: crypto.randomUUID(),
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error("Error al guardar"); return; }

    // Upload photo if user provided one for this member
    if (modalPhotoFile && inserted?.id) {
      const ext = modalPhotoFile.name.split(".").pop() ?? "jpg";
      const path = `member-photos/${user.id}/${inserted.id}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars").upload(path, modalPhotoFile, { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("family_members")
          .update({ photo_url: urlData.publicUrl }).eq("id", inserted.id);
      }
      setModalPhotoFile(null);
      setModalPhotoPreview(null);
    }

    // Generate suggestions for connected family members
    if (inserted) {
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          first_name,
          last_name: last_name || "",
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
    const first_name = [form.primer_nombre.trim(), form.segundo_nombre.trim()].filter(Boolean).join(" ");
    const last_name = [form.primer_apellido.trim(), form.segundo_apellido.trim()].filter(Boolean).join(" ");
    setSaving(true);
    const kind = RELATION_GROUPS[0].options.includes(form.relation_type) ? "blood" : "affinity";
    const { error } = await supabase.from("family_members").update({
      first_name,
      last_name: last_name || null,
      email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      relation_type: form.relation_type,
      relation_kind: kind,
      is_deceased: form.is_deceased,
      parent_member_id: form.parent_member_id || null,
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
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
          <Link href="/photos" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Image size={16} /> Fotos
          </Link>
          <Link href="/events" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Calendar size={16} /> Historia
          </Link>
          <Link href="/chat" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <MessageCircle size={16} /> Chat
          </Link>
          <button onClick={shareTree} className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <Share2 size={16} /> Compartir
          </button>
          <Link href="/settings" className="flex items-center gap-1 text-ceiba-200 hover:text-white text-sm transition-colors">
            <User size={16} />
          </Link>
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
                className="flex items-center gap-1.5 bg-ceiba-600 hover:bg-ceiba-700 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm transition-colors flex-1"
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
            <NameMatchCards onAccepted={loadData} />
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fecha de nacimiento</label>
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
                      <p className="text-xs font-semibold text-amber-800 mb-1">⚠️ Ya existe en otro árbol</p>
                      <p className="text-xs text-amber-700 leading-relaxed mb-3">
                        <span className="font-bold">{duplicateWarning.matchedName}</span> ya está en el árbol de{" "}
                        <span className="font-bold">{duplicateWarning.connectedMember.first_name} {duplicateWarning.connectedMember.last_name}</span>{" "}
                        (tu {RELATION_LABELS[duplicateWarning.connectedMember.relation_type as RelationType] || duplicateWarning.connectedMember.relation_type}){" "}
                        como <span className="font-bold">{RELATION_LABELS[duplicateWarning.matchedRelation as RelationType] || duplicateWarning.matchedRelation}</span>.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setDuplicateWarning(null); saveMember(true); }}
                          className="flex-1 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          Son personas diferentes
                        </button>
                        <button
                          onClick={saveLinkedMember}
                          disabled={saving}
                          className="flex-1 text-xs font-semibold bg-ceiba-700 text-white hover:bg-ceiba-800 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {saving ? "Vinculando..." : "Sí, es la misma persona"}
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <TreePine size={40} className="text-ceiba-600 mx-auto mb-3 animate-pulse" />
        <p className="text-gray-500">Cargando tu árbol...</p>
      </div>
    </div>
  );
}

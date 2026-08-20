"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, ChevronRight, ChevronLeft, Check, Plus, X,
  Eye, EyeOff, Bell, BellOff, Send, Users, Cake,
  AlertTriangle, Megaphone
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createInviteLink, buildInviteMessage, shareInviteWhatsApp, InviteTemplate } from "@/lib/viral/inviteFlow";
import { trackEvent } from "@/lib/viral/viralAnalytics";
import toast, { Toaster } from "react-hot-toast";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";
import phoneLabels from "react-phone-number-input/locale/es";
import "react-phone-number-input/style.css";
import { ONBOARDING_GENDER_OPTIONS, getProfileGenderFormState, type OnboardingGender } from "@/lib/onboardingGender";
import { decideExistingIdentityStep, getAddFamilyContinueLabel } from "@/lib/onboardingFlow";

// ============================================================
// Tipos y constantes
// ============================================================

type Step =
  | "checking"      // 0 — verificando si ya existe una identidad reclamada
  | "init_error"    // 0b — la verificación inicial falló: reintentar o continuar
  | "profile"       // 3 — Cuéntanos quién eres
  | "match"         // 4 — Match condicional
  | "add_family"    // 5 — Agregar 5 familiares
  | "aha"           // 6 — ¡Aquí está tu ceiba!
  | "batch_invite"  // 7 — Invitar en batch
  | "notifications" // 8 — Habilitar notificaciones
  | "done";         // 9 — ¡Listo!

/**
 * ¿La persona identificada (nueva, reclamada o ya vinculada) tiene
 * relaciones familiares activas? Se usa para decidir si el onboarding debe
 * saltar "Construye tu galaxia" y llevar directo a /tree (ver
 * decideExistingIdentityStep en @/lib/onboardingFlow).
 */
async function personHasActiveRelationships(
  supabase: ReturnType<typeof createClient>,
  personId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("relationships")
    .select("id")
    .is("deleted_at", null)
    .or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`)
    .limit(1);

  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

const TOTAL_STEPS = 7;
const STEP_INDEX: Record<Step, number> = {
  checking: 0, init_error: 0,
  profile: 1, match: 2, add_family: 3, aha: 4, batch_invite: 5, notifications: 6, done: 7
};

type CanonicalRelationship =
  | "parent"
  | "partner"
  | "guardian";

interface SlotDef {
  id: string;
  emoji: string;
  label: string;
  relation_key: string;
  relationship: CanonicalRelationship;
  parent_kind?: "biological" | "adoptive" | "step" | "unknown";
  optional?: boolean;
}

const SUGGESTED_SLOTS: SlotDef[] = [
  {
    id: "mom",
    emoji: "👩",
    label: "Tu mamá",
    relation_key: "mother",
    relationship: "parent",
    parent_kind: "biological",
  },
  {
    id: "dad",
    emoji: "👨",
    label: "Tu papá",
    relation_key: "father",
    relationship: "parent",
    parent_kind: "biological",
  },
  {
    id: "spouse",
    emoji: "💑",
    label: "Tu pareja",
    relation_key: "spouse",
    relationship: "partner",
  },
  {
    id: "child",
    emoji: "👶",
    label: "Un hijo/a",
    relation_key: "child",
    relationship: "parent",
    parent_kind: "biological",
  },
  {
    id: "guardian",
    emoji: "🫶",
    label: "Un tutor/a",
    relation_key: "guardian",
    relationship: "guardian",
  },
];

interface AddedPerson {
  id: string;
  first_names: string;
  last_names: string;
  phone?: string;
  relation_type: string;
  slot_id: string;
}

interface MatchCandidate {
  id: string;
  public_id?: string;
  first_names: string;
  last_names: string;
  birth_date?: string;
  birth_city?: string;
  birth_country?: string;
  profile_photo_url?: string;
  added_by_name?: string;
  match_score?: number;
  already_claimed?: boolean;
  claimable?: boolean;
}

// ============================================================
// Helpers
// ============================================================

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full flex gap-1 px-5 pt-4">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full transition-all duration-500 ${
            i < step ? "bg-ceiba-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

// ============================================================
// Modal: agregar familiar (bottom sheet)
// ============================================================

function AddRelativeModal({
  slot,
  onSave,
  onClose,
  loading,
}: {
  slot: SlotDef;
  onSave: (data: {
    first_names: string;
    last_names: string;
    birth_date: string;
    phone: string;
    is_living: boolean;
    relation_type: string;
  }) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    first_names: "",
    last_names: "",
    birth_date: "",
    phone: "",
    is_living: true,
    relation_type: slot.relation_key,
  });

  const inputStyle: React.CSSProperties = {
    background: "#0c0a18", border: "1px solid rgba(212,175,55,0.22)",
    borderRadius: 12, padding: "13px 14px", color: "#fff", fontSize: 14,
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(3,2,8,0.75)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 480, margin: "0 auto",
        background: "#0c0a18",
        borderTop: "1.5px solid rgba(212,175,55,0.4)", borderLeft: "1px solid rgba(212,175,55,0.15)",
        borderRight: "1px solid rgba(0,0,0,0.6)",
        borderRadius: "24px 24px 0 0",
        padding: "20px 20px 40px",
        boxShadow: "0 -12px 40px rgba(0,0,0,0.8), 0 0 30px rgba(212,175,55,0.08)",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* Barra de arrastre */}
        <div style={{ width: 36, height: 3, borderRadius: 2, background: "rgba(212,175,55,0.2)", margin: "0 auto 20px" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>
            {slot.emoji} {slot.label}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(212,175,55,0.4)", padding: 4 }}>
            <X size={22} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input type="text" placeholder="Nombres *" value={form.first_names}
              onChange={(e) => setForm((f) => ({ ...f, first_names: e.target.value }))}
              style={inputStyle} autoFocus />
            <input type="text" placeholder="Apellidos *" value={form.last_names}
              onChange={(e) => setForm((f) => ({ ...f, last_names: e.target.value }))}
              style={inputStyle} />
          </div>

          <div style={{ background: "#0c0a18", border: "1px solid rgba(212,175,55,0.22)", borderRadius: 12, padding: "10px 14px" }}>
            <PhoneInput international defaultCountry="CO" countryCallingCodeEditable={false}
              labels={phoneLabels} placeholder="WhatsApp (opcional)"
              value={form.phone || undefined}
              onChange={(value) => setForm((f) => ({ ...f, phone: value ?? "" }))}
              className="ceiba-phone-input-dark text-sm"
            />
          </div>

          {/* Toggle fallecido */}
          <button type="button"
            onClick={() => setForm((f) => ({ ...f, is_living: !f.is_living }))}
            style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13, color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: "4px 0" }}>
            <div style={{
              width: 40, height: 22, borderRadius: 100, flexShrink: 0, padding: "2px",
              background: !form.is_living ? "rgba(180,200,255,0.3)" : "rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", transition: "background 0.2s",
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                transform: !form.is_living ? "translateX(18px)" : "translateX(0)",
                transition: "transform 0.2s",
              }} />
            </div>
            Fallecido/a — aparece con † en la galaxia
          </button>

          <button
            onClick={() => {
              if (!form.first_names.trim()) { toast.error("El nombre es obligatorio"); return; }
              if (!form.last_names.trim()) { toast.error("El apellido es obligatorio"); return; }
              if (form.phone && !isValidPhoneNumber(form.phone)) { toast.error("El número no es válido"); return; }
              onSave(form);
            }}
            disabled={loading}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 14, marginTop: 4,
              background: loading ? "#6a5600" : "#c9a820",
              borderTop: "2px solid #f5e060", borderLeft: "1.5px solid rgba(255,240,100,0.5)",
              borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
              boxShadow: "0 8px 0 #4a3c00, 0 12px 20px rgba(0,0,0,0.6)",
              color: "#030208", fontSize: 15, fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1, border: "none",
            }}
          >
            {loading ? "Guardando..." : "Agregar y seguir"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Página principal
// ============================================================

export default function OnboardingPage() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>("checking");
  const [initError, setInitError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [myFirstName, setMyFirstName] = useState("");
  const [myLastName, setMyLastName] = useState("");

  // Profile form
  const [profFirstNames, setProfFirstNames] = useState("");
  const [profLastNames, setProfLastNames] = useState("");
  const [profBirthDate, setProfBirthDate] = useState("");
  const [profCity, setProfCity] = useState("");
  const [profGender, setProfGender] = useState<OnboardingGender | null>(null);
  const [profLoading, setProfLoading] = useState(false);
  // Controls input visibility — once shown, never hidden until submit.
  // Avoids the bug where typing one letter makes inputs disappear.
  const [showNameFields, setShowNameFields] = useState(false);

  // Match candidate
  const [match, setMatch] = useState<MatchCandidate | null>(null);

  // Family slots
  const [filledSlots, setFilledSlots] = useState<Record<string, AddedPerson>>({});
  const [activeSlot, setActiveSlot] = useState<SlotDef | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  // Batch invite
  const [inviteLoading, setInviteLoading] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [template] = useState<InviteTemplate>(() => {
    const ts: InviteTemplate[] = ["v1_direct", "v2_emotional", "v3_specific"];
    return ts[Math.floor(Math.random() * ts.length)];
  });

  // ============================================================
  // Init
  // ============================================================

  // Verificación inicial: ¿este usuario ya tiene una identidad reclamada?
  // Si la tiene y esa persona ya tiene relaciones familiares reales, el
  // onboarding no debe mostrarse en absoluto — se salta directo a /tree.
  // Cualquier error en el camino cae en "init_error" (Reintentar / Continuar
  // a la galaxia), nunca deja al usuario atrapado en una pantalla en blanco.
  const runInitialCheck = async () => {
    setInitError(null);
    setStep("checking");

    try {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        router.push("/auth/login");
        return;
      }

      const uid = data.user.id;
      setUserId(uid);

      const meta = data.user.user_metadata ?? {};

      if (meta.first_name) {
        setProfFirstNames(meta.first_name);
        setMyFirstName(meta.first_name);
      }

      if (meta.last_name) {
        setProfLastNames(meta.last_name);
        setMyLastName(meta.last_name);
      }

      // Show input fields immediately when Google didn't provide both names,
      // so the user never sees inputs appear then disappear while typing.
      if (!meta.first_name || !meta.last_name) {
        setShowNameFields(true);
      }

      const { data: claim, error: claimError } = await supabase
        .from("person_claims")
        .select("person_id")
        .eq("user_id", uid)
        .eq("claim_status", "approved")
        .maybeSingle();

      if (claimError) throw claimError;

      if (!claim?.person_id) {
        // Usuario sin identidad reclamada todavía: onboarding normal.
        setStep("profile");
        return;
      }

      const { data: me, error: personError } = await supabase
        .from("persons")
        .select(`
          id,
          first_name,
          middle_name,
          first_surname,
          second_surname
        `)
        .eq("id", claim.person_id)
        .maybeSingle();

      if (personError) throw personError;

      if (me) {
        const firstNames = [me.first_name, me.middle_name]
          .filter(Boolean)
          .join(" ");

        const lastNames = [me.first_surname, me.second_surname]
          .filter(Boolean)
          .join(" ");

        setMyPersonId(me.id);

        if (!meta.first_name) {
          setProfFirstNames(firstNames);
          setMyFirstName(firstNames);
        }

        if (!meta.last_name) {
          setProfLastNames(lastNames);
          setMyLastName(lastNames);
        }

        // If the DB record also lacks a last name, show the input fields
        if (!meta.first_name || !meta.last_name) {
          if (!firstNames || !lastNames) setShowNameFields(true);
        }
      }

      const alreadyConnected = await personHasActiveRelationships(
        supabase,
        claim.person_id
      );

      if (decideExistingIdentityStep(alreadyConnected) === "redirect_to_tree") {
        router.push("/tree");
        return;
      }

      // Identidad ya reclamada pero sin galaxia todavía: directo a
      // "Construye tu galaxia" (el nombre ya se conoce, no hace falta
      // repetir el paso de perfil).
      setStep("add_family");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "No fue posible verificar tu cuenta.";
      console.error("Error en la verificación inicial de onboarding:", err);
      setInitError(message);
      setStep("init_error");
    }
  };

  useEffect(() => {
    runInitialCheck();
    trackEvent("sign_up_start", { type: "organic" });
  }, []);

  // Trackea cada paso del onboarding
  useEffect(() => {
    if (step === "checking" || step === "init_error") return;
    trackEvent("onboarding_step_enter", { step });
    if (step === "match") trackEvent("match_shown");
    if (step === "done") trackEvent("onboarding_completed", { relatives_added: filledCount });
  }, [step]);

  // ============================================================
  // Step: Profile
  // ============================================================

  const saveProfile = async () => {
    if (!profFirstNames.trim()) {
      toast.error("Agrega tu nombre");
      return;
    }

    if (!profLastNames.trim()) {
      toast.error("Agrega tus apellidos");
      return;
    }

    const genderState = getProfileGenderFormState(profGender);

    if (!genderState.canSubmit) {
      toast.error("Selecciona una opción de género");
      return;
    }

    setProfLoading(true);

    try {
      if (!userId) {
        throw new Error("No existe una sesión válida.");
      }

      const names = profFirstNames
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const surnames = profLastNames
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const firstName = names[0];
      const middleName = names.length > 1 ? names.slice(1).join(" ") : null;
      const firstSurname = surnames[0];

      const secondSurname =
        surnames.length > 1 ? surnames.slice(1).join(" ") : null;

      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_first_name: firstName,
        p_middle_name: middleName,
        p_first_surname: firstSurname,
        p_second_surname: secondSurname,
        p_birth_date: profBirthDate || null,
        p_birth_city: profCity.trim() || null,
        p_birth_country: null,
        p_gender: genderState.genderToSubmit,
      });

      if (error) {
        console.error("complete_onboarding RPC error:", error);
        throw new Error(
          `No fue posible completar el registro: ${error.message}`
        );
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (
        result?.success === false &&
        result?.action === "review_required"
      ) {
        const candidate = result.candidates?.[0];

        if (!candidate) {
          throw new Error(
            "Se encontraron coincidencias pero no fueron devueltas por el servidor."
          );
        }

        setMatch({
          id: candidate.person_id,
          public_id: candidate.public_id,
          first_names: candidate.first_name,
          last_names: [
            candidate.first_surname,
            candidate.second_surname,
          ]
            .filter(Boolean)
            .join(" "),
          birth_date: candidate.birth_date,
          birth_city: candidate.birth_city,
          birth_country: candidate.birth_country,
          match_score: candidate.match_score,
          already_claimed: candidate.already_claimed,
          claimable: candidate.claimable,
        });

        setStep("match");
        return;
      }

      const personId = result?.person_id ?? null;
      const spaceId = result?.space_id ?? null;

      if (!personId || !spaceId) {
        console.error(
          "Respuesta inesperada de complete_onboarding:",
          data
        );

        throw new Error(
          "El registro fue procesado, pero la base de datos no devolvió la persona o el espacio familiar."
        );
      }

      setMyPersonId(personId);
      setMyFirstName(profFirstNames.trim());
      setMyLastName(profLastNames.trim());

      // Igual que en claimMatch: si esta identidad (nueva o retomada) ya
      // tiene relaciones reales, saltar "Construye tu galaxia" directo a
      // /tree. complete_onboarding no expone has_relationships todavía,
      // así que se verifica del lado del cliente (misma regla, mismo
      // helper que usa la verificación inicial).
      const alreadyConnected = await personHasActiveRelationships(
        supabase,
        personId
      ).catch(() => false);

      if (decideExistingIdentityStep(alreadyConnected) === "redirect_to_tree") {
        router.push("/tree");
        return;
      }

      setStep("add_family");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado.";

      console.error("Onboarding profile error:", err);
      toast.error(message);
    } finally {
      setProfLoading(false);
    }
  };

  // ============================================================
  // Step: Match
  // ============================================================

  const claimMatch = async () => {
    if (!match || !userId) return;

    if (match.already_claimed || match.claimable === false) {
      toast.error(
        "Esta persona ya está vinculada a otra cuenta."
      );
      return;
    }

    try {
      const matchPersonId = match.id;

      if (!matchPersonId) {
        throw new Error(
          "La coincidencia no contiene un identificador válido."
        );
      }

      const { data, error } = await supabase.rpc(
        "claim_existing_person",
        {
          p_person_id: matchPersonId,
        }
      );

      if (error) {
        console.error("claim_existing_person RPC error:", error);
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;
      const personId = result?.person_id ?? matchPersonId;
      const spaceId = result?.space_id ?? null;

      if (!personId || !spaceId) {
        throw new Error(
          "La vinculación fue procesada, pero no devolvió la persona o el espacio familiar."
        );
      }

      setMyPersonId(personId);
      trackEvent("match_confirmed");
      toast.success("¡Te conectamos con tu galaxia existente!");

      // has_relationships lo calcula el propio RPC (relaciones activas de
      // la persona reclamada) — si ya tiene galaxia, saltar "Construye tu
      // galaxia" por completo (escenario A). Si no, seguir el onboarding
      // normal, pero sin exigir 5/5 (escenario B).
      if (decideExistingIdentityStep(!!result?.has_relationships) === "redirect_to_tree") {
        router.push("/tree");
        return;
      }

      setStep("add_family");
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No fue posible vincular la persona.";

      console.error("Error vinculando coincidencia:", err);
      toast.error(message);
    }
  };

  // ============================================================
  // Step: Add family
  // ============================================================

  const handleAddRelative = async (form: {
    first_names: string;
    last_names: string;
    birth_date: string;
    phone: string;
    is_living: boolean;
    relation_type: string;
  }) => {
    if (!userId) {
      toast.error("No se encontró la sesión del usuario");
      return;
    }

    if (!myPersonId) {
      toast.error(
        "No se encontró tu perfil personal. Regresa al paso anterior y guarda tus datos."
      );
      return;
    }

    if (!activeSlot) {
      toast.error(
        "No se identificó el familiar que estás agregando"
      );
      return;
    }

    if (!form.first_names.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }

    if (!form.last_names.trim()) {
      toast.error("El apellido es obligatorio");
      return;
    }

    setAddLoading(true);

    try {
      const nameParts = form.first_names
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const surnameParts = form.last_names
        .trim()
        .split(/\s+/)
        .filter(Boolean);

      const payload = {
        first_name: nameParts[0],
        middle_name:
          nameParts.length > 1
            ? nameParts.slice(1).join(" ")
            : null,
        first_surname: surnameParts[0],
        second_surname:
          surnameParts.length > 1
            ? surnameParts.slice(1).join(" ")
            : null,
        birth_date: form.birth_date || null,
        is_living: form.is_living,
        relation_key: activeSlot.relation_key,
        parent_kind:
          activeSlot.relationship === "parent"
            ? activeSlot.parent_kind ?? "unknown"
            : undefined,
        is_current:
          activeSlot.relationship === "partner"
            ? true
            : undefined,
      };

      const { data, error } = await supabase.rpc(
        "add_relative",
        {
          p_payload: payload,
          p_relationship: activeSlot.relationship,
        }
      );

      if (error) {
        console.error("add_relative RPC error:", error);
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;
      const newId = result?.person_id ?? null;

      if (!newId) {
        console.error(
          "Respuesta inesperada de add_relative:",
          data
        );

        throw new Error(
          "El familiar fue procesado, pero la base de datos no devolvió su identificador."
        );
      }

      const slotId = activeSlot.id;

      const newPerson: AddedPerson = {
        id: newId,
        first_names: form.first_names.trim(),
        last_names: form.last_names.trim(),
        phone: form.phone || undefined,
        relation_type: form.relation_type,
        slot_id: slotId,
      };

      setFilledSlots((previous) => ({
        ...previous,
        [slotId]: newPerson,
      }));

      setActiveSlot(null);

      toast.success(
        `${form.first_names.trim()} fue agregado correctamente`
      );

      trackEvent("family_member_added" as any, {
        relation: form.relation_type,
        step: "onboarding",
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "No fue posible agregar el familiar";

      console.error("Error agregando familiar:", err);
      toast.error(message);
    } finally {
      setAddLoading(false);
    }
  };

  const filledCount = Object.keys(filledSlots).length;

  // ============================================================
  // Step: Batch invite
  // ============================================================

  const handleInvitePerson = async (person: AddedPerson) => {
    if (invitedIds.has(person.id)) return;
    setInviteLoading(person.id);
    try {
      const result = await createInviteLink(supabase, person.id, template);
      const ctx = {
        inviterFirstName: myFirstName,
        invitedFirstName: person.first_names,
        invitedRelation: person.relation_type,
        previewMembers: Object.values(filledSlots)
          .filter((p) => p.id !== person.id)
          .slice(0, 3)
          .map((p) => p.first_names),
      };
      const msg = buildInviteMessage(template, ctx, result.universalLink);
      await shareInviteWhatsApp(supabase, result.invitationId, msg, person.phone);
      trackEvent("invite_sent", { channel: "whatsapp", relation: person.relation_type });
      setInvitedIds((prev) => new Set([...prev, person.id]));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setInviteLoading(null);
    }
  };

  // ============================================================
  // Step: Notifications
  // ============================================================

  const requestNotifications = async () => {
    if (!("Notification" in window)) { setStep("done"); return; }
    try {
      const perm = await Notification.requestPermission();
      trackEvent("notification_permission_result" as any, { result: perm });
    } catch (_) {}
    setStep("done");
  };

  // ============================================================
  // Render helpers
  // ============================================================

  const stepIndex = STEP_INDEX[step];

  return (
    <>
      <Toaster position="top-center" />
      {activeSlot && (
        <AddRelativeModal
          slot={activeSlot}
          onSave={handleAddRelative}
          onClose={() => setActiveSlot(null)}
          loading={addLoading}
        />
      )}

      <div style={{ minHeight: "100vh", background: "#030208", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto", position: "relative" }}>
        {/* Estrellas de fondo */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, maxWidth: 480, margin: "0 auto" }}>
          {Array.from({ length: 50 }, (_, i) => (
            <circle key={i} cx={`${((i * 137.5) % 100).toFixed(1)}`} cy={`${((i * 97.3) % 100).toFixed(1)}`}
              r={`${(0.4 + (i % 4) * 0.2).toFixed(2)}`} fill="white" opacity={`${(0.12 + (i % 6) * 0.06).toFixed(2)}`} />
          ))}
        </svg>

        {/* Progress */}
        <div style={{ position: "relative", zIndex: 10, padding: "calc(env(safe-area-inset-top,20px) + 14px) 20px 12px", display: "flex", gap: 6 }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 100,
              background: i < stepIndex ? "#d4af37" : "rgba(212,175,55,0.12)",
              transition: "background 0.4s ease",
            }} />
          ))}
        </div>

        {/* ── CHECKING ──────────────────────────────────────────── */}
        {step === "checking" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "0 20px", position: "relative", zIndex: 10 }}>
            <Sparkles size={48} style={{ color: "rgba(212,175,55,0.5)", animation: "pulse 2s ease-in-out infinite" }} />
            <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 14 }}>Verificando tu cuenta...</p>
          </div>
        )}

        {/* ── INIT ERROR ────────────────────────────────────────── */}
        {/* Escenario D: un fallo aquí (person_claims/persons/relationships)
            nunca debe atrapar al usuario — siempre ofrece Reintentar o
            Continuar a la galaxia igual. */}
        {step === "init_error" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 20px", gap: 16, textAlign: "center", position: "relative", zIndex: 10 }}>
            <AlertTriangle size={48} style={{ color: "#f87171" }} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>No pudimos verificar tu cuenta</h1>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>{initError}</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 320 }}>
              <button
                onClick={() => runInitialCheck()}
                style={{ width: "100%", background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00", color: "#030208", fontWeight: 800, padding: "14px 0", borderRadius: 14, cursor: "pointer", fontSize: 15 }}
              >
                Reintentar
              </button>
              <button
                onClick={() => router.push("/tree")}
                style={{ width: "100%", color: "rgba(212,175,55,0.6)", background: "none", border: "none", fontSize: 14, padding: "8px 0", cursor: "pointer" }}
              >
                Continuar a la galaxia
              </button>
            </div>
          </div>
        )}

        {/* ── PROFILE ─────────────────────────────────────────── */}
        {step === "profile" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px 32px", gap: 28, position: "relative", zIndex: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(212,175,55,0.5)", marginBottom: 8 }}>Un último detalle</p>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                ¿Cómo quieres que te<br/>vea tu familia?
              </h1>
            </div>

            {/* Avatar + nombre como confirmación — solo cuando Google llenó ambos campos */}
            {!showNameFields && profFirstNames && profLastNames && (
              <div style={{
                background: "#0c0a18", borderRadius: 18, padding: "16px 18px",
                borderTop: "1.5px solid rgba(212,175,55,0.3)", borderLeft: "1px solid rgba(212,175,55,0.12)",
                borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.6)",
                boxShadow: "0 7px 0 #040300, 0 12px 22px rgba(0,0,0,0.6)",
                display: "flex", alignItems: "center", gap: 14,
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
                  background: "radial-gradient(circle at 35% 30%, rgba(212,175,55,0.3), rgba(3,2,8,0.9))",
                  border: "1.5px solid rgba(212,175,55,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 800, color: "#d4af37",
                }}>
                  {profFirstNames[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{profFirstNames} {profLastNames}</p>
                  <button
                    onClick={() => { setProfFirstNames(""); setProfLastNames(""); setShowNameFields(true); }}
                    style={{ fontSize: 11, color: "rgba(212,175,55,0.45)", background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2 }}
                  >
                    No es mi nombre
                  </button>
                </div>
              </div>
            )}

            {/* Campos de nombre — visibles cuando showNameFields=true.
                Una vez mostrados no se ocultan para que el usuario pueda
                escribir su apellido completo sin que el campo desaparezca. */}
            {showNameFields && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input type="text" placeholder="Nombres *" value={profFirstNames}
                  onChange={(e) => setProfFirstNames(e.target.value)} autoFocus
                  style={{ background: "#0c0a18", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }} />
                <input type="text" placeholder="Apellidos *" value={profLastNames}
                  onChange={(e) => setProfLastNames(e.target.value)}
                  style={{ background: "#0c0a18", border: "1px solid rgba(212,175,55,0.25)", borderRadius: 12, padding: "12px 14px", color: "#fff", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" }} />
              </div>
            )}

            {/* Género — única pregunta activa */}
            <div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginBottom: 12, fontWeight: 600 }}>¿Con qué género te identificas?</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {ONBOARDING_GENDER_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button" onClick={() => setProfGender(opt.value)}
                    style={{
                      padding: "13px 8px", borderRadius: 14, fontSize: 13, fontWeight: 700, cursor: "pointer",
                      background: profGender === opt.value ? "#d4af37" : "#0c0a18",
                      color: profGender === opt.value ? "#030208" : "rgba(255,255,255,0.55)",
                      border: profGender === opt.value ? "1.5px solid #f5e060" : "1px solid rgba(212,175,55,0.18)",
                      boxShadow: profGender === opt.value ? "0 4px 0 #6a5600, 0 0 16px rgba(212,175,55,0.3)" : "0 2px 0 #000",
                      transition: "all 0.15s ease",
                    }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={profLoading || !getProfileGenderFormState(profGender).canSubmit || !profFirstNames.trim() || !profLastNames.trim()}
              style={{
                marginTop: "auto", width: "100%", padding: "15px 0", borderRadius: 14,
                background: (profLoading || !getProfileGenderFormState(profGender).canSubmit) ? "#6a5600" : "#c9a820",
                borderTop: "2px solid #f5e060", borderLeft: "1.5px solid rgba(255,240,100,0.5)",
                borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
                boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7)",
                color: "#030208", fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none",
                opacity: (profLoading || !getProfileGenderFormState(profGender).canSubmit || !profFirstNames.trim() || !profLastNames.trim()) ? 0.5 : 1,
              }}
            >
              {profLoading ? "Conectando tu galaxia..." : "Continuar →"}
            </button>
          </div>
        )}

        {/* ── MATCH ──────────────────────────────────────────── */}
        {step === "match" && match && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px 40px", gap: 20, position: "relative", zIndex: 10 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Parece que alguien ya te agregó</h1>

            <div style={{ background: "#0c0a18", borderRadius: 20, border: "1px solid rgba(212,175,55,0.25)", padding: "20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#5c7a52", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 24, fontWeight: 700, flexShrink: 0 }}>
                {match.first_names[0]}
              </div>
              <div>
                <p style={{ fontWeight: 700, color: "#fff", fontSize: 18 }}>
                  {match.first_names} {match.last_names}
                </p>
                {match.birth_date && (
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 2 }}>
                    {new Date(match.birth_date).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
                {match.added_by_name && (
                  <p style={{ color: "rgba(212,175,55,0.6)", fontSize: 12, marginTop: 4 }}>Agregado por {match.added_by_name}</p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={claimMatch}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00", color: "#030208", fontWeight: 800, padding: "15px 0", borderRadius: 14, cursor: "pointer", fontSize: 15 }}
              >
                <Check size={20} /> Sí, soy yo
              </button>
              <button
                onClick={() => { trackEvent("match_rejected"); setMatch(null); setStep("profile"); }}
                style={{ width: "100%", color: "rgba(255,255,255,0.45)", background: "none", border: "none", fontSize: 14, padding: "10px 0", cursor: "pointer" }}
              >
                No, es otra persona
              </button>
            </div>
          </div>
        )}

        {/* ── ADD FAMILY ─────────────────────────────────────── */}
        {step === "add_family" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "20px 20px 140px", gap: 18, position: "relative", zIndex: 10 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(212,175,55,0.5)", marginBottom: 8 }}>Tu galaxia familiar</p>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.2, letterSpacing: "-0.02em", marginBottom: 4 }}>¿Quién está en tu familia?</h1>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Agrega al menos uno para ver tu galaxia.</p>
            </div>

            {/* Barra de progreso */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 5, background: "rgba(212,175,55,0.1)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ width: `${(filledCount / 5) * 100}%`, height: "100%", background: "#d4af37", borderRadius: 100, transition: "width 0.5s ease", boxShadow: "0 0 8px rgba(212,175,55,0.5)" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "rgba(212,175,55,0.6)", flexShrink: 0 }}>{filledCount} / 5</span>
            </div>

            {/* Slots */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {SUGGESTED_SLOTS.map((slot) => {
                const filled = filledSlots[slot.id];
                return filled ? (
                  <div key={slot.id} style={{
                    background: "rgba(212,175,55,0.08)", borderRadius: 16, padding: "14px 14px 12px",
                    border: "1.5px solid rgba(212,175,55,0.35)",
                    boxShadow: "0 4px 0 rgba(212,175,55,0.08)",
                    display: "flex", flexDirection: "column", gap: 3,
                  }}>
                    <span style={{ fontSize: 24 }}>{slot.emoji}</span>
                    <p style={{ fontWeight: 700, color: "#fff", fontSize: 13, lineHeight: 1.3 }}>{filled.first_names}</p>
                    <p style={{ color: "rgba(212,175,55,0.6)", fontSize: 11 }}>{slot.label}</p>
                    <Check size={14} style={{ color: "#d4af37", marginTop: 2 }} />
                  </div>
                ) : (
                  <button key={slot.id} onClick={() => setActiveSlot(slot)} style={{
                    background: "#0c0a18", borderRadius: 16, padding: "14px 14px 12px",
                    border: "1.5px dashed rgba(212,175,55,0.2)",
                    display: "flex", flexDirection: "column", gap: 3, textAlign: "left", cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}>
                    <span style={{ fontSize: 24 }}>{slot.emoji}</span>
                    <p style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)", fontSize: 13 }}>{slot.label}</p>
                    {slot.optional && <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>opcional</p>}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, color: "rgba(212,175,55,0.5)", fontSize: 11, marginTop: 2 }}>
                      <Plus size={11} /> Agregar
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AHA MOMENT ─────────────────────────────────────── */}
        {step === "aha" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 40px", gap: 24, textAlign: "center", position: "relative", zIndex: 10 }}>
            <Sparkles size={72} style={{ color: "rgba(212,175,55,0.85)", animation: "bounce 1s infinite" }} />
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                ¡Aquí está tu ceiba, {myFirstName}!
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>Tu galaxia familiar ya está tomando forma.</p>
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: "#0c0a18", borderRadius: 16, padding: "12px 16px", border: "1px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 20 }}>🌱</span>
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500 }}>
                  {filledCount} familiar{filledCount !== 1 ? "es" : ""} agregado{filledCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div style={{ background: "#0c0a18", borderRadius: 16, padding: "12px 16px", border: "1px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                <Cake size={20} style={{ color: "rgba(212,175,55,0.65)", flexShrink: 0 }} />
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500 }}>
                  Recibirás recordatorios de cumpleaños
                </span>
              </div>
              <div style={{ background: "#0c0a18", borderRadius: 16, padding: "12px 16px", border: "1px solid rgba(212,175,55,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                <AlertTriangle size={20} style={{ color: "#f87171", flexShrink: 0 }} />
                <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500 }}>
                  Tu familia puede mandarte alertas SOS
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: "auto" }}>
              <button
                onClick={() => setStep("batch_invite")}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7)", color: "#030208", fontWeight: 800, padding: "15px 0", borderRadius: 14, cursor: "pointer", fontSize: 15 }}
              >
                <Send size={18} /> Invitar a mi familia
              </button>
              <button
                onClick={() => router.push("/tree?welcome=1")}
                style={{ width: "100%", border: "1px solid rgba(212,175,55,0.25)", color: "rgba(212,175,55,0.7)", background: "none", fontWeight: 600, fontSize: 14, padding: "12px 0", borderRadius: 14, cursor: "pointer" }}
              >
                Ver mi galaxia ahora →
              </button>
            </div>
          </div>
        )}

        {/* ── BATCH INVITE ───────────────────────────────────── */}
        {step === "batch_invite" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 20px 128px", gap: 16, position: "relative", zIndex: 10 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4, letterSpacing: "-0.02em" }}>Invita a los que agregaste</h1>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
                Cuando entren, cada uno verá la galaxia ya lista.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.values(filledSlots).map((person) => {
                const isInvited = invitedIds.has(person.id);
                const isLoading = inviteLoading === person.id;
                return (
                  <div
                    key={person.id}
                    style={{ background: isInvited ? "rgba(34,197,94,0.08)" : "#0c0a18", borderRadius: 16, border: isInvited ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(212,175,55,0.15)", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}
                  >
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#5c7a52", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, flexShrink: 0 }}>
                      {person.first_names[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {person.first_names} {person.last_names}
                      </p>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{person.phone || "Sin teléfono"}</p>
                    </div>
                    {isInvited ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#4ade80", fontSize: 12, fontWeight: 500 }}>
                        <Check size={14} /> Enviada
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvitePerson(person)}
                        disabled={!!inviteLoading}
                        style={{ flexShrink: 0, background: "#25D366", color: "#fff", fontSize: 12, fontWeight: 700, padding: "8px 12px", borderRadius: 12, border: "none", cursor: "pointer", opacity: inviteLoading ? 0.5 : 1 }}
                      >
                        {isLoading ? "..." : "WhatsApp"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ──────────────────────────────────── */}
        {step === "notifications" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px 40px", gap: 24, textAlign: "center", position: "relative", zIndex: 10 }}>
            <Bell size={64} style={{ color: "rgba(212,175,55,0.75)" }} />
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>Un último paso</h1>
              <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>Ceiba solo te notifica para cosas que importan.</p>
            </div>

            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
              {[
                { icon: "🎂", text: "Cumpleaños de tu familia" },
                { icon: "✨", text: "Recuerdos del día — un día como hoy" },
                { icon: "🚨", text: "Alertas SOS" },
                { icon: "📢", text: "Mensajes familiares importantes" },
              ].map(({ icon, text }) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 12, background: "#0c0a18", borderRadius: 14, padding: "12px 16px", border: "1px solid rgba(212,175,55,0.15)" }}>
                  <span style={{ fontSize: 18 }}>{icon}</span>
                  <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 14 }}>{text}</span>
                </div>
              ))}
              <p style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 12, marginTop: 4 }}>Nunca para publicidad.</p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", marginTop: "auto" }}>
              <button
                onClick={requestNotifications}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7)", color: "#030208", fontWeight: 800, padding: "15px 0", borderRadius: 14, cursor: "pointer", fontSize: 15 }}
              >
                <Bell size={18} /> Activar notificaciones
              </button>
              <button
                onClick={() => router.push("/tree?welcome=1")}
                style={{ width: "100%", border: "1px solid rgba(212,175,55,0.25)", color: "rgba(212,175,55,0.7)", background: "none", fontWeight: 600, fontSize: 14, padding: "12px 0", borderRadius: 14, cursor: "pointer" }}
              >
                Ver mi galaxia primero →
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ───────────────────────────────────────────── */}
        {step === "done" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "64px 20px 40px", gap: 24, textAlign: "center", position: "relative", zIndex: 10 }}>
            <div style={{ position: "relative" }}>
              <Sparkles size={80} style={{ color: "rgba(212,175,55,0.85)" }} />
              <div style={{ position: "absolute", top: -8, right: -8, width: 32, height: 32, background: "#4ade80", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
                <Check size={18} style={{ color: "#fff" }} />
              </div>
            </div>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                ¡Bienvenido/a, {myFirstName}!
              </h1>
              <p style={{ color: "rgba(255,255,255,0.55)" }}>Tu galaxia familiar te está esperando.</p>
            </div>
            <button
              onClick={() => router.push("/tree")}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7)", color: "#030208", fontWeight: 800, padding: "17px 0", borderRadius: 14, cursor: "pointer", fontSize: 17, marginTop: "auto" }}
            >
              Entrar a mi galaxia
              <ChevronRight size={22} />
            </button>
          </div>
        )}

        {/* Footer botones de navegación */}
        {/* 0/5 es progreso recomendado, NUNCA un requisito: el botón está
            siempre habilitado, ya sea para omitir (0 agregados) o para
            continuar (1+). Al pulsarlo se completa el onboarding y se
            redirige directo a /tree. */}
        {step === "add_family" && (
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
            background: "rgba(3,2,8,0.97)", borderTop: "0.5px solid rgba(212,175,55,0.2)",
            padding: "14px 20px 32px", backdropFilter: "blur(12px)", zIndex: 50,
          }}>
            <button
              onClick={() => setStep("aha")}
              style={{
                width: "100%", padding: "15px 0", borderRadius: 14,
                background: "#c9a820",
                borderTop: "2px solid #f5e060", borderLeft: "1.5px solid rgba(255,240,100,0.5)",
                borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
                boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7), 0 0 20px rgba(212,175,55,0.2)",
                color: "#030208", fontSize: 15, fontWeight: 800, cursor: "pointer", border: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
            >
              {getAddFamilyContinueLabel(filledCount)} <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === "batch_invite" && (
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", background: "rgba(3,2,8,0.97)", borderTop: "0.5px solid rgba(212,175,55,0.2)", padding: "14px 20px 32px", backdropFilter: "blur(12px)", zIndex: 50, display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              onClick={() => setStep("notifications")}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#c9a820", borderTop: "2px solid #f5e060", borderBottom: "4px solid #6a5600", border: "none", boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7)", color: "#030208", fontWeight: 800, padding: "15px 0", borderRadius: 14, cursor: "pointer", fontSize: 15 }}
            >
              Continuar <ChevronRight size={20} />
            </button>
            <button
              onClick={() => setStep("notifications")}
              style={{ width: "100%", color: "rgba(212,175,55,0.5)", background: "none", border: "none", fontSize: 14, padding: "6px 0", cursor: "pointer" }}
            >
              Saltar por ahora
            </button>
          </div>
        )}
      </div>
    </>
  );
}

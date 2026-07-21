"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  TreePine, ChevronRight, ChevronLeft, Check, Plus, X,
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

// ============================================================
// Tipos y constantes
// ============================================================

type Step =
  | "profile"       // 3 — Cuéntanos quién eres
  | "match"         // 4 — Match condicional
  | "add_family"    // 5 — Agregar 5 familiares
  | "aha"           // 6 — ¡Aquí está tu ceiba!
  | "batch_invite"  // 7 — Invitar en batch
  | "notifications" // 8 — Habilitar notificaciones
  | "done";         // 9 — ¡Listo!

const TOTAL_STEPS = 7;
const STEP_INDEX: Record<Step, number> = {
  profile: 1, match: 2, add_family: 3, aha: 4, batch_invite: 5, notifications: 6, done: 7
};

interface SlotDef {
  id: string;
  emoji: string;
  label: string;
  relation_type: string;
  optional?: boolean;
}

const SUGGESTED_SLOTS: SlotDef[] = [
  { id: "mom",    emoji: "👩", label: "Tu mamá",     relation_type: "mother" },
  { id: "dad",    emoji: "👨", label: "Tu papá",     relation_type: "father" },
  { id: "sib",    emoji: "👫", label: "Un hermano/a", relation_type: "sibling" },
  { id: "spouse", emoji: "💑", label: "Tu pareja",   relation_type: "spouse",    optional: true },
  { id: "child",  emoji: "👶", label: "Un hijo/a",   relation_type: "child",     optional: true },
  { id: "other",  emoji: "➕", label: "Otro familiar", relation_type: "family" },
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
  first_names: string;
  last_names: string;
  birth_date?: string;
  profile_photo_url?: string;
  added_by_name?: string;
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
    relation_type: slot.relation_type,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full bg-cream-50 rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-ceiba-900">
            {slot.emoji} {slot.label}
          </h3>
          <button onClick={onClose} className="text-ceiba-400 hover:text-ceiba-600">
            <X size={22} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Nombres *"
              value={form.first_names}
              onChange={(e) => setForm((f) => ({ ...f, first_names: e.target.value }))}
              className="col-span-1 rounded-xl border border-cream-300 px-4 py-3 text-sm outline-none focus:border-ceiba-400"
              autoFocus
            />
            <input
              type="text"
              placeholder="Apellidos"
              value={form.last_names}
              onChange={(e) => setForm((f) => ({ ...f, last_names: e.target.value }))}
              className="col-span-1 rounded-xl border border-cream-300 px-4 py-3 text-sm outline-none focus:border-ceiba-400"
            />
          </div>

          <input
            type="date"
            placeholder="Fecha de nacimiento (opcional)"
            value={form.birth_date}
            onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
            className="rounded-xl border border-cream-300 px-4 py-3 text-sm outline-none focus:border-ceiba-400 text-ceiba-700"
          />

          <div className="rounded-xl border border-cream-300 bg-white px-4 py-3 focus-within:border-ceiba-400">
            <PhoneInput
              international
              defaultCountry="CO"
              countryCallingCodeEditable={false}
              labels={phoneLabels}
              placeholder="WhatsApp (opcional)"
              value={form.phone || undefined}
              onChange={(value) =>
                setForm((f) => ({ ...f, phone: value ?? "" }))
              }
              className="ceiba-phone-input text-sm"
            />
          </div>

          {/* Toggle fallecido */}
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, is_living: !f.is_living }))}
            className="flex items-center gap-3 text-sm text-ceiba-600"
          >
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
              !form.is_living ? "bg-gray-400" : "bg-gray-200"
            }`}>
              <div className={`w-5 h-5 bg-cream-50 rounded-full shadow transition-transform ${
                !form.is_living ? "translate-x-4" : ""
              }`} />
            </div>
            Fallecido/a — aparece con † en el árbol
          </button>

          <button
            onClick={() => {
              if (!form.first_names.trim()) {
                toast.error("El nombre es obligatorio");
                return;
              }

              if (form.phone && !isValidPhoneNumber(form.phone)) {
                toast.error("El número de teléfono no es válido");
                return;
              }

              onSave(form);
            }}
            disabled={loading}
            className="w-full bg-ceiba-500 hover:bg-ceiba-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl mt-2 transition-colors"
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

  const [step, setStep] = useState<Step>("profile");
  const [userId, setUserId] = useState<string | null>(null);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [myFirstName, setMyFirstName] = useState("");
  const [myLastName, setMyLastName] = useState("");

  // Profile form
  const [profFirstNames, setProfFirstNames] = useState("");
  const [profLastNames, setProfLastNames] = useState("");
  const [profBirthDate, setProfBirthDate] = useState("");
  const [profCity, setProfCity] = useState("");
  const [profLoading, setProfLoading] = useState(false);

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

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data, error: userError }) => {
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

      const { data: claim, error: claimError } = await supabase
        .from("person_claims")
        .select("person_id")
        .eq("user_id", uid)
        .eq("claim_status", "approved")
        .maybeSingle();

      if (claimError) {
        console.error("Error consultando person_claims:", claimError);
        toast.error(`No fue posible consultar tu persona: ${claimError.message}`);
        return;
      }

      if (!claim?.person_id) return;

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

      if (personError) {
        console.error("Error consultando persons:", personError);
        toast.error(`No fue posible consultar tus datos: ${personError.message}`);
        return;
      }

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
      }
    });

    trackEvent("onboarding_started" as any, { type: "organic" });
  }, []);

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

    setProfLoading(true);

    try {
      const uid = userId;

      if (!uid) {
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
      const middleName =
        names.length > 1 ? names.slice(1).join(" ") : null;

      const firstSurname = surnames[0];
      const secondSurname =
        surnames.length > 1 ? surnames.slice(1).join(" ") : null;

      const displayName = [
        firstName,
        middleName,
        firstSurname,
        secondSurname,
      ]
        .filter(Boolean)
        .join(" ");

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: uid,
            display_name: displayName,
          },
          {
            onConflict: "user_id",
          }
        );

      if (profileError) {
        throw new Error(
          `No fue posible guardar el perfil: ${profileError.message}`
        );
      }

      let personId = myPersonId;

      if (!personId) {
        const { data: existingClaim, error: claimLookupError } =
          await supabase
            .from("person_claims")
            .select("person_id")
            .eq("user_id", uid)
            .eq("claim_status", "approved")
            .maybeSingle();

        if (claimLookupError) {
          throw new Error(
            `No fue posible consultar tu persona: ${claimLookupError.message}`
          );
        }

        personId = existingClaim?.person_id ?? null;
      }

      if (personId) {
        const { error: personUpdateError } = await supabase
          .from("persons")
          .update({
            first_name: firstName,
            middle_name: middleName,
            first_surname: firstSurname,
            second_surname: secondSurname,
            birth_date: profBirthDate || null,
            birth_city: profCity.trim() || null,
            status: "active",
          })
          .eq("id", personId);

        if (personUpdateError) {
          throw new Error(
            `No fue posible actualizar tus datos personales: ${personUpdateError.message}`
          );
        }
      } else {
        const { data: newPerson, error: personInsertError } =
          await supabase
            .from("persons")
            .insert({
              first_name: firstName,
              middle_name: middleName,
              first_surname: firstSurname,
              second_surname: secondSurname,
              birth_date: profBirthDate || null,
              birth_city: profCity.trim() || null,
              created_by: uid,
              status: "active",
            })
            .select("id")
            .single();

        if (personInsertError) {
          throw new Error(
            `No fue posible crear tu persona: ${personInsertError.message}`
          );
        }

        personId = newPerson.id;

        const { error: claimInsertError } = await supabase
          .from("person_claims")
          .insert({
            person_id: personId,
            user_id: uid,
            claim_status: "approved",
            verification_method: "self_registration",
            approved_at: new Date().toISOString(),
          });

        if (claimInsertError) {
          throw new Error(
            `La persona fue creada, pero no pudo vincularse a tu usuario: ${claimInsertError.message}`
          );
        }
      }

      setMyPersonId(personId);
      setMyFirstName(profFirstNames.trim());
      setMyLastName(profLastNames.trim());
      setStep("add_family");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Ocurrió un error inesperado.";

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
    // Link this person to the user
    const { error } = await supabase
      .from("persons")
      .update({ linked_user_id: userId, status: "active" })
      .eq("id", match.id)
      .is("linked_user_id", null);

    if (error) { toast.error(error.message); return; }

    setMyPersonId(match.id);
    toast.success("¡Te conectamos con tu árbol existente!");
    setStep("add_family");
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
      toast.error("No se identificó el familiar que estás agregando");
      return;
    }

    setAddLoading(true);

    try {
      const { data, error } = await supabase.rpc("add_relative", {
        p_first_names: form.first_names.trim(),
        p_last_names: form.last_names.trim() || null,
        p_relation: form.relation_type,
        p_birth_date: form.birth_date || null,
        p_gender: null,
        p_is_living: form.is_living,
      });

      if (error) {
        console.error("add_relative RPC error:", error);
        throw new Error(error.message);
      }

      const result = Array.isArray(data) ? data[0] : data;

      const newId =
        typeof result === "string"
          ? result
          : result?.person_id ?? result?.id ?? null;

      if (!newId) {
        console.error("Respuesta inesperada de add_relative:", data);
        throw new Error(
          "El familiar fue procesado, pero la base de datos no devolvió su identificador."
        );
      }

      if (form.phone) {
        const { error: phoneError } = await supabase
          .from("persons")
          .update({ phone: form.phone })
          .eq("id", newId);

        if (phoneError) {
          console.error("Phone update error:", phoneError);
          throw new Error(
            `No fue posible guardar el teléfono: ${phoneError.message}`
          );
        }
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
    } catch (err: any) {
      console.error("Error agregando familiar:", err);
      toast.error(err?.message || "No fue posible agregar el familiar");
    } finally {
      setAddLoading(false);
    }
  };

  const filledCount = Object.keys(filledSlots).length;
  const canContinue = filledCount >= 5;

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

      <div className="min-h-screen bg-cream-100 flex flex-col max-w-lg mx-auto">
        {/* Progress */}
        <ProgressBar step={stepIndex} total={TOTAL_STEPS} />

        {/* ── PROFILE ─────────────────────────────────────────── */}
        {step === "profile" && (
          <div className="flex flex-col px-5 pt-6 pb-10 gap-5 flex-1">
            <div>
              <h1 className="text-2xl font-bold text-ceiba-900 mb-1">Cuéntanos quién eres</h1>
              <p className="text-ceiba-500 text-sm">Un par de datos y tu árbol estará listo.</p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombres *"
                  value={profFirstNames}
                  onChange={(e) => setProfFirstNames(e.target.value)}
                  className="rounded-2xl border border-cream-300 px-4 py-3.5 outline-none focus:border-ceiba-400 bg-cream-50"
                />
                <input
                  type="text"
                  placeholder="Apellidos"
                  value={profLastNames}
                  onChange={(e) => setProfLastNames(e.target.value)}
                  className="rounded-2xl border border-cream-300 px-4 py-3.5 outline-none focus:border-ceiba-400 bg-cream-50"
                />
              </div>
              <input
                type="date"
                value={profBirthDate}
                onChange={(e) => setProfBirthDate(e.target.value)}
                className="rounded-2xl border border-cream-300 px-4 py-3.5 outline-none focus:border-ceiba-400 bg-cream-50 text-ceiba-700"
              />
              <input
                type="text"
                placeholder="Ciudad donde vives"
                value={profCity}
                onChange={(e) => setProfCity(e.target.value)}
                className="rounded-2xl border border-cream-300 px-4 py-3.5 outline-none focus:border-ceiba-400 bg-cream-50"
              />
            </div>

            <button
              onClick={saveProfile}
              disabled={profLoading}
              className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl mt-auto transition-colors"
            >
              {profLoading ? "Buscando conexiones..." : "Continuar"}
              {!profLoading && <ChevronRight size={20} />}
            </button>
          </div>
        )}

        {/* ── MATCH ──────────────────────────────────────────── */}
        {step === "match" && match && (
          <div className="flex flex-col px-5 pt-6 pb-10 gap-5 flex-1">
            <h1 className="text-2xl font-bold text-ceiba-900">Parece que alguien ya te agregó</h1>

            <div className="bg-cream-50 rounded-2xl border border-cream-200 shadow-sm p-5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-ceiba-600 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                {match.first_names[0]}
              </div>
              <div>
                <p className="font-bold text-ceiba-900 text-lg">
                  {match.first_names} {match.last_names}
                </p>
                {match.birth_date && (
                  <p className="text-ceiba-500 text-sm">
                    {new Date(match.birth_date).toLocaleDateString("es", { year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
                {match.added_by_name && (
                  <p className="text-ceiba-600 text-xs mt-1">Agregado por {match.added_by_name}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={claimMatch}
                className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl"
              >
                <Check size={20} /> Sí, soy yo
              </button>
              <button
                onClick={() => { setMatch(null); setStep("add_family"); }}
                className="w-full text-ceiba-500 hover:text-ceiba-800 py-3 text-sm"
              >
                No, es otra persona
              </button>
            </div>
          </div>
        )}

        {/* ── ADD FAMILY ─────────────────────────────────────── */}
        {step === "add_family" && (
          <div className="flex flex-col px-5 pt-6 pb-32 gap-4 flex-1">
            <div>
              <h1 className="text-2xl font-bold text-ceiba-900 mb-1">Construye tu árbol</h1>
              <p className="text-ceiba-500 text-sm">Empieza por los más cercanos. Detalles después.</p>
            </div>

            {/* Contador */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ceiba-500 rounded-full transition-all duration-500"
                  style={{ width: `${(filledCount / 5) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold text-ceiba-700 flex-shrink-0">
                {filledCount} / 5
              </span>
            </div>

            {/* Slots */}
            <div className="grid grid-cols-2 gap-3">
              {SUGGESTED_SLOTS.map((slot) => {
                const filled = filledSlots[slot.id];
                return filled ? (
                  <div
                    key={slot.id}
                    className="bg-ceiba-50 border-2 border-ceiba-200 rounded-2xl p-4 flex flex-col gap-1"
                  >
                    <span className="text-2xl">{slot.emoji}</span>
                    <p className="font-semibold text-ceiba-800 text-sm leading-tight">
                      {filled.first_names}
                    </p>
                    <p className="text-ceiba-500 text-xs">{slot.label}</p>
                    <Check size={14} className="text-ceiba-500 mt-1" />
                  </div>
                ) : (
                  <button
                    key={slot.id}
                    onClick={() => setActiveSlot(slot)}
                    className="bg-cream-50 border-2 border-dashed border-cream-300 hover:border-ceiba-400 hover:bg-ceiba-50 rounded-2xl p-4 flex flex-col gap-1 text-left transition-colors"
                  >
                    <span className="text-2xl">{slot.emoji}</span>
                    <p className="font-semibold text-ceiba-800 text-sm leading-tight">{slot.label}</p>
                    {slot.optional && <p className="text-ceiba-400 text-xs">opcional</p>}
                    <div className="flex items-center gap-1 text-ceiba-600 text-xs mt-1">
                      <Plus size={12} /> Agregar
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── AHA MOMENT ─────────────────────────────────────── */}
        {step === "aha" && (
          <div className="flex flex-col items-center px-5 pt-10 pb-10 gap-6 flex-1 text-center">
            <TreePine size={72} className="text-ceiba-400 animate-bounce" />
            <div>
              <h1 className="text-3xl font-bold text-ceiba-900 mb-2">
                ¡Aquí está tu ceiba, {myFirstName}!
              </h1>
              <p className="text-ceiba-500">Tu árbol familiar ya está tomando forma.</p>
            </div>

            <div className="w-full flex flex-col gap-2">
              <div className="bg-ceiba-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <span className="text-xl">🌱</span>
                <span className="text-ceiba-800 text-sm font-medium">
                  {filledCount} familiar{filledCount !== 1 ? "es" : ""} agregado{filledCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="bg-ceiba-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Cake size={20} className="text-ceiba-600" />
                <span className="text-ceiba-800 text-sm font-medium">
                  Recibirás recordatorios de cumpleaños
                </span>
              </div>
              <div className="bg-ceiba-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <AlertTriangle size={20} className="text-red-500" />
                <span className="text-ceiba-800 text-sm font-medium">
                  Tu familia puede mandarte alertas SOS
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full mt-auto">
              <button
                onClick={() => setStep("batch_invite")}
                className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl"
              >
                <Send size={18} /> Invitar a mi familia
              </button>
              <button
                onClick={() => setStep("notifications")}
                className="w-full text-ceiba-500 hover:text-ceiba-800 text-sm py-2"
              >
                Explorar mi árbol después
              </button>
            </div>
          </div>
        )}

        {/* ── BATCH INVITE ───────────────────────────────────── */}
        {step === "batch_invite" && (
          <div className="flex flex-col px-5 pt-6 pb-32 gap-4 flex-1">
            <div>
              <h1 className="text-2xl font-bold text-ceiba-900 mb-1">Invita a los que agregaste</h1>
              <p className="text-ceiba-500 text-sm">
                Cuando entren, cada uno verá el árbol ya listo.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {Object.values(filledSlots).map((person) => {
                const isInvited = invitedIds.has(person.id);
                const isLoading = inviteLoading === person.id;
                return (
                  <div
                    key={person.id}
                    className={`bg-cream-50 rounded-2xl border p-4 flex items-center gap-3 ${
                      isInvited ? "border-green-200 bg-green-50" : "border-cream-200"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-ceiba-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {person.first_names[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-ceiba-900 truncate">
                        {person.first_names} {person.last_names}
                      </p>
                      {person.phone ? (
                        <p className="text-ceiba-400 text-xs">{person.phone}</p>
                      ) : (
                        <p className="text-ceiba-400 text-xs">Sin teléfono</p>
                      )}
                    </div>
                    {isInvited ? (
                      <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <Check size={14} /> Enviada
                      </span>
                    ) : (
                      <button
                        onClick={() => handleInvitePerson(person)}
                        disabled={!!inviteLoading}
                        className="flex-shrink-0 bg-[#25D366] hover:bg-[#1ebe5c] disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
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
          <div className="flex flex-col items-center px-5 pt-10 pb-10 gap-6 flex-1 text-center">
            <Bell size={64} className="text-ceiba-500" />
            <div>
              <h1 className="text-2xl font-bold text-ceiba-900 mb-2">Un último paso</h1>
              <p className="text-ceiba-500 text-sm">Ceiba solo te notifica para cosas que importan.</p>
            </div>

            <div className="w-full flex flex-col gap-2 text-left">
              {[
                { icon: "🎂", text: "Cumpleaños de tu familia" },
                { icon: "🚨", text: "Alertas SOS" },
                { icon: "📢", text: "Mensajes familiares importantes" },
              ].map(({ icon, text }) => (
                <div key={text} className="flex items-center gap-3 bg-ceiba-50 rounded-xl px-4 py-3">
                  <span className="text-lg">{icon}</span>
                  <span className="text-ceiba-800 text-sm">{text}</span>
                </div>
              ))}
              <p className="text-center text-ceiba-400 text-xs mt-1">Nunca para publicidad.</p>
            </div>

            <div className="flex flex-col gap-3 w-full mt-auto">
              <button
                onClick={requestNotifications}
                className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl"
              >
                <Bell size={18} /> Activar notificaciones
              </button>
              <button
                onClick={() => setStep("done")}
                className="w-full text-ceiba-400 hover:text-ceiba-600 text-sm py-2"
              >
                Después
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ───────────────────────────────────────────── */}
        {step === "done" && (
          <div className="flex flex-col items-center px-5 pt-16 pb-10 gap-6 flex-1 text-center">
            <div className="relative">
              <TreePine size={80} className="text-ceiba-400" />
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center shadow-lg">
                <Check size={18} className="text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-ceiba-900 mb-2">
                ¡Bienvenido/a, {myFirstName}!
              </h1>
              <p className="text-ceiba-500">Tu árbol familiar te está esperando.</p>
            </div>
            <button
              onClick={() => router.push("/tree")}
              className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl text-lg mt-auto"
            >
              Entrar a mi árbol
              <ChevronRight size={22} />
            </button>
          </div>
        )}

        {/* Footer botones de navegación */}
        {step === "add_family" && (
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-cream-50 border-t px-5 py-4 flex flex-col gap-2">
            <button
              onClick={() => setStep("aha")}
              disabled={!canContinue}
              className={`w-full flex items-center justify-center gap-2 font-bold py-4 rounded-2xl transition-all ${
                canContinue
                  ? "bg-ceiba-500 hover:bg-ceiba-400 text-white"
                  : "bg-cream-200 text-ceiba-400 cursor-not-allowed"
              }`}
            >
              {canContinue ? (
                <>Ya tengo mi árbol → Continuar <ChevronRight size={20} /></>
              ) : (
                `Faltan ${5 - filledCount} familiar${5 - filledCount !== 1 ? "es" : ""}`
              )}
            </button>
          </div>
        )}

        {step === "batch_invite" && (
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-cream-50 border-t px-5 py-4 flex flex-col gap-2">
            <button
              onClick={() => setStep("notifications")}
              className="w-full flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold py-4 rounded-2xl"
            >
              Continuar <ChevronRight size={20} />
            </button>
            <button
              onClick={() => setStep("notifications")}
              className="w-full text-ceiba-400 hover:text-ceiba-600 text-sm py-1"
            >
              Saltar por ahora
            </button>
          </div>
        )}
      </div>
    </>
  );
}

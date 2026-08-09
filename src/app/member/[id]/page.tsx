"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Save, AlertCircle, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PersonData {
  id: string;
  first_name: string;
  middle_name: string | null;
  first_surname: string | null;
  second_surname: string | null;
  birth_date: string | null;
  birth_city: string | null;
  birth_country: string | null;
  is_deceased: boolean;
}

export default function MemberEditPage() {
  const router = useRouter();
  const params = useParams();
  const personId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimedUserId, setClaimedUserId] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    middle_name: "",
    first_surname: "",
    second_surname: "",
    birth_date: "",
    birth_city: "",
    birth_country: "",
    is_deceased: false,
  });

  useEffect(() => { load(); }, [personId]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }

    const { data } = await supabase
      .from("persons")
      .select("id, first_name, middle_name, first_surname, second_surname, birth_date, birth_city, birth_country, is_deceased")
      .eq("id", personId)
      .maybeSingle();

    if (!data) { setNotFound(true); setLoading(false); return; }

    // Check if another user has claimed this person (for the Mensaje button)
    const { data: claim } = await supabase
      .from("person_claims")
      .select("user_id")
      .eq("person_id", personId)
      .eq("claim_status", "approved")
      .is("revoked_at", null)
      .neq("user_id", user.id)
      .maybeSingle();
    if (claim?.user_id) setClaimedUserId(claim.user_id);

    setForm({
      first_name: data.first_name ?? "",
      middle_name: data.middle_name ?? "",
      first_surname: data.first_surname ?? "",
      second_surname: data.second_surname ?? "",
      birth_date: data.birth_date ?? "",
      birth_city: data.birth_city ?? "",
      birth_country: data.birth_country ?? "",
      is_deceased: data.is_deceased ?? false,
    });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.first_name.trim()) { setError("El primer nombre es obligatorio"); return; }
    if (!form.first_surname.trim()) { setError("El primer apellido es obligatorio"); return; }
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/members/${personId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: form.first_name.trim(),
        middle_name: form.middle_name.trim() || null,
        first_surname: form.first_surname.trim(),
        second_surname: form.second_surname.trim() || null,
        birth_date: form.birth_date || null,
        birth_city: form.birth_city.trim() || null,
        birth_country: form.birth_country.trim() || null,
        is_deceased: form.is_deceased,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      if (res.status === 403) {
        router.push(`/collab/${personId}`);
        return;
      }
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Error al guardar");
      return;
    }

    router.push("/tree");
  };

  const startChat = async () => {
    if (!claimedUserId) return;
    setStartingChat(true);
    const res = await fetch("/api/chat/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId: claimedUserId }),
    });
    setStartingChat(false);
    if (!res.ok) return;
    const { roomId } = await res.json();
    router.push(`/chat/${roomId}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  if (notFound) return (
    <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center gap-4">
      <TreePine size={48} className="text-ceiba-300" />
      <p className="text-ceiba-500">Familiar no encontrado</p>
      <Link href="/tree" className="btn-primary">Volver a la galaxia</Link>
    </div>
  );

  const displayName = [form.first_name, form.first_surname].filter(Boolean).join(" ") || "Familiar";

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="font-display text-lg font-bold truncate">Editar: {displayName}</div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 pb-24 space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="card space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">Primer nombre *</label>
              <input
                className="input-field w-full"
                value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">Segundo nombre</label>
              <input
                className="input-field w-full"
                value={form.middle_name}
                onChange={e => setForm(f => ({ ...f, middle_name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">Primer apellido *</label>
              <input
                className="input-field w-full"
                value={form.first_surname}
                onChange={e => setForm(f => ({ ...f, first_surname: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">Segundo apellido</label>
              <input
                className="input-field w-full"
                value={form.second_surname}
                onChange={e => setForm(f => ({ ...f, second_surname: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ceiba-600 mb-1">Fecha de nacimiento</label>
            <input
              type="date"
              className="input-field w-full"
              value={form.birth_date}
              onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">Ciudad de nacimiento</label>
              <input
                className="input-field w-full"
                value={form.birth_city}
                onChange={e => setForm(f => ({ ...f, birth_city: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">País de nacimiento</label>
              <input
                className="input-field w-full"
                value={form.birth_country}
                onChange={e => setForm(f => ({ ...f, birth_country: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_deceased}
              onChange={e => setForm(f => ({ ...f, is_deceased: e.target.checked }))}
              className="w-4 h-4 accent-ceiba-700"
            />
            <span className="text-sm text-ceiba-700">Fallecido/a</span>
          </label>
        </div>

        {claimedUserId && (
          <button
            onClick={startChat}
            disabled={startingChat}
            className="w-full flex items-center justify-center gap-2 disabled:opacity-60"
            style={{
              padding: "12px 16px", borderRadius: 14, fontSize: 14, fontWeight: 700,
              color: "#fff", background: "linear-gradient(135deg,#1a1030,#0c0a18)",
              border: "1.5px solid rgba(212,175,55,0.35)", cursor: "pointer",
              boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
            }}
          >
            <MessageCircle size={16} />
            {startingChat ? "Abriendo chat..." : `Enviar mensaje a ${form.first_name}`}
          </button>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>

        <Link href="/tree" className="w-full text-center text-ceiba-400 hover:text-ceiba-600 text-sm py-2 block">
          Cancelar
        </Link>
      </div>
    </main>
  );
}

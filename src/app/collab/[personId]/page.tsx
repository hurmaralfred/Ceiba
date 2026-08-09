"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Users, Edit3, ArrowRightLeft, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CollabInfo {
  person: { id: string; name: string };
  ownerName: string | null;
  ownerUserId: string | null;
  existingRequest: {
    id: string;
    request_type: "edit" | "transfer";
    status: "pending" | "approved" | "rejected";
    created_at: string;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

const TYPE_LABEL: Record<string, string> = {
  edit: "co-edición",
  transfer: "transferencia",
};

export default function CollabPage() {
  const router = useRouter();
  const params = useParams();
  const personId = params.personId as string;
  const supabase = createClient();

  const [info, setInfo] = useState<CollabInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"edit" | "transfer" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push("/auth/login"); return; }
      loadInfo();
    });
  }, [personId]);

  const loadInfo = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/collab/${personId}`);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "No se pudo cargar la información");
      setLoading(false);
      return;
    }
    setInfo(await res.json());
    setLoading(false);
  };

  const sendRequest = async (type: "edit" | "transfer") => {
    setSubmitting(type);
    setError(null);
    const res = await fetch(`/api/collab/${personId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message: message.trim() || undefined }),
    });
    setSubmitting(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setError(b.error || "Error al enviar la solicitud");
      return;
    }
    await loadInfo();
    setMessage("");
  };

  if (loading) return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  const existing = info?.existingRequest;
  const hasPending = existing?.status === "pending";
  const isApproved = existing?.status === "approved";
  const isRejected = existing?.status === "rejected";

  return (
    <main className="min-h-screen bg-cream-100">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <button onClick={() => router.back()} className="text-ceiba-300 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <TreePine size={20} className="text-ceiba-300" /> Edición colaborativa
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4 pb-24">

        {/* Persona */}
        {info && (
          <div className="card flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-ceiba-700 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {info.person.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-ceiba-900">{info.person.name}</h1>
              <p className="text-sm text-ceiba-500 flex items-center gap-1 mt-0.5">
                <Users size={13} />
                Administrado por{" "}
                <span className="font-semibold text-ceiba-700">
                  {info.ownerName ?? "un familiar"}
                </span>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Estado de solicitud existente */}
        {existing && (
          <div className={`card border ${
            isApproved ? "border-green-300 bg-green-50"
            : isRejected ? "border-red-200 bg-red-50"
            : "border-amber-200 bg-amber-50"
          }`}>
            <div className="flex items-start gap-3">
              {isApproved && <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />}
              {isRejected && <XCircle size={20} className="text-red-500 shrink-0 mt-0.5" />}
              {hasPending && <Clock size={20} className="text-amber-600 shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-semibold text-sm">
                  Solicitud de {TYPE_LABEL[existing.request_type]} · {STATUS_LABEL[existing.status]}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enviada el {new Date(existing.created_at).toLocaleDateString("es", {
                    day: "numeric", month: "long", year: "numeric"
                  })}
                </p>
                {isApproved && (
                  <p className="text-xs text-green-700 mt-1 font-medium">
                    {existing.request_type === "transfer"
                      ? "Ya eres el administrador de esta persona. Puedes editarla en la galaxia."
                      : "Ya puedes co-editar esta persona. Abre la galaxia para editar."}
                  </p>
                )}
                {isRejected && (
                  <p className="text-xs text-red-600 mt-1">
                    El administrador rechazó tu solicitud. Puedes enviar una nueva.
                  </p>
                )}
              </div>
            </div>
            {isApproved && (
              <Link href="/tree" className="btn-primary mt-3 text-sm w-full text-center block">
                Ir a la galaxia familiar
              </Link>
            )}
          </div>
        )}

        {/* Explicación */}
        {!existing && info && (
          <div className="card">
            <h2 className="font-bold text-ceiba-800 mb-2">¿Cómo funciona?</h2>
            <p className="text-sm text-ceiba-600 leading-relaxed">
              <strong>{info.person.name}</strong> está siendo administrado por otro familiar.
              Puedes solicitar permiso para editarla o pedir que te transfieran la administración.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-ceiba-600">
              <li className="flex items-start gap-2">
                <Edit3 size={14} className="text-ceiba-500 shrink-0 mt-0.5" />
                <span><strong>Co-edición</strong> — ambos pueden modificar los datos de esta persona.</span>
              </li>
              <li className="flex items-start gap-2">
                <ArrowRightLeft size={14} className="text-ceiba-500 shrink-0 mt-0.5" />
                <span><strong>Transferencia</strong> — pasas a ser el único administrador.</span>
              </li>
            </ul>
          </div>
        )}

        {/* Formulario de solicitud */}
        {(!existing || isRejected) && info && !isApproved && (
          <div className="card space-y-4">
            <h2 className="font-bold text-ceiba-800">Enviar solicitud</h2>

            <div>
              <label className="block text-xs font-medium text-ceiba-600 mb-1">
                Mensaje para el administrador (opcional)
              </label>
              <textarea
                className="input-field resize-none text-sm w-full"
                rows={2}
                placeholder="ej. Soy su hijo y quiero actualizar sus datos"
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => sendRequest("edit")}
                disabled={!!submitting}
                className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <Edit3 size={16} />
                {submitting === "edit" ? "Enviando..." : "Solicitar co-edición"}
              </button>
              <button
                onClick={() => sendRequest("transfer")}
                disabled={!!submitting}
                className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60"
              >
                <ArrowRightLeft size={16} />
                {submitting === "transfer" ? "Enviando..." : "Solicitar transferencia"}
              </button>
            </div>
          </div>
        )}

        {hasPending && (
          <p className="text-center text-xs text-ceiba-400">
            El administrador recibirá tu solicitud y podrá aceptarla o rechazarla.
          </p>
        )}

        <button onClick={() => router.back()} className="w-full text-center text-ceiba-400 hover:text-ceiba-600 text-sm py-2">
          Cancelar
        </button>
      </div>
    </main>
  );
}

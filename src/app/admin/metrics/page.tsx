"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ChevronLeft } from "lucide-react";

// Embudo de invitaciones: compartida → abierta → botón → aceptada.
// Datos: /api/admin/metrics (vistas v_invitation_*).

interface Totals { shared: number; opened: number; cta_clicked: number; accepted: number }

interface WeeklyRow {
  week: string;
  created: number;
  shared: number;
  opened: number;
  accepted: number;
  pct_opened_of_shared: number | null;
  pct_accepted_of_opened: number | null;
  avg_hours_to_open: number | null;
}

interface TemplateRow {
  template: string;
  shared: number;
  opened: number;
  accepted: number;
  pct_opened: number | null;
  pct_accepted: number | null;
}

interface MetricsData {
  totals: Totals;
  weekly: WeeklyRow[];
  templates: TemplateRow[];
  topInviters: { invited_by: string; shared: number; opened: number; accepted: number }[];
  stuck: { id: string; template: string; opened_at: string }[];
  fetchedAt: string;
}

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);

function Step({ label, value, base }: { label: string; value: number; base: number }) {
  const w = base > 0 ? Math.round((value / base) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 text-gray-600">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
        <div className="h-full bg-ceiba-500 rounded-full" style={{ width: `${w}%` }} />
      </div>
      <span className="w-20 text-right font-mono text-gray-700">{value} · {w}%</span>
    </div>
  );
}

export default function MetricsPage() {
  const router = useRouter();
  const [data, setData] = useState<MetricsData | null>(null);
  const [forbidden, setForbidden] = useState<{ configured: boolean; your_user_id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/metrics");
      if (res.status === 401) { router.push("/auth/login"); return; }
      const body = await res.json();
      if (res.status === 403) { setForbidden(body); return; }
      if (!res.ok) throw new Error(body.error || "Error al cargar");
      setData(body);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-6">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-1 text-sm text-gray-500">
            <ChevronLeft size={16} /> Inicio
          </Link>
          <button onClick={load} className="p-2 text-gray-500" aria-label="Actualizar">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <h1 className="text-xl font-bold text-ceiba-900">Invitaciones</h1>

        {forbidden && (
          <div className="bg-white rounded-2xl p-4 text-sm text-gray-700 space-y-2">
            <p>No tienes acceso a esta página.</p>
            {!forbidden.configured && (
              <p>
                Falta definir <code>ADMIN_USER_IDS</code> en el servidor. Tu id:{" "}
                <code className="break-all">{forbidden.your_user_id}</code>
              </p>
            )}
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {data && (
          <>
            <section className="bg-white rounded-2xl p-4 space-y-3">
              <Step label="Compartidas" value={data.totals.shared} base={data.totals.shared} />
              <Step label="Enlace abierto" value={data.totals.opened} base={data.totals.shared} />
              <Step label="Tocó el botón" value={data.totals.cta_clicked} base={data.totals.shared} />
              <Step label="Aceptadas" value={data.totals.accepted} base={data.totals.shared} />
              {data.totals.opened === 0 && data.totals.shared > 0 && (
                <p className="text-xs text-gray-400">
                  Las aperturas se registran desde que se desplegó el seguimiento; las invitaciones anteriores no tienen ese dato.
                </p>
              )}
            </section>

            <section className="bg-white rounded-2xl p-4 overflow-x-auto">
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Por semana</h2>
              <table className="w-full text-xs">
                <thead className="text-gray-400 text-left">
                  <tr><th>Semana</th><th>Comp.</th><th>Abiertas</th><th>Acept.</th><th>% abre</th><th>% acepta</th></tr>
                </thead>
                <tbody>
                  {data.weekly.map((w) => (
                    <tr key={w.week} className="border-t border-gray-50">
                      <td className="py-1.5">{w.week}</td>
                      <td>{w.shared}</td>
                      <td>{w.opened}</td>
                      <td>{w.accepted}</td>
                      <td>{pct(w.pct_opened_of_shared)}</td>
                      <td>{pct(w.pct_accepted_of_opened)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="bg-white rounded-2xl p-4 overflow-x-auto">
              <h2 className="text-sm font-semibold text-gray-500 mb-2">Mensaje (plantilla)</h2>
              <table className="w-full text-xs">
                <thead className="text-gray-400 text-left">
                  <tr><th>Plantilla</th><th>Comp.</th><th>Abiertas</th><th>Acept.</th><th>% abre</th></tr>
                </thead>
                <tbody>
                  {data.templates.map((t) => (
                    <tr key={t.template} className="border-t border-gray-50">
                      <td className="py-1.5">{t.template}</td>
                      <td>{t.shared}</td>
                      <td>{t.opened}</td>
                      <td>{t.accepted}</td>
                      <td>{pct(t.pct_opened)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {data.stuck.length > 0 && (
              <p className="text-sm text-gray-600">
                {data.stuck.length} invitación(es) abierta(s) hace más de 48 h sin aceptar.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

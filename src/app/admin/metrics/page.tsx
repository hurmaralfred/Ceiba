"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ChevronLeft, TrendingUp, Users, Clock, TreePine, AlertTriangle } from "lucide-react";

// ============================================================
// Tipos (reflejan las columnas de las vistas SQL)
// ============================================================

interface KViralRow {
  cohort_week: string;
  cohort_size: number;
  total_invites_sent: number;
  total_invites_converted: number;
  avg_i: number;
  avg_c: number;
  k_viral: number;
}

interface FunnelRow {
  week: string;
  sign_ups: number;
  with_1_rel: number;
  with_3_rel: number;
  with_5_rel: number;
  with_1_invite: number;
  with_5_invites: number;
  pct_activated: number;
}

interface TemplateRow {
  template_id: string;
  invites_sent: number;
  opened: number;
  signed_up: number;
  activated: number;
  pct_opened: number;
  pct_signed_up: number;
  pct_activated: number;
}

interface CycleRow {
  week: string;
  invitations: number;
  avg_hours_to_open: number;
  avg_hours_to_signup: number;
  avg_hours_signup_to_activation: number;
}

interface FamiliesData {
  total_users: number;
  families_size_5plus: number;
  families_size_10plus: number;
  pct_family_5plus: number;
}

interface TopInviter {
  inviter_user_id: string;
  full_name: string;
  invites_sent: number;
  invites_activated: number;
  conversion_pct: number;
}

interface LostInvite {
  code: string;
  template_id: string;
  first_opened_at: string;
  first_opened_from: string;
  reminders_sent: number;
}

interface MetricsData {
  kViral: KViralRow[];
  funnel: FunnelRow[];
  templates: TemplateRow[];
  cycleTime: CycleRow[];
  families: FamiliesData | null;
  topInviters: TopInviter[];
  lostInvites: LostInvite[];
  fetchedAt: string;
}

// ============================================================
// Helpers
// ============================================================

function kColor(k: number) {
  if (k >= 1.2) return "text-green-600";
  if (k >= 0.8) return "text-yellow-600";
  return "text-red-600";
}

function kDot(k: number) {
  if (k >= 1.2) return "🟢";
  if (k >= 0.8) return "🟡";
  return "🔴";
}

function fmtWeek(isoDate: string) {
  return isoDate ? isoDate.slice(0, 10) : "—";
}

function FunnelBar({ value, total, label }: { value: number; total: number; label: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-36 text-gray-600 text-xs">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className="h-full bg-ceiba-500 rounded-full transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 text-right text-xs font-mono text-gray-700">
        {value.toLocaleString()} ({pct}%)
      </span>
    </div>
  );
}

// ============================================================
// KPI Card
// ============================================================

function KpiCard({
  title, value, sub, color, icon: Icon,
}: {
  title: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wide">
        <Icon size={14} />
        {title}
      </div>
      <p className={`text-3xl font-bold font-mono ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

// ============================================================
// Página
// ============================================================

export default function MetricsDashboard() {
  const router = useRouter();
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) {
        if (res.status === 401) { router.push("/auth/login"); return; }
        throw new Error(`HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Latest K viral row
  const latestK = data?.kViral?.[0];
  // Latest funnel row (most recent week)
  const latestFunnel = data?.funnel?.[0];
  // Best cycle time
  const latestCycle = data?.cycleTime?.[0];
  // Best template
  const bestTemplate = data?.templates?.reduce((best, t) =>
    t.pct_activated > (best?.pct_activated ?? -1) ? t : best, data.templates[0]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-ceiba-900 text-white px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-ceiba-300 hover:text-white">
            <ChevronLeft size={22} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-ceiba-300" />
              <h1 className="font-bold text-lg">K Viral Dashboard</h1>
            </div>
            <p className="text-ceiba-400 text-xs">
              {data?.fetchedAt ? `Actualizado ${new Date(data.fetchedAt).toLocaleTimeString("es")}` : "Cargando..."}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 text-ceiba-300 hover:text-white text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>

      {error && (
        <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col gap-8">

        {/* ── KPI Cards ─────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Métricas norte</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard
              title="K Viral"
              icon={TrendingUp}
              value={latestK ? `${latestK.k_viral} ${kDot(latestK.k_viral)}` : "—"}
              color={latestK ? kColor(latestK.k_viral) : undefined}
              sub={latestK ? `avg_i=${latestK.avg_i} × avg_c=${latestK.avg_c}` : undefined}
            />
            <KpiCard
              title="Familias ≥5"
              icon={TreePine}
              value={data?.families ? `${data.families.pct_family_5plus}%` : "—"}
              color={
                data?.families
                  ? data.families.pct_family_5plus >= 25 ? "text-green-600" : "text-yellow-600"
                  : undefined
              }
              sub={data?.families ? `${data.families.families_size_5plus} / ${data.families.total_users} usuarios` : undefined}
            />
            <KpiCard
              title="T ciclo (h)"
              icon={Clock}
              value={latestCycle?.avg_hours_to_signup ? `${latestCycle.avg_hours_to_signup}h` : "—"}
              color={
                latestCycle?.avg_hours_to_signup
                  ? latestCycle.avg_hours_to_signup < 120 ? "text-green-600" : "text-yellow-600"
                  : undefined
              }
              sub="hasta signup"
            />
            <KpiCard
              title="Template ganador"
              icon={Users}
              value={bestTemplate?.template_id ?? "—"}
              sub={bestTemplate ? `${bestTemplate.pct_activated}% activación` : undefined}
              color="text-ceiba-700"
            />
          </div>
        </section>

        {/* ── Funnel de activación ─────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">
            Funnel de activación
          </h2>
          {latestFunnel && (
            <p className="text-gray-400 text-xs mb-3">Semana {fmtWeek(latestFunnel.week)}</p>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
            {loading || !latestFunnel ? (
              <div className="h-32 animate-pulse bg-gray-100 rounded-xl" />
            ) : (
              <>
                <FunnelBar value={latestFunnel.sign_ups}    total={latestFunnel.sign_ups}    label="Sign ups" />
                <FunnelBar value={latestFunnel.with_1_rel}  total={latestFunnel.sign_ups}    label="Con 1 familiar" />
                <FunnelBar value={latestFunnel.with_3_rel}  total={latestFunnel.sign_ups}    label="Con 3 familiares" />
                <FunnelBar value={latestFunnel.with_5_rel}  total={latestFunnel.sign_ups}    label="Con 5 — aha ✓" />
                <FunnelBar value={latestFunnel.with_1_invite} total={latestFunnel.sign_ups}  label="Invitó ≥1" />
                <FunnelBar value={latestFunnel.with_5_invites} total={latestFunnel.sign_ups} label="Invitó ≥5" />
              </>
            )}
          </div>
        </section>

        {/* ── K Viral histórico ─────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">K Viral por cohorte</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3">Semana</th>
                  <th className="text-right px-4 py-3">Usuarios</th>
                  <th className="text-right px-4 py-3">Invites</th>
                  <th className="text-right px-4 py-3">Convertidos</th>
                  <th className="text-right px-4 py-3">avg_i</th>
                  <th className="text-right px-4 py-3">avg_c</th>
                  <th className="text-right px-4 py-3 font-bold">K</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (data?.kViral ?? []).map((row) => (
                      <tr key={row.cohort_week} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{fmtWeek(row.cohort_week)}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.cohort_size}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.total_invites_sent}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.total_invites_converted}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.avg_i}</td>
                        <td className="px-4 py-3 text-right font-mono">{row.avg_c}</td>
                        <td className={`px-4 py-3 text-right font-bold font-mono ${kColor(row.k_viral)}`}>
                          {row.k_viral} {kDot(row.k_viral)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loading && (data?.kViral ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Aún no hay datos. Las invitaciones generarán datos aquí.</p>
            )}
          </div>
        </section>

        {/* ── A/B Templates ─────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">A/B Templates</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3">Template</th>
                  <th className="text-right px-4 py-3">Enviadas</th>
                  <th className="text-right px-4 py-3">Abiertas</th>
                  <th className="text-right px-4 py-3">Signup</th>
                  <th className="text-right px-4 py-3">Activadas</th>
                  <th className="text-right px-4 py-3 font-bold">% Activ.</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (data?.templates ?? []).map((t) => {
                      const isBest = t.template_id === bestTemplate?.template_id;
                      return (
                        <tr key={t.template_id} className={`border-b transition-colors ${isBest ? "bg-ceiba-50" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3 font-mono text-xs">
                            {t.template_id}
                            {isBest && <span className="ml-2 text-ceiba-600 text-xs">⭐ ganador</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{t.invites_sent}</td>
                          <td className="px-4 py-3 text-right font-mono">{t.pct_opened}%</td>
                          <td className="px-4 py-3 text-right font-mono">{t.pct_signed_up}%</td>
                          <td className="px-4 py-3 text-right font-mono">{t.activated}</td>
                          <td className={`px-4 py-3 text-right font-bold font-mono ${isBest ? "text-ceiba-700" : ""}`}>
                            {t.pct_activated}%
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {!loading && (data?.templates ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">No hay datos de templates todavía.</p>
            )}
          </div>
        </section>

        {/* ── Top Inviters ──────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Top inviters</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-gray-400 text-xs uppercase">
                  <th className="text-left px-4 py-3">#</th>
                  <th className="text-left px-4 py-3">Nombre</th>
                  <th className="text-right px-4 py-3">Enviadas</th>
                  <th className="text-right px-4 py-3">Activadas</th>
                  <th className="text-right px-4 py-3">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-3">
                            <div className="h-4 bg-gray-100 animate-pulse rounded" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : (data?.topInviters ?? []).map((inv, i) => (
                      <tr key={inv.inviter_user_id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                        <td className="px-4 py-3 font-medium">{inv.full_name || "—"}</td>
                        <td className="px-4 py-3 text-right font-mono">{inv.invites_sent}</td>
                        <td className="px-4 py-3 text-right font-mono">{inv.invites_activated}</td>
                        <td className="px-4 py-3 text-right font-bold text-ceiba-700">{inv.conversion_pct}%</td>
                      </tr>
                    ))}
              </tbody>
            </table>
            {!loading && (data?.topInviters ?? []).length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">Nadie ha enviado ≥3 invitaciones todavía.</p>
            )}
          </div>
        </section>

        {/* ── Invitaciones perdidas ─────────────────────────── */}
        {!loading && (data?.lostInvites ?? []).length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-1">
              Invitaciones abiertas sin signup (+48h)
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              {data!.lostInvites.length} invitaciones perdidas — considera ajustar el onboarding o el recordatorio.
            </p>
            <div className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-400 text-xs uppercase">
                    <th className="text-left px-4 py-3">Código</th>
                    <th className="text-left px-4 py-3">Template</th>
                    <th className="text-left px-4 py-3">Abierta</th>
                    <th className="text-left px-4 py-3">Plataforma</th>
                    <th className="text-right px-4 py-3">Recordatorios</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.lostInvites.map((inv) => (
                    <tr key={inv.code} className="border-b hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-red-600">{inv.code}</td>
                      <td className="px-4 py-3 text-xs">{inv.template_id ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {inv.first_opened_at ? new Date(inv.first_opened_at).toLocaleString("es") : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">{inv.first_opened_from ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{inv.reminders_sent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-center text-gray-300 text-xs pb-4">
          Ceiba Admin · Datos en tiempo real · Solo para el equipo interno
        </p>
      </div>
    </div>
  );
}

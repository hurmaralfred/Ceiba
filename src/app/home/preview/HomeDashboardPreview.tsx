"use client";
import Link from "next/link";
import {
  Home, TreePine, Send, Camera, Settings, Bell,
  Users, Layers, BookOpen, Image as ImageIcon,
  ChevronRight, Calendar, Cake, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomNavigation, type NavItem } from "@/components/ui/BottomNavigation";

const NAV_ITEMS: NavItem[] = [
  { href: "/home",     icon: Home,     label: "Inicio"  },
  { href: "/feed",     icon: Bell,     label: "Feed"    },
  { href: "/invitar",  icon: Send,     label: "Invitar", center: true },
  { href: "/photos",   icon: Camera,   label: "Fotos"   },
  { href: "/settings", icon: Settings, label: "Ajustes" },
];

// ── Datos representativos ───────────────────────────────────────────────────
const MOCK = {
  firstName: "Alfredo",
  score: 3,
  total: 5,
  stats: [
    { icon: <Users size={20} className="text-earth-500" />, value: 14, label: "Familiares",    bg: "bg-earth-100",  href: "/tree"   },
    { icon: <Layers size={20} className="text-ceiba-600" />, value: 3, label: "Generaciones", bg: "bg-ceiba-100",  href: "/tree"   },
    { icon: <BookOpen size={20} className="text-gold-500" />, value: 5, label: "Historias",   bg: "bg-gold-100",   href: "/events" },
    { icon: <ImageIcon size={20} className="text-earth-400" />, value: 23, label: "Fotos",    bg: "bg-earth-50",   href: "/photos" },
  ],
  activity: [
    { id: "1", kind: "birthday" as const, name: "Carmen Hurtado",   date: "Hoy · cumpleaños",      initials: "CH", color: "bg-gold-100",  textColor: "text-gold-600"  },
    { id: "2", kind: "birthday" as const, name: "Luis García",      date: "12 jul · cumpleaños",   initials: "LG", color: "bg-gold-100",  textColor: "text-gold-600"  },
    { id: "3", kind: "event"    as const, name: "Reunión anual",    date: "15 ago · Reunión",      initials: "RE", color: "bg-earth-100", textColor: "text-earth-500" },
  ],
  event: {
    title: "Reunión anual familia Hurtado",
    type: "Reunión",
    date: "15 de agosto de 2026",
    description: "Nos encontramos en casa de los abuelos como cada año para celebrar juntos y recordar las historias de siempre.",
  },
};

const STATUS: Record<number, string> = {
  0: "Comienza tu árbol familiar",
  1: "Tu familia da sus primeros pasos",
  2: "Tu familia empieza a conectarse",
  3: "Tu árbol está creciendo",
  4: "Tu árbol florece",
  5: "Tu árbol está completo",
};

function ProgressRing({ score, total }: { score: number; total: number }) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const dash = circ * (total > 0 ? score / total : 0);
  return (
    <svg width="152" height="152" viewBox="0 0 152 152" aria-hidden>
      <circle cx="76" cy="76" r={r} fill="none" stroke="#eedfc6" strokeWidth="7" />
      <circle
        cx="76" cy="76" r={r} fill="none"
        stroke="#c1603a" strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 76 76)"
        style={{ transition: "stroke-dasharray 0.8s ease" }}
      />
    </svg>
  );
}

export function HomeDashboardPreview() {
  const statusMsg = STATUS[Math.min(MOCK.score, 5)] ?? STATUS[3];

  return (
    <div
      className="min-h-screen pb-28"
      style={{ background: "linear-gradient(180deg, #ede3d0 0%, #f7edd9 28%, #fdf8f1 100%)" }}
    >

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-sm border-b border-cream-400/70"
        style={{ background: "rgba(253,248,241,0.92)" }}>
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <TreePine size={19} className="text-ceiba-600" strokeWidth={2} />
            <span className="font-display font-bold text-title text-brown-800 tracking-tight">Ceiba</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-cream-300 transition-colors">
              <Bell size={19} className="text-brown-400" />
            </button>
            <Avatar size="sm" name="Alfredo Hurtado" ring ringColor="terra" />
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 space-y-8 pt-6">

        {/* ── Saludo ─────────────────────────────────────────────────────── */}
        <section className="pt-1">
          <p className="text-caption text-brown-400 font-medium mb-1 tracking-wide uppercase" style={{ letterSpacing: "0.08em" }}>
            Buenas tardes
          </p>
          <h1 className="font-display font-bold text-brown-800" style={{ fontSize: "2.25rem", lineHeight: "1.08", letterSpacing: "-0.02em" }}>
            {MOCK.firstName}
          </h1>
          <p className="text-body text-brown-500 mt-2">Tu familia sigue creciendo</p>
        </section>

        {/* ── Hero de progreso ───────────────────────────────────────────── */}
        <section>
          <div
            className="rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(145deg, #f0dfc8 0%, #ead4b8 100%)",
              boxShadow: "var(--shadow-warm-lg, 0 10px 28px rgba(193,96,58,0.16))",
            }}
          >
            {/* Cuerpo centrado */}
            <div className="flex flex-col items-center text-center px-6 pt-8 pb-6 gap-4">

              {/* Anillo + avatar */}
              <div className="relative">
                <ProgressRing score={MOCK.score} total={MOCK.total} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Avatar size="xl" name="Alfredo Hurtado" ring ringColor="terra" />
                </div>
              </div>

              {/* Copy */}
              <div>
                <p className="font-display font-bold text-brown-800"
                  style={{ fontSize: "1.375rem", lineHeight: "1.3", letterSpacing: "-0.01em" }}>
                  {statusMsg}
                </p>
                <p className="text-caption text-brown-500 mt-1">
                  {MOCK.score} de {MOCK.total} secciones completadas
                </p>
              </div>

              {/* CTA único */}
              <Button
                variant="primary"
                size="lg"
                pill
                fullWidth
                icon={<UserPlus size={17} />}
              >
                Invitar familiar
              </Button>
            </div>

            {/* Enlace discreto al árbol */}
            <div
              className="flex items-center justify-center gap-2 px-6 py-3 border-t"
              style={{ borderColor: "rgba(193,96,58,0.15)" }}
            >
              <TreePine size={14} className="text-brown-500" />
              <span className="text-caption text-brown-500 font-medium">Ver árbol familiar</span>
              <ChevronRight size={13} className="text-brown-400" />
            </div>
          </div>
        </section>

        {/* ── Métricas ───────────────────────────────────────────────────── */}
        <section>
          <SectionHeader title="Tu familia" className="mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {MOCK.stats.map(({ icon, value, label, bg, href }) => (
              <Link key={label} href={href}>
                <div
                  className="rounded-2xl p-4 cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.75)",
                    boxShadow: "var(--shadow-warm-sm, 0 1px 4px rgba(193,96,58,0.10))",
                    border: "1px solid rgba(227,206,176,0.6)",
                  }}
                >
                  {/* Icono + flecha */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                      {icon}
                    </div>
                    <ChevronRight size={14} className="text-brown-300 mt-1 shrink-0" />
                  </div>
                  {/* Valor */}
                  <p className="font-display font-bold text-brown-800"
                    style={{ fontSize: "1.75rem", lineHeight: "1", letterSpacing: "-0.02em" }}>
                    {value}
                  </p>
                  {/* Etiqueta — sin truncar */}
                  <p className="text-caption text-brown-400 mt-0.5">{label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Actividad reciente ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Actividad reciente"
            icon={<Calendar size={17} />}
            action={
              <span className="text-caption text-earth-500 font-medium cursor-pointer hover:text-earth-600">
                Ver todo
              </span>
            }
            className="mb-3"
          />

          {MOCK.activity.length === 0 ? (
            <EmptyState
              icon={<Calendar size={22} className="text-earth-300" />}
              title="Sin actividad aún"
              description="Los cumpleaños y eventos de tu familia aparecerán aquí."
            />
          ) : (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.75)",
                boxShadow: "var(--shadow-warm-sm, 0 1px 4px rgba(193,96,58,0.10))",
                border: "1px solid rgba(227,206,176,0.6)",
              }}
            >
              {MOCK.activity.map((item, i) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={i > 0 ? { borderTop: "1px solid rgba(238,223,198,0.8)" } : {}}
                >
                  {/* Círculo de iniciales */}
                  <div className={`w-10 h-10 rounded-full ${item.color} flex items-center justify-center shrink-0`}>
                    {item.kind === "birthday"
                      ? <Cake size={16} className={item.textColor} />
                      : <Calendar size={16} className={item.textColor} />}
                  </div>
                  {/* Texto */}
                  <div className="flex-1 min-w-0">
                    <p className="text-body font-semibold text-brown-800 truncate">{item.name}</p>
                    <p className="text-caption text-brown-400">{item.date}</p>
                  </div>
                  <ChevronRight size={14} className="text-brown-300 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Historia destacada ──────────────────────────────────────────── */}
        <section>
          <SectionHeader
            title="Historia destacada"
            icon={<BookOpen size={17} />}
            action={
              <span className="text-caption text-earth-500 font-medium cursor-pointer hover:text-earth-600">
                Ver todas
              </span>
            }
            className="mb-3"
          />

          {MOCK.event ? (
            <div
              className="rounded-2xl p-5 cursor-pointer"
              style={{
                background: "linear-gradient(145deg, #f5e8d4 0%, #f0dfc8 100%)",
                boxShadow: "var(--shadow-warm, 0 4px 12px rgba(193,96,58,0.12))",
                border: "1px solid rgba(193,96,58,0.12)",
              }}
            >
              {/* Tipo */}
              <Badge variant="terra" size="sm" className="mb-3">{MOCK.event.type}</Badge>

              {/* Título */}
              <p className="font-display font-semibold text-brown-800 mb-2"
                style={{ fontSize: "1.125rem", lineHeight: "1.35" }}>
                {MOCK.event.title}
              </p>

              {/* Descripción en itálica serif */}
              {MOCK.event.description && (
                <p
                  className="font-display text-brown-600 mb-3"
                  style={{ fontStyle: "italic", fontSize: "0.9375rem", lineHeight: "1.6" }}
                >
                  "{MOCK.event.description}"
                </p>
              )}

              {/* Fecha */}
              <div className="flex items-center justify-between">
                <p className="text-caption text-brown-400 flex items-center gap-1.5">
                  <Calendar size={11} />
                  {MOCK.event.date}
                </p>
                <ChevronRight size={14} className="text-brown-400" />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen size={22} className="text-earth-300" />}
              title="Aún no hay historias"
              description="Registra los momentos importantes de tu familia."
              action={<Button size="sm" icon={<Calendar size={14} />}>Agregar historia</Button>}
            />
          )}
        </section>

      </main>

      {/* ── Navegación inferior ─────────────────────────────────────────── */}
      <BottomNavigation items={NAV_ITEMS} variant="light" />
    </div>
  );
}

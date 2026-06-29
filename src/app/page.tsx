"use client";
import Link from "next/link";
import { ChevronRight, Megaphone, Shield, TreePine } from "lucide-react";

// ── Animated SVG: familia conectada con líneas de luz ──────────
function FamilyConstellation() {
  const members = [
    { x: 50,  y: 18,  label: "Abuela", color: "#818cf8", size: 38 },
    { x: 22,  y: 42,  label: "Papá",   color: "#34d399", size: 34 },
    { x: 78,  y: 42,  label: "Mamá",   color: "#f472b6", size: 34 },
    { x: 50,  y: 64,  label: "Tú",     color: "#4ade80", size: 44, isYou: true },
    { x: 15,  y: 78,  label: "Hugo",   color: "#60a5fa", size: 30 },
    { x: 50,  y: 84,  label: "Joselin",color: "#fb923c", size: 30 },
    { x: 85,  y: 78,  label: "Hija",   color: "#a78bfa", size: 28 },
  ];

  const edges = [
    [0,1],[0,2],[1,3],[2,3],[3,4],[3,5],[3,6]
  ];

  return (
    <svg viewBox="0 0 100 100" className="w-full h-full" style={{ filter: "drop-shadow(0 0 30px rgba(74,222,128,0.15))" }}>
      <defs>
        <radialGradient id="glow-center" cx="50%" cy="64%" r="40%">
          <stop offset="0%"   stopColor="#4ade80" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </radialGradient>
        <filter id="blur-glow">
          <feGaussianBlur stdDeviation="0.8" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes pulse-line {
            0%,100% { opacity: 0.25; }
            50%      { opacity: 0.7; }
          }
          @keyframes float-node {
            0%,100% { transform: translateY(0px); }
            50%      { transform: translateY(-1px); }
          }
          .edge-pulse { animation: pulse-line 3s ease-in-out infinite; }
          .edge-pulse-2 { animation: pulse-line 3s ease-in-out infinite 0.6s; }
          .edge-pulse-3 { animation: pulse-line 3s ease-in-out infinite 1.2s; }
          .edge-pulse-4 { animation: pulse-line 3s ease-in-out infinite 1.8s; }
          .node-float { animation: float-node 4s ease-in-out infinite; }
          .node-float-2 { animation: float-node 4s ease-in-out infinite 1s; }
          .node-float-3 { animation: float-node 4s ease-in-out infinite 2s; }
        `}</style>
      </defs>

      {/* Background glow */}
      <ellipse cx="50" cy="64" rx="45" ry="38" fill="url(#glow-center)" />

      {/* Edges */}
      {edges.map(([a, b], i) => {
        const ma = members[a], mb = members[b];
        const cls = i % 4 === 0 ? "edge-pulse" : i % 4 === 1 ? "edge-pulse-2" : i % 4 === 2 ? "edge-pulse-3" : "edge-pulse-4";
        return (
          <line key={i} x1={ma.x} y1={ma.y} x2={mb.x} y2={mb.y}
            stroke="url(#line-grad)" strokeWidth="0.5"
            className={cls}
          />
        );
      })}

      <defs>
        <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
      </defs>

      {/* Nodes */}
      {members.map((m, i) => {
        const r = m.size / 100 * 6;
        const floatCls = i % 3 === 0 ? "node-float" : i % 3 === 1 ? "node-float-2" : "node-float-3";
        return (
          <g key={i} className={floatCls} style={{ transformOrigin: `${m.x}px ${m.y}px` }}>
            {/* Outer ring glow */}
            <circle cx={m.x} cy={m.y} r={r + 1.5} fill={m.color} opacity={0.15} />
            {/* Avatar circle */}
            <circle cx={m.x} cy={m.y} r={r} fill={m.isYou ? "#052e16" : "#0f172a"}
              stroke={m.color} strokeWidth={m.isYou ? 0.8 : 0.5} />
            {/* Initials */}
            <text x={m.x} y={m.y + 0.5} textAnchor="middle" dominantBaseline="middle"
              fontSize={r * 0.85} fontWeight="bold" fill={m.color} fontFamily="system-ui">
              {m.label.slice(0,2).toUpperCase()}
            </text>
            {/* Label below */}
            <text x={m.x} y={m.y + r + 2} textAnchor="middle" fontSize="2.2" fill="rgba(255,255,255,0.5)" fontFamily="system-ui">
              {m.label}
            </text>
            {/* Green dot for "En Ceiba" */}
            {(i === 0 || i === 1 || i === 3 || i === 5) && (
              <circle cx={m.x + r * 0.7} cy={m.y - r * 0.7} r={0.9} fill="#4ade80" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#060d14] text-white overflow-x-hidden">

      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-ceiba-900/40 blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-indigo-950/30 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-400" /> Ceiba
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-6 pt-12 pb-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

        {/* Left: copy */}
        <div>
          <div className="inline-flex items-center gap-2 bg-ceiba-950 border border-ceiba-800 rounded-full px-3 py-1 text-xs text-ceiba-300 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-ceiba-400 animate-pulse" />
            Gratis · Sin publicidad · Solo tu familia
          </div>

          <h1 className="font-display text-5xl sm:text-6xl font-black leading-[1.05] mb-6">
            Un mensaje.<br />
            <span className="bg-gradient-to-r from-ceiba-300 to-emerald-400 bg-clip-text text-transparent">
              Toda tu familia.
            </span><br />
            Al mismo tiempo.
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
            Ceiba conecta a toda tu familia en un árbol inteligente. Agrega a tus familiares una sola vez — cuando ellos se unen, <strong className="text-white">sus redes se conectan automáticamente</strong> a la tuya.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold text-base px-7 py-3.5 rounded-2xl transition-all shadow-lg shadow-ceiba-900/50">
              Construir mi árbol gratis <ChevronRight size={18} />
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center justify-center gap-2 border border-white/10 text-gray-300 hover:text-white hover:border-white/25 font-medium text-base px-7 py-3.5 rounded-2xl transition-colors">
              Ya tengo cuenta
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <div><span className="text-white font-bold text-lg">100%</span> gratis</div>
            <div className="w-px h-4 bg-gray-700" />
            <div><span className="text-white font-bold text-lg">0</span> publicidad</div>
            <div className="w-px h-4 bg-gray-700" />
            <div><span className="text-white font-bold text-lg">∞</span> familia</div>
          </div>
        </div>

        {/* Right: family constellation illustration */}
        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-[420px] aspect-square">
            <FamilyConstellation />
          </div>
        </div>
      </section>

      {/* Feature strip — 3 key powers */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-center text-gray-500 text-sm uppercase tracking-widest mb-10">Lo que hace Ceiba diferente</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              emoji: "🌳",
              title: "El árbol que se construye solo",
              desc: "Agrega a tu hermano. Cuando él se registra, sus hijos aparecen como tus sobrinos, sus padres como tus suegros. Sin hacer nada más.",
              glow: "rgba(74,222,128,0.08)",
              border: "border-ceiba-800/60",
            },
            {
              emoji: "📢",
              title: "Un mensaje. Todos enterados.",
              desc: "Reunión familiar, emergencia, cumpleaños sorpresa — un solo toque y toda la familia recibe la notificación al mismo tiempo.",
              glow: "rgba(251,146,60,0.08)",
              border: "border-orange-900/40",
            },
            {
              emoji: "🚨",
              title: "Botón de pánico familiar",
              desc: "En una emergencia, activa el SOS. Toda tu familia en Ceiba recibe una alerta inmediata con tu ubicación.",
              glow: "rgba(239,68,68,0.08)",
              border: "border-red-900/40",
            },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border p-6 flex flex-col gap-4 transition-transform hover:-translate-y-1"
              style={{ background: `radial-gradient(ellipse at top left, ${f.glow}, transparent 70%)`, borderColor: "transparent" }}
              // @ts-ignore
              onMouseEnter={e => e.currentTarget.style.borderColor = f.border.replace("border-","").replace("/","/")}
            >
              <div className={`rounded-2xl border ${f.border} p-5`}>
                <div className="text-3xl mb-3">{f.emoji}</div>
                <h3 className="font-bold text-white text-lg mb-2">{f.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — timeline */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-center font-display text-3xl font-bold mb-2">Tres pasos. Menos de 2 minutos.</h2>
        <p className="text-center text-gray-500 mb-12">Sin tarjeta de crédito. Sin configuración complicada.</p>
        <div className="relative">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-ceiba-600 via-ceiba-800 to-transparent" />
          {[
            { n: "1", title: "Crea tu perfil", desc: "Nombre, foto, ciudad. Listo en 30 segundos." },
            { n: "2", title: "Agrega tu familia", desc: "Ingresa a quienes quieras: mamá, hermanos, pareja, hijos. Ceiba detecta si ya están registrados." },
            { n: "3", title: "Comparte el link", desc: "Cada familiar que entra trae su red. El árbol crece solo." },
          ].map((s, i) => (
            <div key={i} className="relative flex gap-5 mb-10 last:mb-0">
              <div className="relative z-10 w-10 h-10 rounded-full bg-ceiba-900 border border-ceiba-600 flex items-center justify-center text-ceiba-300 font-bold text-sm flex-shrink-0">
                {s.n}
              </div>
              <div className="pt-1.5">
                <h3 className="font-bold text-white mb-1">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* More features — compact grid */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-center font-display text-2xl font-bold mb-8 text-gray-300">Y mucho más incluido</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { e: "🗺️", t: "Mapa familiar", d: "Dónde vive cada quien" },
            { e: "🎂", t: "Cumpleaños", d: "Alertas automáticas" },
            { e: "📸", t: "Galería", d: "Fotos compartidas" },
            { e: "📅", t: "Eventos", d: "Historia familiar" },
            { e: "💬", t: "Chat", d: "Por grupos de relación" },
            { e: "🔒", t: "Privacidad", d: "Solo tu familia lo ve" },
          ].map((f, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">{f.e}</span>
              <div>
                <div className="text-white text-sm font-semibold">{f.t}</div>
                <div className="text-gray-500 text-xs mt-0.5">{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="relative rounded-3xl overflow-hidden border border-ceiba-800/60 p-10"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(20,83,45,0.6), rgba(6,13,20,0.9))" }}>
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.1) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          <div className="relative">
            <div className="text-4xl mb-4">🌳</div>
            <h2 className="font-display text-3xl font-black mb-3">¿Cuándo fue la última vez<br />que toda tu familia supo de ti?</h2>
            <p className="text-gray-400 mb-8">Empieza hoy. Es gratis para siempre.</p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-ceiba-500 hover:bg-ceiba-400 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-lg shadow-ceiba-900/60">
              Crear mi árbol familiar gratis <ChevronRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-gray-700 pb-8 text-sm">
        © 2025 Ceiba · Hecho con amor por familias, para familias
      </footer>
    </main>
  );
}

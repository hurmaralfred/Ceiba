"use client";
import Link from "next/link";
import { ChevronRight, TreePine } from "lucide-react";

// ── Líneas de conexión SVG superpuestas sobre la foto ──────────
function ConnectionOverlay() {
  // Puntos que "conectan" personas en la foto (ajustados visualmente)
  const nodes = [
    { x: 22,  y: 28, label: "Abuela"  },
    { x: 68,  y: 18, label: "Abuelo"  },
    { x: 15,  y: 58, label: "Mamá"    },
    { x: 50,  y: 45, label: "Papá"    },
    { x: 80,  y: 55, label: "Tío"     },
    { x: 35,  y: 78, label: "Tú"      },
    { x: 72,  y: 80, label: "Hermana" },
  ];
  const edges = [[0,2],[0,3],[1,3],[1,4],[2,5],[3,5],[3,6],[4,6]];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="conn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#4ade80" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <filter id="glow-line">
          <feGaussianBlur stdDeviation="0.6" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes dash-flow {
            from { stroke-dashoffset: 20; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes node-pulse {
            0%,100% { r: 1.4; opacity: 0.9; }
            50%      { r: 2.0; opacity: 1;   }
          }
          @keyframes ring-expand {
            0%   { r: 2.2; opacity: 0.6; }
            100% { r: 4.5; opacity: 0;   }
          }
          .conn-line { animation: dash-flow 2.5s linear infinite; }
          .conn-line-2 { animation: dash-flow 2.5s linear infinite 0.5s; }
          .conn-line-3 { animation: dash-flow 2.5s linear infinite 1s; }
          .conn-line-4 { animation: dash-flow 2.5s linear infinite 1.5s; }
          .node-dot { animation: node-pulse 2.5s ease-in-out infinite; }
          .node-ring { animation: ring-expand 2.5s ease-out infinite; }
        `}</style>
      </defs>

      {edges.map(([a, b], i) => {
        const na = nodes[a], nb = nodes[b];
        const cls = ["conn-line","conn-line-2","conn-line-3","conn-line-4"][i % 4];
        return (
          <line key={i}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="url(#conn-grad)"
            strokeWidth="0.45"
            strokeDasharray="3,2"
            opacity="0.75"
            filter="url(#glow-line)"
            className={cls}
          />
        );
      })}

      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={2.2} fill="none"
            stroke="#4ade80" strokeWidth="0.3" opacity="0.5"
            className="node-ring"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
          <circle cx={n.x} cy={n.y} r={1.4}
            fill="#4ade80"
            filter="url(#glow-line)"
            className="node-dot"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
          <text x={n.x} y={n.y - 2.8}
            textAnchor="middle" fontSize="2.4" fill="white"
            fontFamily="system-ui" fontWeight="600"
            style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#060d14] text-white overflow-x-hidden">

      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/3 w-[600px] h-[400px] rounded-full bg-ceiba-950/60 blur-[120px]" />
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] rounded-full bg-amber-950/20 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-400" /> Ceiba
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-gray-400 hover:text-white text-sm font-medium transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors shadow-lg shadow-ceiba-950/50">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-10 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

        {/* LEFT: copy */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-ceiba-950/80 border border-ceiba-800/60 rounded-full px-3 py-1 text-xs text-ceiba-300 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-ceiba-400 animate-pulse" />
            Gratis · Sin publicidad · Solo tu familia
          </div>

          <h1 className="font-display font-black leading-[1.05] mb-5" style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)" }}>
            ¡Conectados!<br />
            <span className="bg-gradient-to-r from-ceiba-300 via-emerald-300 to-amber-300 bg-clip-text text-transparent">
              Un solo mensaje,
            </span><br />
            <span className="text-white">toda la familia, unida.</span>
          </h1>

          <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
            Agrega a tus familiares una vez. Cuando ellos se registran,
            <strong className="text-white"> Ceiba conecta automáticamente</strong> toda su red —
            sus hijos son tus sobrinos, sus padres tus abuelos.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-base px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-ceiba-950/60">
              Construir mi árbol gratis <ChevronRight size={18} />
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center justify-center border border-white/10 hover:border-white/25 text-gray-300 hover:text-white font-medium text-base px-7 py-3.5 rounded-2xl transition-colors">
              Ya tengo cuenta
            </Link>
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500">
            <div><span className="text-white font-bold text-base">100%</span> gratis</div>
            <div className="w-px h-4 bg-gray-800" />
            <div><span className="text-white font-bold text-base">0</span> anuncios</div>
            <div className="w-px h-4 bg-gray-800" />
            <div><span className="text-white font-bold text-base">∞</span> familiares</div>
          </div>
        </div>

        {/* RIGHT: foto familiar con conexiones animadas */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60" style={{ aspectRatio: "4/3" }}>
          {/* Foto de familia cálida */}
          <img
            src="https://images.unsplash.com/photo-1609220136736-443140cffec6?w=900&q=85&fit=crop&crop=faces"
            alt="Familia conectada"
            className="w-full h-full object-cover"
          />
          {/* Overlay oscuro en bordes para que las líneas resalten */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#060d14]/70 via-transparent to-[#060d14]/20" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[#060d14]/30" />

          {/* Líneas de conexión animadas */}
          <ConnectionOverlay />

          {/* Badge ¡Conectados! */}
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-2">
              <p className="text-white font-bold text-sm">🌳 Familia conectada</p>
              <p className="text-ceiba-300 text-xs">Red de 3 generaciones</p>
            </div>
            <div className="bg-ceiba-600/80 backdrop-blur-md border border-ceiba-500/40 rounded-2xl px-4 py-2 text-right">
              <p className="text-white font-bold text-sm">7 familiares</p>
              <p className="text-ceiba-200 text-xs">en Ceiba</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 FEATURES CLAVE ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <p className="text-center text-gray-600 text-xs uppercase tracking-widest mb-8">Lo que hace Ceiba único</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            {
              emoji: "🌳",
              title: "El árbol que se construye solo",
              desc: "Agrega a tu hermano — cuando él se une, sus hijos aparecen como tus sobrinos automáticamente. Sin hacer nada más.",
              accent: "from-ceiba-900/40 to-transparent border-ceiba-800/50",
            },
            {
              emoji: "📢",
              title: "Un mensaje. Todos enterados.",
              desc: "Reunión familiar, sorpresa, novedad — un solo toque y cada familiar recibe la notificación al mismo tiempo.",
              accent: "from-amber-900/30 to-transparent border-amber-800/40",
            },
            {
              emoji: "🚨",
              title: "Botón de pánico familiar",
              desc: "En una emergencia activa el SOS. Toda tu familia recibe una alerta inmediata con tu ubicación.",
              accent: "from-red-900/30 to-transparent border-red-800/40",
            },
          ].map((f, i) => (
            <div key={i} className={`bg-gradient-to-b ${f.accent} border rounded-2xl p-6 hover:-translate-y-1 transition-transform`}>
              <div className="text-3xl mb-4">{f.emoji}</div>
              <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <h2 className="text-center font-display text-2xl font-bold mb-2">Tres pasos. Menos de 2 minutos.</h2>
        <p className="text-center text-gray-500 text-sm mb-10">Sin tarjeta de crédito. Sin nada complicado.</p>
        <div className="relative space-y-8">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-gradient-to-b from-ceiba-600 via-ceiba-800/50 to-transparent" />
          {[
            { n: "1", title: "Crea tu perfil", desc: "Nombre, foto y ciudad. Listo en 30 segundos." },
            { n: "2", title: "Agrega tu familia", desc: "Mamá, hermanos, pareja, hijos — Ceiba detecta si ya están registrados." },
            { n: "3", title: "Comparte el link", desc: "Cada familiar que entra trae su red. El árbol crece solo." },
          ].map((s, i) => (
            <div key={i} className="relative flex gap-5">
              <div className="relative z-10 w-10 h-10 rounded-full bg-ceiba-950 border border-ceiba-700 flex items-center justify-center text-ceiba-300 font-bold text-sm flex-shrink-0 shadow-lg shadow-ceiba-950">
                {s.n}
              </div>
              <div className="pt-2">
                <h3 className="font-semibold text-white mb-0.5">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES SECUNDARIAS ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-center text-gray-400 text-sm font-medium mb-6 uppercase tracking-widest">Y mucho más, incluido gratis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { e: "🗺️", t: "Mapa familiar",  d: "Dónde vive cada quien" },
            { e: "🎂", t: "Cumpleaños",      d: "Alertas automáticas" },
            { e: "📸", t: "Galería",          d: "Fotos compartidas" },
            { e: "📅", t: "Historia",         d: "Eventos de la familia" },
            { e: "💬", t: "Chat familiar",    d: "Por grupos de relación" },
            { e: "🔒", t: "Privacidad",       d: "Solo tu familia lo ve" },
          ].map((f, i) => (
            <div key={i} className="bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] rounded-xl p-4 flex items-start gap-3 transition-colors">
              <span className="text-xl">{f.e}</span>
              <div>
                <div className="text-white text-sm font-medium">{f.t}</div>
                <div className="text-gray-600 text-xs mt-0.5">{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="relative rounded-3xl overflow-hidden border border-ceiba-800/50 p-10"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(20,83,45,0.55), rgba(6,13,20,0.95))" }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="relative">
            <div className="text-4xl mb-4">🌳</div>
            <h2 className="font-display text-3xl font-black mb-3 leading-tight">
              ¿Cuándo fue la última vez<br />que toda tu familia<br />supo de ti al mismo tiempo?
            </h2>
            <p className="text-gray-400 mb-8">Empieza hoy. Es gratis para siempre.</p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-lg px-8 py-4 rounded-2xl transition-all shadow-xl shadow-ceiba-950/60">
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

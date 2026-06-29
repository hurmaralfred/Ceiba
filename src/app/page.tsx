"use client";
import Link from "next/link";
import { ChevronRight, TreePine } from "lucide-react";

// ── Overlay de conexiones sobre la foto ────────────────────────
// Nodos posicionados para coincidir con personas en la foto
// (abuelos arriba, padres al medio, niños abajo)
function ConnectionOverlay() {
  const nodes = [
    { x: 18, y: 12, label: "Abuela"  },   // arriba izquierda — abuelos
    { x: 78, y: 10, label: "Abuelo"  },   // arriba derecha
    { x: 28, y: 48, label: "Mamá"    },   // medio izquierda — padres
    { x: 62, y: 44, label: "Papá"    },   // medio derecha
    { x: 45, y: 80, label: "Tú"      },   // centro abajo — tú
  ];
  const edges = [[0,2],[1,3],[2,4],[3,4],[0,3],[1,2]];

  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="line-warm" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0.9" />
        </linearGradient>
        <filter id="soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes flow {
            from { stroke-dashoffset: 18; }
            to   { stroke-dashoffset: 0; }
          }
          @keyframes pop {
            0%,100% { transform: scale(1);   opacity: 0.9; }
            50%      { transform: scale(1.3); opacity: 1;   }
          }
          @keyframes ring {
            0%   { r: 2.5; opacity: 0.5; }
            100% { r: 5.5; opacity: 0;   }
          }
          .line-anim { animation: flow 2.8s linear infinite; }
          .line-anim-2 { animation: flow 2.8s linear infinite 0.7s; }
          .line-anim-3 { animation: flow 2.8s linear infinite 1.4s; }
          .dot-pop { animation: pop 3s ease-in-out infinite; }
          .dot-ring { animation: ring 3s ease-out infinite; }
        `}</style>
      </defs>

      {/* Líneas de conexión */}
      {edges.map(([a, b], i) => {
        const na = nodes[a], nb = nodes[b];
        const cls = i < 2 ? "line-anim" : i < 4 ? "line-anim-2" : "line-anim-3";
        return (
          <line key={i}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke="url(#line-warm)"
            strokeWidth="0.5"
            strokeDasharray="4,3"
            filter="url(#soft-glow)"
            className={cls}
          />
        );
      })}

      {/* Nodos */}
      {nodes.map((n, i) => (
        <g key={i} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          {/* Anillo exterior pulsante */}
          <circle cx={n.x} cy={n.y} r={2.5}
            fill="none" stroke="#fbbf24" strokeWidth="0.3"
            opacity="0.5" className="dot-ring"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
          {/* Punto central */}
          <circle cx={n.x} cy={n.y} r={1.6}
            fill="#fbbf24"
            filter="url(#soft-glow)"
            className="dot-pop"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
          {/* Etiqueta con fondo */}
          <rect
            x={n.x - 6} y={n.y - 6.5}
            width={12} height={4.5} rx={1.2}
            fill="rgba(0,0,0,0.55)"
          />
          <text
            x={n.x} y={n.y - 3.8}
            textAnchor="middle"
            fontSize="2.6"
            fontWeight="700"
            fill="white"
            fontFamily="system-ui"
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
    <main className="min-h-screen bg-[#06090f] text-white overflow-x-hidden">

      {/* Glows de fondo */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/4 w-[700px] h-[500px] rounded-full bg-ceiba-950/50 blur-[140px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full bg-amber-950/20 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <TreePine size={22} className="text-ceiba-400" /> Ceiba
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-gray-500 hover:text-white text-sm font-medium transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/auth/register"
            className="bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-ceiba-950/60">
            Empezar gratis
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative max-w-6xl mx-auto px-6 pt-8 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

        {/* Texto */}
        <div className="relative z-10 order-2 lg:order-1">
          {/* Comparación directa con WhatsApp */}
          <div className="inline-flex items-center gap-2 bg-white/[0.05] border border-white/10 rounded-full px-3 py-1 text-xs text-gray-400 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-ceiba-400 animate-pulse inline-block" />
            No es un grupo de WhatsApp. Es otra cosa.
          </div>

          <h1 className="font-display font-black leading-[1.05] mb-6 tracking-tight"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)" }}>
            Agrega a tu hermano.
            <br />
            <span className="text-ceiba-400">El árbol detecta</span>
            <br />
            el resto solo.
          </h1>

          {/* El diferenciador explicado en 2 líneas */}
          <p className="text-gray-300 text-lg leading-relaxed mb-4 max-w-md">
            Su esposa es tu <strong className="text-white">cuñada</strong>. Sus hijos, tus <strong className="text-white">sobrinos</strong>. Sus padres, tus <strong className="text-white">suegros</strong>.
            Ceiba lo sabe — sin que tú hagas nada más.
          </p>
          <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-md">
            Un grupo de WhatsApp no sabe quién es quién. Ceiba sí.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link href="/auth/register"
              className="inline-flex items-center justify-center gap-2 bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-base px-7 py-3.5 rounded-2xl transition-all shadow-xl shadow-ceiba-950/50 group">
              Construir mi árbol gratis
              <ChevronRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link href="/auth/login"
              className="inline-flex items-center justify-center border border-white/10 hover:border-white/20 text-gray-400 hover:text-white font-medium text-base px-7 py-3.5 rounded-2xl transition-colors">
              Ya tengo cuenta
            </Link>
          </div>

          {/* Social proof minimalista */}
          <div className="flex items-center gap-5 text-sm">
            {[["100%","gratis"],["0","anuncios"],["∞","familiares"]].map(([n, l], i) => (
              <span key={i} className="flex items-baseline gap-1.5">
                <span className="text-white font-bold text-base">{n}</span>
                <span className="text-gray-600">{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Foto con conexiones */}
        <div className="relative order-1 lg:order-2">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/70"
            style={{ aspectRatio: "4/3" }}>

            {/* Foto de familia — 3 generaciones */}
            <img
              src="https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=900"
              alt="Familia de tres generaciones conectada"
              className="w-full h-full object-cover"
              style={{ objectPosition: "center 30%" }}
            />

            {/* Gradientes sobre la foto para legibilidad */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#06090f]/40 via-transparent to-[#06090f]/20" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06090f]/60 via-transparent to-[#06090f]/10" />

            {/* Líneas de conexión animadas */}
            <ConnectionOverlay />

            {/* Badge único — limpio y discreto */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full bg-ceiba-400 animate-pulse" />
                <span className="text-white text-xs font-semibold">Red de 3 generaciones conectada</span>
              </div>
            </div>
          </div>

          {/* Decoración exterior — brillo sutil */}
          <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-ceiba-600/20 via-transparent to-amber-600/10 pointer-events-none" />
        </div>
      </section>

      {/* ── FEATURES CLAVE ── */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <p className="text-center text-gray-600 text-xs uppercase tracking-[0.2em] mb-8">Lo que hace Ceiba único</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              emoji: "🌳",
              title: "WhatsApp no sabe que eres su tío",
              desc: "En un grupo de WhatsApp, Juan es solo un contacto. En Ceiba, Juan es tu cuñado, su hijo es tu sobrino, y su mamá es tu suegra — el árbol lo deduce solo.",
              border: "border-ceiba-900/60",
              glow: "rgba(74,222,128,0.06)",
            },
            {
              emoji: "📢",
              title: "Un mensaje llega a todos",
              desc: "Reunión, sorpresa, emergencia — un toque y cada familiar recibe la notificación al mismo tiempo. Sin reenviar, sin copiar.",
              border: "border-amber-900/50",
              glow: "rgba(251,191,36,0.06)",
            },
            {
              emoji: "🚨",
              title: "Botón de pánico familiar",
              desc: "En emergencia activa el SOS. Toda tu red familiar recibe una alerta inmediata con tu ubicación — no solo los que tienes en un grupo.",
              border: "border-red-900/50",
              glow: "rgba(239,68,68,0.06)",
            },
          ].map((f, i) => (
            <div key={i}
              className={`border ${f.border} rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200`}
              style={{ background: `radial-gradient(ellipse at top left, ${f.glow}, transparent 60%), rgba(255,255,255,0.02)` }}
            >
              <div className="text-3xl mb-4">{f.emoji}</div>
              <h3 className="font-bold text-white text-base mb-2 leading-snug">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section className="max-w-xl mx-auto px-6 pb-20">
        <h2 className="text-center font-display text-2xl font-bold mb-1">Tres pasos. Menos de 2 minutos.</h2>
        <p className="text-center text-gray-600 text-sm mb-10">Sin tarjeta de crédito. Sin complicaciones.</p>
        <div className="relative space-y-8">
          <div className="absolute left-[18px] top-3 bottom-3 w-px bg-gradient-to-b from-ceiba-700 via-ceiba-900/50 to-transparent" />
          {[
            { n:"1", t:"Crea tu perfil",      d:"Nombre, foto y ciudad. 30 segundos." },
            { n:"2", t:"Agrega tu familia",   d:"Mamá, hermanos, pareja, hijos — Ceiba detecta si ya están en la app." },
            { n:"3", t:"Comparte el link",    d:"Cada familiar que entra trae su red. El árbol crece solo." },
          ].map((s,i) => (
            <div key={i} className="flex gap-5">
              <div className="relative z-10 w-9 h-9 rounded-full bg-[#06090f] border border-ceiba-700 flex items-center justify-center text-ceiba-300 font-bold text-sm flex-shrink-0">
                {s.n}
              </div>
              <div className="pt-1.5">
                <p className="font-semibold text-white text-sm mb-0.5">{s.t}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRID DE FEATURES ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <p className="text-center text-gray-600 text-xs uppercase tracking-[0.2em] mb-6">Todo incluido, gratis</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { e:"🗺️", t:"Mapa familiar",   d:"Dónde vive cada quien"      },
            { e:"🎂", t:"Cumpleaños",       d:"Alertas automáticas"         },
            { e:"📸", t:"Galería",          d:"Fotos compartidas"           },
            { e:"📅", t:"Historia",         d:"Eventos de la familia"       },
            { e:"💬", t:"Chat familiar",    d:"Por grupos de relación"      },
            { e:"🔒", t:"Privacidad",       d:"Solo tu familia lo ve"       },
          ].map((f, i) => (
            <div key={i}
              className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.05] hover:border-white/10 rounded-xl p-4 flex items-start gap-3 transition-all">
              <span className="text-xl">{f.e}</span>
              <div>
                <p className="text-white text-sm font-medium">{f.t}</p>
                <p className="text-gray-600 text-xs mt-0.5">{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="max-w-xl mx-auto px-6 pb-24 text-center">
        <div className="relative rounded-3xl overflow-hidden border border-ceiba-900/60 p-10"
          style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(20,83,45,0.5) 0%, rgba(6,9,15,0.95) 70%)" }}>
          {/* Textura de puntos sutil */}
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "20px 20px" }} />
          <div className="relative">
            <div className="text-5xl mb-5">🌳</div>
            <h2 className="font-display text-2xl sm:text-3xl font-black mb-3 leading-tight">
              Tu familia ya existe.<br />Solo falta<br />conectarla.
            </h2>
            <p className="text-gray-500 text-sm mb-2">No es un grupo de WhatsApp. Es un árbol que sabe quién es quién.</p>
            <p className="text-gray-600 text-xs mb-8">Gratis para siempre · Sin anuncios · Sin complicaciones</p>
            <Link href="/auth/register"
              className="inline-flex items-center gap-2 bg-ceiba-600 hover:bg-ceiba-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all shadow-xl shadow-ceiba-950/50 group">
              Crear mi árbol familiar gratis
              <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="text-center text-gray-700 pb-8 text-xs">
        © 2025 Ceiba · Hecho con amor por familias, para familias
      </footer>
    </main>
  );
}

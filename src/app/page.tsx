"use client";
import Link from "next/link";
import { ChevronRight, TreePine } from "lucide-react";

// Estrellas del fondo (igual que home page)
function StarField() {
  const stars = Array.from({ length: 70 }, (_, i) => ({
    cx: (((i * 137.5) % 100)).toFixed(1),
    cy: (((i * 97.3) % 100)).toFixed(1),
    r:  (0.5 + (i % 5) * 0.22).toFixed(2),
    op: (0.18 + (i % 7) * 0.07).toFixed(2),
  }));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}>
      {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />)}
    </svg>
  );
}

// Nebula background orbs
function NebulaBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }} aria-hidden>
      <div style={{ position: "absolute", top: "-10%", left: "20%", width: 500, height: 400,
        background: "radial-gradient(ellipse, rgba(30,60,20,0.22) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(60px)" }} />
      <div style={{ position: "absolute", top: "30%", right: "-5%", width: 350, height: 350,
        background: "radial-gradient(ellipse, rgba(120,80,10,0.14) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(50px)" }} />
      <div style={{ position: "absolute", bottom: "10%", left: "-10%", width: 300, height: 300,
        background: "radial-gradient(ellipse, rgba(40,20,80,0.16) 0%, transparent 70%)", borderRadius: "50%", filter: "blur(60px)" }} />
    </div>
  );
}

// Overlay de conexiones sobre la foto
function ConnectionOverlay() {
  const nodes = [
    { x: 18, y: 12, label: "Abuela" },
    { x: 78, y: 10, label: "Abuelo" },
    { x: 28, y: 48, label: "Mamá"   },
    { x: 62, y: 44, label: "Papá"   },
    { x: 45, y: 80, label: "Tú"     },
  ];
  const edges = [[0,2],[1,3],[2,4],[3,4],[0,3],[1,2]];
  return (
    <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="line-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#d4af37" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f5e070" stopOpacity="0.7" />
        </linearGradient>
        <filter id="soft-glow2">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.7" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          @keyframes flow2 { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
          @keyframes pop2  { 0%,100% { opacity:0.9; } 50% { opacity:1; } }
          @keyframes ring2 { 0% { r:2.5; opacity:0.5; } 100% { r:5.5; opacity:0; } }
          .fl2  { animation: flow2 2.8s linear infinite; }
          .fl2b { animation: flow2 2.8s linear infinite 0.7s; }
          .fl2c { animation: flow2 2.8s linear infinite 1.4s; }
          .pp2  { animation: pop2  3s ease-in-out infinite; }
          .rr2  { animation: ring2 3s ease-out infinite; }
        `}</style>
      </defs>
      {edges.map(([a, b], i) => {
        const na = nodes[a], nb = nodes[b];
        const cls = i < 2 ? "fl2" : i < 4 ? "fl2b" : "fl2c";
        return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
          stroke="url(#line-gold)" strokeWidth="0.5" strokeDasharray="4,3"
          filter="url(#soft-glow2)" className={cls} />;
      })}
      {nodes.map((n, i) => (
        <g key={i} style={{ transformOrigin: `${n.x}px ${n.y}px` }}>
          <circle cx={n.x} cy={n.y} r={2.5} fill="none" stroke="#d4af37" strokeWidth="0.3"
            opacity="0.5" className="rr2" style={{ animationDelay: `${i * 0.5}s` }} />
          <circle cx={n.x} cy={n.y} r={1.6} fill="#d4af37"
            filter="url(#soft-glow2)" className="pp2" style={{ animationDelay: `${i * 0.5}s` }} />
          <rect x={n.x - 6} y={n.y - 6.5} width={12} height={4.5} rx={1.2} fill="rgba(0,0,0,0.6)" />
          <text x={n.x} y={n.y - 3.8} textAnchor="middle" fontSize="2.6" fontWeight="700"
            fill="white" fontFamily="system-ui">{n.label}</text>
        </g>
      ))}
    </svg>
  );
}

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.35)";
const BG = "#030208";
const CARD = "#0c0a18";

function GoldBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
        background: "#c9a820", borderTop: "2px solid #f5e060",
        borderLeft: "1.5px solid rgba(255,240,100,0.5)",
        borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
        boxShadow: "0 8px 0 #4a3c00, 0 14px 28px rgba(0,0,0,0.7), 0 0 28px rgba(212,175,55,0.25)",
        borderRadius: 16, color: BG, fontWeight: 800, fontSize: 15,
        padding: "13px 28px", cursor: "pointer" }}>
        {children}
      </div>
    </Link>
  );
}

function OutlineBtn({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
        border: `1px solid ${GOLD_DIM}`, borderRadius: 16, color: GOLD_DIM,
        fontWeight: 600, fontSize: 14, padding: "12px 24px", cursor: "pointer" }}>
        {children}
      </div>
    </Link>
  );
}

function Card3d({ ar = "212,175,55", sh = "#040300", glow = 0.07, children, style = {} }: {
  ar?: string; sh?: string; glow?: number; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      borderRadius: 20, background: CARD, position: "relative", overflow: "hidden",
      borderTop: `1.5px solid rgba(${ar},0.4)`, borderLeft: `1px solid rgba(${ar},0.18)`,
      borderBottom: `3px solid ${sh}`, borderRight: "1px solid rgba(0,0,0,0.6)",
      boxShadow: `0 7px 0 ${sh}, 0 12px 22px rgba(0,0,0,0.85), 0 0 20px rgba(${ar},${glow})`,
      ...style,
    }}>
      <div style={{ position: "absolute", top: 0, left: "18%", right: "18%",
        height: 1, background: `rgba(${ar},0.42)` }} />
      {children}
    </div>
  );
}

export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", background: BG, color: "#fff", overflowX: "hidden", position: "relative" }}>
      <StarField />
      <NebulaBg />

      {/* Nav */}
      <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "20px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          fontSize: 19, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
          <TreePine size={21} style={{ color: GOLD }} /> Ceiba
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/auth/login" style={{ fontSize: 13, color: GOLD_DIM, fontWeight: 600, textDecoration: "none" }}>
            Iniciar sesión
          </Link>
          <Link href="/auth/register" style={{ textDecoration: "none" }}>
            <div style={{ background: "#c9a820", borderTop: "2px solid #f5e060",
              borderLeft: "1.5px solid rgba(255,240,100,0.5)",
              borderBottom: "3px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
              boxShadow: "0 5px 0 #4a3c00, 0 8px 18px rgba(0,0,0,0.6)",
              borderRadius: 12, color: BG, fontWeight: 800, fontSize: 13,
              padding: "9px 20px", cursor: "pointer" }}>
              Empezar gratis
            </div>
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 1100, margin: "0 auto",
        padding: "20px 24px 72px", display: "grid",
        gridTemplateColumns: "1fr", gap: 40 }} className="hero-grid">
        <style>{`
          @media (min-width: 900px) {
            .hero-grid { grid-template-columns: 1fr 1fr !important; align-items: center; }
            .hero-order-1 { order: 1 !important; }
            .hero-order-2 { order: 2 !important; }
          }
        `}</style>

        {/* Texto */}
        <div style={{ order: 2 }} className="hero-order-1">
          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(212,175,55,0.06)", border: `1px solid ${GOLD_DIM}`,
            borderRadius: 100, padding: "5px 14px", fontSize: 11, color: GOLD_DIM,
            fontWeight: 600, marginBottom: 28 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD,
              display: "inline-block", boxShadow: `0 0 8px ${GOLD}`, flexShrink: 0 }} />
            Gratis · Sin publicidad · Solo tu familia
          </div>

          <h1 style={{ fontWeight: 900, lineHeight: 1.05, marginBottom: 24, letterSpacing: "-0.025em",
            fontSize: "clamp(2.4rem, 5vw, 3.6rem)" }}>
            Toda tu familia<br />
            <span style={{ color: GOLD }}>siempre enterada,</span><br />
            siempre cerca.
          </h1>

          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { icon: "🎂", text: "Sabes el cumpleaños de tu sobrino aunque nunca lo hayas agregado — Ceiba lo sabe por tu hermano." },
              { icon: "🚨", text: "En emergencia, el SOS llega a toda tu red familiar — no solo a quien tienes en el teléfono." },
              { icon: "📢", text: "Un solo mensaje llega a todos al mismo tiempo. Sin grupos, sin reenviar, sin olvidar a nadie." },
              { icon: "🌳", text: "Cuando un familiar entra, el árbol ya está listo — no tiene que agregar a nadie desde cero." },
            ].map((b, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 18, marginTop: 1, flexShrink: 0 }}>{b.icon}</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65 }}>{b.text}</span>
              </li>
            ))}
          </ul>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 36 }}>
            <GoldBtn href="/auth/register">
              Construir mi árbol gratis <ChevronRight size={16} />
            </GoldBtn>
            <OutlineBtn href="/auth/login">Ya tengo cuenta</OutlineBtn>
          </div>

          {/* Social proof */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[["100%","gratis"],["0","anuncios"],["∞","familiares"]].map(([n, l], i) => (
              <span key={i} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>{n}</span>
                <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 12 }}>{l}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Foto con conexiones */}
        <div style={{ order: 1, position: "relative" }} className="hero-order-2">
          <div style={{ position: "relative", borderRadius: 24, overflow: "hidden",
            aspectRatio: "4/3",
            boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(212,175,55,0.15)",
            background: "#0c0a18" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.pexels.com/photos/13197844/pexels-photo-13197844.jpeg?auto=compress&cs=tinysrgb&w=900"
              alt="Familia de tres generaciones conectada"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 40%" }} />
            <div style={{ position: "absolute", inset: 0,
              background: `linear-gradient(to right, rgba(3,2,8,0.45) 0%, transparent, rgba(3,2,8,0.22) 100%)` }} />
            <div style={{ position: "absolute", inset: 0,
              background: `linear-gradient(to top, rgba(3,2,8,0.6) 0%, transparent 50%)` }} />
            <ConnectionOverlay />
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8,
                background: "rgba(0,0,0,0.65)", backdropFilter: "blur(10px)",
                border: "1px solid rgba(212,175,55,0.18)", borderRadius: 100,
                padding: "7px 16px", whiteSpace: "nowrap" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: GOLD,
                  boxShadow: `0 0 8px ${GOLD}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Red de 3 generaciones conectada</span>
              </div>
            </div>
          </div>
          {/* Borde exterior dorado sutil */}
          <div style={{ position: "absolute", inset: -1, borderRadius: 25, pointerEvents: "none",
            background: "linear-gradient(135deg, rgba(212,175,55,0.18) 0%, transparent 50%, rgba(120,80,20,0.1) 100%)" }} />
        </div>
      </section>

      {/* ── FEATURES CLAVE ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "0 24px 80px" }}>
        <p style={{ textAlign: "center", color: GOLD_DIM, fontSize: 10, letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: 32 }}>Lo que hace Ceiba único</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
          {[
            { emoji: "🎂", title: "Nunca más te enteras tarde",
              desc: "El cumpleaños de tu prima, el bebé de tu sobrino — Ceiba te avisa porque conoce a toda tu red, no solo a quien tú agregaste.",
              ar: "40,180,120", sh: "#020a05" },
            { emoji: "📢", title: "Un toque. Todos saben.",
              desc: "¿Reunión? ¿Una sorpresa? Un mensaje y cada familiar recibe la notificación — sin reenviar ni olvidar a nadie.",
              ar: "212,175,55", sh: "#040300" },
            { emoji: "🚨", title: "Emergencia: nadie se queda sin saber",
              desc: "Activa el SOS y tu ubicación llega a toda la familia al instante — incluyendo familiares que nunca guardaste en el teléfono.",
              ar: "220,60,80", sh: "#160208" },
          ].map((f, i) => (
            <Card3d key={i} ar={f.ar} sh={f.sh} style={{ padding: 24 }}>
              <div style={{ fontSize: 30, marginBottom: 14 }}>{f.emoji}</div>
              <h3 style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 8, lineHeight: 1.3 }}>{f.title}</h3>
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.7 }}>{f.desc}</p>
            </Card3d>
          ))}
        </div>
      </section>

      {/* ── CÓMO FUNCIONA ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 520, margin: "0 auto", padding: "0 24px 80px" }}>
        <h2 style={{ textAlign: "center", fontSize: 24, fontWeight: 800, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Tres pasos. Menos de 2 minutos.
        </h2>
        <p style={{ textAlign: "center", color: "rgba(212,175,55,0.4)", fontSize: 13, marginBottom: 40 }}>
          Sin tarjeta de crédito. Sin complicaciones.
        </p>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Línea vertical */}
          <div style={{ position: "absolute", left: 17, top: 18, bottom: 18, width: 1,
            background: "linear-gradient(to bottom, rgba(212,175,55,0.4), rgba(212,175,55,0.05))" }} />
          {[
            { n:"1", t:"Crea tu perfil",    d:"Nombre, foto y ciudad. 30 segundos." },
            { n:"2", t:"Agrega tu familia", d:"Mamá, hermanos, pareja, hijos — Ceiba detecta si ya están en la app." },
            { n:"3", t:"Comparte el link",  d:"Cada familiar que entra trae su red. El árbol crece solo." },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 20 }}>
              <div style={{ position: "relative", zIndex: 2, width: 36, height: 36, borderRadius: "50%",
                background: BG, border: `1.5px solid ${GOLD_DIM}`, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: GOLD,
                boxShadow: `0 0 12px rgba(212,175,55,0.12)` }}>
                {s.n}
              </div>
              <div style={{ paddingTop: 6 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 4 }}>{s.t}</p>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── GRID DE FEATURES ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 840, margin: "0 auto", padding: "0 24px 80px" }}>
        <p style={{ textAlign: "center", color: GOLD_DIM, fontSize: 10, letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: 24 }}>Todo incluido, gratis</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 10 }}>
          {[
            { e:"🗺️", t:"Mapa familiar",   d:"Dónde vive cada quien"     },
            { e:"🎂", t:"Cumpleaños",       d:"Alertas automáticas"        },
            { e:"📸", t:"Galería",          d:"Fotos compartidas"          },
            { e:"📅", t:"Historia",         d:"Eventos de la familia"      },
            { e:"💬", t:"Chat familiar",    d:"Por grupos de relación"     },
            { e:"🔒", t:"Privacidad",       d:"Solo tu familia lo ve"      },
          ].map((f, i) => (
            <div key={i} style={{ borderRadius: 14, background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(212,175,55,0.08)", padding: "16px 14px",
              display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{f.e}</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{f.t}</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{f.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section style={{ position: "relative", zIndex: 10, maxWidth: 560, margin: "0 auto", padding: "0 24px 96px" }}>
        <Card3d ar="212,175,55" sh="#040300" glow={0.12} style={{ padding: "48px 32px", textAlign: "center" }}>
          {/* Dot texture */}
          <div style={{ position: "absolute", inset: 0, borderRadius: 20, pointerEvents: "none", opacity: 0.05,
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px" }} />
          {/* Radial green glow */}
          <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: "60%",
            background: "radial-gradient(ellipse, rgba(30,80,30,0.35) 0%, transparent 70%)",
            pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 48, marginBottom: 20 }}>🌳</div>
            <h2 style={{ fontSize: "clamp(1.5rem,4vw,2rem)", fontWeight: 900, lineHeight: 1.2,
              marginBottom: 12, letterSpacing: "-0.025em" }}>
              Tu familia ya existe.<br />Ceiba solo<br />la conecta.
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 6, maxWidth: 300, margin: "0 auto 6px" }}>
              Agrega a tu hermano. El árbol detecta a tu cuñada, tus sobrinos, tus suegros.
            </p>
            <p style={{ fontSize: 11, color: "rgba(212,175,55,0.3)", marginBottom: 32 }}>
              Y cuando alguien nuevo entra — ya sabe quién es quién.
            </p>
            <GoldBtn href="/auth/register">
              Crear mi árbol familiar gratis <ChevronRight size={17} />
            </GoldBtn>
          </div>
        </Card3d>
      </section>

      <footer style={{ position: "relative", zIndex: 10, textAlign: "center",
        paddingBottom: 32, fontSize: 11, color: "rgba(212,175,55,0.2)" }}>
        © 2025 Ceiba · Hecho con amor por familias, para familias
      </footer>
    </main>
  );
}

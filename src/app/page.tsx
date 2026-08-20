"use client";
import Link from "next/link";

const GOLD   = "#d4af37";
const GOLD_L = "#f5e070";
const GOLD_D = "#8b6914";
const BG     = "#030208";
const CARD   = "#0c0a18";

const S = {
  gold:    { color: GOLD } as React.CSSProperties,
  italic:  { fontStyle: "italic" } as React.CSSProperties,
  muted:   { color: "rgba(255,255,255,0.50)" } as React.CSSProperties,
  muted70: { color: "rgba(255,255,255,0.70)" } as React.CSSProperties,
  eyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.22em",
    textTransform: "uppercase" as const, color: "rgba(212,175,55,0.55)",
    marginBottom: 14,
  } as React.CSSProperties,
};

// ── Background ─────────────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 120 }, (_, i) => ({
    cx: ((i * 137.5) % 100).toFixed(1),
    cy: ((i * 97.3)  % 100).toFixed(1),
    r:  (0.30 + (i % 5) * 0.14).toFixed(2),
    op: (0.08 + (i % 9) * 0.05).toFixed(2),
  }));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }}>
      {stars.map((s,i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op}/>)}
    </svg>
  );
}

function NebulaBg() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }} aria-hidden>
      <div style={{ position:"absolute", top:"-8%", left:"10%", width:700, height:600,
        background:"radial-gradient(ellipse, rgba(30,14,70,0.38) 0%, transparent 70%)", filter:"blur(90px)" }}/>
      <div style={{ position:"absolute", top:"35%", right:"-8%", width:480, height:480,
        background:"radial-gradient(ellipse, rgba(120,70,10,0.16) 0%, transparent 70%)", filter:"blur(72px)" }}/>
      <div style={{ position:"absolute", bottom:"8%", left:"-5%", width:420, height:420,
        background:"radial-gradient(ellipse, rgba(50,18,90,0.20) 0%, transparent 70%)", filter:"blur(75px)" }}/>
    </div>
  );
}

// ── Logo ───────────────────────────────────────────────────────────────────────
function CeibaLogo({ small }: { small?: boolean }) {
  const sz = small ? 24 : 30;
  return (
    <div style={{ display:"flex", alignItems:"center", gap: small ? 7 : 9 }}>
      <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
        <ellipse cx="16" cy="16" rx="12" ry="4.5" stroke={GOLD} strokeWidth="0.7" fill="none" strokeOpacity="0.5" transform="rotate(-22 16 16)"/>
        <path d="M16 16 Q20 11 24 8"  stroke={GOLD} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.7"/>
        <path d="M16 16 Q12 21 8 24"  stroke={GOLD} strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.6"/>
        <path d="M16 16 Q11 11 8 8"   stroke={GOLD} strokeWidth="0.8" strokeLinecap="round" fill="none" opacity="0.5"/>
        <path d="M16 16 Q21 21 24 24" stroke={GOLD} strokeWidth="0.7" strokeLinecap="round" fill="none" opacity="0.45"/>
        <circle cx="22" cy="9.5" r="1.1" fill={GOLD_L} opacity="0.9"/>
        <circle cx="10" cy="22" r="1"   fill={GOLD_L} opacity="0.8"/>
        <circle cx="10" cy="10" r="0.8" fill={GOLD}   opacity="0.65"/>
        <circle cx="22" cy="22" r="0.7" fill={GOLD}   opacity="0.6"/>
        <circle cx="5"  cy="5"  r="0.45" fill="white" opacity="0.55"/>
        <circle cx="27" cy="6"  r="0.45" fill="white" opacity="0.45"/>
        <circle cx="6"  cy="26" r="0.4"  fill="white" opacity="0.45"/>
        <circle cx="27" cy="26" r="0.4"  fill="white" opacity="0.4"/>
        <path d="M16 11.5 L16.5 15.5 L16 20.5 L15.5 15.5 Z" fill="rgba(255,245,200,0.92)"/>
        <path d="M11.5 16 L15.5 16.5 L20.5 16 L15.5 15.5 Z" fill="rgba(255,245,200,0.92)"/>
        <circle cx="16" cy="16" r="2.2" fill="rgba(255,245,200,0.95)"/>
        <circle cx="16" cy="16" r="1"   fill="white"/>
      </svg>
      <div>
        <div style={{ fontWeight:800, fontSize: small ? 15 : 17, color:"#fff", lineHeight:1, letterSpacing:"-0.02em" }}>CEIBA</div>
        <div style={{ fontSize: small ? 7 : 8, color:"rgba(212,175,55,0.45)", letterSpacing:"0.10em", textTransform:"uppercase", lineHeight:1.2 }}>
          Nuestras Raíces
        </div>
      </div>
    </div>
  );
}

// ── App icon card ──────────────────────────────────────────────────────────────
function AppIconCard() {
  return (
    <div style={{
      width: 220, height: 220, borderRadius: 48,
      background: "linear-gradient(145deg, #0e0a22 0%, #060318 100%)",
      border: "1.5px solid rgba(212,175,55,0.22)",
      boxShadow: "0 0 60px rgba(212,175,55,0.30), 0 20px 60px rgba(0,0,0,0.80)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 8,
      position: "relative", overflow: "hidden",
    }}>
      {/* Constellation SVG — simplified version of the app icon */}
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden>
        <defs>
          <radialGradient id="ic-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#d4af37" stopOpacity="0.20"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill="url(#ic-halo)"/>
        {/* Outer arc left */}
        <path d="M28 22 Q10 60 28 98" stroke={GOLD} strokeWidth="2" fill="none" strokeOpacity="0.7"/>
        {/* Outer arc right */}
        <path d="M92 22 Q110 60 92 98" stroke={GOLD} strokeWidth="2" fill="none" strokeOpacity="0.7"/>
        {/* Trunk */}
        <line x1="60" y1="82" x2="60" y2="56" stroke={GOLD} strokeWidth="2" strokeOpacity="0.8"/>
        {/* Branch left */}
        <line x1="60" y1="70" x2="38" y2="52" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.7"/>
        {/* Branch right */}
        <line x1="60" y1="70" x2="82" y2="52" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.7"/>
        {/* People figures */}
        <circle cx="60" cy="78" r="5" fill={GOLD} opacity="0.85"/>
        <circle cx="44" cy="84" r="4" fill={GOLD} opacity="0.70"/>
        <circle cx="76" cy="84" r="4" fill={GOLD} opacity="0.70"/>
        <circle cx="32" cy="90" r="3" fill={GOLD} opacity="0.55"/>
        <circle cx="88" cy="90" r="3" fill={GOLD} opacity="0.55"/>
        {/* Star dots on branches */}
        <circle cx="38" cy="52" r="3" fill={GOLD_L} opacity="0.9"/>
        <circle cx="82" cy="52" r="3" fill={GOLD_L} opacity="0.9"/>
        <circle cx="60" cy="44" r="2" fill={GOLD} opacity="0.6"/>
        {/* Top star */}
        <path d="M60 26 L61.5 32 L60 38 L58.5 32 Z" fill={GOLD_L} opacity="0.95"/>
        <path d="M54 32 L60 33.5 L66 32 L60 30.5 Z" fill={GOLD_L} opacity="0.95"/>
        <circle cx="60" cy="32" r="3" fill="white" opacity="0.90"/>
      </svg>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:18, fontWeight:900, color:"#fff", letterSpacing:"0.16em" }}>CEIBA</div>
        <div style={{ fontSize:8, color:"rgba(212,175,55,0.55)", letterSpacing:"0.18em", textTransform:"uppercase" }}>Nuestras Raíces</div>
      </div>
    </div>
  );
}

// ── Phone mockup (decorative) ─────────────────────────────────────────────────
function PhoneMockup({ title, subtitle, accent = false }: { title: string; subtitle: string; accent?: boolean }) {
  return (
    <div style={{
      width: 220, borderRadius: 36,
      background: "#060318",
      border: `1.5px solid ${accent ? "rgba(212,175,55,0.35)" : "rgba(212,175,55,0.15)"}`,
      boxShadow: accent
        ? "0 0 48px rgba(212,175,55,0.20), 0 24px 64px rgba(0,0,0,0.80)"
        : "0 16px 48px rgba(0,0,0,0.75)",
      overflow: "hidden", position: "relative",
    }}>
      {/* Notch */}
      <div style={{ height:10, background:"#060318", display:"flex", alignItems:"center", justifyContent:"center" }}>
        <div style={{ width:48, height:4, borderRadius:4, background:"rgba(255,255,255,0.08)" }}/>
      </div>
      {/* Screen */}
      <div style={{ padding: "20px 16px 24px", minHeight: 340, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:12 }}>
        {/* CEIBA header */}
        <div style={{ display:"flex", alignItems:"center", gap:5, opacity:0.55 }}>
          <div style={{ width:14, height:14, borderRadius:"50%", border:"1px solid rgba(212,175,55,0.5)",
            display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:GOLD, opacity:0.7 }}/>
          </div>
          <span style={{ fontSize:8, fontWeight:700, color:GOLD, letterSpacing:"0.12em" }}>CEIBA</span>
        </div>
        {/* Central star */}
        <div style={{ marginTop:8 }}>
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
            <path d="M22 8 L23.4 18 L22 28 L20.6 18 Z" fill={GOLD_L} opacity="0.9"/>
            <path d="M8 22 L18 23.4 L28 22 L18 20.6 Z" fill={GOLD_L} opacity="0.9"/>
            <circle cx="22" cy="22" r="5" fill="white" opacity="0.92"/>
            <circle cx="22" cy="22" r="8" fill={GOLD} opacity="0.12"/>
          </svg>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:14, fontWeight:800, color:"#fff", lineHeight:1.2,
            textShadow:"0 0 16px rgba(212,175,55,0.4)" }}>{title}</div>
          <div style={{ fontSize:10, color:"rgba(212,175,55,0.55)", marginTop:5, fontWeight:500, lineHeight:1.4 }}>{subtitle}</div>
        </div>
        {/* Fake content rows */}
        {[0.38,0.25,0.18].map((op,i)=>(
          <div key={i} style={{ width:"85%", height:6, borderRadius:6,
            background:`rgba(212,175,55,${op})`, marginTop:2 }}/>
        ))}
        <div style={{ display:"flex", gap:8, marginTop:4 }}>
          {[0.22,0.14,0.10].map((op,i)=>(
            <div key={i} style={{ width:44, height:28, borderRadius:8,
              background:`rgba(212,175,55,${op})`, border:"1px solid rgba(212,175,55,0.12)" }}/>
          ))}
        </div>
      </div>
      {/* Bottom bar */}
      <div style={{ height:6, background:"rgba(212,175,55,0.04)" }}>
        <div style={{ height:3, width:36, borderRadius:4, background:"rgba(255,255,255,0.12)",
          margin:"1.5px auto" }}/>
      </div>
    </div>
  );
}

// ── Store badges ───────────────────────────────────────────────────────────────
function StoreBadges({ centered = false }: { centered?: boolean }) {
  const wrap: React.CSSProperties = {
    display: "flex", gap: 12, flexWrap: "wrap",
    justifyContent: centered ? "center" : "flex-start",
  };
  const badge = (label: string, sub: string, icon: React.ReactNode): React.ReactNode => (
    <Link href="/instalar" style={{ textDecoration:"none" }}>
      <div style={{
        display:"flex", alignItems:"center", gap:12,
        background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.12)",
        borderRadius:14, padding:"10px 18px", cursor:"pointer", minWidth:160,
        transition:"background 0.18s",
      }}>
        <div style={{ color:"rgba(255,255,255,0.75)", flexShrink:0 }}>{icon}</div>
        <div>
          <div style={{ fontSize:8, color:"rgba(255,255,255,0.45)", fontWeight:600, letterSpacing:"0.10em", textTransform:"uppercase" }}>{sub}</div>
          <div style={{ fontSize:14, color:"#fff", fontWeight:700, lineHeight:1.2 }}>{label}</div>
        </div>
      </div>
    </Link>
  );
  return (
    <div style={wrap}>
      {badge("iPhone / Safari", "Instalar en",
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
      )}
      {badge("Android / Chrome", "Instalar en",
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M3 20.5v-17c0-.83.94-1.3 1.6-.8l14 8.5c.6.36.6 1.24 0 1.6l-14 8.5c-.66.5-1.6.03-1.6-.8z"/></svg>
      )}
    </div>
  );
}

// ── Feature icon chips ─────────────────────────────────────────────────────────
function HabitIcon({ d }: { d: string }) {
  return (
    <div style={{
      width:44, height:44, borderRadius:12,
      background:"rgba(212,175,55,0.10)", border:"1px solid rgba(212,175,55,0.18)",
      display:"flex", alignItems:"center", justifyContent:"center",
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={d}/>
      </svg>
    </div>
  );
}

// ── Privacy tag pill ───────────────────────────────────────────────────────────
function Tag({ label }: { label: string }) {
  return (
    <div style={{
      display:"inline-flex", alignItems:"center", gap:7,
      background:"rgba(212,175,55,0.07)", border:"1px solid rgba(212,175,55,0.18)",
      borderRadius:100, padding:"6px 14px",
    }}>
      <span style={{ color:GOLD, fontSize:11 }}>✦</span>
      <span style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontWeight:500 }}>{label}</span>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main style={{ minHeight:"100vh", background:BG, color:"#fff", overflowX:"hidden", position:"relative" }}>
      <StarField/><NebulaBg/>

      <style>{`
        html,body{background:#030208!important}
        .nav-lnk{color:rgba(255,255,255,0.50);font-size:13px;font-weight:500;text-decoration:none;transition:color .2s}
        .nav-lnk:hover{color:rgba(212,175,55,0.85)}
        .feat-card:hover{border-color:rgba(212,175,55,0.32)!important;transform:translateY(-2px)}
        .feat-card{transition:transform .22s,border-color .22s}
        .habit-card:hover{background:rgba(212,175,55,0.06)!important}
        .habit-card{transition:background .2s}
        @media(max-width:860px){.nav-links{display:none!important}}
        @media(max-width:680px){
          .hero-cols{flex-direction:column!important;text-align:center}
          .hero-btns{justify-content:center!important}
          .feat-mini{grid-template-columns:1fr 1fr!important}
          .detail-row{flex-direction:column!important}
          .detail-row.rev{flex-direction:column!important}
          .habit-grid{grid-template-columns:1fr!important}
          .px{padding-left:20px!important;padding-right:20px!important}
        }
        @media(max-width:440px){
          .feat-mini{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────────────────────── */}
      <nav style={{ position:"relative", zIndex:20, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"18px 40px", maxWidth:1160, margin:"0 auto" }}
        className="px">
        <CeibaLogo/>
        <div className="nav-links" style={{ display:"flex", gap:28 }}>
          {[["#features","Características"],["#habitos","Por qué Ceiba"],["#privacidad","Privacidad"]].map(([href,l])=>(
            <Link key={href} href={href} className="nav-lnk">{l}</Link>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Link href="/auth/login" style={{
            fontSize:13, color:"rgba(255,255,255,0.50)", fontWeight:600, textDecoration:"none",
            padding:"8px 18px", border:"1px solid rgba(255,255,255,0.10)", borderRadius:10,
          }}>Iniciar sesión</Link>
          <Link href="/instalar" style={{ textDecoration:"none" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background:"linear-gradient(to bottom, #e0bc2a 0%, #c09810 100%)",
              borderTop:"1.5px solid #f5e060", borderBottom:"3px solid #6a5200",
              borderRadius:10, color:BG, fontWeight:800, fontSize:13,
              padding:"9px 20px", cursor:"pointer", whiteSpace:"nowrap",
              boxShadow:"0 4px 0 #3d3000, 0 6px 18px rgba(0,0,0,0.55)",
            }}>Instalar app ↓</div>
          </Link>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:720,
        margin:"0 auto", padding:"80px 40px 100px", textAlign:"center" }}
        className="px">
        <p style={S.eyebrow}>El hogar digital de tu familia</p>
        <h1 style={{
          fontWeight:300, lineHeight:1.08, letterSpacing:"-0.02em",
          fontSize:"clamp(2.8rem,8vw,5.2rem)", marginBottom:22,
        }}>
          Aquí vive{" "}
          <em style={{ fontStyle:"italic", fontWeight:400, color:"rgba(255,255,255,0.90)" }}>la historia</em>
          <br/>de tu familia.
        </h1>
        <p style={{ ...S.muted70, fontSize:"clamp(15px,2vw,17px)", lineHeight:1.80,
          marginBottom:40, maxWidth:520, margin:"0 auto 40px" }}>
          Tres generaciones, un solo lugar. Ceiba conecta a tu familia, conserva sus recuerdos
          y mantiene viva su historia — sin importar la distancia ni el tiempo.
        </p>
        <div className="hero-btns" style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <Link href="/auth/register" style={{ textDecoration:"none" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              background:"linear-gradient(to bottom, #e0bc2a 0%, #c09810 100%)",
              borderTop:"1.5px solid #f5e060", borderBottom:"4px solid #6a5200",
              borderRadius:14, color:BG, fontWeight:800, fontSize:15,
              padding:"14px 32px", cursor:"pointer",
              boxShadow:"0 8px 0 #3d3000, 0 14px 32px rgba(0,0,0,0.65)",
            }}>Empezar gratis</div>
          </Link>
          <Link href="#features" style={{ textDecoration:"none" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:8,
              border:"1.5px solid rgba(255,255,255,0.20)", borderRadius:14,
              color:"rgba(255,255,255,0.72)", fontWeight:600, fontSize:15,
              padding:"14px 32px", cursor:"pointer",
              background:"rgba(255,255,255,0.04)",
            }}>Conocer más</div>
          </Link>
        </div>
      </section>

      {/* ── APP ICON + STORE BADGES ─────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:1160, margin:"0 auto",
        padding:"0 40px 80px", display:"flex", flexDirection:"column", alignItems:"center", gap:32 }}
        className="px">
        <AppIconCard/>
        <StoreBadges centered/>

        <div style={{ textAlign:"center", marginTop:24 }}>
          <p style={{ ...S.eyebrow, marginBottom:16 }}>El universo de tu familia</p>
          <h2 style={{
            fontWeight:300, fontSize:"clamp(2rem,5vw,3.4rem)",
            lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:16,
          }}>
            Tu galaxia, completa{" "}
            <em style={{ fontStyle:"italic", color:"rgba(255,255,255,0.90)" }}>y</em>
            {" "}viva.
          </h2>
          <p style={{ ...S.muted70, fontSize:16, lineHeight:1.75,
            maxWidth:480, margin:"0 auto" }}>
            Todo lo que importa de tu familia, organizado en un solo lugar:
            personas, historias, fotos y recuerdos que persisten en el tiempo.
          </p>
        </div>
      </section>

      {/* ── FEATURE MINI CARDS ─────────────────────────────────────────────── */}
      <section id="features" style={{ position:"relative", zIndex:10, maxWidth:1160,
        margin:"0 auto", padding:"0 40px 88px" }} className="px">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}
          className="feat-mini">
          {[
            { label:"INICIO",    h:"Tu familia, ya conectada",   d:"El resumen vivo de tu legado." },
            { label:"ÁRBOL",     h:"Tu galaxia familiar",        d:"Explora cada generación, un toque a la vez." },
            { label:"HISTORIAS", h:"Recuerdos vivos",            d:"Anécdotas que siguen pasando de generación." },
          ].map(({ label, h, d }, i) => (
            <div key={i} className="feat-card" style={{
              borderRadius:20, background:CARD, padding:"20px 18px 22px",
              border:"1px solid rgba(212,175,55,0.10)",
              borderTop:"1.5px solid rgba(212,175,55,0.25)",
              boxShadow:"0 8px 28px rgba(0,0,0,0.65)",
            }}>
              <div style={{ ...S.eyebrow, fontSize:9, marginBottom:10 }}>{label}</div>
              <h3 style={{ fontSize:16, fontWeight:700, lineHeight:1.25, marginBottom:8 }}>{h}</h3>
              <p style={{ fontSize:13, ...S.muted, lineHeight:1.70 }}>{d}</p>
            </div>
          ))}
        </div>
        {/* Álbumes — wider card below */}
        <div className="feat-card" style={{
          borderRadius:20, background:CARD, marginTop:14, padding:"20px 18px 22px",
          border:"1px solid rgba(212,175,55,0.10)",
          borderTop:"1.5px solid rgba(212,175,55,0.25)",
          boxShadow:"0 8px 28px rgba(0,0,0,0.65)",
        }}>
          <div style={{ ...S.eyebrow, fontSize:9, marginBottom:10 }}>ÁLBUMES</div>
          <h3 style={{ fontSize:16, fontWeight:700, lineHeight:1.25, marginBottom:8 }}>Fotos, juntos</h3>
          <p style={{ fontSize:13, ...S.muted, lineHeight:1.70 }}>Todas las fotos, en una sola historia.</p>
        </div>
      </section>

      {/* ── FEATURE DETAILS (alternating) ─────────────────────────────────── */}
      {[
        {
          num:"I", label:"La Galaxia", h:"Tu familia, ya conectada.",
          body:"Cuando un familiar entra, el resto ya está ahí. Ceiba detecta automáticamente quiénes son padres, hermanos, tíos o primos — nadie empieza de cero.",
          phone:{ title:"Explora tu\ngalaxia familiar", sub:"Visualiza vínculos, generaciones\ny ramas de forma viva y memorable" },
          reverse: false,
        },
        {
          num:"II", label:"Historias", h:"Historias que siguen vivas.",
          body:"Guarda anécdotas, recuerdos y momentos para las próximas generaciones. Las historias que solo tus abuelos conocen merecen un lugar que no se pierda.",
          phone:{ title:"Historias que\nsiguen vivas", sub:"Guarda anécdotas, recuerdos y\nmoments para las próximas generaciones" },
          reverse: true,
        },
        {
          num:"III", label:"Álbumes", h:"Tus fotos, juntas para siempre.",
          body:"Álbumes familiares privados donde cada generación aporta las suyas. Una línea de tiempo visual que crece con los años y nunca se pierde.",
          phone:{ title:"Tus fotos,\njuntas para siempre", sub:"Álbumes familiares privados\npara revivir lo que más importa" },
          reverse: false,
        },
        {
          num:"IV", label:"Mapas", h:"Descubre de dónde vienen.",
          body:"Visualiza el mapa de tu familia: de qué país, región o ciudad vienen tus raíces. Un viaje visual por las generaciones y los lugares que las vieron crecer.",
          phone:{ title:"Raíces en el mapa", sub:"De dónde viene\ncada generación" },
          reverse: true,
        },
        {
          num:"V", label:"Recuerdos", h:"Un día como hoy, hace años.",
          body:"Cada día, Ceiba rescata algo que pasó en tu familia en la misma fecha de años anteriores. Pequeños viajes al pasado que se vuelven rituales.",
          phone:{ title:"Un día como hoy,\nhace años", sub:"Pequeños viajes al pasado\nque se vuelven rituales" },
          reverse: false,
        },
      ].map(({ num, label, h, body, phone, reverse }, i) => (
        <section key={i} style={{ position:"relative", zIndex:10, maxWidth:1160,
          margin:"0 auto", padding:"0 40px 96px" }} className="px">
          <div className={`detail-row${reverse?" rev":""}`} style={{
            display:"flex", alignItems:"center", gap:56,
            flexDirection: reverse ? "row-reverse" : "row",
          }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ ...S.eyebrow, marginBottom:10 }}>{num} · {label}</p>
              <h2 style={{ fontWeight:300, fontSize:"clamp(1.8rem,4vw,2.8rem)",
                lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:20 }}>{h}</h2>
              <p style={{ ...S.muted70, fontSize:"clamp(14px,1.8vw,16px)", lineHeight:1.85, maxWidth:400 }}>{body}</p>
            </div>
            <div style={{ flexShrink:0, display:"flex", justifyContent:"center" }}>
              <PhoneMockup title={phone.title} subtitle={phone.sub} accent={i === 0}/>
            </div>
          </div>
        </section>
      ))}

      {/* ── HÁBITOS REALES ─────────────────────────────────────────────────── */}
      <section id="habitos" style={{ position:"relative", zIndex:10, maxWidth:760,
        margin:"0 auto", padding:"0 40px 100px" }} className="px">
        <p style={S.eyebrow}>Hábitos reales</p>
        <h2 style={{ fontWeight:300, fontSize:"clamp(2rem,5vw,3.2rem)",
          lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:14 }}>
          Por qué volver{" "}
          <em style={{ fontStyle:"italic", color:"rgba(255,255,255,0.90)" }}>cada día</em>.
        </h2>
        <p style={{ ...S.muted70, fontSize:16, lineHeight:1.75,
          maxWidth:480, marginBottom:44 }}>
          Ceiba no compite por tu atención. Te devuelve algo cada vez que la abres
          — un recuerdo, una fecha, una conversación pendiente.
        </p>

        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {[
            {
              icon:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0-6 0",
              t:"Momento del día",
              d:"Una pequeña actualización viva para tu familia, no ruido de notificaciones.",
            },
            {
              icon:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
              t:"Cumpleaños reales",
              d:"Los que nunca escribiste en el calendario: tíos, primos, abuelos, todos en su justo momento.",
            },
            {
              icon:"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
              t:"Invita sin empujar",
              d:"Un enlace y la familia entra sola. Sin formularios largos ni pasos confusos.",
            },
            {
              icon:"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
              t:"Historias guiadas",
              d:"Preguntas que ayudan a tus abuelos a contar lo que nadie más recuerda.",
            },
          ].map(({ icon, t, d }, i) => (
            <div key={i} className="habit-card" style={{
              borderRadius:18, background:"rgba(255,255,255,0.025)",
              border:"1px solid rgba(212,175,55,0.10)",
              padding:"20px 22px", display:"flex", gap:18, alignItems:"flex-start",
            }}>
              <HabitIcon d={icon}/>
              <div>
                <h3 style={{ fontSize:15, fontWeight:700, marginBottom:5 }}>{t}</h3>
                <p style={{ fontSize:13, ...S.muted, lineHeight:1.70 }}>{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRIVACIDAD ─────────────────────────────────────────────────────── */}
      <section id="privacidad" style={{ position:"relative", zIndex:10, maxWidth:1160,
        margin:"0 auto", padding:"0 40px 100px" }} className="px">
        <div style={{
          borderRadius:28, padding:"64px 48px",
          background:"linear-gradient(145deg, rgba(14,10,34,0.85) 0%, rgba(6,3,24,0.95) 100%)",
          border:"1px solid rgba(212,175,55,0.14)",
          borderTop:"1.5px solid rgba(212,175,55,0.28)",
          boxShadow:"0 0 64px rgba(212,175,55,0.05), 0 32px 80px rgba(0,0,0,0.70)",
          textAlign:"center",
        }}>
          <p style={S.eyebrow}>Privacidad por diseño</p>
          <h2 style={{ fontWeight:300, fontSize:"clamp(2rem,5vw,3.4rem)",
            lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:20 }}>
            Solo tu familia{" "}
            <em style={{ fontStyle:"italic", color:"rgba(255,255,255,0.90)" }}>lo ve</em>.
          </h2>
          <p style={{ ...S.muted70, fontSize:16, lineHeight:1.78, maxWidth:520,
            margin:"0 auto 36px" }}>
            Ceiba no es una red social. No hay likes, ni extraños, ni algoritmos decidiendo
            qué te mostramos. Tu información vive dentro de tu familia y tú decides qué se comparte.
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, justifyContent:"center" }}>
            {["Sin publicidad","Sin algoritmos","Cifrado en tránsito","Privacidad por familia","Tú controlas qué se ve"].map(l=>(
              <Tag key={l} label={l}/>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:700,
        margin:"0 auto", padding:"0 40px 120px", textAlign:"center" }} className="px">
        <p style={S.eyebrow}>Empieza hoy</p>
        <h2 style={{ fontWeight:300, fontSize:"clamp(2rem,5vw,3.4rem)",
          lineHeight:1.1, letterSpacing:"-0.02em", marginBottom:16 }}>
          Tu historia hoy,<br/>el legado de mañana.
        </h2>
        <p style={{ ...S.muted70, fontSize:16, lineHeight:1.75, marginBottom:36 }}>
          Gratis. Sin publicidad. Sin límites. Solo tu familia.
        </p>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <StoreBadges centered/>
        </div>
        <p style={{ ...S.muted, fontSize:13, marginTop:8 }}>
          También disponible en la web —{" "}
          <Link href="/" style={{ color:"rgba(212,175,55,0.70)", textDecoration:"none", fontWeight:600 }}>ceibapp.com</Link>
        </p>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
      <footer style={{ position:"relative", zIndex:10,
        background:"rgba(3,2,8,1)", borderTop:"1px solid rgba(212,175,55,0.07)",
        padding:"36px 40px" }} className="px">
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center",
            justifyContent:"space-between", gap:20, marginBottom:24 }}>
            <CeibaLogo/>
            <div style={{ display:"flex", flexWrap:"wrap", gap:18 }}>
              {[
                ["/instalar",         "Instalar app"],
                ["/privacidad",       "Privacidad"],
                ["/soporte",          "Soporte"],
                ["/auth/login",       "Iniciar sesión"],
              ].map(([href,l])=>(
                <Link key={href} href={href} style={{ fontSize:12,
                  color:"rgba(255,255,255,0.30)", textDecoration:"none", fontWeight:500 }}>{l}</Link>
              ))}
            </div>
            <span style={{ fontSize:10, color:"rgba(212,175,55,0.22)", fontStyle:"italic", fontWeight:500 }}>
              Nuestras raíces.
            </span>
          </div>
          <div style={{ borderTop:"1px solid rgba(255,255,255,0.04)", paddingTop:16,
            display:"flex", flexWrap:"wrap", justifyContent:"space-between",
            alignItems:"center", gap:10 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.18)" }}>
              © Ceiba · Hecho con amor por familias, para familias. Gratis. Sin publicidad. Solo tu familia.
            </span>
            <div style={{ display:"flex", gap:16 }}>
              {[["Términos","/terminos"],["Privacidad","/privacidad"]].map(([l,h])=>(
                <Link key={h} href={h} style={{ fontSize:11,
                  color:"rgba(255,255,255,0.18)", textDecoration:"none" }}>{l}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

"use client";
import Link from "next/link";

const GOLD = "#d4af37";
const GOLD_DIM = "rgba(212,175,55,0.35)";
const BG = "#030208";
const CARD = "#0c0a18";

// ── Background ─────────────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 90 }, (_, i) => ({
    cx: (((i * 137.5) % 100)).toFixed(1),
    cy: (((i * 97.3) % 100)).toFixed(1),
    r:  (0.4 + (i % 5) * 0.18).toFixed(2),
    op: (0.12 + (i % 9) * 0.06).toFixed(2),
  }));
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:0 }}>
      {stars.map((s, i) => <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op} />)}
    </svg>
  );
}

function NebulaBg() {
  return (
    <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }} aria-hidden>
      <div style={{ position:"absolute", top:"-10%", left:"15%", width:600, height:500,
        background:"radial-gradient(ellipse, rgba(20,10,60,0.35) 0%, transparent 70%)", filter:"blur(70px)" }} />
      <div style={{ position:"absolute", top:"35%", right:"-5%", width:400, height:400,
        background:"radial-gradient(ellipse, rgba(100,60,10,0.18) 0%, transparent 70%)", filter:"blur(60px)" }} />
      <div style={{ position:"absolute", bottom:"5%", left:"-5%", width:350, height:350,
        background:"radial-gradient(ellipse, rgba(40,15,90,0.20) 0%, transparent 70%)", filter:"blur(65px)" }} />
    </div>
  );
}

// ── Cosmic portal ──────────────────────────────────────────────────────────────
function CosmicPortal() {
  const R = 182, CX = 260, CY = 248;
  const avatars = [
    { angle: 312, init: "R", color: "#E8784A" },
    { angle: 32,  init: "C", color: "#F2B43C" },
    { angle: 88,  init: "H", color: "#5AAEE0" },
    { angle: 148, init: "L", color: "#D46090" },
    { angle: 215, init: "A", color: "#4ABA8A" },
    { angle: 272, init: "M", color: "#9A88DA" },
  ].map(a => {
    const rad = (a.angle * Math.PI) / 180;
    return { ...a, x: CX + R * Math.sin(rad), y: CY - R * Math.cos(rad) };
  });
  const persons = [
    { x: 218, hy: 352, bw: 22, hr: 10, ph: 38 },
    { x: 240, hy: 333, bw: 26, hr: 12, ph: 50 },
    { x: 260, hy: 316, bw: 28, hr: 13, ph: 58 },
    { x: 280, hy: 333, bw: 25, hr: 12, ph: 50 },
    { x: 302, hy: 352, bw: 20, hr:  9, ph: 38 },
  ];
  return (
    <svg viewBox="0 0 520 498" style={{ width:"100%", maxWidth:560, display:"block" }} aria-hidden>
      <defs>
        <filter id="cp-gl"><feGaussianBlur stdDeviation="10" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="cp-gm"><feGaussianBlur stdDeviation="4"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="cp-gs"><feGaussianBlur stdDeviation="2"  result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="cp-in" cx="50%" cy="38%" r="65%">
          <stop offset="0%"   stopColor="#1a0800" stopOpacity="0.92"/>
          <stop offset="50%"  stopColor="#07040f" stopOpacity="0.97"/>
          <stop offset="100%" stopColor="#030208" stopOpacity="1"/>
        </radialGradient>
        <radialGradient id="cp-neb" cx="50%" cy="68%" r="52%">
          <stop offset="0%"   stopColor="#c87030" stopOpacity="0.24"/>
          <stop offset="50%"  stopColor="#6b3010" stopOpacity="0.10"/>
          <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="cp-rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#f5e070" stopOpacity="0.98"/>
          <stop offset="28%"  stopColor="#d4af37" stopOpacity="0.88"/>
          <stop offset="58%"  stopColor="#8b6914" stopOpacity="0.62"/>
          <stop offset="82%"  stopColor="#d4af37" stopOpacity="0.85"/>
          <stop offset="100%" stopColor="#f5e070" stopOpacity="0.96"/>
        </linearGradient>
        <style>{`
          @keyframes cp-spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes cp-rspin { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
          @keyframes cp-pulse { 0%,100%{opacity:.75} 50%{opacity:1} }
          .cpr  { animation:cp-spin  80s linear infinite; transform-origin:${CX}px ${CY}px; }
          .cprr { animation:cp-rspin 52s linear infinite; transform-origin:${CX}px ${CY}px; }
          .cpp  { animation:cp-pulse 3.5s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* Portal glow aura */}
      <ellipse cx={CX} cy={CY} rx={220} ry={200} fill="#3020a0" opacity="0.07" filter="url(#cp-gl)"/>

      {/* Avatar connector lines */}
      {avatars.map((a, i) => {
        const rad = a.angle * Math.PI / 180;
        return <line key={i}
          x1={CX + (R - 3) * Math.sin(rad)} y1={CY - (R - 3) * Math.cos(rad)}
          x2={CX + (R + 30) * Math.sin(rad)} y2={CY - (R + 30) * Math.cos(rad)}
          stroke={a.color} strokeWidth="0.9" strokeOpacity="0.40"
        />;
      })}

      {/* Outer ring glow */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#d4af37" strokeWidth="5" strokeOpacity="0.12" filter="url(#cp-gl)"/>

      {/* Portal interior */}
      <circle cx={CX} cy={CY} r={R - 1} fill="url(#cp-in)"/>
      <circle cx={CX} cy={CY} r={R - 1} fill="url(#cp-neb)"/>

      {/* Ground light */}
      <ellipse cx={CX} cy={428} rx={125} ry={28} fill="#c87030" opacity="0.22" filter="url(#cp-gm)"/>

      {/* Silhouettes */}
      {persons.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.hy} r={p.hr} fill="rgba(4,2,10,0.96)"/>
          <path d={`M${p.x-p.bw/2},${p.hy+p.hr+2} Q${p.x-p.bw*.58},${p.hy+p.hr+p.ph*.4} ${p.x-p.bw*.68},${p.hy+p.hr+p.ph} L${p.x+p.bw*.68},${p.hy+p.hr+p.ph} Q${p.x+p.bw*.58},${p.hy+p.hr+p.ph*.4} ${p.x+p.bw/2},${p.hy+p.hr+2} Z`}
            fill="rgba(4,2,10,0.88)"/>
        </g>
      ))}

      {/* Atmospheric floor */}
      <ellipse cx={CX} cy={404} rx={135} ry={16} fill="#c87030" opacity="0.16" filter="url(#cp-gm)"/>

      {/* Main ring — slow spin */}
      <g className="cpr">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#cp-rg)" strokeWidth="2.4"/>
        {[0,45,90,135,180,225,270,315].map((ang, i) => {
          const r2 = ang * Math.PI / 180;
          return <circle key={i}
            cx={CX + R * Math.sin(r2)} cy={CY - R * Math.cos(r2)}
            r={i % 2 === 0 ? 2.6 : 1.6}
            fill={i % 2 === 0 ? "#f5e070" : "#d4af37"}
            opacity={i % 2 === 0 ? 0.88 : 0.55}
            filter={i % 2 === 0 ? "url(#cp-gs)" : undefined}
          />;
        })}
      </g>

      {/* Inner dashed ring — reverse spin */}
      <g className="cprr">
        <circle cx={CX} cy={CY} r={R - 14} fill="none" stroke="#d4af37" strokeWidth="0.55" strokeOpacity="0.18" strokeDasharray="8,16"/>
      </g>

      {/* Avatar circles */}
      {avatars.map((a, i) => (
        <g key={i} className="cpp" style={{ animationDelay:`${i * 0.55}s` }}>
          <circle cx={a.x} cy={a.y} r={27} fill="none" stroke={a.color} strokeWidth="0.9" strokeOpacity="0.28"/>
          <circle cx={a.x} cy={a.y} r={22} fill={CARD} stroke={a.color} strokeWidth="1.6" strokeOpacity="0.72"/>
          <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central"
            fontSize="13" fontWeight="800" fill={a.color} fontFamily="system-ui">{a.init}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Memories visual ────────────────────────────────────────────────────────────
function MemoriesVisual() {
  return (
    <div style={{ position:"relative", width:"100%", maxWidth:480, aspectRatio:"1/0.9", margin:"0 auto" }}>
      <style>{`@keyframes mem-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}`}</style>
      {/* Golden light burst */}
      <div style={{ position:"absolute", bottom:"4%", left:"50%", transform:"translateX(-50%)",
        width:340, height:200,
        background:"radial-gradient(ellipse at center bottom, rgba(212,175,55,0.42) 0%, rgba(180,90,20,0.18) 42%, transparent 72%)",
        filter:"blur(28px)", pointerEvents:"none" }} />

      {/* Photo: back-left */}
      <div style={{
        position:"absolute", left:"2%", top:"14%", width:"50%", aspectRatio:"3/4",
        background:"#f0e8d4", border:"8px solid #f5f0e8", borderBottom:"24px solid #f5f0e8",
        borderRadius:4, transform:"rotate(-8deg)",
        boxShadow:"0 16px 48px rgba(0,0,0,0.72), 0 4px 12px rgba(0,0,0,0.5)",
        overflow:"hidden", animation:"mem-float 5.5s ease-in-out 0.8s infinite",
      }}>
        <div style={{ width:"100%", height:"80%",
          background:"linear-gradient(160deg,#8b6914 0%,#5c3d0a 42%,#3a2008 100%)",
          position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, opacity:0.55,
            background:"radial-gradient(ellipse at 35% 40%,rgba(255,220,160,0.3) 0%,rgba(100,60,20,0.4) 60%,rgba(30,15,5,0.6) 100%)" }}/>
          <svg viewBox="0 0 100 100" style={{ position:"absolute", bottom:0, width:"100%", height:"62%" }}>
            {[20,38,56,74,88].map((x,i)=>(
              <g key={i}>
                <circle cx={x} cy={i%2===0?28:22} r={i===2?9:7} fill="rgba(18,9,3,0.75)"/>
                <rect x={x-(i===2?8:6)} y={i%2===0?37:30} width={i===2?16:12} height={65} rx="4" fill="rgba(12,6,2,0.68)"/>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ height:"20%", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:9, color:"#8b6914", fontFamily:"Georgia,serif", opacity:0.7 }}>Familia · 1978</span>
        </div>
      </div>

      {/* Photo: front-right */}
      <div style={{
        position:"absolute", right:"2%", top:"6%", width:"52%", aspectRatio:"3/4",
        background:"#f5f0e8", border:"8px solid #fff", borderBottom:"26px solid #fff",
        borderRadius:4, transform:"rotate(6deg)",
        boxShadow:"0 20px 60px rgba(0,0,0,0.76), 0 6px 16px rgba(0,0,0,0.56)",
        overflow:"hidden", zIndex:2, animation:"mem-float 6s ease-in-out 0s infinite",
      }}>
        <div style={{ width:"100%", height:"79%",
          background:"linear-gradient(140deg,#c4943a 0%,#7a4510 46%,#3f200a 100%)",
          position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", inset:0, opacity:0.48,
            background:"radial-gradient(ellipse at 60% 35%,rgba(255,200,120,0.4) 0%,transparent 70%)" }}/>
          <svg viewBox="0 0 100 100" style={{ position:"absolute", bottom:0, width:"100%", height:"60%" }}>
            {[28,50,72].map((x,i)=>(
              <g key={i}>
                <circle cx={x} cy={i===1?19:27} r={i===1?11:8} fill="rgba(22,11,4,0.78)"/>
                <rect x={x-(i===1?10:7)} y={i===1?29:34} width={i===1?20:14} height={72} rx="4" fill="rgba(15,8,3,0.68)"/>
              </g>
            ))}
          </svg>
        </div>
        <div style={{ height:"21%", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize:9, color:"#8b6914", fontFamily:"Georgia,serif", opacity:0.7 }}>Tres generaciones · 1995</span>
        </div>
      </div>

      {/* Floating icons */}
      {[
        { e:"📷", b:"22%", l:"7%",  d:"0s",   sz:36 },
        { e:"♥",  b:"46%", r:"4%",  d:"1.2s", sz:34, red:true },
        { e:"♥",  b:"18%", r:"15%", d:"0.6s", sz:26, red:true },
      ].map((ic,i)=>(
        <div key={i} style={{
          position:"absolute", bottom:ic.b, left:(ic as any).l, right:(ic as any).r,
          width:ic.sz, height:ic.sz, borderRadius:"50%",
          background:"rgba(10,8,20,0.82)", border:"1px solid rgba(212,175,55,0.22)",
          backdropFilter:"blur(8px)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:ic.sz * 0.42,
          color:(ic as any).red ? "#e06080" : "#d4af37",
          boxShadow:"0 4px 12px rgba(0,0,0,0.55)",
          animation:`cp-pulse 3s ease-in-out ${ic.d} infinite`,
          zIndex:5,
        }}>{ic.e}</div>
      ))}
    </div>
  );
}

// ── Buttons ────────────────────────────────────────────────────────────────────
function GoldBtn({ href, children }: { href:string; children:React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration:"none" }}>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:8,
        background:"#c9a820", borderTop:"2px solid #f5e060",
        borderLeft:"1.5px solid rgba(255,240,100,0.5)",
        borderBottom:"4px solid #6a5600", borderRight:"1.5px solid rgba(0,0,0,0.4)",
        boxShadow:"0 8px 0 #4a3c00, 0 14px 28px rgba(0,0,0,0.65), 0 0 24px rgba(212,175,55,0.22)",
        borderRadius:14, color:BG, fontWeight:800, fontSize:15,
        padding:"13px 28px", cursor:"pointer",
      }}>{children}</div>
    </Link>
  );
}

function AppBtn({ store }: { store:"apple"|"google" }) {
  return (
    <Link href="/instalar" style={{ textDecoration:"none" }}>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:10,
        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)",
        borderRadius:12, padding:"9px 18px", cursor:"pointer", color:"#fff",
      }}>
        <span style={{ fontSize:22, lineHeight:1 }}>{store==="apple"?"":"▶"}</span>
        <div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.48)", lineHeight:1,
            letterSpacing:"0.06em", textTransform:"uppercase" }}>
            {store==="apple"?"Descárgalo en el":"Disponible en"}
          </div>
          <div style={{ fontSize:14, fontWeight:700, lineHeight:1.3 }}>
            {store==="apple"?"App Store":"Google Play"}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Feature icons ──────────────────────────────────────────────────────────────
const G = GOLD;
function IcoTree() {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="11" r="8" stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <circle cx="10" cy="27" r="6" stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <circle cx="30" cy="27" r="6" stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <line x1="20" y1="19" x2="10" y2="22" stroke={G} strokeWidth="1.2" strokeOpacity="0.6"/>
    <line x1="20" y1="19" x2="30" y2="22" stroke={G} strokeWidth="1.2" strokeOpacity="0.6"/>
  </svg>;
}
function IcoMsg() {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <rect x="4" y="8" width="32" height="20" rx="6" stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <circle cx="13" cy="18" r="2.2" fill={G} fillOpacity="0.75"/>
    <circle cx="20" cy="18" r="2.2" fill={G} fillOpacity="0.75"/>
    <circle cx="27" cy="18" r="2.2" fill={G} fillOpacity="0.75"/>
    <path d="M16 28 L20 34 L24 28" stroke={G} strokeWidth="1.2" fill="rgba(212,175,55,0.08)" strokeOpacity="0.6"/>
  </svg>;
}
function IcoAlbum() {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <rect x="7" y="9" width="26" height="22" rx="4" stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <rect x="4" y="6" width="26" height="22" rx="4" stroke={G} strokeWidth="1" fill="rgba(212,175,55,0.05)" strokeOpacity="0.45"/>
    <circle cx="21" cy="19" r="5.5" stroke={G} strokeWidth="1.2" fill="none" strokeOpacity="0.65"/>
    <circle cx="21" cy="19" r="2.2" fill={G} fillOpacity="0.55"/>
  </svg>;
}
function IcoMap() {
  return <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
    <path d="M20 5C14.48 5 10 9.48 10 15C10 22 20 35 20 35C20 35 30 22 30 15C30 9.48 25.52 5 20 5Z"
      stroke={G} strokeWidth="1.5" fill="rgba(212,175,55,0.08)"/>
    <circle cx="20" cy="15" r="4" stroke={G} strokeWidth="1.2" fill="none" strokeOpacity="0.7"/>
  </svg>;
}

// ── Social icons ───────────────────────────────────────────────────────────────
function IcoIG()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none"/></svg>; }
function IcoFB()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>; }
function IcoYT()  {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.41 19.1C5.12 19.56 12 19.56 12 19.56s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 11.75a29 29 0 0 0-.46-5.33z"/>
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"/>
  </svg>;
}

// ── Logo ───────────────────────────────────────────────────────────────────────
function CeibaLogo() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:9 }}>
      <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
        <rect x="14" y="20" width="4" height="9" rx="2" fill={GOLD} opacity="0.82"/>
        <ellipse cx="16" cy="13" rx="10" ry="9" fill={GOLD} opacity="0.88"/>
        <ellipse cx="13" cy="10" rx="5" ry="3.5" fill="#f5e070" opacity="0.28"/>
      </svg>
      <div>
        <div style={{ fontWeight:800, fontSize:17, color:"#fff", lineHeight:1, letterSpacing:"-0.02em" }}>CEIBA</div>
        <div style={{ fontSize:8, color:GOLD_DIM, letterSpacing:"0.10em", textTransform:"uppercase", lineHeight:1.2 }}>Nuestras Raíces</div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
const FEATURES = [
  { Ico: IcoTree,  title:"Árbol Familiar",       desc:"Explora tu árbol familiar interactivo y visualiza tus conexiones de generación en generación.", href:"/tree"   },
  { Ico: IcoMsg,   title:"Historias y Mensajes",  desc:"Comparte recuerdos, anécdotas y mensajes con tus seres queridos y mantenlos vivos para siempre.", href:"/feed"   },
  { Ico: IcoAlbum, title:"Álbumes y Recuerdos",   desc:"Guarda fotos, videos y documentos importantes en álbumes privados y revívelos cuando quieras.",   href:"/photos" },
  { Ico: IcoMap,   title:"Mapas de Origen",        desc:"Descubre de dónde venimos. Explora los lugares que marcaron la historia de tu familia.",            href:"/mapa"   },
];

const NAV = [
  { href:"#",          l:"Inicio"          },
  { href:"#features",  l:"Características" },
  { href:"#memories",  l:"Historias"       },
  { href:"#sobre",     l:"Sobre nosotros"  },
];

export default function LandingPage() {
  return (
    <main style={{ minHeight:"100vh", background:BG, color:"#fff", overflowX:"hidden", position:"relative" }}>
      <StarField />
      <NebulaBg />
      <style>{`
        @keyframes cp-pulse{0%,100%{opacity:.75}50%{opacity:1}}
        .nav-lnk{color:rgba(255,255,255,0.60);font-size:13px;font-weight:500;text-decoration:none;transition:color .2s}
        .nav-lnk:hover{color:rgba(212,175,55,0.85)}
        .feat-card:hover{border-color:rgba(212,175,55,0.28)!important;transform:translateY(-2px)}
        .feat-card{transition:transform .22s,border-color .22s}
        @media(max-width:860px){.nav-links-row{display:none!important}}
        @media(min-width:860px){.hero-grid{grid-template-columns:1fr 1fr!important}.hero-txt{order:1!important}.hero-vis{order:2!important}}
        @media(min-width:860px){.mem-grid{grid-template-columns:1fr 1fr!important}}
        @media(max-width:640px){.stats-grid{grid-template-columns:repeat(2,1fr)!important}}
        .stat-sep{border-right:1px solid rgba(212,175,55,0.08)}
        @media(max-width:640px){.stat-sep:nth-child(2n){border-right:none}}
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position:"relative", zIndex:20, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"20px 32px", maxWidth:1160, margin:"0 auto" }}>
        <CeibaLogo />
        <div style={{ display:"flex", alignItems:"center", gap:32 }}>
          <div className="nav-links-row" style={{ display:"flex", gap:28 }}>
            {NAV.map(n => <Link key={n.href} href={n.href} className="nav-lnk">{n.l}</Link>)}
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <Link href="/auth/login" style={{
              fontSize:13, color:"rgba(255,255,255,0.52)", fontWeight:600, textDecoration:"none",
              padding:"8px 16px", border:"1px solid rgba(255,255,255,0.11)", borderRadius:10,
            }}>Iniciar sesión</Link>
            <Link href="/auth/register" style={{ textDecoration:"none" }}>
              <div style={{
                background:"#c9a820", borderTop:"1.5px solid #f5e060",
                borderBottom:"3px solid #6a5600", borderRadius:10,
                color:BG, fontWeight:800, fontSize:13, padding:"9px 20px",
                cursor:"pointer", whiteSpace:"nowrap",
                boxShadow:"0 4px 0 #4a3c00,0 6px 18px rgba(0,0,0,0.55)",
              }}>Comenzar ahora →</div>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:1160, margin:"0 auto",
        padding:"16px 32px 80px", display:"grid", gridTemplateColumns:"1fr", gap:48, alignItems:"center" }}
        className="hero-grid">
        <div style={{ order:2 }} className="hero-txt">
          <p style={{ fontSize:10, fontWeight:700, letterSpacing:"0.22em", textTransform:"uppercase",
            color:GOLD_DIM, marginBottom:20 }}>Tu familia. Tu legado. Para siempre.</p>
          <h1 style={{ fontWeight:900, lineHeight:1.02, letterSpacing:"-0.03em",
            fontSize:"clamp(3rem,7vw,4.8rem)", marginBottom:22 }}>
            Nuestras<br /><span style={{ color:GOLD }}>Raíces</span>
          </h1>
          <p style={{ fontSize:"clamp(14px,1.8vw,16px)", color:"rgba(255,255,255,0.46)",
            lineHeight:1.82, marginBottom:36, maxWidth:440 }}>
            CEIBA te ayuda a conectar con tu historia familiar, descubrir tus raíces y preservar lo que más importa: las personas que nos hacen quienes somos.
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
            <AppBtn store="apple" />
            <AppBtn store="google" />
          </div>
        </div>
        <div style={{ order:1 }} className="hero-vis">
          <CosmicPortal />
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section style={{ position:"relative", zIndex:10, padding:"0 32px 80px", maxWidth:1160, margin:"0 auto" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          background:CARD, border:"1px solid rgba(212,175,55,0.12)",
          borderRadius:18, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.62)" }}
          className="stats-grid">
          {[
            { e:"👥", n:"53",   l:"Personas"           },
            { e:"🌿", n:"5",    l:"Generaciones"       },
            { e:"🔗", n:"18",   l:"Conexiones"         },
            { e:"📖", n:"120+", l:"Historias guardadas" },
          ].map((s,i)=>(
            <div key={i} className="stat-sep" style={{ padding:"24px 16px", textAlign:"center" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{s.e}</div>
              <div style={{ fontSize:"clamp(1.5rem,3vw,2rem)", fontWeight:900, color:GOLD, lineHeight:1 }}>{s.n}</div>
              <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:6, letterSpacing:"0.04em" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ position:"relative", zIndex:10,
        padding:"0 32px 96px", maxWidth:1160, margin:"0 auto" }}>
        <p style={{ textAlign:"center", fontSize:9, fontWeight:700, letterSpacing:"0.22em",
          textTransform:"uppercase", color:GOLD_DIM, marginBottom:16 }}>
          Todo lo que necesitas para honrar tu historia
        </p>
        <h2 style={{ textAlign:"center", fontSize:"clamp(1.8rem,4vw,2.6rem)",
          fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.1, marginBottom:14 }}>
          Un legado que crece contigo
        </h2>
        <p style={{ textAlign:"center", fontSize:14, color:"rgba(255,255,255,0.36)",
          lineHeight:1.75, maxWidth:400, margin:"0 auto 52px" }}>
          Herramientas poderosas y fáciles de usar para conectar, compartir y preservar las historias que dan forma a tu familia.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:16 }}>
          {FEATURES.map(({Ico,title,desc,href},i)=>(
            <div key={i} className="feat-card" style={{
              borderRadius:18, background:CARD, padding:"28px 24px 24px",
              border:"1px solid rgba(212,175,55,0.10)",
              borderTop:"1px solid rgba(212,175,55,0.22)",
              boxShadow:"0 8px 24px rgba(0,0,0,0.65)", position:"relative",
              overflow:"hidden", display:"flex", flexDirection:"column",
            }}>
              <div style={{ position:"absolute", top:0, left:"22%", right:"22%", height:1,
                background:"rgba(212,175,55,0.35)" }}/>
              <div style={{ marginBottom:18 }}><Ico /></div>
              <h3 style={{ fontSize:16, fontWeight:700, color:"#fff", marginBottom:10, lineHeight:1.3 }}>{title}</h3>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.38)", lineHeight:1.72, flex:1 }}>{desc}</p>
              <Link href={href} style={{ display:"inline-flex", alignItems:"center", gap:4,
                marginTop:20, fontSize:12, fontWeight:600, color:GOLD_DIM, textDecoration:"none" }}>
                Explorar →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── MEMORIES ── */}
      <section id="memories" style={{ position:"relative", zIndex:10,
        maxWidth:1160, margin:"0 auto", padding:"0 32px 100px",
        display:"grid", gridTemplateColumns:"1fr", gap:48, alignItems:"center" }}
        className="mem-grid">
        <div style={{ order:1 }}>
          <p style={{ fontSize:9, fontWeight:700, letterSpacing:"0.22em",
            textTransform:"uppercase", color:GOLD_DIM, marginBottom:20 }}>
            Un viaje en el tiempo
          </p>
          <h2 style={{ fontSize:"clamp(1.9rem,4vw,2.8rem)", fontWeight:900,
            letterSpacing:"-0.025em", lineHeight:1.1, marginBottom:20 }}>
            Revive lo que<br />nos une
          </h2>
          <p style={{ fontSize:"clamp(14px,1.8vw,16px)", color:"rgba(255,255,255,0.42)",
            lineHeight:1.82, marginBottom:36, maxWidth:420 }}>
            Cada foto, cada historia, cada detalle cuenta. CEIBA convierte los recuerdos en un legado que tus futuras generaciones podrán valorar.
          </p>
          <Link href="/photos" style={{ textDecoration:"none" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8,
              border:`1px solid ${GOLD_DIM}`, borderRadius:12,
              padding:"11px 22px", cursor:"pointer",
              color:GOLD_DIM, fontWeight:600, fontSize:14 }}>
              Ver historias →
            </div>
          </Link>
        </div>
        <div style={{ order:2 }}>
          <MemoriesVisual />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ position:"relative", zIndex:10 }}>
        <div style={{ background:"linear-gradient(to bottom,rgba(3,2,8,0) 0%,rgba(8,5,20,0.95) 20%,rgba(4,3,10,1) 100%)",
          padding:"72px 32px 0", textAlign:"center", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:"20%", left:"50%", transform:"translateX(-50%)",
            width:640, height:220, pointerEvents:"none",
            background:"radial-gradient(ellipse,rgba(212,175,55,0.07) 0%,transparent 70%)" }}/>
          <h2 style={{ fontSize:"clamp(1.8rem,4.5vw,3.1rem)", fontWeight:900, lineHeight:1.18,
            letterSpacing:"-0.025em", maxWidth:660, margin:"0 auto 40px", position:"relative" }}>
            Guardemos hoy nuestra historia,<br />
            <span style={{ color:GOLD }}>para que mañana nos recuerden.</span>
          </h2>
          <div style={{ marginBottom:68, position:"relative" }}>
            <GoldBtn href="/auth/register">Guardar nuestra historia →</GoldBtn>
          </div>

          {/* Ceiba tree */}
          <div style={{ maxWidth:700, margin:"0 auto" }}>
            <svg viewBox="0 0 700 220" style={{ width:"100%", display:"block" }} aria-hidden>
              <defs>
                <radialGradient id="tg" cx="50%" cy="100%" r="55%">
                  <stop offset="0%"  stopColor="#d4af37" stopOpacity="0.28"/>
                  <stop offset="60%" stopColor="#8b6914" stopOpacity="0.07"/>
                  <stop offset="100%" stopColor="transparent"/>
                </radialGradient>
                <radialGradient id="tga" cx="50%" cy="40%" r="55%">
                  <stop offset="0%" stopColor="#d4af37" stopOpacity="0.16"/>
                  <stop offset="100%" stopColor="transparent"/>
                </radialGradient>
                <filter id="tb"><feGaussianBlur stdDeviation="7"/></filter>
              </defs>
              <ellipse cx="350" cy="202" rx="310" ry="38" fill="url(#tg)"/>
              <ellipse cx="350" cy="100" rx="170" ry="125" fill="url(#tga)" filter="url(#tb)"/>
              <rect x="338" y="142" width="24" height="58" rx="10" fill="#8b6914" opacity="0.58"/>
              <ellipse cx="350" cy="90" rx="125" ry="105" fill="#1a0e00" opacity="0.92"/>
              <ellipse cx="350" cy="75" rx="95"  ry="78"  fill="#3a1e00" opacity="0.85"/>
              <ellipse cx="350" cy="62" rx="68"  ry="55"  fill="#5c2e00" opacity="0.75"/>
              <ellipse cx="350" cy="52" rx="44"  ry="36"  fill="#8b4500" opacity="0.62"/>
              {[305,342,358,395,325,370,315,348,380,340,360,330,385,310,350,322,368,295,408,345,355,338,362,350].map((x,i)=>(
                <circle key={i} cx={x} cy={50+(i%6)*12} r={1.1+(i%3)*0.5} fill="#d4af37" opacity={0.14+(i%5)*0.07}/>
              ))}
              <path d="M338 192 Q310 196 280 210" stroke="#8b6914" strokeWidth="2" strokeOpacity="0.28" fill="none"/>
              <path d="M362 192 Q390 196 420 210" stroke="#8b6914" strokeWidth="2" strokeOpacity="0.28" fill="none"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="sobre" style={{ position:"relative", zIndex:10,
        background:"rgba(4,3,10,0.99)", borderTop:"1px solid rgba(212,175,55,0.08)",
        padding:"40px 32px" }}>
        <div style={{ maxWidth:1160, margin:"0 auto" }}>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center",
            justifyContent:"space-between", gap:24, marginBottom:32 }}>
            <CeibaLogo />
            <div style={{ display:"flex", flexWrap:"wrap", gap:22 }}>
              {[
                { href:"#",         l:"Inicio"          },
                { href:"#features", l:"Características" },
                { href:"#memories", l:"Historias"       },
                { href:"/instalar", l:"Blog"            },
                { href:"#sobre",    l:"Contacto"        },
              ].map(n=>(
                <Link key={n.href} href={n.href} style={{ fontSize:12,
                  color:"rgba(255,255,255,0.36)", textDecoration:"none", fontWeight:500 }}>
                  {n.l}
                </Link>
              ))}
            </div>
            <div style={{ display:"flex", gap:12 }}>
              {([IcoIG, IcoFB, IcoYT] as React.FC[]).map((Ico,i)=>(
                <Link key={i} href="#" style={{ color:"rgba(212,175,55,0.40)", display:"flex",
                  padding:7, borderRadius:8, border:"1px solid rgba(212,175,55,0.10)" }}>
                  <Ico />
                </Link>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between",
            alignItems:"center", gap:12, borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:20 }}>
            <span style={{ fontSize:11, color:"rgba(212,175,55,0.18)" }}>
              © 2024 CEIBA – Nuestras Raíces. Todos los derechos reservados.
            </span>
            <div style={{ display:"flex", gap:20 }}>
              {["Términos de servicio","Política de privacidad"].map(t=>(
                <Link key={t} href="#" style={{ fontSize:11, color:"rgba(255,255,255,0.20)", textDecoration:"none" }}>{t}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

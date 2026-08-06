"use client";
import Link from "next/link";

const GOLD   = "#d4af37";
const GOLD_L = "#f5e070";
const GOLD_D = "#8b6914";
const BG     = "#030208";
const CARD   = "#0c0a18";

// ── Shared style helpers ───────────────────────────────────────────────────────
const S = {
  gold:  { color: GOLD  } as React.CSSProperties,
  muted: { color: "rgba(255,255,255,0.45)" } as React.CSSProperties,
  eyebrow: {
    fontSize: 10, fontWeight: 700, letterSpacing: "0.22em",
    textTransform: "uppercase" as const, color: "rgba(212,175,55,0.55)",
    marginBottom: 14,
  } as React.CSSProperties,
};

// ── Background ─────────────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 100 }, (_, i) => ({
    cx: ((i * 137.5) % 100).toFixed(1),
    cy: ((i * 97.3)  % 100).toFixed(1),
    r:  (0.35 + (i % 5) * 0.16).toFixed(2),
    op: (0.10 + (i % 9) * 0.055).toFixed(2),
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
      <div style={{ position:"absolute", top:"-8%", left:"10%", width:650, height:550,
        background:"radial-gradient(ellipse, rgba(30,14,70,0.40) 0%, transparent 70%)", filter:"blur(80px)" }}/>
      <div style={{ position:"absolute", top:"35%", right:"-8%", width:450, height:450,
        background:"radial-gradient(ellipse, rgba(120,70,10,0.18) 0%, transparent 70%)", filter:"blur(65px)" }}/>
      <div style={{ position:"absolute", bottom:"8%", left:"-5%", width:400, height:400,
        background:"radial-gradient(ellipse, rgba(50,18,90,0.22) 0%, transparent 70%)", filter:"blur(70px)" }}/>
    </div>
  );
}

// ── Logo ───────────────────────────────────────────────────────────────────────
function CeibaLogo({ small }: { small?: boolean }) {
  const sz = small ? 24 : 30;
  return (
    <div style={{ display:"flex", alignItems:"center", gap: small ? 7 : 9 }}>
      <svg width={sz} height={sz} viewBox="0 0 32 32" fill="none">
        <rect x="13.5" y="21" width="5" height="8" rx="2.5" fill={GOLD} opacity="0.75"/>
        <ellipse cx="16" cy="13.5" rx="11" ry="9.5" fill={GOLD} opacity="0.85"/>
        <ellipse cx="13" cy="10.5" rx="5.5" ry="3.5" fill={GOLD_L} opacity="0.22"/>
        {/* roots */}
        <path d="M14.5 29 Q10 30 6 32" stroke={GOLD} strokeWidth="1" strokeOpacity="0.28" fill="none"/>
        <path d="M17.5 29 Q22 30 26 32" stroke={GOLD} strokeWidth="1" strokeOpacity="0.28" fill="none"/>
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

// ── CosmicPortal ───────────────────────────────────────────────────────────────
const PORTAL_AVATARS = [
  { angle:318, init:"R", color:"#E8784A" },
  { angle: 22, init:"C", color:"#F2B43C" },
  { angle: 82, init:"A", color:"#D46090" },
  { angle:148, init:"H", color:"#5AAEE0" },
  { angle:213, init:"L", color:"#4ABA8A" },
  { angle:272, init:"M", color:"#9A88DA" },
];

function CosmicPortal() {
  const R=188, CX=270, CY=252;
  const avs = PORTAL_AVATARS.map(a => {
    const rad = a.angle * Math.PI / 180;
    return { ...a, x: CX + R * Math.sin(rad), y: CY - R * Math.cos(rad) };
  });
  return (
    <svg viewBox="0 0 540 510" style={{ width:"100%", maxWidth:580, display:"block" }} aria-hidden>
      <defs>
        <filter id="gl8"><feGaussianBlur stdDeviation="10"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gl4"><feGaussianBlur stdDeviation="4" /><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="gl2"><feGaussianBlur stdDeviation="2" /></filter>
        <radialGradient id="portalIn" cx="50%" cy="40%" r="60%">
          <stop offset="0%"   stopColor="#1a0a00" stopOpacity="0.92"/>
          <stop offset="45%"  stopColor="#07040f" stopOpacity="0.97"/>
          <stop offset="100%" stopColor={BG}      stopOpacity="1"/>
        </radialGradient>
        <radialGradient id="portalNeb" cx="50%" cy="72%" r="55%">
          <stop offset="0%"   stopColor="#d07030" stopOpacity="0.32"/>
          <stop offset="48%"  stopColor="#7a3a10" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <radialGradient id="groundGlow" cx="50%" cy="100%" r="50%">
          <stop offset="0%"  stopColor="#d4af37" stopOpacity="0.35"/>
          <stop offset="70%" stopColor="transparent"/>
        </radialGradient>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor={GOLD_L} stopOpacity="0.98"/>
          <stop offset="30%"  stopColor={GOLD}   stopOpacity="0.88"/>
          <stop offset="62%"  stopColor={GOLD_D} stopOpacity="0.52"/>
          <stop offset="85%"  stopColor={GOLD}   stopOpacity="0.85"/>
          <stop offset="100%" stopColor={GOLD_L} stopOpacity="0.96"/>
        </linearGradient>
        <style>{`
          @keyframes cp-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
          @keyframes cp-rspin{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
          @keyframes cp-pulse{0%,100%{opacity:.7}50%{opacity:1}}
          .cp-ring{animation:cp-spin 82s linear infinite;transform-origin:${CX}px ${CY}px}
          .cp-inner{animation:cp-rspin 54s linear infinite;transform-origin:${CX}px ${CY}px}
          .cp-av{animation:cp-pulse 3.8s ease-in-out infinite}
        `}</style>
      </defs>

      {/* Outer halo */}
      <ellipse cx={CX} cy={CY} rx={230} ry={215} fill="#2510a0" opacity="0.06" filter="url(#gl8)"/>

      {/* Connection lines avatar → ring */}
      {avs.map((a,i)=>{
        const r2 = a.angle * Math.PI / 180;
        const ix = CX + (R-2)*Math.sin(r2), iy = CY - (R-2)*Math.cos(r2);
        const ox = CX + (R+36)*Math.sin(r2), oy = CY - (R+36)*Math.cos(r2);
        return <line key={i} x1={ix} y1={iy} x2={ox} y2={oy}
          stroke={a.color} strokeWidth="1.2" strokeOpacity="0.45"/>;
      })}

      {/* Ring glow */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke={GOLD} strokeWidth="7" strokeOpacity="0.12" filter="url(#gl8)"/>

      {/* Portal fill */}
      <circle cx={CX} cy={CY} r={R-1} fill="url(#portalIn)"/>
      <circle cx={CX} cy={CY} r={R-1} fill="url(#portalNeb)"/>

      {/* Ground light beam */}
      <ellipse cx={CX} cy={440} rx={140} ry={32} fill="url(#groundGlow)" filter="url(#gl4)"/>
      <ellipse cx={CX} cy={420} rx={100} ry={20} fill="#c87030" opacity="0.22" filter="url(#gl4)"/>

      {/* Family silhouettes */}
      {[
        [CX-62, 358, 8,  42],
        [CX-30, 337, 10, 54],
        [CX,    318, 12, 64],
        [CX+30, 337, 10, 54],
        [CX+62, 358, 8,  42],
      ].map(([x,hy,hr,ph],i)=>(
        <g key={i}>
          <circle cx={x} cy={hy} r={hr} fill="rgba(3,2,8,0.96)"/>
          <path d={`M${x-(hr*1.4)},${hy+hr+2} Q${x-(hr*1.7)},${hy+hr+ph*0.4} ${x-(hr*1.9)},${hy+hr+ph} L${x+(hr*1.9)},${hy+hr+ph} Q${x+(hr*1.7)},${hy+hr+ph*0.4} ${x+(hr*1.4)},${hy+hr+2} Z`}
            fill="rgba(3,2,8,0.90)"/>
        </g>
      ))}

      {/* Spinning ring */}
      <g className="cp-ring">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="url(#ringGrad)" strokeWidth="2.8"/>
        {[0,45,90,135,180,225,270,315].map((ang,i)=>{
          const r2=ang*Math.PI/180;
          return <circle key={i}
            cx={CX+R*Math.sin(r2)} cy={CY-R*Math.cos(r2)}
            r={i%2===0?3:1.8}
            fill={i%2===0?GOLD_L:GOLD} opacity={i%2===0?0.9:0.55}
            filter={i%2===0?"url(#gl2)":undefined}/>;
        })}
      </g>

      {/* Inner dashed ring */}
      <g className="cp-inner">
        <circle cx={CX} cy={CY} r={R-16} fill="none" stroke={GOLD} strokeWidth="0.6"
          strokeOpacity="0.18" strokeDasharray="9,18"/>
      </g>

      {/* Avatar circles */}
      {avs.map((a,i)=>(
        <g key={i} className="cp-av" style={{ animationDelay:`${i*0.6}s` }}>
          {/* Photo frame outer glow */}
          <circle cx={a.x} cy={a.y} r={30} fill="none" stroke={a.color}
            strokeWidth="1" strokeOpacity="0.22"/>
          {/* Photo circle bg */}
          <circle cx={a.x} cy={a.y} r={24} fill={CARD} stroke={a.color}
            strokeWidth="2" strokeOpacity="0.75"/>
          {/* Inner highlight arc */}
          <circle cx={a.x} cy={a.y} r={20} fill="none" stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"/>
          {/* Initial */}
          <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central"
            fontSize="13" fontWeight="800" fill={a.color} fontFamily="system-ui,-apple-system">{a.init}</text>
          {/* Specular */}
          <ellipse cx={a.x-7} cy={a.y-7} rx="5" ry="3" fill="white" opacity="0.12"/>
        </g>
      ))}
    </svg>
  );
}

// ── App Store Buttons ──────────────────────────────────────────────────────────
function AppBtn({ store }: { store:"apple"|"google" }) {
  return (
    <Link href="/instalar" style={{ textDecoration:"none" }}>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:8,
        background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.14)",
        borderRadius:12, padding:"9px 14px", cursor:"pointer", color:"#fff",
        flex:"1 1 0", minWidth:0,
      }}>
        {store==="apple"
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M3.18 23.76a2 2 0 0 0 2.07-.21l11.58-6.59L13.76 14l-10.58 9.76zm-1.1-20.4A2 2 0 0 0 2 5v14a2 2 0 0 0 .09 1.63l.08.08 7.86-7.86v-.19L2.08 3.36zm18.1 8.45-2.56-1.46-3.05 3.04 3.05 3.04 2.58-1.47a2 2 0 0 0 0-3.15zm-15.05 9.3 10.08-5.74-3.03-3.03-7.05 8.77z"/></svg>
        }
        <div>
          <div style={{ fontSize:9, color:"rgba(255,255,255,0.45)", letterSpacing:"0.06em",
            textTransform:"uppercase", lineHeight:1 }}>
            {store==="apple"?"Descárgalo en el":"Disponible en"}
          </div>
          <div style={{ fontSize:15, fontWeight:700, lineHeight:1.35 }}>
            {store==="apple"?"App Store":"Google Play"}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Feature icons ──────────────────────────────────────────────────────────────
function IcoTree() {
  return <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M22 4 Q14 10 10 17 Q6 24 10 28 Q14 32 20 31 L20 38 L24 38 L24 31 Q30 32 34 28 Q38 24 34 17 Q30 10 22 4Z"
      stroke={GOLD} strokeWidth="1.5" fill="rgba(212,175,55,0.07)"/>
    <path d="M22 15 Q16 19 14 24 Q16 28 22 27 Q28 28 30 24 Q28 19 22 15Z"
      stroke={GOLD} strokeWidth="1" fill="rgba(212,175,55,0.10)" strokeOpacity="0.6"/>
    <line x1="22" y1="27" x2="22" y2="38" stroke={GOLD} strokeWidth="1.5" strokeOpacity="0.5"/>
    <line x1="18" y1="33" x2="22" y2="30" stroke={GOLD} strokeWidth="1" strokeOpacity="0.35"/>
    <line x1="26" y1="33" x2="22" y2="30" stroke={GOLD} strokeWidth="1" strokeOpacity="0.35"/>
  </svg>;
}
function IcoMsg() {
  return <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M6 10 Q6 7 9 7 L35 7 Q38 7 38 10 L38 26 Q38 29 35 29 L16 29 L10 37 L10 29 L9 29 Q6 29 6 26 Z"
      stroke={GOLD} strokeWidth="1.5" fill="rgba(212,175,55,0.07)"/>
    <circle cx="15" cy="18" r="2.2" fill={GOLD} opacity="0.7"/>
    <circle cx="22" cy="18" r="2.2" fill={GOLD} opacity="0.7"/>
    <circle cx="29" cy="18" r="2.2" fill={GOLD} opacity="0.7"/>
  </svg>;
}
function IcoAlbum() {
  return <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <rect x="7" y="10" width="30" height="24" rx="4" stroke={GOLD} strokeWidth="1.5" fill="rgba(212,175,55,0.07)"/>
    <rect x="4" y="7" width="30" height="24" rx="4" stroke={GOLD} strokeWidth="1" fill="rgba(212,175,55,0.04)" strokeOpacity="0.4"/>
    <circle cx="23" cy="21" r="6" stroke={GOLD} strokeWidth="1.2" fill="none" strokeOpacity="0.65"/>
    <circle cx="23" cy="21" r="2.5" fill={GOLD} opacity="0.55"/>
    <path d="M23 15 L23 17 M30 21 L28 21 M23 27 L23 25 M16 21 L18 21"
      stroke={GOLD} strokeWidth="1" strokeOpacity="0.35" strokeLinecap="round"/>
  </svg>;
}
function IcoMap() {
  return <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
    <path d="M22 5 C15 5 10 10.5 10 17 C10 25 22 40 22 40 C22 40 34 25 34 17 C34 10.5 29 5 22 5Z"
      stroke={GOLD} strokeWidth="1.5" fill="rgba(212,175,55,0.07)"/>
    <circle cx="22" cy="17" r="5" stroke={GOLD} strokeWidth="1.2" fill="none" strokeOpacity="0.7"/>
    <circle cx="22" cy="17" r="2" fill={GOLD} opacity="0.6"/>
    {/* Horizon lines */}
    <path d="M6 38 Q14 34 22 35 Q30 36 38 32" stroke={GOLD} strokeWidth="0.8"
      strokeOpacity="0.25" fill="none"/>
  </svg>;
}

// ── Glowing book (Memories visual) ────────────────────────────────────────────
function MemoriesVisual() {
  return (
    <div style={{ position:"relative", width:"100%", maxWidth:500, margin:"0 auto",
      height:340, minHeight:280 }}>
      <style>{`
        @keyframes bk-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes bk-glow{0%,100%{opacity:.65}50%{opacity:1}}
      `}</style>

      {/* Glow burst from book */}
      <div style={{
        position:"absolute", bottom:"8%", left:"50%", transform:"translateX(-50%)",
        width:360, height:200,
        background:"radial-gradient(ellipse at center bottom, rgba(212,175,55,0.55) 0%, rgba(180,90,20,0.22) 45%, transparent 72%)",
        filter:"blur(32px)", pointerEvents:"none",
        animation:"bk-glow 4s ease-in-out infinite",
      }}/>

      {/* Book SVG */}
      <svg viewBox="0 0 500 300" style={{ position:"absolute", bottom:0, width:"100%", animation:"bk-float 6s ease-in-out infinite" }} aria-hidden>
        <defs>
          <radialGradient id="bk-g1" cx="50%" cy="90%" r="70%">
            <stop offset="0%"  stopColor="#d4af37" stopOpacity="0.45"/>
            <stop offset="60%" stopColor="#8b5a00" stopOpacity="0.10"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <linearGradient id="bk-cover" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#5c3a10"/>
            <stop offset="100%" stopColor="#2a1504"/>
          </linearGradient>
          <linearGradient id="bk-page" x1="0%" y1="0%" x2="30%" y2="100%">
            <stop offset="0%"   stopColor="#f5e8c0" stopOpacity="0.95"/>
            <stop offset="100%" stopColor="#c8a870" stopOpacity="0.80"/>
          </linearGradient>
        </defs>

        {/* Ground glow */}
        <ellipse cx="250" cy="285" rx="210" ry="28" fill="url(#bk-g1)"/>

        {/* Left cover */}
        <path d="M100 240 L100 100 Q102 88 114 85 L240 75 L240 215 Z"
          fill="url(#bk-cover)" stroke="#8b5a00" strokeWidth="1.5"/>
        {/* Left pages */}
        <path d="M240 215 L240 75 L120 82 L110 225 Z"
          fill="url(#bk-page)" opacity="0.45"/>
        {/* Right pages */}
        <path d="M260 215 L260 75 L380 82 L390 225 Z"
          fill="url(#bk-page)" opacity="0.45"/>
        {/* Right cover */}
        <path d="M400 240 L400 100 Q398 88 386 85 L260 75 L260 215 Z"
          fill="url(#bk-cover)" stroke="#8b5a00" strokeWidth="1.5"/>
        {/* Spine / center crease */}
        <path d="M240 215 Q250 220 260 215 L260 75 Q250 68 240 75 Z"
          fill="#1a0c02" stroke="#d4af37" strokeWidth="0.8" strokeOpacity="0.5"/>

        {/* Light rays from pages */}
        {[-40,-20,0,20,40].map((ang,i)=>(
          <path key={i}
            d={`M250 100 L${250+Math.sin(ang*Math.PI/180)*280} ${100-Math.cos(ang*Math.PI/180)*260}`}
            stroke={GOLD} strokeWidth={2-i*0.1} strokeOpacity={0.06+i*0.01} fill="none"/>
        ))}

        {/* Left polaroid photo */}
        <g transform="translate(130,55) rotate(-12)">
          <rect width="80" height="70" rx="3" fill="#f5f0e8" stroke="#e0d0b0" strokeWidth="1.5"/>
          <rect x="5" y="5" width="70" height="52" rx="2" fill="#3a1e08"/>
          <rect x="5" y="5" width="70" height="52" rx="2"
            fill="url(#bk-cover)" opacity="0.7"/>
          {/* tiny silhouettes */}
          {[20,35,52].map((x,i)=>(<g key={i}>
            <circle cx={x} cy={26} r={i===1?5:4} fill="rgba(3,2,8,0.7)"/>
            <rect x={x-(i===1?5:4)} y={31} width={i===1?10:8} height={24} rx="3" fill="rgba(3,2,8,0.65)"/>
          </g>))}
          <text x="40" y="65" textAnchor="middle" fontSize="6" fill="#8b6914" fontFamily="Georgia,serif" opacity="0.7">Familia · 1978</text>
        </g>

        {/* Right polaroid photo */}
        <g transform="translate(290,45) rotate(9)">
          <rect width="88" height="76" rx="3" fill="#fff" stroke="#e0d0b0" strokeWidth="1.5"/>
          <rect x="5" y="5" width="78" height="58" rx="2" fill="#5c2e0a"/>
          <rect x="5" y="5" width="78" height="58" rx="2"
            fill="url(#bk-cover)" opacity="0.65"/>
          {[22,44,66].map((x,i)=>(<g key={i}>
            <circle cx={x} cy={28} r={i===1?6:4.5} fill="rgba(3,2,8,0.7)"/>
            <rect x={x-(i===1?6:4.5)} y={34} width={i===1?12:9} height={28} rx="3" fill="rgba(3,2,8,0.65)"/>
          </g>))}
          <text x="44" y="71" textAnchor="middle" fontSize="6" fill="#8b6914" fontFamily="Georgia,serif" opacity="0.7">Tres generaciones</text>
        </g>
      </svg>

      {/* Floating icons */}
      {[
        { e:"📷", b:160, l:"12%", d:"0.8s" },
        { e:"♥",  b:200, r:"8%",  d:"0s",   red:true },
        { e:"♥",  b:80,  r:"22%", d:"1.5s", red:true },
      ].map((ic,i)=>(
        <div key={i} style={{
          position:"absolute",
          bottom: ic.b, left:(ic as any).l, right:(ic as any).r,
          width:36, height:36, borderRadius:"50%",
          background:"rgba(10,8,20,0.80)", border:"1px solid rgba(212,175,55,0.20)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:15,
          color:(ic as any).red?"#e06080":GOLD,
          boxShadow:"0 4px 12px rgba(0,0,0,0.55)",
          animation:`bk-glow 3.2s ease-in-out ${ic.d} infinite`,
        }}>{ic.e}</div>
      ))}
    </div>
  );
}

// ── Glowing tree (CTA) ────────────────────────────────────────────────────────
function GlowingTree() {
  return (
    <div style={{ position:"relative", width:"100%", maxWidth:440, margin:"0 auto" }}>
      <style>{`@keyframes tr-glow{0%,100%{opacity:.78}50%{opacity:1}}`}</style>
      {/* Ground glow pool */}
      <div style={{
        position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)",
        width:380, height:130,
        background:"radial-gradient(ellipse at center bottom, rgba(212,175,55,0.55) 0%, rgba(160,80,10,0.22) 48%, transparent 72%)",
        filter:"blur(26px)", animation:"tr-glow 4.5s ease-in-out infinite",
      }}/>
      <svg viewBox="0 0 420 480" style={{ width:"100%", display:"block", position:"relative" }} aria-hidden>
        <defs>
          <radialGradient id="tr-atm" cx="50%" cy="52%" r="55%">
            <stop offset="0%"  stopColor="#d4af37" stopOpacity="0.28"/>
            <stop offset="55%" stopColor="#8b5a00" stopOpacity="0.09"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <radialGradient id="tr-core" cx="50%" cy="50%" r="45%">
            <stop offset="0%"  stopColor="#f5d060" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <filter id="tr-b12"><feGaussianBlur stdDeviation="12"/></filter>
          <filter id="tr-b6"><feGaussianBlur stdDeviation="6"/></filter>
          <filter id="tr-b3"><feGaussianBlur stdDeviation="3"/></filter>
          <filter id="tr-b1"><feGaussianBlur stdDeviation="1.2"/></filter>
        </defs>

        {/* Atmospheric glow behind canopy */}
        <ellipse cx="210" cy="195" rx="175" ry="148" fill="url(#tr-atm)" filter="url(#tr-b12)"/>
        <ellipse cx="210" cy="210" rx="110" ry="96"  fill="url(#tr-core)" filter="url(#tr-b6)"/>

        {/* ── TRUNK ── */}
        <path d="M198 455 Q196 390 194 340 Q192 300 196 258 Q198 238 205 222 L215 222 Q222 238 224 258 Q228 300 226 340 Q224 390 222 455 Z"
          fill="#3a1e08" stroke="#7a4810" strokeWidth="1.2"/>
        {/* trunk highlight */}
        <path d="M203 450 Q202 392 201 342 Q200 306 204 265 L208 232 L212 265 Q216 306 215 342 Q214 392 213 450 Z"
          fill="#a06820" opacity="0.38"/>

        {/* ── ROOTS ── */}
        {[
          { d:"M200 435 Q175 445 148 455 Q125 462 100 468", w:2.2, o:0.50 },
          { d:"M220 435 Q245 445 272 455 Q295 462 320 468", w:2.2, o:0.50 },
          { d:"M200 445 Q185 462 168 475",                  w:1.6, o:0.38 },
          { d:"M220 445 Q235 462 252 475",                  w:1.6, o:0.38 },
          { d:"M205 440 Q190 460 178 478",                  w:1.2, o:0.28 },
          { d:"M215 440 Q230 460 242 478",                  w:1.2, o:0.28 },
        ].map((r,i)=><path key={i} d={r.d} stroke={GOLD} strokeWidth={r.w} strokeOpacity={r.o} fill="none" strokeLinecap="round"/>)}
        {/* root glow */}
        {["M200 435 Q175 445 148 455","M220 435 Q245 445 272 455"].map((d,i)=>(
          <path key={i} d={d} stroke={GOLD_L} strokeWidth="5" strokeOpacity="0.12" fill="none" filter="url(#tr-b6)"/>
        ))}

        {/* ── MAIN BRANCHES ── */}
        {[
          { d:"M210 222 Q182 188 152 155 Q128 128 98 108",   w:3.2 },
          { d:"M210 222 Q238 188 268 155 Q292 128 322 108",  w:3.2 },
          { d:"M208 232 Q188 206 162 178 Q148 162 132 148",  w:2.6 },
          { d:"M212 232 Q232 206 258 178 Q272 162 288 148",  w:2.6 },
          { d:"M207 245 Q192 220 175 195 Q164 178 153 162",  w:2.0 },
          { d:"M213 245 Q228 220 245 195 Q256 178 267 162",  w:2.0 },
          { d:"M208 222 Q204 192 200 162 Q197 138 194 114",  w:2.2 },
          { d:"M212 222 Q216 192 220 162 Q223 138 226 114",  w:2.2 },
          { d:"M205 258 Q196 235 190 210 Q185 192 182 172",  w:1.6 },
          { d:"M215 258 Q224 235 230 210 Q235 192 238 172",  w:1.6 },
        ].map((b,i)=>(
          <path key={i} d={b.d} stroke={GOLD} strokeWidth={b.w}
            strokeOpacity={0.60-i*0.022} fill="none" strokeLinecap="round"/>
        ))}
        {/* branch glow on main two */}
        {[
          "M210 222 Q182 188 152 155 Q128 128 98 108",
          "M210 222 Q238 188 268 155 Q292 128 322 108",
          "M208 222 Q204 192 200 162 Q197 138 194 114",
        ].map((d,i)=>(
          <path key={i} d={d} stroke={GOLD_L} strokeWidth="6" strokeOpacity="0.10" fill="none" filter="url(#tr-b6)"/>
        ))}

        {/* ── LEAF CLUSTERS (canopy) ── */}
        {[
          [98,104,32],[322,104,32],[134,148,26],[286,148,26],
          [155,165,22],[265,165,22],[182,116,20],[238,116,20],
          [210,92,28],[165,88,18],[255,88,18],
          [192,72,16],[228,72,16],[210,58,22],
          [145,136,16],[275,136,16],
        ].map(([cx,cy,r],i)=>(
          <g key={i}>
            <circle cx={cx} cy={cy} r={r+8} fill="#c87a20" opacity="0.055" filter="url(#tr-b6)"/>
            <circle cx={cx} cy={cy} r={r+2} fill="#d4af37" opacity="0.08"  filter="url(#tr-b3)"/>
            <circle cx={cx} cy={cy} r={r}   fill="#a06010" opacity="0.16"/>
            <circle cx={cx} cy={cy} r={r-5} fill="#d4af37" opacity="0.12"/>
          </g>
        ))}

        {/* ── SPARKLE DOTS ── */}
        {[
          [100,106,2.4],[320,106,2.4],[136,150,2.0],[284,150,2.0],
          [157,167,1.8],[263,167,1.8],[184,118,1.8],[236,118,1.8],
          [210,90,2.6],[166,90,1.6],[254,90,1.6],[210,56,2.2],
          [192,74,1.4],[228,74,1.4],[145,138,1.4],[275,138,1.4],
          [170,130,1.2],[250,130,1.2],[120,124,1.2],[300,124,1.2],
        ].map(([x,y,r],i)=>(
          <circle key={i} cx={x} cy={y} r={r}
            fill={i%3===0?GOLD_L:GOLD}
            opacity={i%3===0?0.88:0.55}
            filter={i%3===0?"url(#tr-b1)":undefined}/>
        ))}
      </svg>
    </div>
  );
}

// ── Primary button ─────────────────────────────────────────────────────────────
function GoldBtn({ href, children }: { href:string; children:React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration:"none", display:"inline-block" }}>
      <div style={{
        display:"inline-flex", alignItems:"center", gap:10,
        background:"linear-gradient(to bottom, #e0bc2a 0%, #c09810 100%)",
        borderTop:"1.5px solid #f5e060", borderLeft:"1.5px solid rgba(255,240,100,0.40)",
        borderBottom:"4px solid #6a5200", borderRight:"1.5px solid rgba(0,0,0,0.35)",
        boxShadow:"0 8px 0 #3d3000, 0 14px 32px rgba(0,0,0,0.65), 0 0 28px rgba(212,175,55,0.20)",
        borderRadius:14, color:BG, fontWeight:800, fontSize:15,
        padding:"14px 32px", cursor:"pointer", whiteSpace:"nowrap",
      }}>{children}</div>
    </Link>
  );
}

// ── Social icons ───────────────────────────────────────────────────────────────
function IcoIG() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4.5"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>; }
function IcoFB() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>; }
function IcoYT() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.97C18.88 4 12 4 12 4s-6.88 0-8.59.45A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.41 19.1C5.12 19.56 12 19.56 12 19.56s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.97A29 29 0 0 0 23 11.75a29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none"/></svg>; }

// ── Feature card ───────────────────────────────────────────────────────────────
const FEATURES = [
  { Ico:IcoTree,  t:"Árbol Familiar",      d:"Explora tu árbol familiar interactivo y visualiza tus conexiones de generación en generación.",     href:"/tree"   },
  { Ico:IcoMsg,   t:"Historias y Mensajes", d:"Comparte recuerdos, anécdotas y mensajes con tus seres queridos y mantenlos vivos para siempre.",   href:"/feed"   },
  { Ico:IcoAlbum, t:"Álbumes y Recuerdos", d:"Guarda fotos, videos y documentos importantes en álbumes privados y revívelos cuando quieras.",     href:"/photos" },
  { Ico:IcoMap,   t:"Mapas de Origen",     d:"Descubre de dónde venimos. Explora los lugares que marcaron la historia de tu familia.",             href:"/mapa"   },
];

// ── Page ───────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main style={{ minHeight:"100vh", background:BG, color:"#fff", overflowX:"hidden", position:"relative" }}>
      <StarField/><NebulaBg/>

      <style>{`
        @keyframes bk-glow{0%,100%{opacity:.65}50%{opacity:1}}
        .nav-lnk{color:rgba(255,255,255,0.55);font-size:13px;font-weight:500;text-decoration:none;transition:color .2s}
        .nav-lnk:hover{color:rgba(212,175,55,0.85)}
        .nav-lnk.active{color:#fff;border-bottom:2px solid ${GOLD};padding-bottom:2px}
        .fc:hover{border-color:rgba(212,175,55,0.30)!important;transform:translateY(-3px)}
        .fc{transition:transform .22s,border-color .22s}
        /* ─ Mobile ─ */
        @media(max-width:860px){.nav-links{display:none!important}}
        @media(max-width:700px){
          .hero-g{grid-template-columns:1fr!important}
          .mem-g{grid-template-columns:1fr!important}
          .cta-g{grid-template-columns:1fr!important}
          .feat-g{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:540px){
          .nav-login{display:none!important}
          .feat-g{grid-template-columns:1fr!important}
          .px-section{padding-left:18px!important;padding-right:18px!important}
          .nav-wrap{padding:14px 18px!important}
          .stats-g{grid-template-columns:repeat(2,1fr)!important}
          .stat-sep:nth-child(2n){border-right:none!important}
        }
      `}</style>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{ position:"relative", zIndex:20, display:"flex", alignItems:"center",
        justifyContent:"space-between", padding:"18px 40px", maxWidth:1200, margin:"0 auto" }}
        className="nav-wrap px-section">
        <CeibaLogo/>
        <div className="nav-links" style={{ display:"flex", gap:30 }}>
          {["Inicio","Características","Historias","Sobre nosotros"].map((l,i)=>(
            <Link key={l} href={i===0?"#":i===1?"#features":i===2?"#memories":"#sobre"}
              className={`nav-lnk${i===0?" active":""}`}>{l}</Link>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Link href="/auth/login" className="nav-login" style={{
            fontSize:13, color:"rgba(255,255,255,0.55)", fontWeight:600, textDecoration:"none",
            padding:"8px 18px", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10,
            whiteSpace:"nowrap",
          }}>Iniciar sesión</Link>
          <Link href="/auth/register" style={{ textDecoration:"none" }}>
            <div style={{
              display:"inline-flex", alignItems:"center", gap:6,
              background:"linear-gradient(to bottom, #e0bc2a 0%, #c09810 100%)",
              borderTop:"1.5px solid #f5e060", borderBottom:"3px solid #6a5200",
              borderRadius:10, color:BG, fontWeight:800, fontSize:13,
              padding:"9px 20px", cursor:"pointer", whiteSpace:"nowrap",
              boxShadow:"0 4px 0 #3d3000, 0 6px 18px rgba(0,0,0,0.55)",
            }}>Comenzar ahora <span style={{ fontSize:14 }}>›</span></div>
          </Link>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:1200, margin:"0 auto",
        padding:"20px 40px 72px", display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:32, alignItems:"center" }}
        className="hero-g px-section">

        <div>
          <p style={S.eyebrow}>Tu familia. Tu legado. Para siempre.</p>
          <h1 style={{ fontWeight:900, lineHeight:1.0, letterSpacing:"-0.03em",
            fontSize:"clamp(3.2rem,7vw,5rem)", marginBottom:20 }}>
            Nuestras<br/><span style={S.gold}>Raíces</span>
          </h1>
          <p style={{ ...S.muted, fontSize:"clamp(14px,1.7vw,16px)", lineHeight:1.85,
            marginBottom:36, maxWidth:430 }}>
            CEIBA te ayuda a conectar con tu historia familiar, descubrir tus raíces
            y preservar lo que más importa: las personas que nos hacen quienes somos.
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            <AppBtn store="apple"/>
            <AppBtn store="google"/>
          </div>
        </div>

        <div style={{ display:"flex", justifyContent:"center" }}>
          <CosmicPortal/>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, maxWidth:1200, margin:"0 auto",
        padding:"0 40px 72px" }} className="px-section">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)",
          background:CARD, border:"1px solid rgba(212,175,55,0.12)",
          borderTop:"1px solid rgba(212,175,55,0.25)",
          borderRadius:18, overflow:"hidden",
          boxShadow:"0 8px 40px rgba(0,0,0,0.65)" }}
          className="stats-g">
          {[
            { e:"👥", n:"53",   l:"Personas"            },
            { e:"🌿", n:"5",    l:"Generaciones"        },
            { e:"🔗", n:"18",   l:"Conexiones"          },
            { e:"📖", n:"120+", l:"Historias guardadas"  },
          ].map((s,i)=>(
            <div key={i} className="stat-sep" style={{
              padding:"22px 16px", display:"flex", alignItems:"center", gap:14,
              borderRight:"1px solid rgba(212,175,55,0.07)",
            }}>
              <span style={{ fontSize:26, flexShrink:0 }}>{s.e}</span>
              <div>
                <div style={{ fontSize:"clamp(1.6rem,2.8vw,2.2rem)", fontWeight:900,
                  color:GOLD, lineHeight:1 }}>{s.n}</div>
                <div style={{ fontSize:11, ...S.muted, marginTop:4,
                  letterSpacing:"0.03em" }}>{s.l}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section id="features" style={{ position:"relative", zIndex:10, maxWidth:1200,
        margin:"0 auto", padding:"0 40px 88px" }} className="px-section">
        <p style={{ textAlign:"center", ...S.eyebrow, marginBottom:14 }}>
          Todo lo que necesitas para honrar tu historia
        </p>
        <h2 style={{ textAlign:"center", fontSize:"clamp(1.8rem,4vw,2.8rem)",
          fontWeight:900, letterSpacing:"-0.025em", lineHeight:1.1, marginBottom:12 }}>
          Un legado que crece contigo
        </h2>
        <p style={{ textAlign:"center", ...S.muted, fontSize:14, lineHeight:1.75,
          maxWidth:440, margin:"0 auto 52px" }}>
          Herramientas poderosas y fáciles de usar para conectar,
          compartir y preservar las historias que dan forma a tu familia.
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14 }}
          className="feat-g">
          {FEATURES.map(({Ico,t,d,href},i)=>(
            <div key={i} className="fc" style={{
              borderRadius:16, background:CARD, padding:"26px 20px 22px",
              border:"1px solid rgba(212,175,55,0.10)",
              borderTop:"1px solid rgba(212,175,55,0.22)",
              boxShadow:"0 6px 24px rgba(0,0,0,0.65)", position:"relative",
              display:"flex", flexDirection:"column",
            }}>
              <div style={{ position:"absolute", top:0, left:"18%", right:"18%", height:1,
                background:"rgba(212,175,55,0.30)" }}/>
              <div style={{ marginBottom:16 }}><Ico/></div>
              <h3 style={{ fontSize:15, fontWeight:700, marginBottom:10, lineHeight:1.3 }}>{t}</h3>
              <p style={{ fontSize:13, ...S.muted, lineHeight:1.72, flex:1 }}>{d}</p>
              <Link href={href} style={{ display:"inline-flex", alignItems:"center", gap:5,
                marginTop:18, fontSize:12, fontWeight:600, color:"rgba(212,175,55,0.60)",
                textDecoration:"none" }}>
                Explorar <span style={{ fontSize:14 }}>›</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── MEMORIES ─────────────────────────────────────── */}
      <section id="memories" style={{ position:"relative", zIndex:10, maxWidth:1200,
        margin:"0 auto", padding:"0 40px 88px",
        display:"grid", gridTemplateColumns:"1fr 1fr",
        gap:48, alignItems:"center" }}
        className="mem-g px-section">

        <div>
          <p style={S.eyebrow}>Un viaje en el tiempo</p>
          <h2 style={{ fontSize:"clamp(2rem,4vw,3rem)", fontWeight:900,
            letterSpacing:"-0.025em", lineHeight:1.1, marginBottom:20 }}>
            Revive lo que<br/>nos une
          </h2>
          <p style={{ ...S.muted, fontSize:"clamp(14px,1.7vw,16px)", lineHeight:1.85,
            marginBottom:36, maxWidth:400 }}>
            Cada foto, cada historia, cada detalle cuenta. CEIBA convierte
            los recuerdos en un legado que tus futuras generaciones podrán valorar.
          </p>
          <Link href="/photos" style={{ textDecoration:"none" }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8,
              border:`1px solid rgba(212,175,55,0.38)`, borderRadius:12,
              padding:"11px 22px", cursor:"pointer",
              color:"rgba(212,175,55,0.75)", fontWeight:600, fontSize:14 }}>
              Ver historias <span style={{ fontSize:16 }}>›</span>
            </div>
          </Link>
        </div>

        <div style={{ display:"flex", justifyContent:"center" }}>
          <MemoriesVisual/>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ position:"relative", zIndex:10, overflow:"hidden",
        background:"linear-gradient(to bottom, rgba(3,2,8,0) 0%, rgba(4,3,10,0.98) 8%, rgba(3,2,8,1) 100%)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"60px 40px 0",
          display:"grid", gridTemplateColumns:"1fr 1fr",
          gap:16, alignItems:"flex-end" }}
          className="cta-g px-section">

          {/* Tree */}
          <div style={{ display:"flex", justifyContent:"center" }}>
            <GlowingTree/>
          </div>

          {/* Text */}
          <div style={{ paddingBottom:60, textAlign:"center" }}>
            <h2 style={{ fontSize:"clamp(1.7rem,3.8vw,2.8rem)", fontWeight:900,
              lineHeight:1.2, letterSpacing:"-0.025em", marginBottom:40 }}>
              Guardemos hoy nuestra historia,{" "}
              <span style={S.gold}>para que mañana nos recuerden.</span>
            </h2>
            <GoldBtn href="/auth/register">Guardar nuestra historia ›</GoldBtn>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer id="sobre" style={{ position:"relative", zIndex:10,
        background:"rgba(3,2,8,1)", borderTop:"1px solid rgba(212,175,55,0.08)",
        padding:"40px 40px" }}
        className="px-section">
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center",
            justifyContent:"space-between", gap:24, marginBottom:28 }}>
            <CeibaLogo/>
            <div style={{ display:"flex", flexWrap:"wrap", gap:20 }}>
              {[
                ["#",          "Inicio"],
                ["#features",  "Características"],
                ["#memories",  "Historias"],
                ["/instalar",  "Blog"],
                ["#sobre",     "Contacto"],
              ].map(([href,l])=>(
                <Link key={href} href={href} style={{ fontSize:12,
                  color:"rgba(255,255,255,0.35)", textDecoration:"none", fontWeight:500 }}>{l}</Link>
              ))}
            </div>
            <div style={{ display:"flex", gap:10 }}>
              {([IcoIG,IcoFB,IcoYT] as React.FC[]).map((Ico,i)=>(
                <Link key={i} href="#" style={{ color:"rgba(212,175,55,0.38)", display:"flex",
                  padding:7, borderRadius:8, border:"1px solid rgba(212,175,55,0.10)" }}>
                  <Ico/>
                </Link>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", justifyContent:"space-between",
            alignItems:"center", gap:10,
            borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:18 }}>
            <span style={{ fontSize:11, color:"rgba(212,175,55,0.18)" }}>
              © 2024 CEIBA – Nuestras Raíces. Todos los derechos reservados.
            </span>
            <div style={{ display:"flex", gap:18 }}>
              {["Términos de servicio","Política de privacidad"].map(t=>(
                <Link key={t} href="#" style={{ fontSize:11,
                  color:"rgba(255,255,255,0.20)", textDecoration:"none" }}>{t}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

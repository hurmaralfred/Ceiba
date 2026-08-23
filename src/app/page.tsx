"use client";
import Link from "next/link";

const GOLD   = "#d4af37";
const GOLD_L = "#f5e070";
const BG     = "#030208";

function UniverseBg() {
  /* Two layers of stars: 200 tiny (r≤0.18) + 60 micro-brights (r≤0.10).
     Max opacity 0.22 so they read as distant stars, not paint splatter. */
  const tiny = Array.from({ length: 200 }, (_, i) => ({
    cx: ((i * 137.508) % 100).toFixed(2),
    cy: ((i * 83.721)  % 100).toFixed(2),
    r:  (0.06 + (i % 4) * 0.03).toFixed(2),
    op: (0.06 + (i % 7) * 0.023).toFixed(3),
  }));
  const bright = Array.from({ length: 60 }, (_, i) => ({
    cx: ((i * 61.803 + 12) % 100).toFixed(2),
    cy: ((i * 94.427 + 7)  % 100).toFixed(2),
    r:  (0.08 + (i % 3) * 0.02).toFixed(2),
    op: (0.12 + (i % 5) * 0.02).toFixed(3),
  }));
  return (
    <>
      {/* Deep-space nebula — large, very soft colour washes */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }} aria-hidden>
        {/* Core galaxy glow — centre-top, deep violet */}
        <div style={{ position:"absolute", top:"-20%", left:"50%", transform:"translateX(-50%)",
          width:900, height:800,
          background:"radial-gradient(ellipse, rgba(38,18,90,0.55) 0%, rgba(20,8,50,0.18) 45%, transparent 72%)",
          filter:"blur(110px)" }}/>
        {/* Warm amber arm — bottom right */}
        <div style={{ position:"absolute", bottom:"-10%", right:"-10%", width:600, height:500,
          background:"radial-gradient(ellipse, rgba(140,80,8,0.18) 0%, transparent 65%)",
          filter:"blur(90px)" }}/>
        {/* Cool blue-violet arm — left */}
        <div style={{ position:"absolute", top:"30%", left:"-15%", width:500, height:500,
          background:"radial-gradient(ellipse, rgba(24,12,80,0.28) 0%, transparent 68%)",
          filter:"blur(85px)" }}/>
        {/* Subtle gold haze — centre, behind content */}
        <div style={{ position:"absolute", top:"38%", left:"50%", transform:"translateX(-50%)",
          width:340, height:240,
          background:"radial-gradient(ellipse, rgba(180,130,20,0.07) 0%, transparent 70%)",
          filter:"blur(48px)" }}/>
      </div>
      {/* Star field */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
        style={{ position:"fixed", inset:0, width:"100%", height:"100%", pointerEvents:"none", zIndex:1 }}>
        {tiny.map((s, i)   => <circle key={`t${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op}/>)}
        {bright.map((s, i) => <circle key={`b${i}`} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.op}/>)}
      </svg>
    </>
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

function CeibaWordmark() {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
        <div style={{ fontWeight:800, fontSize:18, color:"#fff", lineHeight:1, letterSpacing:"-0.01em" }}>CEIBA</div>
        <div style={{ fontSize:8, color:"rgba(212,175,55,0.45)", letterSpacing:"0.12em", textTransform:"uppercase", lineHeight:1.3 }}>
          Nuestras Raíces
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main style={{
      minHeight:"100dvh", background:BG, color:"#fff",
      display:"flex", flexDirection:"column",
      position:"relative", overflowX:"hidden",
    }}>
      <UniverseBg/>

      <style>{`
        html,body{background:#030208!important}
        @media(max-width:480px){
          .hero-title{font-size:2.2rem!important}
          .hero-sub{font-size:15px!important}
          .hero-pad{padding:0 24px!important}
        }
      `}</style>

      {/* Hero — fills the viewport */}
      <div style={{
        flex:1, position:"relative", zIndex:10,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        textAlign:"center",
        padding:"48px 32px 32px",
        minHeight:"calc(100dvh - 72px)",
      }} className="hero-pad">

        {/* Wordmark */}
        <div style={{ marginBottom:40 }}>
          <CeibaWordmark/>
        </div>

        {/* Headline */}
        <h1
          className="hero-title"
          style={{
            fontWeight:300, lineHeight:1.1, letterSpacing:"-0.02em",
            fontSize:"clamp(2.2rem,7vw,4.4rem)",
            marginBottom:18, maxWidth:560,
          }}
        >
          El hogar digital<br/>
          <em style={{ fontStyle:"italic", fontWeight:400, color:"rgba(255,255,255,0.90)" }}>de tu familia.</em>
        </h1>

        {/* Subtitle */}
        <p
          className="hero-sub"
          style={{
            fontSize:"clamp(15px,2vw,17px)", lineHeight:1.75,
            color:"rgba(255,255,255,0.65)",
            maxWidth:420, margin:"0 auto 40px",
          }}
        >
          Tu familia conectada, sus historias<br/>y recuerdos en un solo lugar.
        </p>

        {/* Primary CTA */}
        <Link href="/auth/register" style={{ textDecoration:"none", marginBottom:18 }}>
          <div style={{
            display:"inline-flex", alignItems:"center", justifyContent:"center",
            background:"linear-gradient(to bottom, #e0bc2a 0%, #c09810 100%)",
            borderTop:"1.5px solid #f5e060", borderBottom:"4px solid #6a5200",
            borderRadius:16, color:BG, fontWeight:800, fontSize:16,
            padding:"15px 40px", cursor:"pointer",
            boxShadow:"0 8px 0 #3d3000, 0 14px 32px rgba(0,0,0,0.65)",
            letterSpacing:"-0.01em",
          }}>
            Crear cuenta gratis
          </div>
        </Link>

        {/* Secondary link */}
        <Link href="/auth/login" style={{
          fontSize:14, color:"rgba(255,255,255,0.40)", textDecoration:"none",
          fontWeight:500, display:"block", marginBottom:48,
        }}>
          ¿Ya tienes cuenta? <span style={{ color:"rgba(212,175,55,0.70)", fontWeight:600 }}>Iniciar sesión →</span>
        </Link>

        {/* Footer-micro */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.22)", margin:0 }}>
            Solo tu familia lo ve. Sin ads, sin algoritmos.
          </p>
          <Link href="/instalar" style={{
            fontSize:12, color:"rgba(212,175,55,0.50)", textDecoration:"none", fontWeight:600,
            display:"flex", alignItems:"center", gap:5,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            Instalar app — iPhone / Android
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer style={{
        position:"relative", zIndex:10,
        borderTop:"1px solid rgba(212,175,55,0.07)",
        padding:"18px 32px",
        display:"flex", flexWrap:"wrap", gap:12,
        alignItems:"center", justifyContent:"center",
      }}>
        {[
          ["/privacidad", "Privacidad"],
          ["/terminos",   "Términos"],
          ["/soporte",    "Soporte"],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{
            fontSize:11, color:"rgba(255,255,255,0.22)",
            textDecoration:"none", fontWeight:500,
          }}>
            {label}
          </Link>
        ))}
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.12)" }}>·</span>
        <span style={{ fontSize:11, color:"rgba(255,255,255,0.15)" }}>© Ceiba</span>
      </footer>
    </main>
  );
}

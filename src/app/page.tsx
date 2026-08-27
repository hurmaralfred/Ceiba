"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";

const GOLD   = "#d4af37";
const GOLD_L = "#f5e070";
const BG     = "#030208";

// ── Canvas galaxy — nodos familiares conectados, vivos ──────────────────────
function GalaxyCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    let W = 0, H = 0, raf = 0;
    const t0 = performance.now();

    // ── Stars ──
    type Star = { x: number; y: number; r: number; op: number; phase: number; speed: number };
    let stars: Star[] = [];

    // ── Family nodes ──
    type Node = { ox: number; oy: number; r: number; delay: number; idx: number };
    let nodes: Node[] = [];

    // Edges: pairs of node indices
    const edges = [[0,1],[0,2],[1,3],[2,4],[0,5],[0,6],[2,7]];

    function buildScene() {
      stars = Array.from({ length: 280 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.3 + Math.random() * 1.8,
        op: 0.08 + Math.random() * 0.78,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0014,
      }));

      // Positions relative to canvas center — felt organic, not symmetric
      const cx = W * 0.5, cy = H * 0.52;
      const raw: [number, number, number][] = [
        [  0,     0,    16], // 0 center — "Tú"
        [-0.26,  -0.22, 11], // 1 upper-left parent
        [ 0.28,  -0.20, 11], // 2 upper-right parent
        [-0.42,   0.04,  9], // 3 left sibling
        [ 0.38,   0.06,  9], // 4 right partner
        [-0.14,   0.30,  8], // 5 child lower-left
        [ 0.18,   0.32,  8], // 6 child lower-right
        [ 0.26,  -0.42,  7], // 7 grandparent (distant)
      ];
      nodes = raw.map(([dx, dy, r], i) => ({
        ox: cx + dx * W,
        oy: cy + dy * H,
        r,
        delay: i * 0.45,  // staggered reveal in seconds
        idx: i,
      }));
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      W = window.innerWidth;
      H = window.innerHeight;
      canvas!.width  = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width  = W + "px";
      canvas!.style.height = H + "px";
      ctx.scale(dpr, dpr);
      buildScene();
    }

    function ease(x: number) {
      // ease-out cubic
      return 1 - Math.pow(1 - Math.min(x, 1), 3);
    }

    function nodeOpacity(n: Node, elapsed: number): number {
      const progress = (elapsed - n.delay) / 1.2; // 1.2s fade per node
      return Math.min(ease(progress), 1);
    }

    function draw() {
      const now = performance.now();
      const elapsed = (now - t0) / 1000; // seconds

      ctx.clearRect(0, 0, W, H);

      // ── Background ──
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.45, Math.max(W, H) * 0.75);
      bg.addColorStop(0, "#130a30");
      bg.addColorStop(0.5, "#0a0520");
      bg.addColorStop(1, "#030208");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // ── Nebula blobs ──
      const breathe1 = 0.96 + 0.04 * Math.sin(elapsed * 0.28);
      const breathe2 = 0.97 + 0.03 * Math.sin(elapsed * 0.19 + 1.5);
      const breathe3 = 0.95 + 0.05 * Math.sin(elapsed * 0.23 + 3.1);

      const nb1 = ctx.createRadialGradient(W * 0.55, H * 0.3 * breathe1, 0, W * 0.55, H * 0.3, W * 0.5);
      nb1.addColorStop(0, "rgba(55,22,130,0.42)");
      nb1.addColorStop(0.5, "rgba(28,10,65,0.16)");
      nb1.addColorStop(1, "transparent");
      ctx.fillStyle = nb1;
      ctx.fillRect(0, 0, W, H);

      const nb2 = ctx.createRadialGradient(W * 0.15 * breathe2, H * 0.72, 0, W * 0.15, H * 0.72, W * 0.42);
      nb2.addColorStop(0, "rgba(28,12,80,0.30)");
      nb2.addColorStop(1, "transparent");
      ctx.fillStyle = nb2;
      ctx.fillRect(0, 0, W, H);

      const nb3 = ctx.createRadialGradient(W * 0.82, H * 0.15 * breathe3, 0, W * 0.82, H * 0.15, W * 0.36);
      nb3.addColorStop(0, "rgba(120, 70, 8, 0.14)");
      nb3.addColorStop(1, "transparent");
      ctx.fillStyle = nb3;
      ctx.fillRect(0, 0, W, H);

      // ── Stars — drift + twinkle ──
      const driftX = Math.sin(elapsed * 0.018) * 4;
      const driftY = Math.cos(elapsed * 0.012) * 3;
      ctx.save();
      ctx.translate(driftX, driftY);
      stars.forEach(s => {
        const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * s.speed * 6000 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220,210,255,${s.op * twinkle})`;
        ctx.fill();
      });
      ctx.restore();

      // ── Edges (connection lines) ──
      edges.forEach(([ai, bi]) => {
        const a = nodes[ai], b = nodes[bi];
        const opA = nodeOpacity(a, elapsed);
        const opB = nodeOpacity(b, elapsed);
        const lineOp = Math.min(opA, opB);
        if (lineOp <= 0) return;

        // Slow pulse along the line
        const pulse = 0.06 + 0.05 * Math.sin(elapsed * 0.7 + ai * 1.1);
        const grad = ctx.createLinearGradient(a.ox, a.oy, b.ox, b.oy);
        grad.addColorStop(0, `rgba(201,162,39,${pulse * lineOp})`);
        grad.addColorStop(0.5, `rgba(201,162,39,${(pulse + 0.04) * lineOp})`);
        grad.addColorStop(1, `rgba(201,162,39,${pulse * lineOp})`);

        ctx.beginPath();
        ctx.moveTo(a.ox, a.oy);
        ctx.lineTo(b.ox, b.oy);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.9;
        ctx.stroke();

        // Traveling particle on each line
        const progress = ((elapsed * 0.22 + ai * 0.37 + bi * 0.19) % 1);
        const px = a.ox + (b.ox - a.ox) * progress;
        const py = a.oy + (b.oy - a.oy) * progress;
        ctx.beginPath();
        ctx.arc(px, py, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,224,112,${0.6 * lineOp})`;
        ctx.fill();
      });

      // ── Nodes ──
      nodes.forEach((n, i) => {
        const op = nodeOpacity(n, elapsed);
        if (op <= 0) return;

        const breathe = 0.85 + 0.15 * Math.sin(elapsed * 0.6 + i * 1.4);

        // Outer glow
        const glow = ctx.createRadialGradient(n.ox, n.oy, 0, n.ox, n.oy, n.r * 4.5);
        glow.addColorStop(0, `rgba(201,162,39,${0.22 * breathe * op})`);
        glow.addColorStop(0.4, `rgba(140,100,20,${0.08 * op})`);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(n.ox, n.oy, n.r * 4.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Core
        const isCenter = i === 0;
        ctx.beginPath();
        ctx.arc(n.ox, n.oy, n.r * breathe, 0, Math.PI * 2);
        ctx.fillStyle = isCenter
          ? `rgba(230,185,55,${0.88 * op})`
          : `rgba(180,148,200,${0.65 * op})`;
        ctx.fill();

        // Ring
        ctx.beginPath();
        ctx.arc(n.ox, n.oy, n.r * breathe + 2.5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(201,162,39,${0.28 * op})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      });

      // ── Vignette ──
      const vig = ctx.createRadialGradient(W*0.5, H*0.5, H*0.18, W*0.5, H*0.5, H*0.72);
      vig.addColorStop(0, "transparent");
      vig.addColorStop(1, "rgba(3,2,8,0.68)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(draw);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);
    draw();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed", inset: 0,
        pointerEvents: "none", zIndex: 0,
        display: "block",
      }}
    />
  );
}

// ── Wordmark ──────────────────────────────────────────────────────────────────
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

// ── Landing ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main style={{
      minHeight:"100dvh", background:BG, color:"#fff",
      display:"flex", flexDirection:"column",
      position:"relative", overflowX:"hidden",
    }}>
      <GalaxyCanvas />

      <style>{`
        html,body{background:#030208!important}
        @media(max-width:480px){
          .hero-title{font-size:2.2rem!important}
          .hero-sub{font-size:15px!important}
          .hero-pad{padding:0 24px!important}
        }
      `}</style>

      {/* Hero */}
      <div style={{
        flex:1, position:"relative", zIndex:10,
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        textAlign:"center",
        padding:"48px 32px 32px",
        minHeight:"calc(100dvh - 72px)",
      }} className="hero-pad">

        <div style={{ marginBottom:40 }}>
          <CeibaWordmark/>
        </div>

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

        <Link href="/auth/login" style={{
          fontSize:14, color:"rgba(255,255,255,0.40)", textDecoration:"none",
          fontWeight:500, display:"block", marginBottom:48,
        }}>
          ¿Ya tienes cuenta? <span style={{ color:"rgba(212,175,55,0.70)", fontWeight:600 }}>Iniciar sesión →</span>
        </Link>

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

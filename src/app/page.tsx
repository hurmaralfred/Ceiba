"use client";
import Link from "next/link";

// ── Ilustración SVG: árbol familiar estilizado ────────────────────────────────
function LinajeIllustration() {
  return (
    <svg
      viewBox="0 0 320 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", maxWidth: 320, height: "auto", display: "block" }}
      aria-hidden
    >
      {/* Raíces / trunk */}
      <path d="M160 220 L160 150" stroke="#DDD8CF" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M160 200 L130 230" stroke="#DDD8CF" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
      <path d="M160 210 L190 238" stroke="#DDD8CF" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

      {/* Ramas principales */}
      <path d="M160 150 Q130 130 100 118" stroke="#C8C0B2" strokeWidth="2" strokeLinecap="round"/>
      <path d="M160 150 Q190 130 220 118" stroke="#C8C0B2" strokeWidth="2" strokeLinecap="round"/>
      <path d="M160 150 L160 110" stroke="#C8C0B2" strokeWidth="2" strokeLinecap="round"/>

      {/* Ramas secundarias */}
      <path d="M100 118 Q80 104 64 96"  stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M100 118 Q88 102 80 92"  stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M220 118 Q236 104 252 96" stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M220 118 Q232 102 242 92" stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M160 110 Q148 96 136 88"  stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M160 110 Q172 96 184 88"  stroke="#DDD8CF" strokeWidth="1.4" strokeLinecap="round"/>

      {/* Nodo central — tú */}
      <circle cx="160" cy="150" r="14" fill="#1E2E4A" opacity="0.95"/>
      <circle cx="160" cy="150" r="18" stroke="#C8882A" strokeWidth="1.5" fill="none" opacity="0.45"/>
      <circle cx="160" cy="150" r="22" stroke="#C8882A" strokeWidth="0.6" fill="none" opacity="0.18"/>
      <text x="160" y="154" textAnchor="middle" fontSize="10" fontWeight="700" fill="rgba(253,252,250,0.90)" fontFamily="sans-serif">Tú</text>

      {/* Nodo padre */}
      <circle cx="100" cy="118" r="10" fill="#EAF0F8" stroke="#A2BFDD" strokeWidth="1.2"/>
      {/* Nodo madre */}
      <circle cx="220" cy="118" r="10" fill="#EAF0F8" stroke="#A2BFDD" strokeWidth="1.2"/>
      {/* Nodo hijo */}
      <circle cx="160" cy="110" r="8"  fill="#FDF6E8" stroke="#EFC07A" strokeWidth="1.2"/>

      {/* Abuelos */}
      <circle cx="64"  cy="96"  r="7" fill="#EDF2E9" stroke="#ADC7A1" strokeWidth="1"/>
      <circle cx="80"  cy="92"  r="7" fill="#EDF2E9" stroke="#ADC7A1" strokeWidth="1"/>
      <circle cx="252" cy="96"  r="7" fill="#EDF2E9" stroke="#ADC7A1" strokeWidth="1"/>
      <circle cx="242" cy="92"  r="7" fill="#EDF2E9" stroke="#ADC7A1" strokeWidth="1"/>
      <circle cx="136" cy="88"  r="6" fill="#FDF6E8" stroke="#EFC07A" strokeWidth="0.9" opacity="0.85"/>
      <circle cx="184" cy="88"  r="6" fill="#FDF6E8" stroke="#EFC07A" strokeWidth="0.9" opacity="0.85"/>

      {/* Puntos decorativos — semillas */}
      <circle cx="58"  cy="72"  r="2" fill="#C8882A" opacity="0.35"/>
      <circle cx="88"  cy="68"  r="1.5" fill="#7A8C6E" opacity="0.40"/>
      <circle cx="258" cy="74"  r="2" fill="#C8882A" opacity="0.30"/>
      <circle cx="248" cy="68"  r="1.5" fill="#7A8C6E" opacity="0.35"/>
      <circle cx="130" cy="66"  r="1.5" fill="#C8882A" opacity="0.30"/>
      <circle cx="192" cy="66"  r="1.5" fill="#7A8C6E" opacity="0.35"/>

      {/* Tierra / base */}
      <ellipse cx="160" cy="240" rx="48" ry="6" fill="#DDD8CF" opacity="0.35"/>
    </svg>
  );
}

// ── Wordmark Linaje ───────────────────────────────────────────────────────────
function CeibaWordmark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Ícono árbol mínimo */}
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <path d="M14 24 L14 14" stroke="#1E2E4A" strokeWidth="2" strokeLinecap="round"/>
        <path d="M14 14 Q10 10 6 9"  stroke="#1E2E4A" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 14 Q18 10 22 9"  stroke="#1E2E4A" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 14 L14 9"        stroke="#1E2E4A" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="6"  cy="8.5" r="2"   fill="#7A8C6E"/>
        <circle cx="22" cy="8.5" r="2"   fill="#7A8C6E"/>
        <circle cx="14" cy="8"   r="2.5" fill="#C8882A"/>
        <circle cx="14" cy="14"  r="3"   fill="#1E2E4A"/>
      </svg>
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: "#1E2E4A", lineHeight: 1,
          letterSpacing: "0.06em", fontFamily: "var(--font-fraunces), Georgia, serif" }}>
          CEIBA
        </div>
        <div style={{ fontSize: 8, color: "#9A9084", letterSpacing: "0.14em",
          textTransform: "uppercase", lineHeight: 1.4 }}>
          Nuestras Raíces
        </div>
      </div>
    </div>
  );
}

// ── Feature pill ─────────────────────────────────────────────────────────────
function Pill({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "#FDFCFA", border: "1px solid #DDD8CF",
      borderRadius: 100, padding: "6px 14px",
      fontSize: 12, color: "#3D3428", fontWeight: 500,
      boxShadow: "0 1px 3px rgba(30,46,74,0.06)",
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// ── Landing ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <main style={{
      minHeight: "100dvh",
      background: "#F4F1EC",
      color: "#1A1612",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflowX: "hidden",
    }}>

      {/* Acento decorativo — degradado suave esquina sup-der */}
      <div style={{
        position: "fixed", top: 0, right: 0,
        width: "60vw", height: "60vw", maxWidth: 500, maxHeight: 500,
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle,rgba(200,136,42,0.07) 0%,transparent 65%)",
        transform: "translate(25%,-25%)",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0,
        width: "50vw", height: "50vw", maxWidth: 400, maxHeight: 400,
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle,rgba(122,140,110,0.08) 0%,transparent 65%)",
        transform: "translate(-30%,30%)",
      }} />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header style={{
        position: "relative", zIndex: 10,
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <CeibaWordmark />
        <Link href="/auth/login" style={{
          fontSize: 13, color: "#6B6258", fontWeight: 600,
          textDecoration: "none", padding: "8px 16px",
          border: "1px solid #DDD8CF", borderRadius: 50,
          background: "#FDFCFA",
        }}>
          Iniciar sesión
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{
        flex: 1, position: "relative", zIndex: 10,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        textAlign: "center",
        padding: "24px 28px 40px",
      }}>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(200,136,42,0.08)", border: "1px solid rgba(200,136,42,0.22)",
          borderRadius: 100, padding: "5px 14px", marginBottom: 28,
          fontSize: 11, color: "#C8882A", fontWeight: 600, letterSpacing: "0.04em",
        }}>
          🌳 Para familias colombianas
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "var(--font-fraunces), Georgia, serif",
          fontWeight: 400,
          fontSize: "clamp(2.2rem, 8vw, 3.8rem)",
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          marginBottom: 18,
          maxWidth: 520,
          color: "#1A1612",
        }}>
          Tu familia,<br/>
          <em style={{ fontStyle: "italic", color: "#1E2E4A", fontWeight: 500 }}>
            conectada a su historia.
          </em>
        </h1>

        {/* Subtítulo */}
        <p style={{
          fontSize: "clamp(15px, 2vw, 17px)",
          lineHeight: 1.65,
          color: "#6B6258",
          maxWidth: 320,
          margin: "0 auto 32px",
          fontWeight: 400,
        }}>
          Árbol genealógico, fotos, cumpleaños y recuerdos —
          todo en un solo lugar, solo para tu familia.
        </p>

        {/* Pills de features */}
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8,
          justifyContent: "center", marginBottom: 36,
        }}>
          <Pill icon="🎂" label="Cumpleaños" />
          <Pill icon="🌳" label="Árbol familiar" />
          <Pill icon="📸" label="Fotos" />
          <Pill icon="📖" label="Historias" />
        </div>

        {/* Ilustración */}
        <div style={{ width: "100%", maxWidth: 280, margin: "0 auto 36px" }}>
          <LinajeIllustration />
        </div>

        {/* CTA principal */}
        <Link href="/auth/register" style={{ textDecoration: "none", marginBottom: 14, display: "block", width: "100%", maxWidth: 280 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#1E2E4A",
            borderRadius: 16,
            color: "#FDFCFA",
            fontWeight: 700,
            fontSize: 16,
            padding: "16px 0",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(30,46,74,0.22), 0 2px 4px rgba(30,46,74,0.12)",
            letterSpacing: "-0.01em",
            transition: "transform 0.12s ease",
          }}>
            Empezar gratis
          </div>
        </Link>

        {/* Secundario */}
        <Link href="/auth/login" style={{
          fontSize: 14, color: "#9A9084", textDecoration: "none",
          fontWeight: 500, display: "block",
        }}>
          ¿Ya tienes cuenta?{" "}
          <span style={{ color: "#C8882A", fontWeight: 700 }}>Iniciar sesión →</span>
        </Link>

      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        position: "relative", zIndex: 10,
        borderTop: "1px solid #E8E4DC",
        padding: "18px 24px",
        display: "flex", flexWrap: "wrap", gap: 14,
        alignItems: "center", justifyContent: "center",
      }}>
        {[
          ["/privacidad", "Privacidad"],
          ["/terminos",   "Términos"],
          ["/soporte",    "Soporte"],
        ].map(([href, label]) => (
          <Link key={href} href={href} style={{
            fontSize: 11, color: "#9A9084",
            textDecoration: "none", fontWeight: 500,
          }}>
            {label}
          </Link>
        ))}
        <span style={{ fontSize: 11, color: "#C8C0B2" }}>·</span>
        <span style={{ fontSize: 11, color: "#B0A898" }}>© Ceiba</span>
      </footer>
    </main>
  );
}

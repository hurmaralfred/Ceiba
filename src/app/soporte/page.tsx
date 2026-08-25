import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Soporte – Ceiba",
  description: "Centro de ayuda de Ceiba. Resuelve tus dudas o contáctanos directamente.",
};

const GOLD = "#d4af37";
const BG   = "#030208";

const faqs = [
  {
    q: "¿Cómo instalo Ceiba en mi celular?",
    a: 'Visita ceibapp.com desde Safari (iPhone) o Chrome (Android) y sigue los pasos en la página de instalación. En iPhone: toca el botón Compartir → "Agregar a pantalla de inicio". En Android: toca el banner o el menú ⋮ → "Instalar app".',
    link: { label: "Ver guía de instalación →", href: "/instalar" },
  },
  {
    q: "¿Cómo invito a mi familia?",
    a: 'Desde la pantalla principal ve a "Invitar" y busca o agrega a cada familiar. Puedes compartir el enlace por WhatsApp, SMS o copiándolo. Cada enlace es único y tiene validez por 30 días.',
  },
  {
    q: "El enlace de invitación me dice que expiró, ¿qué hago?",
    a: "Los enlaces de invitación tienen una vigencia. Pídele a quien te invitó que genere un nuevo enlace desde la sección Invitar. Si el problema persiste, escríbenos.",
  },
  {
    q: "¿Puedo usar Ceiba en más de un dispositivo?",
    a: "Sí. Puedes iniciar sesión con tu cuenta en cualquier dispositivo. En cada uno, instálala siguiendo los pasos de la guía de instalación.",
  },
  {
    q: "¿Cómo elimino mi cuenta?",
    a: "Ve a Configuración → Cuenta → Eliminar cuenta. También puedes escribirnos a soporte@ceibapp.com y lo hacemos en menos de 48 horas. Todos tus datos se borran en 30 días.",
  },
  {
    q: "¿Mis fotos y recuerdos son privados?",
    a: "Sí. Tu espacio familiar es completamente privado. Solo los miembros que tú invites pueden ver el contenido. Ceiba no comparte tus fotos con nadie ni las usa para publicidad.",
  },
  {
    q: "No recibo notificaciones, ¿por qué?",
    a: 'Asegúrate de que las notificaciones están habilitadas en la configuración de tu dispositivo para Ceiba (la app instalada en pantalla de inicio). En iPhone: Ajustes → Ceiba → Notificaciones → Permitir. En Android: Ajustes → Apps → Ceiba → Notificaciones.',
  },
  {
    q: "Olvidé mi contraseña, ¿qué hago?",
    a: 'En la pantalla de inicio de sesión toca "¿Olvidaste tu contraseña?" e ingresa tu correo. Te llegará un enlace para restablecerla. Si iniciaste sesión con Google, usa el mismo método de Google.',
  },
  {
    q: "¿Cómo reporto un problema o un bug?",
    a: "Escríbenos a soporte@ceibapp.com con una descripción del problema, el dispositivo que usas y, si puedes, una captura de pantalla. Respondemos en 24-48 horas.",
  },
];

export default function SoportePage() {
  return (
    <main style={{ background: BG, color: "#e8e8e8", minHeight: "100dvh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        a { color: ${GOLD}; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: `1px solid rgba(212,175,55,0.12)`,
        padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ color: GOLD, fontWeight: 800, fontSize: 18, letterSpacing: "-0.01em", textDecoration: "none" }}>
          CEIBA
        </Link>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Soporte</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>

        {/* Title */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
            ¿En qué te podemos ayudar?
          </h1>
          <p style={{ fontSize: "0.92rem", color: "rgba(255,255,255,0.50)", margin: 0 }}>
            Respuestas a las preguntas más frecuentes, o escríbenos directamente.
          </p>
        </div>

        {/* Contact cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 48 }}>
          <a
            href="mailto:soporte@ceibapp.com"
            style={{
              display: "block", padding: "20px 18px",
              background: "rgba(212,175,55,0.06)", border: "1px solid rgba(212,175,55,0.16)",
              borderRadius: 16, textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>✉️</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>Email</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem" }}>soporte@ceibapp.com</div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.78rem", marginTop: 6 }}>Resp. en 24-48h</div>
          </a>

          <a
            href="https://wa.me/message/CEIBA"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block", padding: "20px 18px",
              background: "rgba(37,211,102,0.05)", border: "1px solid rgba(37,211,102,0.15)",
              borderRadius: 16, textDecoration: "none",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 8 }}>💬</div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>WhatsApp</div>
            <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem" }}>Chat directo</div>
            <div style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.78rem", marginTop: 6 }}>Más rápido</div>
          </a>
        </div>

        {/* FAQ */}
        <h2 style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, marginBottom: 20 }}>
          Preguntas frecuentes
        </h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {faqs.map((faq, i) => (
            <details
              key={i}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                overflow: "hidden",
              }}
            >
              <summary style={{
                padding: "16px 18px",
                cursor: "pointer",
                color: "rgba(255,255,255,0.85)",
                fontSize: "0.90rem",
                fontWeight: 600,
                listStyle: "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}>
                {faq.q}
                <span style={{ color: "rgba(212,175,55,0.50)", fontSize: "1.1rem", flexShrink: 0, marginLeft: 12 }}>+</span>
              </summary>
              <div style={{ padding: "0 18px 18px", fontSize: "0.88rem", lineHeight: 1.75, color: "rgba(255,255,255,0.55)" }}>
                <p style={{ margin: "0 0 8px" }}>{faq.a}</p>
                {faq.link && (
                  <Link href={faq.link.href} style={{ color: GOLD, fontSize: "0.85rem", fontWeight: 600 }}>
                    {faq.link.label}
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>

        {/* Bottom nav */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 48, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/privacidad" style={{ fontSize: 13, color: GOLD }}>Privacidad</Link>
          <Link href="/terminos" style={{ fontSize: 13, color: GOLD }}>Términos</Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>← Inicio</Link>
        </div>
      </div>
    </main>
  );
}

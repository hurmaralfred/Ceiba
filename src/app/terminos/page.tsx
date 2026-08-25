import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de Servicio – Ceiba",
  description: "Términos y condiciones de uso de la plataforma Ceiba.",
};

const GOLD = "#d4af37";
const BG   = "#030208";

export default function TerminosPage() {
  return (
    <main style={{ background: BG, color: "#e8e8e8", minHeight: "100dvh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <style>{`
        h2 { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 2rem 0 0.5rem; }
        h3 { color: rgba(255,255,255,0.80); font-size: 0.95rem; font-weight: 600; margin: 1.25rem 0 0.35rem; }
        p, li { font-size: 0.92rem; line-height: 1.75; color: rgba(255,255,255,0.65); margin: 0 0 0.5rem; }
        ul { padding-left: 1.4rem; margin: 0 0 0.75rem; }
        a { color: ${GOLD}; text-decoration: none; }
        a:hover { text-decoration: underline; }
        hr { border: none; border-top: 1px solid rgba(212,175,55,0.10); margin: 2rem 0; }
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
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Términos</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Términos de Servicio
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}>
            Última actualización: 24 de agosto de 2026
          </p>
        </div>

        <p>
          Bienvenido a Ceiba. Al crear una cuenta o usar la aplicación, aceptas estos Términos de Servicio.
          Si no los aceptas, por favor no uses el servicio.
        </p>

        <hr/>

        <h2>1. El servicio</h2>
        <p>
          Ceiba es una plataforma privada para que las familias se conecten, preserven recuerdos y compartan
          su historia. El servicio está disponible en <a href="https://ceibapp.com">ceibapp.com</a> y como
          aplicación instalable en dispositivos móviles (PWA).
        </p>
        <p>
          Ceiba es operado por Alfredo Hurtado. Para contactarnos:{" "}
          <a href="mailto:soporte@ceibapp.com">soporte@ceibapp.com</a>.
        </p>

        <h2>2. Tu cuenta</h2>
        <ul>
          <li>Debes tener al menos 13 años para usar Ceiba.</li>
          <li>Eres responsable de mantener tu contraseña segura y de toda la actividad de tu cuenta.</li>
          <li>Debes proporcionar información verídica al registrarte.</li>
          <li>No puedes compartir tu cuenta con otras personas.</li>
          <li>Puedes eliminar tu cuenta en cualquier momento desde la configuración o contactándonos.</li>
        </ul>

        <h2>3. Tu contenido</h2>

        <h3>3.1 Lo que es tuyo</h3>
        <p>
          Todo el contenido que subes a Ceiba (fotos, recuerdos, textos, relaciones familiares) te
          pertenece a ti y a tu familia. No reclamamos ningún derecho de propiedad sobre tu contenido.
        </p>

        <h3>3.2 Licencia que nos otorgas</h3>
        <p>
          Al subir contenido a Ceiba, nos otorgas una licencia limitada, no exclusiva y revocable para
          almacenarlo, mostrarlo a los miembros autorizados de tu espacio familiar y hacer copias de
          seguridad. Esta licencia termina cuando eliminas el contenido o tu cuenta.
        </p>

        <h3>3.3 Tu responsabilidad</h3>
        <p>Eres responsable del contenido que publicas. Aceptas NO publicar:</p>
        <ul>
          <li>Contenido ilegal, difamatorio, amenazante u obsceno.</li>
          <li>Material que infrinja derechos de autor o de propiedad intelectual de terceros.</li>
          <li>Información de menores de edad sin el consentimiento de sus tutores.</li>
          <li>Spam, publicidad o contenido comercial no autorizado.</li>
          <li>Malware, virus o cualquier código dañino.</li>
        </ul>

        <hr/>

        <h2>4. Uso aceptable</h2>
        <p>Aceptas no usar Ceiba para:</p>
        <ul>
          <li>Hacerse pasar por otra persona o falsificar relaciones familiares.</li>
          <li>Acceder sin autorización a cuentas, sistemas o datos de otros usuarios.</li>
          <li>Intentar evadir las medidas de seguridad de la plataforma.</li>
          <li>Recopilar datos de otros usuarios de forma automatizada.</li>
          <li>Usar el servicio para actividades ilegales.</li>
        </ul>

        <h2>5. Espacios familiares e invitaciones</h2>
        <p>
          Cada espacio familiar es privado. Como creador o administrador de un espacio, eres responsable
          de invitar únicamente a personas que hayan dado su consentimiento. No uses Ceiba para enviar
          invitaciones no solicitadas de forma masiva.
        </p>

        <h2>6. Inteligencia artificial</h2>
        <p>
          Ceiba usa modelos de IA (Anthropic Claude) para generar la pregunta del día. Estas preguntas
          son sugerencias y no representan la opinión de Ceiba. El servicio de IA utiliza contexto
          anonimizado de actividad de tu espacio familiar.
        </p>

        <hr/>

        <h2>7. Disponibilidad del servicio</h2>
        <p>
          Hacemos nuestro mejor esfuerzo por mantener Ceiba disponible, pero no garantizamos una
          disponibilidad ininterrumpida. Podemos realizar mantenimientos o actualizaciones que causen
          interrupciones temporales.
        </p>
        <p>
          Nos reservamos el derecho de modificar, suspender o discontinuar el servicio, con o sin aviso
          previo, aunque haremos nuestro mejor esfuerzo por notificarte con anticipación si se trata de
          cambios significativos.
        </p>

        <h2>8. Suspensión de cuentas</h2>
        <p>
          Podemos suspender o eliminar tu cuenta si violas estos términos, si detectamos actividad
          fraudulenta o si así lo requiere la ley. Intentaremos notificarte salvo que sea necesario
          actuar de inmediato por razones de seguridad.
        </p>

        <h2>9. Limitación de responsabilidad</h2>
        <p>
          Ceiba se proporciona <strong style={{ color: "#fff" }}>"tal como está"</strong>. En la medida
          permitida por la ley, no somos responsables de daños indirectos, incidentales o consecuentes
          derivados del uso o la imposibilidad de usar el servicio.
        </p>
        <p>
          No somos responsables del contenido publicado por los usuarios ni de las disputas entre
          miembros de una familia.
        </p>

        <h2>10. Propiedad intelectual de Ceiba</h2>
        <p>
          El nombre Ceiba, el logotipo, el diseño de la aplicación y el código son propiedad de
          Alfredo Hurtado. No puedes copiar, modificar ni distribuir ningún elemento de la plataforma
          sin autorización escrita.
        </p>

        <h2>11. Cambios a los términos</h2>
        <p>
          Podemos actualizar estos términos. Te notificaremos por correo electrónico o mediante un aviso
          en la app con al menos 15 días de antelación antes de que entren en vigor cambios sustanciales.
          Continuar usando Ceiba después de esa fecha implica aceptar los nuevos términos.
        </p>

        <h2>12. Ley aplicable</h2>
        <p>
          Estos términos se rigen por las leyes aplicables en el lugar de residencia del operador del
          servicio. Cualquier disputa se resolverá en primera instancia mediante comunicación directa
          a <a href="mailto:soporte@ceibapp.com">soporte@ceibapp.com</a>.
        </p>

        <hr/>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
          <Link href="/privacidad" style={{ fontSize: 13, color: GOLD }}>Política de Privacidad</Link>
          <Link href="/soporte" style={{ fontSize: 13, color: GOLD }}>Soporte</Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>← Inicio</Link>
        </div>
      </div>
    </main>
  );
}

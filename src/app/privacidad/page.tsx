import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad – Ceiba",
  description: "Cómo Ceiba recopila, usa y protege la información de tu familia.",
};

const GOLD = "#d4af37";
const BG   = "#030208";

export default function PrivacidadPage() {
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
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.30)" }}>Privacidad</span>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ color: "#fff", fontSize: "1.6rem", fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 8 }}>
            Política de Privacidad
          </h1>
          <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.82rem" }}>
            Última actualización: 24 de agosto de 2026
          </p>
        </div>

        <p>
          En Ceiba nos tomamos muy en serio la privacidad de tu familia. Esta política explica qué información
          recopilamos, para qué la usamos y cómo la protegemos. Ceiba <strong style={{ color: "#fff" }}>no vende
          tus datos ni muestra publicidad</strong>.
        </p>

        <hr/>

        <h2>1. Quiénes somos</h2>
        <p>
          Ceiba es un servicio de historia familiar operado por Alfredo Hurtado. Puedes contactarnos en{" "}
          <a href="mailto:soporte@ceibapp.com">soporte@ceibapp.com</a>.
        </p>

        <h2>2. Información que recopilamos</h2>

        <h3>2.1 Información que tú nos das</h3>
        <ul>
          <li>Nombre, correo electrónico y contraseña (o datos de tu cuenta de Google si inicias sesión con OAuth).</li>
          <li>Fecha de nacimiento, género y foto de perfil que elijas compartir.</li>
          <li>Nombres, relaciones y fechas de nacimiento de los familiares que añades a tu galaxia familiar.</li>
          <li>Fotos, recuerdos, historias y mensajes que publicas dentro de la app.</li>
          <li>Respuestas a la pregunta del día y comentarios en el muro familiar.</li>
          <li>Número de teléfono, si decides compartirlo para enviar invitaciones.</li>
        </ul>

        <h3>2.2 Información que recopilamos automáticamente</h3>
        <ul>
          <li>Registros de uso (qué funciones utilizas, cuándo y con qué frecuencia).</li>
          <li>Información del dispositivo: sistema operativo, tipo de navegador, idioma.</li>
          <li>Dirección IP y país de acceso, para seguridad y cumplimiento regional.</li>
          <li>Tokens de suscripción para notificaciones push (si las aceptas).</li>
        </ul>

        <h3>2.3 Información de terceros</h3>
        <ul>
          <li>Si inicias sesión con Google, recibimos tu nombre y correo confirmado por Google.</li>
        </ul>

        <hr/>

        <h2>3. Cómo usamos tu información</h2>
        <ul>
          <li>Crear y mantener tu cuenta y el espacio familiar.</li>
          <li>Mostrar el árbol genealógico y la galaxia familiar a los miembros de tu familia.</li>
          <li>Enviar notificaciones de cumpleaños, recuerdos del pasado y la pregunta del día.</li>
          <li>Generar la pregunta del día usando inteligencia artificial (servicio de Anthropic), que utiliza
              contexto anonimizado de actividad del espacio familiar para personalizar la pregunta.</li>
          <li>Mejorar la app, detectar errores y prevenir fraudes.</li>
          <li>Responderte cuando nos contactes.</li>
        </ul>
        <p>
          <strong style={{ color: "#fff" }}>No usamos tus datos para publicidad ni los compartimos con anunciantes.</strong>
        </p>

        <hr/>

        <h2>4. Con quién compartimos tu información</h2>
        <p>Solo compartimos información en estos casos:</p>

        <h3>Proveedores de servicio (procesadores)</h3>
        <ul>
          <li>
            <strong style={{ color: "#fff" }}>Supabase</strong> — base de datos, autenticación y almacenamiento
            de archivos. Tus datos se almacenan en servidores seguros dentro de AWS.
          </li>
          <li>
            <strong style={{ color: "#fff" }}>Anthropic</strong> — generación de la pregunta del día mediante
            IA. Solo recibe contexto de actividad familiar anónimo (número de fotos, recuerdos recientes,
            cumpleaños próximos). No recibe nombres, fotos ni contenido personal identificable.
          </li>
          <li>
            <strong style={{ color: "#fff" }}>Vercel</strong> — alojamiento de la aplicación web.
          </li>
          <li>
            <strong style={{ color: "#fff" }}>Google</strong> — autenticación OAuth (si la usas).
          </li>
        </ul>

        <h3>Dentro de tu familia</h3>
        <p>
          Los miembros de tu espacio familiar pueden ver el contenido que publicas dentro de ese espacio.
          Cada espacio familiar es privado y aislado de otros espacios.
        </p>

        <h3>Obligación legal</h3>
        <p>
          Podemos divulgar información si la ley lo exige o para proteger los derechos, la propiedad o
          la seguridad de Ceiba, sus usuarios u otros.
        </p>

        <hr/>

        <h2>5. Tus derechos</h2>
        <ul>
          <li><strong style={{ color: "#fff" }}>Acceso:</strong> puedes solicitar una copia de los datos que tenemos sobre ti.</li>
          <li><strong style={{ color: "#fff" }}>Corrección:</strong> puedes corregir tu información desde la configuración de la app.</li>
          <li><strong style={{ color: "#fff" }}>Eliminación:</strong> puedes solicitar la eliminación de tu cuenta y todos tus datos enviando un
            correo a <a href="mailto:soporte@ceibapp.com">soporte@ceibapp.com</a>. Procesamos estas solicitudes en un plazo de 30 días.</li>
          <li><strong style={{ color: "#fff" }}>Portabilidad:</strong> puedes solicitar tus datos en formato JSON.</li>
          <li><strong style={{ color: "#fff" }}>Notificaciones:</strong> puedes desactivar las notificaciones push desde la configuración
            de tu dispositivo en cualquier momento.</li>
        </ul>

        <hr/>

        <h2>6. Seguridad</h2>
        <p>
          Usamos cifrado en tránsito (HTTPS/TLS) y en reposo para proteger tus datos. El acceso a la
          base de datos está restringido por políticas de seguridad a nivel de fila (Row Level Security),
          lo que garantiza que solo los miembros autorizados de un espacio familiar puedan ver su contenido.
        </p>

        <h2>7. Menores de edad</h2>
        <p>
          Ceiba no está dirigida a menores de 13 años. Si eres padre o tutor y crees que un menor
          ha creado una cuenta, contáctanos para eliminarla.
        </p>

        <h2>8. Retención de datos</h2>
        <p>
          Conservamos tus datos mientras tu cuenta esté activa. Si eliminas tu cuenta, borramos tu
          información personal en un plazo de 30 días, salvo que la ley exija conservarla por más tiempo.
        </p>

        <h2>9. Cambios a esta política</h2>
        <p>
          Podemos actualizar esta política. Te notificaremos por correo electrónico o mediante un aviso
          en la app si los cambios son significativos. La fecha de la última actualización siempre
          aparece al inicio de este documento.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier pregunta sobre privacidad: <a href="mailto:soporte@ceibapp.com">soporte@ceibapp.com</a>
        </p>

        <hr/>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
          <Link href="/terminos" style={{ fontSize: 13, color: GOLD }}>Términos de Servicio</Link>
          <Link href="/soporte" style={{ fontSize: 13, color: GOLD }}>Soporte</Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>← Inicio</Link>
        </div>
      </div>
    </main>
  );
}

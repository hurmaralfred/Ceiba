import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// Use verified domain if set, else Resend's sandbox address
const FROM = process.env.EMAIL_FROM || "Ceiba <onboarding@resend.dev>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ceiba.app";

// ─── Base layout ────────────────────────────────────────────────────────────
function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ceiba</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#166534,#15803d);padding:28px 32px;text-align:center;">
            <div style="font-size:28px;margin-bottom:4px;">🌳</div>
            <div style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">Ceiba</div>
            <div style="color:#86efac;font-size:13px;margin-top:2px;">El árbol de tu familia</div>
          </td>
        </tr>
        <!-- Body -->
        <tr><td style="padding:32px;">${content}</td></tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Ceiba · privado y seguro para tu familia<br/>
              <a href="${APP_URL}" style="color:#16a34a;text-decoration:none;">Abrir Ceiba</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Button helper ───────────────────────────────────────────────────────────
function btn(text: string, href: string) {
  return `<a href="${href}" style="display:inline-block;background:#166534;color:#ffffff;font-weight:600;font-size:15px;padding:13px 28px;border-radius:12px;text-decoration:none;margin-top:8px;">${text}</a>`;
}

// ─── Email: Bienvenida ───────────────────────────────────────────────────────
export async function sendWelcomeEmail(to: string, firstName: string) {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#166534;">¡Bienvenido a Ceiba, ${firstName}! 🌳</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
      Tu árbol familiar ya está listo. Cada familiar que invites hará crecer la red y
      descubrirás conexiones que ni sabías que tenías.
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 10px;font-weight:600;color:#166534;">Primeros pasos:</p>
      <p style="margin:4px 0;color:#475569;font-size:14px;">✅ Agrega a mamá, papá y hermanos</p>
      <p style="margin:4px 0;color:#475569;font-size:14px;">📨 Invítalos por WhatsApp con un link personalizado</p>
      <p style="margin:4px 0;color:#475569;font-size:14px;">🗺️ Ve dónde vive tu familia en el mapa</p>
      <p style="margin:4px 0;color:#475569;font-size:14px;">📸 Comparte fotos e historias familiares</p>
    </div>
    <div style="text-align:center;">
      ${btn("Ver mi árbol familiar →", `${APP_URL}/tree`)}
    </div>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: "🌳 Tu árbol familiar te espera en Ceiba",
    html,
  });
}

// ─── Email: Familiar se unió ─────────────────────────────────────────────────
export async function sendMemberJoinedEmail(
  to: string,
  ownerName: string,
  joinerName: string,
  relationLabel: string
) {
  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#166534;">¡${joinerName} se unió a Ceiba! 🎉</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
      Hola ${ownerName}, tu <strong>${relationLabel.toLowerCase()}</strong> <strong>${joinerName}</strong>
      aceptó la invitación y ya está conectado en tu árbol familiar.
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">👤</div>
      <div style="font-weight:700;font-size:18px;color:#166534;">${joinerName}</div>
      <div style="color:#64748b;font-size:14px;margin-top:4px;">Tu ${relationLabel.toLowerCase()} en Ceiba</div>
    </div>
    <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 24px;">
      Ahora puedes ver su ubicación en el mapa, chatear con él/ella en el grupo familiar y
      ver las fotos que comparta.
    </p>
    <div style="text-align:center;">
      ${btn("Ver árbol familiar →", `${APP_URL}/tree`)}
    </div>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: `🌳 ${joinerName} se unió a tu árbol familiar`,
    html,
  });
}

// ─── Email: Cumpleaños ───────────────────────────────────────────────────────
export async function sendBirthdayEmail(
  to: string,
  ownerName: string,
  birthdays: { first_name: string; last_name: string; birth_date: string }[]
) {
  const today = new Date();
  const single = birthdays.length === 1;
  const person = birthdays[0];
  const age = person.birth_date
    ? today.getFullYear() - parseInt(person.birth_date.split("-")[0])
    : null;

  const listHtml = birthdays
    .map((b) => {
      const a = b.birth_date
        ? today.getFullYear() - parseInt(b.birth_date.split("-")[0])
        : null;
      return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:28px;">🎂</span>
        <div>
          <div style="font-weight:600;color:#1e293b;">${b.first_name} ${b.last_name || ""}</div>
          ${a ? `<div style="font-size:13px;color:#64748b;">Cumple ${a} años hoy</div>` : ""}
        </div>
      </div>`;
    })
    .join("");

  const subject = single
    ? `🎂 Hoy cumple años ${person.first_name} ${person.last_name || ""}`
    : `🎂 ${birthdays.length} familiares cumplen años hoy`;

  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#166534;">¡Hoy hay cumpleaños! 🎉</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
      Hola ${ownerName}, ${single ? `<strong>${person.first_name}</strong> cumple años hoy` : `${birthdays.length} familiares cumplen años hoy`}.
      ¡No olvides felicitarlos!
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      ${listHtml}
    </div>
    <div style="text-align:center;">
      ${btn("Ver árbol familiar →", `${APP_URL}/tree`)}
    </div>
  `);

  return resend.emails.send({ from: FROM, to, subject, html });
}

// ─── Email: Nueva foto o evento ─────────────────────────────────────────────
export async function sendNewContentEmail(
  to: string,
  recipientName: string,
  uploaderName: string,
  type: "photo" | "event",
  title?: string
) {
  const isPhoto = type === "photo";
  const emoji = isPhoto ? "📸" : "📅";
  const ctaPath = isPhoto ? "/photos" : "/events";
  const displayTitle = isPhoto
    ? (title ? `"${title}"` : "Nueva foto familiar")
    : (title || "Nuevo evento");

  const html = layout(`
    <h2 style="margin:0 0 8px;font-size:22px;color:#166534;">${emoji} ${uploaderName} ${isPhoto ? "compartió una foto" : "registró un evento"}</h2>
    <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
      Hola ${recipientName}, tu familiar <strong>${uploaderName}</strong> acaba de agregar
      ${isPhoto ? "una nueva foto" : `el evento <strong>${title || "un evento"}</strong>`} en Ceiba.
    </p>
    <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
      <div style="font-size:40px;margin-bottom:8px;">${emoji}</div>
      <div style="font-weight:600;color:#166534;font-size:16px;">${displayTitle}</div>
    </div>
    <div style="text-align:center;">
      ${btn(`Ver ${isPhoto ? "fotos" : "eventos"} →`, `${APP_URL}${ctaPath}`)}
    </div>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: `${emoji} ${uploaderName} ${isPhoto ? "compartió una foto" : `registró "${displayTitle}"`} en Ceiba`,
    html,
  });
}

// ─── Email: Digest semanal ───────────────────────────────────────────────────
export async function sendWeeklyDigestEmail(
  to: string,
  firstName: string,
  data: {
    newMembers: { first_name: string; last_name: string }[];
    upcomingBirthdays: { first_name: string; last_name: string; birth_date: string }[];
    newPhotos: number;
    newEvents: number;
    totalMembers: number;
    joinedMembers: number;
  }
) {
  const hasAnything =
    data.newMembers.length > 0 ||
    data.upcomingBirthdays.length > 0 ||
    data.newPhotos > 0 ||
    data.newEvents > 0;

  if (!hasAnything) return null; // don't send empty digests

  const today = new Date();

  const sections: string[] = [];

  if (data.newMembers.length > 0) {
    const names = data.newMembers.map((m) => `${m.first_name} ${m.last_name || ""}`).join(", ");
    sections.push(`
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;color:#166534;margin-bottom:8px;">🌳 Nuevos en Ceiba esta semana</div>
        <p style="margin:0;color:#475569;font-size:14px;">${names} se unieron a tu árbol familiar.</p>
      </div>
    `);
  }

  if (data.upcomingBirthdays.length > 0) {
    const bdList = data.upcomingBirthdays
      .map((b) => {
        const bd = new Date(b.birth_date + "T12:00:00");
        const day = bd.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
        return `<div style="font-size:14px;color:#475569;padding:4px 0;">🎂 <strong>${b.first_name}</strong> — ${day}</div>`;
      })
      .join("");
    sections.push(`
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;color:#166534;margin-bottom:8px;">🎂 Cumpleaños esta semana</div>
        ${bdList}
      </div>
    `);
  }

  if (data.newPhotos > 0) {
    sections.push(`
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;color:#166534;margin-bottom:8px;">📸 Fotos nuevas</div>
        <p style="margin:0;color:#475569;font-size:14px;">${data.newPhotos} foto${data.newPhotos !== 1 ? "s" : ""} compartida${data.newPhotos !== 1 ? "s" : ""} esta semana.</p>
      </div>
    `);
  }

  if (data.newEvents > 0) {
    sections.push(`
      <div style="margin-bottom:20px;">
        <div style="font-weight:600;color:#166534;margin-bottom:8px;">📅 Eventos registrados</div>
        <p style="margin:0;color:#475569;font-size:14px;">${data.newEvents} evento${data.newEvents !== 1 ? "s" : ""} nuevo${data.newEvents !== 1 ? "s" : ""} en la historia familiar.</p>
      </div>
    `);
  }

  const html = layout(`
    <h2 style="margin:0 0 4px;font-size:22px;color:#166534;">Tu resumen familiar 🌳</h2>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 24px;">
      Semana del ${today.toLocaleDateString("es", { day: "numeric", month: "long" })}
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:8px;">
      <div style="display:flex;gap:24px;text-align:center;margin-bottom:16px;">
        <div style="flex:1;">
          <div style="font-size:28px;font-weight:700;color:#166534;">${data.totalMembers}</div>
          <div style="font-size:12px;color:#64748b;">familiares</div>
        </div>
        <div style="flex:1;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${data.joinedMembers}</div>
          <div style="font-size:12px;color:#64748b;">en Ceiba</div>
        </div>
      </div>
      ${sections.join('<div style="border-top:1px solid #e2e8f0;margin:16px 0;"></div>')}
    </div>
    <div style="text-align:center;margin-top:24px;">
      ${btn("Abrir mi árbol →", `${APP_URL}/tree`)}
    </div>
  `);

  return resend.emails.send({
    from: FROM,
    to,
    subject: `🌳 Tu resumen familiar de la semana`,
    html,
  });
}

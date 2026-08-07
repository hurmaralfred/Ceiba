"use client";
import { useState } from "react";
import Link from "next/link";
import { Gift, Share2, Copy, X } from "lucide-react";

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface BirthdayWithDays {
  person_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  days: number;
}

// ── Estilo 3D coherente con home/page.tsx ─────────────────────────────────────
function s3dCard(bg: string, ar: string, sh: string, glow = 0.1): React.CSSProperties {
  return {
    borderRadius: 18, background: bg, position: "relative", overflow: "hidden",
    borderTop: `1.5px solid rgba(${ar},0.5)`,
    borderLeft: `1px solid rgba(${ar},0.22)`,
    borderBottom: `4px solid ${sh}`,
    borderRight: `1px solid rgba(0,0,0,0.65)`,
    boxShadow: `0 8px 0 ${sh}, 0 16px 32px rgba(0,0,0,0.92), 0 0 32px rgba(${ar},${glow})`,
    transition: "transform 0.12s ease, box-shadow 0.12s ease",
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysLabel(days: number) {
  if (days === 0) return { icon: "🎂", text: "Hoy" };
  if (days === 1) return { icon: "🎁", text: "Mañana" };
  return { icon: "📅", text: `En ${days} días` };
}

function getTemplates(firstName: string, days: number) {
  const link = "ceibapp.com/invitar";
  return [
    {
      id: days === 0 ? "T1" : "T2",
      label: days === 0 ? "🎂 Hoy cumples" : "🎁 Esta semana",
      text:
        days === 0
          ? `Hola, ${firstName}. Hoy es tu cumpleaños y quería que estuvieras en nuestra galaxia familiar. Te invito a Ceiba — la app donde guardamos la historia de nuestra familia. ${link}`
          : `Hola, ${firstName}. Dentro de poco cumples años. Te invito a Ceiba, la app donde nuestra familia guarda fotos, historias y se mantiene conectada. ${link}`,
    },
    {
      id: "T3",
      label: "✉️ Genérica",
      text: `Hola, ${firstName}. Nuestra familia está en Ceiba — sin publicidad, sólo nosotros. Te invito a unirte. ${link}`,
    },
  ];
}

// Sprint 0: analytics en consola. En producción, conectar con el sistema de métricas.
function track(event: string, props: Record<string, unknown> = {}) {
  console.log(
    `%c[Ceiba · ${event}]`,
    "background:#1A1209;color:#D4AF37;padding:2px 6px;border-radius:3px;font-weight:600;",
    { timestamp: new Date().toISOString(), ...props }
  );
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function BirthdayCardFeed({
  birthdays,
  rosterPersonIds,
}: {
  birthdays: BirthdayWithDays[];
  rosterPersonIds: Set<string>;
}) {
  const [inviting, setInviting] = useState<BirthdayWithDays | null>(null);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [copied, setCopied]   = useState(false);
  const [sent, setSent]       = useState<Set<string>>(new Set());

  if (birthdays.length === 0) return null;

  // Solo cumpleaños de hoy o futuros este año (excluir los que ya pasaron)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const cards = birthdays
    .slice()
    .filter(p => {
      if (p.days === 0) return true;
      const bd = new Date(p.birth_date);
      const thisYearBd = new Date(todayStart.getFullYear(), bd.getMonth(), bd.getDate());
      return thisYearBd >= todayStart;
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  const openInvite = (p: BirthdayWithDays) => {
    setInviting(p);
    setTemplateIdx(0);
    setCopied(false);
    track("invitation_compose_shown", { personId: p.person_id, name: p.first_name });
    track("birthday_card_tapped", { personId: p.person_id, state: "NON_CONTACT", action: "invitar" });
  };

  const closeInvite = () => { setInviting(null); setCopied(false); };

  const handleCopy = async (msg: string) => {
    try { await navigator.clipboard.writeText(msg); } catch { /* sin clipboard API */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async (msg: string) => {
    if (navigator.share) {
      await navigator.share({ text: msg }).catch(() => handleCopy(msg));
    } else {
      await handleCopy(msg);
    }
    if (inviting) {
      setSent(prev => new Set([...prev, inviting.person_id]));
      track("invitation_sent", { personId: inviting.person_id, name: inviting.first_name });
    }
    closeInvite();
  };

  return (
    <>
      <style>{`
        @keyframes bdfSlide { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes bdfModalUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes bdfFade { from{opacity:0} to{opacity:1} }
      `}</style>

      {/* ── Encabezado de sección ── */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8, paddingTop:6 }}>
        <Gift size={12} style={{ color:"#d4af37" }} />
        <span style={{ fontSize:11, fontWeight:700, color:"rgba(212,175,55,0.65)",
          letterSpacing:"0.1em", textTransform:"uppercase" }}>
          Próximos cumpleaños
        </span>
      </div>

      {/* ── Tarjetas ── */}
      <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
        {cards.map((p, i) => {
          const inApp   = rosterPersonIds.has(p.person_id);
          const wasSent = sent.has(p.person_id);
          const isToday = p.days === 0;
          const { icon, text } = daysLabel(p.days);

          // Tokens de color: dorado para miembros activos, terracota para pendientes
          const ar  = inApp ? "212,175,55" : "196,98,45";
          const sh  = inApp ? "#040300"    : "#040100";
          const bg  = inApp ? "#100c02"    : "#0f0802";
          const acc = inApp ? "#d4af37"    : "#c4622d";

          return (
            <div key={p.person_id}
              style={{ ...s3dCard(bg, ar, sh, inApp ? 0.12 : 0.08),
                animation: `bdfSlide .3s ease both ${i * 0.06}s` }}>

              {/* Línea de acento superior */}
              <div style={{ position:"absolute", top:0, left:"18%", right:"18%", height:1,
                background: `rgba(${ar},0.4)` }} />

              {/* Badge de proximidad */}
              <div style={{ position:"absolute", top:10, right:12,
                background: isToday ? `rgba(${ar},0.12)` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isToday ? `rgba(${ar},0.3)` : "rgba(255,255,255,0.07)"}`,
                borderRadius:100, padding:"2px 8px",
                fontSize:9, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase",
                color: isToday ? acc : "rgba(255,255,255,0.3)" }}>
                {icon} {text}
              </div>

              <div style={{ padding:"12px 14px" }}>
                {/* Fila persona */}
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0,
                    background: `rgba(${ar},0.10)`,
                    border: `1.5px solid rgba(${ar},0.30)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:14, fontWeight:800, color: acc }}>
                    {p.first_name[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#fff", lineHeight:1.2,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {p.first_name} {p.last_name}
                    </div>
                    <div style={{ fontSize:10, fontWeight:600, marginTop:2,
                      color: inApp ? "rgba(212,175,55,0.55)" : "rgba(196,98,45,0.55)" }}>
                      {inApp ? "✓ En Ceiba" : "No está en Ceiba aún"}
                    </div>
                  </div>
                </div>

                {/* Botón de acción */}
                {inApp ? (
                  <Link href={`/persona/${p.person_id}`} style={{ textDecoration:"none" }}
                    onClick={() => track("birthday_card_tapped", { personId: p.person_id, state:"IN_APP", action:"felicitar" })}>
                    <button style={{ width:"100%", padding:"9px", borderRadius:12, cursor:"pointer",
                      background: isToday ? "#c9a820" : "rgba(212,175,55,0.08)",
                      border: isToday ? "none" : "1px solid rgba(212,175,55,0.2)",
                      borderTop:    isToday ? "1.5px solid rgba(255,240,100,0.45)" : undefined,
                      borderBottom: isToday ? "2.5px solid #6a5600" : undefined,
                      boxShadow: isToday ? "0 5px 0 #4a3c00, 0 8px 16px rgba(0,0,0,0.6)" : "none",
                      color: isToday ? "#030208" : "#d4af37",
                      fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
                      {isToday ? "🎉 Felicitar ahora" : "Ver perfil →"}
                    </button>
                  </Link>
                ) : wasSent ? (
                  <div style={{ width:"100%", padding:"9px", borderRadius:12,
                    background:"rgba(74,155,111,0.12)", border:"1px solid rgba(74,155,111,0.25)",
                    color:"#6DC994", fontSize:13, fontWeight:700, textAlign:"center" }}>
                    ✓ Invitación enviada
                  </div>
                ) : (
                  <button onClick={() => openInvite(p)}
                    style={{ width:"100%", padding:"9px", borderRadius:12, cursor:"pointer",
                      background:"rgba(196,98,45,0.10)", border:"1px solid rgba(196,98,45,0.28)",
                      color:"#c4622d", fontSize:13, fontWeight:700, fontFamily:"inherit" }}>
                    Invitar a Ceiba →
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal de invitación ── */}
      {inviting && (() => {
        const templates = getTemplates(inviting.first_name, inviting.days);
        const msg       = templates[templateIdx]?.text ?? "";
        return (
          <div onClick={closeInvite}
            style={{ position:"fixed", inset:0, zIndex:200,
              background:"rgba(3,2,8,0.85)", backdropFilter:"blur(12px)",
              WebkitBackdropFilter:"blur(12px)",
              display:"flex", alignItems:"flex-end", justifyContent:"center",
              animation:"bdfFade .2s" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ width:"100%", maxWidth:430,
                borderTopLeftRadius:26, borderTopRightRadius:26,
                background:"#0c0a12", borderBottom:"none",
                border:"1px solid rgba(212,175,55,0.12)",
                padding:`0 0 max(24px, env(safe-area-inset-bottom))`,
                maxHeight:"88vh", overflowY:"auto",
                animation:"bdfModalUp .3s cubic-bezier(.22,.8,.36,1)" }}>

              {/* Handle */}
              <div style={{ width:36, height:4, borderRadius:2,
                background:"rgba(255,255,255,0.15)", margin:"10px auto 16px" }} />

              {/* Header */}
              <div style={{ padding:"0 20px 14px",
                borderBottom:"1px solid rgba(255,255,255,0.05)",
                display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#fff", marginBottom:3 }}>
                    Invitar a {inviting.first_name}
                  </div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                    {daysLabel(inviting.days).icon} {daysLabel(inviting.days).text}
                  </div>
                </div>
                <button onClick={closeInvite}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    padding:4, color:"rgba(255,255,255,0.3)", lineHeight:0 }}>
                  <X size={18} />
                </button>
              </div>

              {/* Tabs de plantilla */}
              <div style={{ display:"flex", gap:8, padding:"12px 20px 0", overflowX:"auto" }}>
                {templates.map((t, i) => (
                  <button key={t.id} onClick={() => setTemplateIdx(i)}
                    style={{ flexShrink:0, padding:"6px 12px", borderRadius:20,
                      cursor:"pointer", fontFamily:"inherit",
                      fontSize:12, fontWeight:600, whiteSpace:"nowrap",
                      background: i === templateIdx ? "rgba(196,98,45,0.18)" : "rgba(255,255,255,0.05)",
                      border:     i === templateIdx ? "1px solid rgba(196,98,45,0.38)" : "1px solid transparent",
                      color:      i === templateIdx ? "#c4622d" : "rgba(255,255,255,0.35)" }}>
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Vista previa del mensaje */}
              <div style={{ padding:"12px 20px" }}>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.3)",
                  letterSpacing:".06em", textTransform:"uppercase", marginBottom:8 }}>Mensaje</div>
                <div style={{ background:"rgba(255,255,255,0.04)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:12, padding:"12px 14px",
                  fontSize:14, color:"rgba(255,255,255,0.75)", lineHeight:1.65 }}>
                  {msg}
                </div>
              </div>

              {/* Acciones de envío */}
              <div style={{ padding:"0 20px", display:"flex", flexDirection:"column", gap:8 }}>
                <button onClick={() => handleShare(msg)}
                  style={{ width:"100%", padding:"13px", borderRadius:12, cursor:"pointer",
                    background:"#c4622d", border:"none", color:"#fff",
                    fontSize:14, fontWeight:700, fontFamily:"inherit",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                  <Share2 size={16} /> Compartir mensaje
                </button>
                <button onClick={() => handleCopy(msg)}
                  style={{ width:"100%", padding:"11px", borderRadius:12, cursor:"pointer",
                    background: copied ? "rgba(74,155,111,0.12)" : "rgba(255,255,255,0.05)",
                    border:     copied ? "1px solid rgba(74,155,111,0.3)" : "1px solid rgba(255,255,255,0.09)",
                    color:      copied ? "#6DC994" : "rgba(255,255,255,0.5)",
                    fontSize:13, fontWeight:600, fontFamily:"inherit",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                  <Copy size={14} /> {copied ? "¡Copiado!" : "Copiar mensaje"}
                </button>
                <button onClick={closeInvite}
                  style={{ width:"100%", padding:"10px", borderRadius:12, cursor:"pointer",
                    background:"transparent",
                    border:"1px solid rgba(255,255,255,0.07)",
                    color:"rgba(255,255,255,0.3)", fontSize:13, fontFamily:"inherit" }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

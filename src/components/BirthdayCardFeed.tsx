"use client";
import { useState } from "react";
import Link from "next/link";
import { Gift, Share2, Copy, X, ChevronRight } from "lucide-react";

interface BirthdayWithDays {
  person_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  days: number;
}

function daysLabel(days: number): { icon: string; text: string; urgent: boolean } {
  if (days === 0) return { icon: "🎂", text: "Hoy",     urgent: true  };
  if (days === 1) return { icon: "🎁", text: "Mañana",  urgent: true  };
  if (days <= 7)  return { icon: "🎁", text: `${days}d`, urgent: false };
  return              { icon: "📅", text: `${days}d`, urgent: false };
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
    setInviting(p); setTemplateIdx(0); setCopied(false);
  };
  const closeInvite = () => { setInviting(null); setCopied(false); };

  const handleCopy = async (msg: string) => {
    try { await navigator.clipboard.writeText(msg); } catch { /* sin clipboard */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShare = async (msg: string) => {
    if (navigator.share) {
      await navigator.share({ text: msg }).catch(() => handleCopy(msg));
    } else {
      await handleCopy(msg);
    }
    if (inviting) setSent(prev => new Set([...prev, inviting.person_id]));
    closeInvite();
  };

  return (
    <>
      <style>{`
        @keyframes bdfFade    { from{opacity:0} to{opacity:1} }
        @keyframes bdfModalUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes bdfRow     { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
      `}</style>

      {/* Encabezado */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
        <Gift size={12} style={{ color:"#d4af37" }} />
        <span style={{ fontSize:11, fontWeight:700, color:"rgba(212,175,55,0.65)",
          letterSpacing:"0.1em", textTransform:"uppercase", flex:1 }}>
          Próximos cumpleaños
        </span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontWeight:600 }}>
          {cards.length}
        </span>
      </div>

      {/* Lista compacta */}
      <div style={{
        borderRadius:14,
        border:"1px solid rgba(212,175,55,0.10)",
        borderTop:"1.5px solid rgba(212,175,55,0.18)",
        overflow:"hidden",
        background:"rgba(255,255,255,0.02)",
      }}>
        {cards.map((p, i) => {
          const inApp   = rosterPersonIds.has(p.person_id);
          const wasSent = sent.has(p.person_id);
          const { icon, text, urgent } = daysLabel(p.days);
          const isLast  = i === cards.length - 1;

          return (
            <div key={p.person_id} style={{
              display:"flex", alignItems:"center", gap:11,
              padding:"11px 14px",
              borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.04)",
              animation:`bdfRow .25s ease both ${i * 0.05}s`,
            }}>
              {/* Emoji */}
              <div style={{ fontSize:18, lineHeight:1, width:24, textAlign:"center", flexShrink:0 }}>
                {icon}
              </div>

              {/* Nombre */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#fff",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {p.first_name} {p.last_name}
                </div>
              </div>

              {/* Días */}
              <div style={{
                fontSize:10, fontWeight:800, flexShrink:0,
                padding:"3px 8px", borderRadius:20,
                background: urgent
                  ? "rgba(212,175,55,0.15)"
                  : "rgba(255,255,255,0.04)",
                border: urgent
                  ? "1px solid rgba(212,175,55,0.35)"
                  : "1px solid rgba(255,255,255,0.07)",
                color: urgent ? "#d4af37" : "rgba(255,255,255,0.30)",
              }}>
                {text}
              </div>

              {/* Acción */}
              {inApp ? (
                <Link href="/chat" style={{ textDecoration:"none", flexShrink:0 }}>
                  <div style={{
                    width:30, height:30, borderRadius:"50%", display:"flex",
                    alignItems:"center", justifyContent:"center",
                    background: urgent ? "#c9a820" : "rgba(212,175,55,0.07)",
                    border: urgent ? "none" : "1px solid rgba(212,175,55,0.18)",
                    borderTop: urgent ? "1.5px solid #ffe060" : undefined,
                    boxShadow: urgent ? "0 3px 0 rgba(90,60,0,0.5), 0 5px 12px rgba(0,0,0,0.5)" : "none",
                  }}>
                    <span style={{ fontSize:13 }}>🎉</span>
                  </div>
                </Link>
              ) : wasSent ? (
                <div style={{ fontSize:10, color:"#6DC994", fontWeight:700, flexShrink:0 }}>✓</div>
              ) : (
                <button onClick={() => openInvite(p)}
                  style={{ background:"none", border:"none", cursor:"pointer",
                    padding:0, flexShrink:0, display:"flex", alignItems:"center" }}>
                  <ChevronRight size={16} style={{ color:"rgba(196,98,45,0.6)" }} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de invitación — sin cambios funcionales */}
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
                background:"#0c0a12",
                border:"1px solid rgba(212,175,55,0.12)",
                padding:`0 0 max(24px, env(safe-area-inset-bottom))`,
                maxHeight:"88vh", overflowY:"auto",
                animation:"bdfModalUp .3s cubic-bezier(.22,.8,.36,1)" }}>

              <div style={{ width:36, height:4, borderRadius:2,
                background:"rgba(255,255,255,0.15)", margin:"10px auto 16px" }} />

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

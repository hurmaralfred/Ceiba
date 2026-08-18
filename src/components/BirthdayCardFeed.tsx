"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift, Share2, Copy, X } from "lucide-react";

// ── Gorrito de fiesta SVG ─────────────────────────────────────────────────────
function PartyHat({ days }: { days: number }) {
  // Colores: dorado para hoy, rosa/morado para próximos
  const cone  = days === 0 ? "#f5c842" : days <= 3 ? "#e854a4" : "#9b59e8";
  const band  = days === 0 ? "#fff6c0" : days <= 3 ? "#ffc0e0" : "#d0b8ff";
  const pom   = days === 0 ? "#fff"    : days <= 3 ? "#ff80c8" : "#c090ff";
  return (
    <svg width="26" height="30" viewBox="0 0 26 30"
      style={{ position:"absolute", top:-20, left:"50%",
        transform:"translateX(-38%) rotate(-18deg)",
        zIndex:10, filter:"drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
        pointerEvents:"none" }}
      aria-hidden>
      {/* Cuerpo del gorro */}
      <polygon points="13,1 24,26 2,26" fill={cone} />
      {/* Franja diagonal decorativa */}
      <polygon points="13,1 17.5,13.5 9,13.5" fill={band} opacity="0.55" />
      {/* Ribete inferior */}
      <rect x="1" y="24" width="24" height="4" rx="2" fill={band} />
      {/* Pompón en la punta */}
      <circle cx="13" cy="3" r="4" fill={pom} />
      <circle cx="13" cy="3" r="2.5" fill="white" opacity="0.5" />
    </svg>
  );
}

interface BirthdayWithDays {
  person_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  days: number;
  photo_path?: string | null;
}

function daysChip(days: number): { label: string; gold: boolean } {
  if (days === 0) return { label: "Hoy 🎂", gold: true  };
  if (days === 1) return { label: "Mañana", gold: true  };
  if (days <= 7)  return { label: `${days}d 🎁`, gold: false };
  return              { label: `${days}d`,    gold: false };
}

function getTemplates(firstName: string, days: number) {
  const link = "https://ceibapp.com/invitar";
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
  rosterPersonMap,
}: {
  birthdays: BirthdayWithDays[];
  // person_id → user_id de familiares registrados en Ceiba
  rosterPersonMap: Record<string, string>;
}) {
  const router = useRouter();
  const [inviting, setInviting]       = useState<BirthdayWithDays | null>(null);
  const [templateIdx, setTemplateIdx] = useState(0);
  const [copied, setCopied]           = useState(false);
  const [sent, setSent]               = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState<string | null>(null); // person_id en curso

  if (birthdays.length === 0) return null;

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const cards = birthdays
    .filter(p => {
      if (p.days === 0) return true;
      const bd = new Date(p.birth_date);
      return new Date(todayStart.getFullYear(), bd.getMonth(), bd.getDate()) >= todayStart;
    })
    .sort((a, b) => a.days - b.days)
    .slice(0, 6);

  // Abre un DM con el familiar registrado y navega a esa sala
  const handleFelicitar = async (p: BirthdayWithDays) => {
    const userId = rosterPersonMap[p.person_id];
    if (!userId) return;
    setLoading(p.person_id);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId: userId }),
      });
      if (res.ok) {
        const { roomId } = await res.json();
        router.push(`/chat/${roomId}`);
      } else {
        router.push("/chat");
      }
    } catch {
      router.push("/chat");
    } finally {
      setLoading(null);
    }
  };

  const openInvite  = (p: BirthdayWithDays) => { setInviting(p); setTemplateIdx(0); setCopied(false); };
  const closeInvite = () => { setInviting(null); setCopied(false); };

  const handleCopy = async (msg: string) => {
    try { await navigator.clipboard.writeText(msg); } catch { /**/ }
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };
  const handleShare = async (msg: string) => {
    if (navigator.share) await navigator.share({ text: msg }).catch(() => handleCopy(msg));
    else await handleCopy(msg);
    if (inviting) setSent(prev => new Set([...prev, inviting.person_id]));
    closeInvite();
  };

  return (
    <>
      <style>{`
        @keyframes bdfFade    { from{opacity:0} to{opacity:1} }
        @keyframes bdfModalUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
        @keyframes bdfPop     { from{opacity:0;transform:scale(0.88)} to{opacity:1;transform:scale(1)} }
        @keyframes bday-ring  { 0%,100%{opacity:0.7} 50%{opacity:1} }
      `}</style>

      {/* Encabezado */}
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
        <Gift size={12} style={{ color:"#d4af37" }} />
        <span style={{ fontSize:11, fontWeight:700, color:"rgba(212,175,55,0.65)",
          letterSpacing:"0.1em", textTransform:"uppercase", flex:1 }}>
          Próximos cumpleaños
        </span>
        <span style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontWeight:600 }}>{cards.length}</span>
      </div>

      {/* Tira horizontal scrollable */}
      <div style={{
        display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap",
        paddingBottom:4,
      }}>
        {cards.map((p, i) => {
          const userId  = rosterPersonMap[p.person_id];
          const inApp   = !!userId;           // registrado en Ceiba
          const wasSent = sent.has(p.person_id);
          const busy    = loading === p.person_id;
          const { label, gold } = daysChip(p.days);
          const initials  = p.first_name[0]?.toUpperCase() ?? "?";
          const firstName = p.first_name.split(" ")[0];
          const accentRgb = inApp ? "212,175,55" : "196,98,45";
          const accentHex = inApp ? "#d4af37"    : "#c4622d";

          return (
            <div key={p.person_id} style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              flexShrink:0, width:80,
              animation:`bdfPop .28s ease both ${i * 0.06}s`,
            }}>
              {/* Avatar con anillo y gorrito */}
              <div style={{ position:"relative", width:60, height:60, overflow:"visible" }}>
                {/* Gorrito de fiesta encima del avatar */}
                <PartyHat days={p.days} />
                {gold && (
                  <div style={{
                    position:"absolute", inset:-3, borderRadius:"50%",
                    background:"conic-gradient(from 0deg, rgba(242,180,60,0.9) 0deg, rgba(200,120,48,0.5) 120deg, rgba(242,180,60,0.9) 360deg)",
                    animation:"home-ring-spin 5s linear infinite, bday-ring 2s ease-in-out infinite",
                    filter:"blur(1px)",
                  }} />
                )}
                {gold && (
                  <div style={{ position:"absolute", inset:-1, borderRadius:"50%",
                    background:"#030208", zIndex:1 }} />
                )}
                <div style={{
                  position:"relative", zIndex:2,
                  width:60, height:60, borderRadius:"50%",
                  background:`rgba(${accentRgb},0.10)`,
                  border:`2px solid rgba(${accentRgb},${gold ? 0.6 : 0.25})`,
                  boxShadow: gold
                    ? `0 0 18px rgba(${accentRgb},0.35), 0 4px 12px rgba(0,0,0,0.6)`
                    : `0 4px 12px rgba(0,0,0,0.45)`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  overflow:"hidden",
                }}>
                  {p.photo_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.photo_path} alt={p.first_name}
                      style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  ) : (
                    <span style={{ fontSize:22, fontWeight:800, color:accentHex,
                      textShadow:`0 0 12px rgba(${accentRgb},0.5)` }}>
                      {initials}
                    </span>
                  )}
                </div>
              </div>

              {/* Nombre */}
              <div style={{ marginTop:7, fontSize:11, fontWeight:700, color:"#fff",
                maxWidth:78, overflow:"hidden", textOverflow:"ellipsis",
                whiteSpace:"nowrap", textAlign:"center" }}>
                {firstName}
              </div>

              {/* Días chip */}
              <div style={{
                marginTop:4, padding:"2px 8px", borderRadius:20, fontSize:9, fontWeight:800,
                background: gold ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.04)",
                border:     gold ? "1px solid rgba(212,175,55,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color:      gold ? "#d4af37" : "rgba(255,255,255,0.28)",
                textAlign:"center",
              }}>
                {label}
              </div>

              {/* ── Acción según si está o no registrado y si es hoy ── */}
              {inApp && p.days === 0 ? (
                // Registrado + cumple HOY → botón Felicitar
                <button
                  disabled={busy}
                  onClick={() => handleFelicitar(p)}
                  style={{
                    marginTop:8, padding:"5px 10px", borderRadius:20, fontSize:10,
                    fontWeight:700, cursor: busy ? "default" : "pointer", fontFamily:"inherit",
                    background:"#c9a820", color:"#030208",
                    border:"none", borderTop:"1.5px solid #ffe060",
                    boxShadow:"0 3px 0 rgba(90,60,0,0.5)",
                    whiteSpace:"nowrap", opacity: busy ? 0.6 : 1,
                  }}>
                  {busy ? "…" : "🎉 Felicitar"}
                </button>
              ) : inApp ? (
                // Registrado pero aún no es su día → solo cuenta regresiva
                <div style={{
                  marginTop:8, padding:"3px 8px", borderRadius:20, fontSize:9, fontWeight:700,
                  background:"rgba(212,175,55,0.06)", border:"1px solid rgba(212,175,55,0.14)",
                  color:"rgba(212,175,55,0.4)", textAlign:"center", whiteSpace:"nowrap",
                }}>
                  {p.days === 1 ? "Mañana 🎂" : `${p.days}d 🎁`}
                </div>
              ) : wasSent ? (
                // Invitación ya enviada
                <div style={{ marginTop:8, fontSize:10, fontWeight:700,
                  color:"#6DC994", textAlign:"center" }}>
                  ✓ Enviado
                </div>
              ) : (
                // No registrado → invitar a Ceiba
                <button
                  onClick={() => openInvite(p)}
                  style={{
                    marginTop:8, padding:"5px 10px", borderRadius:20, fontSize:10,
                    fontWeight:700, cursor:"pointer", fontFamily:"inherit",
                    background:"rgba(196,98,45,0.10)", border:"1px solid rgba(196,98,45,0.28)",
                    color:"#c4622d", whiteSpace:"nowrap",
                  }}>
                  Invitar
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de invitación (solo para no registrados) */}
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
                    {daysChip(inviting.days).label}
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
                    background:"transparent", border:"1px solid rgba(255,255,255,0.07)",
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

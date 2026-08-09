"use client";
import { useEffect, useState, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Unlock, Send, X, ChevronDown, Paperclip, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Capsula {
  id: string;
  sender_name: string;
  sender_photo: string | null;
  recipient_name: string;
  recipient_photo: string | null;
  unlock_date: string;
  created_at: string;
  opened_at: string | null;
  is_mine: boolean;
  is_recipient: boolean;
  can_open: boolean;
  unlocked: boolean;
}

interface FamilyMember {
  person_id: string;
  name: string;
  photo: string | null;
}

function Avatar({ name, photo, size = 32 }: { name: string; photo: string | null; size?: number }) {
  const initial = name.charAt(0).toUpperCase();
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photo} alt={name}
        style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#1a0e30",
      border: "1.5px solid rgba(150,90,255,0.35)", display: "flex", alignItems: "center",
      justifyContent: "center", flexShrink: 0, fontSize: size * 0.38, fontWeight: 700,
      color: "rgba(150,90,255,0.85)" }}>
      {initial}
    </div>
  );
}

function formatUnlockDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function CapsulaPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [capsulas, setCapsulas] = useState<Capsula[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [myPersonId, setMyPersonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [openedContent, setOpenedContent] = useState<{ id: string; content: string; media_url?: string | null } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // Compose form state
  const [recipientId, setRecipientId] = useState("");
  const [unlockDate, setUnlockDate] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  // Media attachment state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaIsVideo, setMediaIsVideo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/capsulas");
    if (res.status === 401) { router.push("/login"); return; }
    if (res.ok) {
      const data = await res.json();
      setCapsulas(data.capsulas ?? []);
      setFamilyMembers(data.familyMembers ?? []);
      setMyPersonId(data.myPersonId ?? null);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // Deep link: open a specific capsula from push notification (?open=id)
  const openParam = searchParams.get("open");
  useEffect(() => {
    if (!openParam || loading || openedContent) return;
    const target = capsulas.find(c => c.id === openParam && c.can_open && !c.opened_at);
    if (target) handleOpen(target.id);
  }, [openParam, loading, capsulas]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearMedia = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaIsVideo(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaIsVideo(file.type.startsWith("video/"));
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleSend = async () => {
    setSendError("");
    if (!recipientId) { setSendError("Elige un destinatario"); return; }
    if (!unlockDate) { setSendError("Elige una fecha de apertura"); return; }
    if (!message.trim()) { setSendError("Escribe tu mensaje"); return; }
    setSending(true);

    let media_url: string | null = null;
    if (mediaFile) {
      const ext = mediaFile.name.split(".").pop() ?? "bin";
      const path = `capsulas/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { data: upload, error: upErr } = await supabase.storage
        .from("family-photos")
        .upload(path, mediaFile, { cacheControl: "3600", upsert: false });
      if (upErr) { setSendError("Error al subir el archivo"); setSending(false); return; }
      const { data: pub } = supabase.storage.from("family-photos").getPublicUrl(upload.path);
      media_url = pub.publicUrl;
    }

    const res = await fetch("/api/capsulas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_person_id: recipientId, unlock_date: unlockDate, content: message, ...(media_url ? { media_url } : {}) }),
    });
    if (res.ok) {
      setComposing(false);
      setRecipientId(""); setUnlockDate(""); setMessage(""); setSendError("");
      clearMedia();
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      setSendError(d.error ?? "Error al enviar");
    }
    setSending(false);
  };

  const handleOpen = async (id: string) => {
    setOpening(id);
    const res = await fetch(`/api/capsulas/${id}`);
    if (res.ok) {
      const d = await res.json();
      setOpenedContent({ id, content: d.content, media_url: d.media_url ?? null });
      load();
    }
    setOpening(null);
  };

  const selectedMember = familyMembers.find(m => m.person_id === recipientId);
  const minDate = new Date(); minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 10);

  const sealed = capsulas.filter(c => !c.unlocked);
  const unlocked = capsulas.filter(c => c.unlocked);

  return (
    <div style={{ minHeight: "100dvh", background: "#030208", color: "#fff", paddingBottom: 80 }}>
      <style>{`
        @keyframes capsule-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes star-twinkle { 0%,100%{opacity:.9} 50%{opacity:.2} }
        @keyframes seal-glow { 0%,100%{box-shadow:0 0 0 2px rgba(150,90,255,0.22),0 8px 32px rgba(0,0,0,0.8)} 50%{box-shadow:0 0 0 2px rgba(150,90,255,0.60),0 8px 32px rgba(0,0,0,0.8),0 0 28px rgba(150,90,255,0.28)} }
        @keyframes unlock-pulse { 0%,100%{box-shadow:0 0 0 2px rgba(212,175,55,0.30),0 8px 32px rgba(0,0,0,0.8)} 50%{box-shadow:0 0 0 2px rgba(212,175,55,0.80),0 8px 32px rgba(0,0,0,0.8),0 0 36px rgba(212,175,55,0.36)} }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1) opacity(0.4); }
        textarea { resize: none; }
        textarea:focus { outline: none; }
        input[type="date"]:focus { outline: none; }
      `}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(3,2,8,0.92)",
        backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(150,90,255,0.12)",
        padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.55)", cursor: "pointer",
            display: "flex", alignItems: "center", padding: 4 }}>
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>Cápsulas del tiempo</div>
          <div style={{ fontSize: 10, color: "rgba(150,90,255,0.60)", letterSpacing: "0.06em" }}>
            Mensajes que el tiempo guardará
          </div>
        </div>
        <button onClick={() => setComposing(true)}
          style={{ marginLeft: "auto", background: "rgba(150,90,255,0.18)", border: "1.5px solid rgba(150,90,255,0.40)",
            borderRadius: 12, color: "#c0a0ff", padding: "8px 14px", cursor: "pointer",
            fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          <Send size={13} /> Nueva
        </button>
      </div>

      {/* Star field */}
      <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} aria-hidden>
        {[[22,60],[88,30],[180,18],[260,45],[310,80],[40,140],[150,100],[280,130],[70,200],[220,180],[320,160]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="0.7" fill="white" opacity="0.35"
            style={{ animation: `star-twinkle ${2.5 + (i % 3) * 0.8}s ease-in-out infinite ${i * 0.4}s` }} />
        ))}
      </svg>

      <div style={{ position: "relative", zIndex: 1, padding: "20px 16px 0" }}>

        {loading ? (
          <div style={{ textAlign: "center", color: "rgba(150,90,255,0.45)", padding: 60, fontSize: 13 }}>
            Cargando cápsulas...
          </div>
        ) : (
          <>
            {/* Ready to open */}
            {unlocked.filter(c => c.can_open && !c.opened_at).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(212,175,55,0.55)", marginBottom: 12 }}>
                  ✦ Listas para abrir
                </div>
                {unlocked.filter(c => c.can_open && !c.opened_at).map(c => (
                  <div key={c.id} style={{ borderRadius: 18, background: "#0c0902",
                    border: "1px solid rgba(212,175,55,0.22)",
                    animation: "unlock-pulse 3s ease-in-out infinite",
                    marginBottom: 10, padding: "16px 16px 14px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
                      background: "rgba(212,175,55,0.38)" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <Avatar name={c.sender_name} photo={c.sender_photo} size={36} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{c.sender_name}</div>
                        <div style={{ fontSize: 10, color: "rgba(212,175,55,0.60)" }}>te escribió el {new Date(c.created_at).toLocaleDateString("es-MX")}</div>
                      </div>
                      <Unlock size={16} style={{ marginLeft: "auto", color: "#d4af37" }} />
                    </div>
                    {openedContent?.id === c.id ? (
                      <div>
                        {openedContent.media_url && (
                          openedContent.media_url.match(/\.(mp4|mov|webm|ogg)(\?|$)/i) ? (
                            <video controls src={openedContent.media_url}
                              style={{ width: "100%", borderRadius: 12, marginBottom: 10, maxHeight: 280, background: "#000" }} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={openedContent.media_url} alt="Archivo adjunto"
                              style={{ width: "100%", borderRadius: 12, marginBottom: 10, objectFit: "cover", maxHeight: 280 }} />
                          )
                        )}
                        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.88)", lineHeight: 1.65,
                          background: "rgba(212,175,55,0.06)", borderRadius: 12, padding: "12px 14px",
                          border: "1px solid rgba(212,175,55,0.14)" }}>
                          {openedContent.content}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => handleOpen(c.id)} disabled={opening === c.id}
                        style={{ width: "100%", background: "rgba(212,175,55,0.14)", border: "1.5px solid rgba(212,175,55,0.40)",
                          borderRadius: 12, color: "#d4af37", padding: "10px", cursor: "pointer",
                          fontSize: 13, fontWeight: 700 }}>
                        {opening === c.id ? "Abriendo..." : "Abrir mi cápsula"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Sealed */}
            {sealed.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(150,90,255,0.50)", marginBottom: 12 }}>
                  Selladas · {sealed.length}
                </div>
                {sealed.map(c => {
                  const days = daysUntil(c.unlock_date);
                  return (
                    <div key={c.id} style={{ borderRadius: 18, background: "#06030f",
                      border: "1px solid rgba(150,90,255,0.16)",
                      animation: "seal-glow 4s ease-in-out infinite",
                      marginBottom: 10, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: 1,
                        background: "rgba(150,90,255,0.30)" }} />
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={c.sender_name} photo={c.sender_photo} size={32} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                            {c.sender_name} → {c.recipient_name}
                          </div>
                          <div style={{ fontSize: 10, color: "rgba(150,90,255,0.55)", marginTop: 2 }}>
                            Se abre el {formatUnlockDate(c.unlock_date)}
                            {days > 0 ? ` · en ${days} días` : ""}
                          </div>
                        </div>
                        <Lock size={14} style={{ color: "rgba(150,90,255,0.55)", flexShrink: 0 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Opened / past unlocked */}
            {unlocked.filter(c => !c.can_open || c.opened_at).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase",
                  color: "rgba(255,255,255,0.20)", marginBottom: 12 }}>
                  Abiertas
                </div>
                {unlocked.filter(c => !c.can_open || c.opened_at).map(c => (
                  <div key={c.id} style={{ borderRadius: 16, background: "#050309",
                    border: "1px solid rgba(255,255,255,0.06)",
                    marginBottom: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={c.sender_name} photo={c.sender_photo} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>
                          {c.sender_name} → {c.recipient_name}
                        </div>
                        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.22)", marginTop: 1 }}>
                          {c.opened_at ? `Abierta · ${formatUnlockDate(c.unlock_date)}` : formatUnlockDate(c.unlock_date)}
                        </div>
                      </div>
                      {c.can_open && !openedContent && (
                        <button onClick={() => handleOpen(c.id)} disabled={opening === c.id}
                          style={{ background: "none", border: "none", color: "rgba(212,175,55,0.55)", cursor: "pointer", fontSize: 11 }}>
                          Leer
                        </button>
                      )}
                    </div>
                    {openedContent?.id === c.id && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        {openedContent.media_url && (
                          openedContent.media_url.match(/\.(mp4|mov|webm|ogg)(\?|$)/i) ? (
                            <video controls src={openedContent.media_url}
                              style={{ width: "100%", borderRadius: 10, marginBottom: 8, maxHeight: 220, background: "#000" }} />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={openedContent.media_url} alt="Archivo adjunto"
                              style={{ width: "100%", borderRadius: 10, marginBottom: 8, objectFit: "cover", maxHeight: 220 }} />
                          )
                        )}
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", lineHeight: 1.6 }}>
                          {openedContent.content}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {capsulas.length === 0 && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>✉️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.55)", marginBottom: 6 }}>
                  Ninguna cápsula todavía
                </div>
                <div style={{ fontSize: 12, color: "rgba(150,90,255,0.45)", lineHeight: 1.6 }}>
                  Sé el primero en dejar un mensaje para el futuro.
                </div>
                <button onClick={() => setComposing(true)}
                  style={{ marginTop: 20, background: "rgba(150,90,255,0.18)", border: "1.5px solid rgba(150,90,255,0.40)",
                    borderRadius: 14, color: "#c0a0ff", padding: "12px 24px", cursor: "pointer",
                    fontSize: 13, fontWeight: 700 }}>
                  Crear primera cápsula
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Compose modal */}
      {composing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.80)",
          backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end" }}
          onClick={e => { if (e.target === e.currentTarget) setComposing(false); }}>
          <div style={{ width: "100%", background: "#06030f", borderRadius: "24px 24px 0 0",
            padding: "20px 16px 36px", border: "1px solid rgba(150,90,255,0.22)",
            borderBottom: "none", maxHeight: "88dvh", overflowY: "auto" }}>

            <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>Nueva cápsula</div>
              <button onClick={() => setComposing(false)}
                style={{ marginLeft: "auto", background: "none", border: "none",
                  color: "rgba(255,255,255,0.35)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Recipient picker */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(150,90,255,0.55)", marginBottom: 8 }}>Para quién</div>
              <div style={{ position: "relative" }}>
                <button onClick={() => setShowPicker(p => !p)}
                  style={{ width: "100%", background: "#0a0618", border: "1.5px solid rgba(150,90,255,0.28)",
                    borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10,
                    color: "#fff", cursor: "pointer", textAlign: "left" }}>
                  {selectedMember ? (
                    <>
                      <Avatar name={selectedMember.name} photo={selectedMember.photo} size={28} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{selectedMember.name}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.30)" }}>Seleccionar familiar…</span>
                  )}
                  <ChevronDown size={16} style={{ marginLeft: "auto", color: "rgba(150,90,255,0.45)", flexShrink: 0 }} />
                </button>
                {showPicker && (
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 10,
                    background: "#0a0618", border: "1.5px solid rgba(150,90,255,0.28)", borderRadius: 14,
                    overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                    {familyMembers.map(m => (
                      <button key={m.person_id}
                        onClick={() => { setRecipientId(m.person_id); setShowPicker(false); }}
                        style={{ width: "100%", background: recipientId === m.person_id ? "rgba(150,90,255,0.14)" : "none",
                          border: "none", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10,
                          cursor: "pointer", color: "#fff", textAlign: "left" }}>
                        <Avatar name={m.name} photo={m.photo} size={28} />
                        <span style={{ fontSize: 13 }}>{m.name}</span>
                      </button>
                    ))}
                    {familyMembers.length === 0 && (
                      <div style={{ padding: "14px", fontSize: 12, color: "rgba(255,255,255,0.30)", textAlign: "center" }}>
                        No hay familiares registrados
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Unlock date */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(150,90,255,0.55)", marginBottom: 8 }}>Se abrirá el</div>
              <input type="date" value={unlockDate} min={minDateStr}
                onChange={e => setUnlockDate(e.target.value)}
                style={{ width: "100%", background: "#0a0618", border: "1.5px solid rgba(150,90,255,0.28)",
                  borderRadius: 14, padding: "12px 14px", color: unlockDate ? "#fff" : "rgba(255,255,255,0.30)",
                  fontSize: 13, boxSizing: "border-box" }} />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                color: "rgba(150,90,255,0.55)", marginBottom: 8 }}>
                Tu mensaje · {message.length}/2000
              </div>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                placeholder="Escríbele algo que solo el tiempo podrá revelar…"
                rows={5}
                style={{ width: "100%", background: "#0a0618", border: "1.5px solid rgba(150,90,255,0.28)",
                  borderRadius: 14, padding: "12px 14px", color: "#fff",
                  fontSize: 14, lineHeight: 1.6, boxSizing: "border-box",
                  fontFamily: "inherit" }} />
            </div>

            {/* Media attachment */}
            <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
              onChange={handleFileChange} />

            {mediaPreview ? (
              <div style={{ marginBottom: 16, position: "relative" }}>
                {mediaIsVideo ? (
                  <div style={{ position: "relative", borderRadius: 14, overflow: "hidden",
                    background: "#000", border: "1.5px solid rgba(150,90,255,0.28)" }}>
                    <video src={mediaPreview} style={{ width: "100%", maxHeight: 160, objectFit: "contain" }} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
                      justifyContent: "center", background: "rgba(0,0,0,0.4)", pointerEvents: "none" }}>
                      <Play size={28} fill="white" color="white" style={{ opacity: 0.8 }} />
                    </div>
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreview} alt="Vista previa"
                    style={{ width: "100%", maxHeight: 160, objectFit: "cover",
                      borderRadius: 14, border: "1.5px solid rgba(150,90,255,0.28)" }} />
                )}
                <button onClick={clearMedia}
                  style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.65)",
                    border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex",
                    alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
                  <X size={14} />
                </button>
                <div style={{ marginTop: 6, fontSize: 10, color: "rgba(150,90,255,0.50)", textAlign: "center" }}>
                  {mediaIsVideo ? "Video adjunto" : "Foto adjunta"}
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()}
                style={{ width: "100%", background: "rgba(150,90,255,0.08)",
                  border: "1.5px dashed rgba(150,90,255,0.25)", borderRadius: 14,
                  color: "rgba(150,90,255,0.55)", padding: "10px 14px", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 7, marginBottom: 16 }}>
                <Paperclip size={14} /> Adjuntar foto o video
              </button>
            )}

            {sendError && (
              <div style={{ fontSize: 12, color: "#ff6b8a", marginBottom: 12, textAlign: "center" }}>
                {sendError}
              </div>
            )}

            <button onClick={handleSend} disabled={sending}
              style={{ width: "100%", background: sending ? "rgba(150,90,255,0.12)" : "rgba(150,90,255,0.22)",
                border: "1.5px solid rgba(150,90,255,0.50)", borderRadius: 16,
                color: sending ? "rgba(150,90,255,0.40)" : "#c0a0ff",
                padding: "14px", cursor: sending ? "default" : "pointer",
                fontSize: 14, fontWeight: 800, letterSpacing: "0.02em" }}>
              {sending ? "Sellando cápsula…" : "Sellar y enviar al futuro"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CapsulaPage() {
  return (
    <Suspense fallback={null}>
      <CapsulaPageInner />
    </Suspense>
  );
}

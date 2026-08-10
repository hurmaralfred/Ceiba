"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Clock, Trash2, X, CalendarDays, Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

interface Memory {
  id: string;
  body: string;
  memory_date: string;
  photo_path: string | null;
  author: { name: string; photo: string | null };
  is_mine: boolean;
  year: number;
  years_ago: number;
}

function todayLabel() {
  return new Date().toLocaleDateString("es", { day: "numeric", month: "long" });
}

function yearLabel(yearsAgo: number) {
  if (yearsAgo === 1) return "Hace 1 año";
  if (yearsAgo < 10) return `Hace ${yearsAgo} años`;
  return `Hace ${yearsAgo} años`;
}

export default function HoyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [body, setBody] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    const res = await fetch("/api/hoy");
    if (res.ok) {
      const { memories: m } = await res.json();
      setMemories(m ?? []);
    }
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => { load(); }, [load]);

  // Default date: today's month+day but one year ago
  useEffect(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    setDate(d.toISOString().slice(0, 10));
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Foto menor a 10MB"); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);

    let photo_path: string | null = null;
    if (photoFile) {
      setUploadingPhoto(true);
      const ext = photoFile.name.split(".").pop() ?? "jpg";
      const path = `memories/${Date.now()}.${ext}`;
      const { data: upData, error: upError } = await supabase.storage
        .from("family-photos")
        .upload(path, photoFile, { upsert: false });
      setUploadingPhoto(false);
      if (upError) { toast.error("Error subiendo foto"); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("family-photos").getPublicUrl(upData.path);
      photo_path = urlData.publicUrl;
    }

    const res = await fetch("/api/hoy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, memory_date: date, photo_path }),
    });
    setSaving(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error || "Error al guardar");
      return;
    }
    toast.success("Recuerdo guardado ✨");
    setShowForm(false);
    setBody("");
    setPhotoFile(null);
    setPhotoPreview(null);
    load();
  };

  const remove = async (id: string) => {
    setDeleting(id);
    setConfirmDelete(null);
    await fetch(`/api/hoy?id=${id}`, { method: "DELETE" });
    setMemories(m => m.filter(x => x.id !== id));
    setDeleting(null);
  };

  const today = todayLabel();

  return (
    <div style={{ minHeight: "100dvh", background: "#030208", color: "#fff", paddingBottom: 100, overflowX: "hidden" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "calc(env(safe-area-inset-top,20px) + 14px) 16px 14px",
        borderBottom: "0.5px solid rgba(212,175,55,0.14)",
        background: "rgba(3,2,8,0.98)", backdropFilter: "blur(10px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <Link href="/home">
          <div style={{
            width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderBottom: "2px solid #000",
            borderLeft: "1px solid rgba(212,175,55,0.12)", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
          </div>
        </Link>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Un día como hoy</div>
          <div style={{ fontSize: 11, color: "rgba(212,175,55,0.6)", marginTop: 1 }}>{today}</div>
        </div>

        <button onClick={() => setShowForm(true)} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 12, fontSize: 12, fontWeight: 700,
          color: "#030208", background: "linear-gradient(135deg,#f0c040,#c8902a)",
          border: "none", cursor: "pointer",
          boxShadow: "0 4px 12px rgba(212,175,55,0.35)",
        }}>
          <Plus size={14} /> Agregar
        </button>
      </div>

      <div style={{ padding: "24px 16px 0" }}>

        {/* Empty state */}
        {!loading && memories.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", padding: "60px 24px", textAlign: "center", gap: 16 }}>
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.05))",
              border: "1.5px solid rgba(212,175,55,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CalendarDays size={30} style={{ color: "rgba(212,175,55,0.5)" }} />
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
                Ningún recuerdo para hoy
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6, maxWidth: 260 }}>
                ¿Pasó algo especial un {today} de años atrás? Cuéntaselo a tu familia.
              </p>
            </div>
            <button onClick={() => setShowForm(true)} style={{
              padding: "12px 24px", borderRadius: 14, fontSize: 14, fontWeight: 700,
              color: "#030208", background: "linear-gradient(135deg,#f0c040,#c8902a)",
              border: "none", cursor: "pointer",
              boxShadow: "0 6px 20px rgba(212,175,55,0.4)",
            }}>
              Agregar el primer recuerdo
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1,2].map(i => (
              <div key={i} style={{ height: 120, borderRadius: 18,
                background: "rgba(255,255,255,0.04)", animation: "pulse 1.5s infinite" }} />
            ))}
          </div>
        )}

        {/* Memory cards */}
        {memories.map((m, idx) => (
          <div key={m.id} style={{ marginBottom: 20 }}>
            {/* Year badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(212,175,55,0.1)", border: "1px solid rgba(212,175,55,0.25)",
                borderRadius: 20, padding: "4px 12px",
              }}>
                <Clock size={11} style={{ color: "#d4af37" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#d4af37", letterSpacing: "0.05em" }}>
                  {m.year} · {yearLabel(m.years_ago)}
                </span>
              </div>
              <div style={{ flex: 1, height: 0.5, background: "rgba(212,175,55,0.1)" }} />
            </div>

            {/* Card */}
            <div style={{
              background: "#0c0a18",
              border: "1px solid rgba(212,175,55,0.15)",
              borderTop: "1.5px solid rgba(212,175,55,0.25)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 4px 0 #000, 0 8px 24px rgba(0,0,0,0.5)",
            }}>
              {/* Photo */}
              {m.photo_path && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.photo_path} alt=""
                  style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
              )}

              <div style={{ padding: "14px 16px 16px" }}>
                {/* Author */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: "#1a1030", border: "1.5px solid rgba(212,175,55,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 800, color: "#d4af37", overflow: "hidden",
                  }}>
                    {m.author.photo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={m.author.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                      : m.author.name[0]}
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(212,175,55,0.7)", fontWeight: 600 }}>
                    {m.author.name}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>
                    {new Date(m.memory_date).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>

                {/* Body */}
                <p style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(255,255,255,0.85)",
                  wordBreak: "break-word", margin: 0 }}>
                  {m.body}
                </p>

                {/* Delete with confirm */}
                {m.is_mine && (
                  confirmDelete === m.id ? (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>¿Eliminar este recuerdo?</span>
                      <button onClick={() => remove(m.id)} disabled={deleting === m.id}
                        style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,80,80,0.9)",
                          background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        {deleting === m.id ? "…" : "Sí, eliminar"}
                      </button>
                      <button onClick={() => setConfirmDelete(null)}
                        style={{ fontSize: 11, color: "rgba(255,255,255,0.35)",
                          background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(m.id)}
                      style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 5,
                        background: "none", border: "none", cursor: "pointer", padding: 0,
                        fontSize: 11, color: "rgba(255,100,100,0.5)" }}>
                      <Trash2 size={11} /> Eliminar
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add memory modal */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end",
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "100%", background: "#0e0b1f",
            borderTop: "1px solid rgba(212,175,55,0.25)",
            borderRadius: "20px 20px 0 0",
            padding: "20px 20px calc(env(safe-area-inset-bottom,16px) + 20px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: 0 }}>
                Agregar recuerdo
              </h2>
              <button onClick={() => setShowForm(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} style={{ color: "rgba(255,255,255,0.4)" }} />
              </button>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)",
                letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                ¿Cuándo ocurrió?
              </label>
              <input
                type="date"
                value={date}
                max={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}
                onChange={e => setDate(e.target.value)}
                style={{
                  width: "100%", background: "#0c0a18", border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "#fff",
                  outline: "none", boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "rgba(212,175,55,0.7)",
                letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                ¿Qué pasó?
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Ej: Hoy hace 15 años nació tu abuelo en un pequeño pueblo de Colombia..."
                rows={5}
                style={{
                  width: "100%", background: "#0c0a18", border: "1px solid rgba(212,175,55,0.2)",
                  borderRadius: 12, padding: "10px 14px", fontSize: 14, color: "#fff",
                  outline: "none", resize: "none", lineHeight: 1.6, boxSizing: "border-box",
                }}
              />
              <div style={{ textAlign: "right", fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 4 }}>
                {body.length}/2000
              </div>
            </div>

            {/* Photo picker */}
            <div style={{ marginBottom: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                style={{ display: "none" }}
              />
              {photoPreview ? (
                <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Vista previa"
                    style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
                  <button
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    style={{
                      position: "absolute", top: 8, right: 8,
                      width: 28, height: 28, borderRadius: "50%",
                      background: "rgba(0,0,0,0.65)", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    <X size={14} style={{ color: "#fff" }} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "10px 16px", borderRadius: 12, fontSize: 13, fontWeight: 600,
                    color: "rgba(212,175,55,0.7)",
                    background: "rgba(212,175,55,0.07)",
                    border: "1px dashed rgba(212,175,55,0.25)",
                    cursor: "pointer", width: "100%", justifyContent: "center",
                  }}>
                  <Camera size={16} /> Agregar foto (opcional)
                </button>
              )}
            </div>

            <button onClick={save} disabled={!body.trim() || saving} style={{
              width: "100%", padding: "14px", borderRadius: 14, fontSize: 14, fontWeight: 700,
              color: "#030208", background: "linear-gradient(135deg,#f0c040,#c8902a)",
              border: "none", cursor: body.trim() ? "pointer" : "default",
              opacity: !body.trim() || saving ? 0.5 : 1,
              boxShadow: "0 6px 20px rgba(212,175,55,0.35)",
            }}>
              {uploadingPhoto ? "Subiendo foto…" : saving ? "Guardando..." : "Guardar recuerdo ✨"}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  );
}

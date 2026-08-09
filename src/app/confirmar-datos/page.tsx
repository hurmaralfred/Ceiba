"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TreePine, CheckCircle, Edit3, Shield } from "lucide-react";

interface PersonData {
  first_name: string;
  middle_name: string;
  first_surname: string;
  second_surname: string;
  birth_date: string;
  birth_city: string;
  birth_country: string;
}

function Field({
  label, value, editing, onChange,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "rgba(212,175,55,0.52)", marginBottom: 5 }}>{label}</div>
      {editing ? (
        <input
          type={label.toLowerCase().includes("fecha") ? "date" : "text"}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width: "100%", background: "#0c0a1a", border: "none",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
            borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.5)",
            boxShadow: "0 4px 0 #02010a, 0 6px 12px rgba(0,0,0,0.5)",
            borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 14,
            outline: "none", boxSizing: "border-box",
          }}
        />
      ) : (
        <div style={{ fontSize: 14, color: value ? "#fff" : "rgba(212,175,55,0.25)",
          fontWeight: value ? 600 : 400, padding: "2px 0" }}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}

export default function ConfirmarDatosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);
  const [done,    setDone]    = useState(false);
  const [form,    setForm]    = useState<PersonData>({
    first_name: "", middle_name: "", first_surname: "", second_surname: "",
    birth_date: "", birth_city: "", birth_country: "",
  });

  useEffect(() => {
    fetch("/api/profile/data-status")
      .then(r => r.json())
      .then(res => {
        if (!res.needsConfirmation) {
          router.replace("/home");
          return;
        }
        setForm(res.data);
        setLoading(false);
      })
      .catch(() => router.replace("/home"));
  }, [router]);

  const set = (key: keyof PersonData) => (v: string) =>
    setForm(f => ({ ...f, [key]: v }));

  const handleConfirm = async () => {
    setSaving(true);
    const res = await fetch("/api/profile/confirm-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setDone(true);
      setTimeout(() => router.replace("/home"), 1800);
    } else {
      const { error } = await res.json().catch(() => ({ error: "Error al guardar" }));
      alert(error);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#030208", display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        <TreePine size={36} style={{ color: "#d4af37", opacity: 0.6 }} />
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "#030208", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <CheckCircle size={56} style={{ color: "#d4af37" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>¡Datos confirmados!</div>
        <div style={{ fontSize: 12, color: "rgba(212,175,55,0.5)" }}>Bienvenido a Ceiba</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#030208", color: "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "0 0 40px" }}>

      {/* Header decorativo */}
      <div style={{ width: "100%", padding: "56px 24px 28px", position: "relative",
        textAlign: "center", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -30, left: -40, width: 200, height: 200,
          borderRadius: "50%", background: "radial-gradient(circle,rgba(110,40,220,0.12) 0%,transparent 70%)",
          pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: -20, right: -40, width: 180, height: 180,
          borderRadius: "50%", background: "radial-gradient(circle,rgba(212,175,55,0.1) 0%,transparent 70%)",
          pointerEvents: "none" }} />

        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#0c0a18",
          borderTop: "1.5px solid rgba(212,175,55,0.4)", borderLeft: "1px solid rgba(212,175,55,0.18)",
          borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.6)",
          boxShadow: "0 7px 0 #040300, 0 12px 22px rgba(0,0,0,0.8), 0 0 20px rgba(212,175,55,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          position: "relative" }}>
          <Shield size={26} style={{ color: "#d4af37" }} />
        </div>

        <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
          ¿Estos son tus datos?
        </div>
        <div style={{ fontSize: 12, color: "rgba(212,175,55,0.55)", lineHeight: 1.55, maxWidth: 290, margin: "0 auto" }}>
          Un familiar te agregó a la galaxia. Confirma que la información es correcta — solo tú puedes editarla.
        </div>
      </div>

      {/* Separador */}
      <div style={{ height: 0.5, width: "calc(100% - 48px)",
        background: "linear-gradient(90deg,transparent,rgba(212,175,55,0.3),transparent)",
        marginBottom: 24 }} />

      {/* Tarjeta de datos */}
      <div style={{ width: "calc(100% - 32px)", maxWidth: 420, borderRadius: 20,
        background: "#0c0a18",
        borderTop: "1.5px solid rgba(212,175,55,0.3)", borderLeft: "1px solid rgba(212,175,55,0.14)",
        borderBottom: "3px solid #040300", borderRight: "1px solid rgba(0,0,0,0.6)",
        boxShadow: "0 7px 0 #040300, 0 14px 26px rgba(0,0,0,0.85), 0 0 24px rgba(212,175,55,0.08)",
        padding: "20px 20px 16px", position: "relative", overflow: "hidden" }}>

        <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1,
          background: "rgba(212,175,55,0.38)" }} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(212,175,55,0.5)" }}>Tus datos</span>
          <button onClick={() => setEditing(e => !e)}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
              cursor: "pointer", color: editing ? "#50d070" : "rgba(212,175,55,0.6)", fontSize: 11,
              fontWeight: 600, padding: 0 }}>
            <Edit3 size={13} />
            {editing ? "Ver resumen" : "Corregir datos"}
          </button>
        </div>

        <Field label="Primer nombre"    value={form.first_name}     editing={editing} onChange={set("first_name")} />
        <Field label="Segundo nombre"   value={form.middle_name}    editing={editing} onChange={set("middle_name")} />
        <Field label="Primer apellido"  value={form.first_surname}  editing={editing} onChange={set("first_surname")} />
        <Field label="Segundo apellido" value={form.second_surname} editing={editing} onChange={set("second_surname")} />
        <Field label="Fecha de nacimiento" value={form.birth_date}  editing={editing} onChange={set("birth_date")} />
        <Field label="Ciudad de nacimiento" value={form.birth_city} editing={editing} onChange={set("birth_city")} />
        <Field label="País de nacimiento" value={form.birth_country} editing={editing} onChange={set("birth_country")} />
      </div>

      {/* Nota informativa */}
      <div style={{ width: "calc(100% - 32px)", maxWidth: 420, marginTop: 14, padding: "10px 14px",
        borderRadius: 12, background: "rgba(212,175,55,0.05)",
        borderLeft: "2px solid rgba(212,175,55,0.25)", fontSize: 11,
        color: "rgba(212,175,55,0.5)", lineHeight: 1.5 }}>
        Estos datos son tuyos. Nadie más en la galaxia puede cambiarlos una vez que los confirmes.
      </div>

      {/* Botón confirmar */}
      <div style={{ width: "calc(100% - 32px)", maxWidth: 420, marginTop: 24 }}>
        <button
          onClick={handleConfirm}
          disabled={saving || !form.first_name.trim()}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 14, cursor: saving ? "wait" : "pointer",
            background: saving ? "#6a5600" : "#c9a820",
            borderTop: "2px solid #f5e060", borderLeft: "1.5px solid rgba(255,240,100,0.5)",
            borderBottom: "4px solid #6a5600", borderRight: "1.5px solid rgba(0,0,0,0.4)",
            boxShadow: "0 8px 0 #4a3c00, 0 14px 24px rgba(0,0,0,0.7), 0 0 20px rgba(212,175,55,0.25)",
            color: "#030208", fontSize: 15, fontWeight: 800, letterSpacing: "0.04em",
            position: "relative", overflow: "hidden",
          }}>
          <div style={{ position: "absolute", inset: 0,
            background: "radial-gradient(circle at 35% 22%,rgba(255,255,255,0.28) 0%,transparent 55%)" }} />
          <span style={{ position: "relative" }}>
            {saving ? "Guardando..." : "Confirmar mis datos"}
          </span>
        </button>
      </div>
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, XCircle, Sparkles, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { C, s3dCard, GoldDivider } from "@/components/ui/cosmic";

interface Evidence {
  type: string;
  weight: number;
  detail: string;
}

interface Suggestion {
  id: string;
  score: number;
  evidence: Evidence[];
  status: string;
  person_a: {
    id: string; first_name: string; first_surname: string; second_surname?: string;
    birth_date?: string; birth_city?: string; birth_country?: string;
  } | null;
  person_b: {
    id: string; first_name: string; first_surname: string; second_surname?: string;
    birth_date?: string; birth_city?: string; birth_country?: string;
  } | null;
  space_a: { id: string; name: string } | null;
  space_b: { id: string; name: string } | null;
}

const EVIDENCE_LABEL: Record<string, string> = {
  surname:      "Apellido compartido",
  birth_city:   "Misma ciudad de nacimiento",
  birth_decade: "Misma generación",
  birth_country:"Mismo país de nacimiento",
};

const EVIDENCE_ICON: Record<string, string> = {
  surname: "🔤", birth_city: "📍", birth_decade: "🕰️", birth_country: "🌎",
};

function fullName(p: NonNullable<Suggestion["person_a"]>) {
  return [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(" ");
}

function initials(p: NonNullable<Suggestion["person_a"]>) {
  return [p.first_name, p.first_surname].filter(Boolean).map(w => w[0]).join("").toUpperCase();
}

export default function SugerenciaPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<"confirm" | "dismiss" | null>(null);
  const [done, setDone]             = useState<"confirmed" | "dismissed" | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push("/auth/login"); return; }
      fetch("/api/suggestions")
        .then(r => r.json())
        .then(({ suggestions }) => {
          const found = (suggestions ?? []).find((s: Suggestion) => s.id === id);
          setSuggestion(found ?? null);
        })
        .finally(() => setLoading(false));
    });
  }, [id, router]);

  const act = async (action: "confirm" | "dismiss") => {
    setActing(action);
    await fetch(`/api/suggestions/${id}/${action}`, { method: "POST" });
    setDone(action === "confirm" ? "confirmed" : "dismissed");
    setActing(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex",
        alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%",
          border: "2.5px solid rgba(100,200,120,0.3)", borderTopColor: "#64c878",
          animation: "spin 0.9s linear infinite" }} />
      </div>
    );
  }

  if (!suggestion) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 24px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 24 }}>
          Sugerencia no encontrada o ya procesada.
        </p>
        <Link href="/feed">
          <button style={{ background: "#0c0a18", border: "1px solid rgba(212,175,55,0.2)",
            borderRadius: 12, padding: "10px 22px", color: "#d4af37",
            fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            Volver al inicio
          </button>
        </Link>
      </div>
    );
  }

  const { score, evidence, person_a, person_b, space_a, space_b } = suggestion;
  const pct = Math.round(score * 100);

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, color: "#fff",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
        {done === "confirmed" ? (
          <>
            <CheckCircle size={52} style={{ color: "#64c878", marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>
              ¡Conexión registrada!
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 300, lineHeight: 1.6 }}>
              La posible familia en común quedó marcada. Cuando alguien identifique al antepasado
              en común, los árboles quedarán enlazados.
            </p>
          </>
        ) : (
          <>
            <XCircle size={52} style={{ color: "rgba(255,80,80,0.6)", marginBottom: 16 }} />
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Descartada</h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 300, lineHeight: 1.6 }}>
              Gracias por confirmarlo. El motor de descubrimiento seguirá buscando conexiones más precisas.
            </p>
          </>
        )}
        <Link href="/feed" style={{ marginTop: 28 }}>
          <button style={{ background: "#c9a820", borderRadius: 12, padding: "11px 28px",
            color: "#030208", fontWeight: 800, fontSize: 14, border: "none",
            borderTop: "2px solid #f5e060", borderBottom: "3px solid #6a5600",
            boxShadow: "0 6px 0 #4a3c00, 0 10px 20px rgba(0,0,0,0.6)", cursor: "pointer" }}>
            Volver al inicio
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 40 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12,
        padding: "calc(env(safe-area-inset-top,20px) + 14px) 20px 14px",
        borderBottom: "0.5px solid rgba(212,175,55,0.12)" }}>
        <Link href="/feed">
          <div style={{ width: 36, height: 36, borderRadius: 11, background: "#0c0a1a",
            borderTop: "1px solid rgba(212,175,55,0.28)", borderLeft: "1px solid rgba(212,175,55,0.12)",
            borderBottom: "2px solid #000", borderRight: "1px solid rgba(0,0,0,0.6)",
            boxShadow: "0 5px 0 #02010a, 0 7px 14px rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={17} style={{ color: "rgba(212,175,55,0.75)" }} />
          </div>
        </Link>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Sparkles size={13} style={{ color: "#64c878" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(100,200,120,0.7)" }}>
              Posible conexión
            </span>
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
            Detalle de la sugerencia
          </p>
        </div>
        <div style={{ marginLeft: "auto", background: "rgba(100,200,120,0.12)",
          borderRadius: 20, padding: "4px 12px",
          fontSize: 12, fontWeight: 700, color: "#64c878" }}>
          {pct}%
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* two-person comparison card */}
        <div style={{ ...s3dCard("#0c0a18", "100,200,120", "#000c04"), padding: "18px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(100,200,120,0.5)", marginBottom: 16 }}>
            Personas en familias distintas
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch" }}>
            {/* person A */}
            {person_a && <PersonCard person={person_a} spaceName={space_a?.name} accentRgb="100,200,120" />}

            {/* common ancestor placeholder */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", gap: 6, flexShrink: 0 }}>
              <div style={{ width: 2, flex: 1, background: "rgba(100,200,120,0.2)" }} />
              <div style={{ width: 40, height: 40, borderRadius: "50%",
                background: "rgba(100,200,120,0.08)",
                border: "1.5px dashed rgba(100,200,120,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "rgba(100,200,120,0.5)" }}>?</span>
              </div>
              <p style={{ fontSize: 9, color: "rgba(100,200,120,0.4)", textAlign: "center",
                maxWidth: 50, margin: 0, lineHeight: 1.3 }}>ancestro común</p>
              <div style={{ width: 2, flex: 1, background: "rgba(100,200,120,0.2)" }} />
            </div>

            {/* person B */}
            {person_b && <PersonCard person={person_b} spaceName={space_b?.name} accentRgb="100,200,120" />}
          </div>
        </div>

        {/* evidence list */}
        <div style={{ ...s3dCard("#0c0a18", "212,175,55", "#040300"), padding: "16px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "rgba(212,175,55,0.5)", marginBottom: 12 }}>
            Evidencias detectadas
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {evidence.map((e, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <span style={{ fontSize: 20 }}>{EVIDENCE_ICON[e.type] ?? "🔍"}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>
                      {EVIDENCE_LABEL[e.type] || e.type}
                    </p>
                    <p style={{ fontSize: 11, color: "#d4af37", margin: 0 }}>"{e.detail}"</p>
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(212,175,55,0.5)", fontWeight: 600 }}>
                    +{Math.round(e.weight * 100)}%
                  </div>
                </div>
                {i < evidence.length - 1 && <GoldDivider mx={0} />}
              </div>
            ))}
          </div>
        </div>

        {/* explanation */}
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 14,
          border: "0.5px solid rgba(255,255,255,0.07)", padding: "14px 14px" }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.7, margin: 0 }}>
            Si confirmas esta conexión, el nodo{" "}
            <span style={{ color: "rgba(100,200,120,0.7)", fontWeight: 700 }}>?</span>{" "}
            quedará visible en ambos árboles como un ancestro sin identificar en común.
            Cualquier familiar podrá más adelante completar quién fue esa persona.
          </p>
        </div>

        {/* action buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
          <button
            onClick={() => act("confirm")}
            disabled={!!acting}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, cursor: acting ? "not-allowed" : "pointer",
              background: acting === "confirm" ? "#0d7025" : "#18a836", border: "none",
              borderTop: "2px solid rgba(100,230,130,0.5)", borderBottom: "3.5px solid #0a5c1c",
              boxShadow: "0 8px 0 #073d13, 0 14px 24px rgba(0,0,0,0.7), 0 0 20px rgba(24,168,54,0.2)",
              color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: "0.02em" }}>
            {acting === "confirm" ? "Confirmando…" : "Sí, son familia"}
          </button>
          <button
            onClick={() => act("dismiss")}
            disabled={!!acting}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, cursor: acting ? "not-allowed" : "pointer",
              background: "#0c0a18", border: "none",
              borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "2.5px solid #000",
              boxShadow: "0 5px 0 #030208, 0 8px 16px rgba(0,0,0,0.6)",
              color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: 700 }}>
            {acting === "dismiss" ? "Descartando…" : "No somos familia"}
          </button>
        </div>

      </div>
    </div>
  );
}

function PersonCard({
  person, spaceName, accentRgb,
}: {
  person: NonNullable<Suggestion["person_a"]>;
  spaceName?: string;
  accentRgb: string;
}) {
  const year = person.birth_date ? new Date(person.birth_date).getFullYear() : null;
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      gap: 8, minWidth: 0, textAlign: "center" }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
        background: `rgba(${accentRgb},0.12)`,
        border: `2px solid rgba(${accentRgb},0.45)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 800, color: `rgb(${accentRgb})` }}>
        {initials(person)}
      </div>
      <div style={{ minWidth: 0, width: "100%" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fullName(person)}
        </p>
        {spaceName && (
          <p style={{ fontSize: 10, color: `rgba(${accentRgb},0.5)`, margin: "2px 0 0",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {spaceName}
          </p>
        )}
        {(year || person.birth_city) && (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "2px 0 0" }}>
            {[year, person.birth_city].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

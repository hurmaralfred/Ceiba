"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { MapPin, Cake, Calendar, Users, CheckCircle, BookOpen, TreePine } from "lucide-react";
import { CosmicNav, CosmicHeader, CosmicSpinner, s3dCard, C } from "@/components/ui/cosmic";

interface PersonData {
  id: string;
  first_name: string;
  middle_name?: string | null;
  first_surname?: string | null;
  second_surname?: string | null;
  birth_date?: string | null;
  birth_city?: string | null;
  birth_country?: string | null;
  avatarUrl?: string | null;
  hasAccount: boolean;
}

interface FamilyMemberItem {
  id: string;
  first_name: string;
  first_surname?: string | null;
}

interface EventItem {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description?: string | null;
}

const EVENT_LABEL: Record<string, string> = {
  birth: "Nacimiento", marriage: "Matrimonio", death: "Fallecimiento",
  graduation: "Graduación", reunion: "Reunión", anniversary: "Aniversario", other: "Evento",
};

const EVENT_EMOJI: Record<string, string> = {
  birth: "🐣", marriage: "💍", death: "🕊️",
  graduation: "🎓", reunion: "🤗", anniversary: "🎉", other: "📅",
};

const EVENT_COLOR: Record<string, string> = {
  birth: "220,80,120", marriage: "220,60,80", death: "140,140,160",
  graduation: "60,120,240", reunion: "40,180,120", anniversary: "212,175,55", other: "160,80,240",
};

function age(birthDate: string): number {
  const bd = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) a--;
  return a;
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });
}

export default function PersonaPage() {
  const router = useRouter();
  const { personId } = useParams<{ personId: string }>();
  const [person, setPerson] = useState<PersonData | null>(null);
  const [family, setFamily] = useState<FamilyMemberItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [totalInSpace, setTotalInSpace] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    fetch(`/api/persona/${personId}`)
      .then(r => { if (!r.ok) throw new Error("No autorizado"); return r.json(); })
      .then(({ person: p, familyInCeiba, events: ev, totalInSpace: t }) => {
        setPerson(p);
        setFamily(familyInCeiba ?? []);
        setEvents(ev ?? []);
        setTotalInSpace(t ?? 0);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [personId]);

  const fullName = person
    ? [person.first_name, person.middle_name, person.first_surname, person.second_surname].filter(Boolean).join(" ")
    : "";

  const personAge = person?.birth_date ? age(person.birth_date) : null;
  const initials = person ? `${person.first_name?.[0] ?? ""}${person.first_surname?.[0] ?? ""}` : "?";

  if (loading) return <CosmicSpinner />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: "#fff", paddingBottom: 100 }}>
      <CosmicHeader title="Historia familiar" backHref="/tree"
        right={
          <Link href="/tree">
            <TreePine size={18} style={{ color: "rgba(212,175,55,0.5)" }} />
          </Link>
        }
      />

      {error ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>No disponible</p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 20 }}>{error}</p>
          <button onClick={() => router.back()}
            style={{ background: "#c9a820", border: "none", borderRadius: 12, padding: "11px 24px",
              color: "#030208", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
            Volver
          </button>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
            textAlign: "center", padding: "28px 20px 24px",
            background: "linear-gradient(180deg,rgba(12,10,24,0.8) 0%,transparent 100%)" }}>
            {/* Avatar ring */}
            <div style={{ width: 96, height: 96, borderRadius: "50%",
              backgroundImage: "conic-gradient(from 15deg,#d4af37 0%,#f5e070 16%,#8a6012 32%,#6030b0 48%,#2044c0 64%,#18b0c0 76%,#f0d060 88%,#d4af37 100%)",
              padding: 3, boxShadow: "0 0 32px rgba(212,175,55,0.22), 0 8px 24px rgba(0,0,0,0.6)",
              marginBottom: 14, flexShrink: 0 }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "#0c0a18",
                overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {person?.avatarUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={person.avatarUrl} alt={person.first_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 28, fontWeight: 800, color: "#d4af37" }}>{initials}</span>}
              </div>
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.2, marginBottom: 8 }}>
              {fullName}
            </h1>

            {person?.hasAccount && (
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                background: "rgba(40,200,100,0.12)", border: "1px solid rgba(40,200,100,0.2)",
                borderRadius: 100, padding: "4px 12px", marginBottom: 8 }}>
                <CheckCircle size={11} style={{ color: "rgba(40,200,100,0.8)" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(40,200,100,0.7)" }}>En Ceiba</span>
              </div>
            )}

            {person?.birth_date && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(212,175,55,0.55)", fontSize: 12, marginTop: 4 }}>
                <Cake size={12} />
                <span>{formatDate(person.birth_date)}</span>
                {personAge !== null && <span style={{ color: "rgba(212,175,55,0.35)" }}>· {personAge} años</span>}
              </div>
            )}
            {person?.birth_city && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(212,175,55,0.4)", fontSize: 12, marginTop: 3 }}>
                <MapPin size={12} />
                <span>{[person.birth_city, person.birth_country].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>

          {/* Cards */}
          <div style={{ padding: "0 16px", maxWidth: 480, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Datos biográficos */}
            <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"), padding: "16px" }}>
              <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(212,175,55,0.35)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <BookOpen size={14} style={{ color: "rgba(212,175,55,0.6)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Su historia</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {person?.birth_date && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "#100808",
                      border: "1px solid rgba(220,120,60,0.2)", display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0 }}>
                      <Cake size={14} style={{ color: "rgba(220,120,60,0.7)" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
                        letterSpacing: "0.08em", fontWeight: 700, marginBottom: 2 }}>Fecha de nacimiento</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{formatDate(person.birth_date)}</p>
                      {personAge !== null && <p style={{ fontSize: 11, color: "rgba(212,175,55,0.4)", marginTop: 1 }}>{personAge} años</p>}
                    </div>
                  </div>
                )}
                {person?.birth_city && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: "#080b18",
                      border: "1px solid rgba(60,120,220,0.2)", display: "flex", alignItems: "center",
                      justifyContent: "center", flexShrink: 0 }}>
                      <MapPin size={14} style={{ color: "rgba(60,120,220,0.7)" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
                        letterSpacing: "0.08em", fontWeight: 700, marginBottom: 2 }}>Lugar de nacimiento</p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                        {[person.birth_city, person.birth_country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {!person?.birth_date && !person?.birth_city && (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                    Aún no hay información biográfica registrada.
                  </p>
                )}
              </div>
            </div>

            {/* Familia en Ceiba */}
            {(family.length > 0 || totalInSpace > 1) && (
              <div style={{ ...s3dCard("#0c0a18","60,180,120","#020c06"), padding: "16px" }}>
                <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(60,180,120,0.35)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Users size={14} style={{ color: "rgba(60,180,120,0.7)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Familia en Ceiba</span>
                </div>
                {family.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {family.map(m => (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 6,
                        background: "rgba(60,180,120,0.1)", border: "1px solid rgba(60,180,120,0.2)",
                        borderRadius: 100, padding: "5px 10px" }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(60,180,120,0.2)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 800, color: "rgba(60,180,120,0.9)" }}>
                          {m.first_name[0]}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)" }}>
                          {m.first_name} {m.first_surname || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                    Hay {totalInSpace - 1} familiar{totalInSpace - 1 !== 1 ? "es" : ""} en el árbol. Invítalos a unirse a Ceiba.
                  </p>
                )}
              </div>
            )}

            {/* Eventos */}
            {events.length > 0 && (
              <div style={{ ...s3dCard("#0c0a18","160,80,240","#060210"), padding: "16px" }}>
                <div style={{ position: "absolute", top: 0, left: "18%", right: "18%", height: 1, background: "rgba(160,80,240,0.35)" }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Calendar size={14} style={{ color: "rgba(160,80,240,0.7)" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Momentos de la familia</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {events.slice(0, 4).map(ev => {
                    const col = EVENT_COLOR[ev.event_type] ?? "160,80,240";
                    return (
                      <div key={ev.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                          background: `rgba(${col},0.12)`, border: `1px solid rgba(${col},0.2)`,
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                          {EVENT_EMOJI[ev.event_type] ?? "📅"}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{ev.title}</p>
                          <p style={{ fontSize: 11, color: `rgba(${col},0.5)`, marginTop: 2 }}>
                            {EVENT_LABEL[ev.event_type] ?? "Evento"} · {formatDate(ev.event_date)}
                          </p>
                          {ev.description && (
                            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 3, fontStyle: "italic" }}>
                              "{ev.description}"
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {events.length > 4 && (
                  <Link href="/events" style={{ display: "block", textAlign: "center",
                    fontSize: 11, color: "rgba(160,80,240,0.5)", fontWeight: 600, marginTop: 14,
                    textDecoration: "none" }}>
                    Ver todos los momentos →
                  </Link>
                )}
              </div>
            )}

            {/* CTAs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingBottom: 8 }}>
              <Link href="/tree" style={{ textDecoration: "none" }}>
                <div style={{ ...s3dCard("#0c0a18","212,175,55","#040300"),
                  padding: "18px 12px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, textAlign: "center" }}>
                  <TreePine size={18} style={{ color: "rgba(212,175,55,0.7)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Ver en el árbol</span>
                </div>
              </Link>
              <Link href="/events" style={{ textDecoration: "none" }}>
                <div style={{ ...s3dCard("#0c0a18","160,80,240","#060210"),
                  padding: "18px 12px", display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 8, textAlign: "center" }}>
                  <Calendar size={18} style={{ color: "rgba(160,80,240,0.7)" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Agregar momento</span>
                </div>
              </Link>
            </div>
          </div>
        </>
      )}

      <CosmicNav />
    </div>
  );
}

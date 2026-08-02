"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, TreePine, MapPin, Cake, Calendar,
  Users, CheckCircle, BookOpen,
} from "lucide-react";
import { AvatarFigure } from "@/components/universe/AvatarFigure";

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
  avatarConfig?: any;
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

function age(birthDate: string): number {
  const bd = new Date(birthDate);
  const now = new Date();
  let a = now.getFullYear() - bd.getFullYear();
  if (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate())) a--;
  return a;
}

function formatDate(d: string): string {
  return new Date(d + "T12:00:00").toLocaleDateString("es", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function Skeleton({ h = 16, w = "full", rounded = "xl" }: { h?: number; w?: string; rounded?: string }) {
  return <div className={`animate-pulse bg-cream-300 rounded-${rounded} h-${h} w-${w}`} />;
}

function makePreviewNode(person: PersonData): any {
  return {
    id: person.id,
    label: person.first_name,
    avatarUrl: person.avatarUrl ?? null,
    avatarConfig: person.avatarConfig ?? null,
    gender: undefined,
    generation: 0,
    x: 0, y: 0,
  };
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
      .then((r) => {
        if (!r.ok) throw new Error("No autorizado");
        return r.json();
      })
      .then(({ person: p, familyInCeiba, events: ev, totalInSpace: t }) => {
        setPerson(p);
        setFamily(familyInCeiba ?? []);
        setEvents(ev ?? []);
        setTotalInSpace(t ?? 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [personId]);

  const fullName = person
    ? [person.first_name, person.middle_name, person.first_surname, person.second_surname]
        .filter(Boolean)
        .join(" ")
    : "";

  const personAge = person?.birth_date ? age(person.birth_date) : null;

  return (
    <div className="min-h-screen pb-10"
      style={{ background: "linear-gradient(180deg, #1a3a2a 0%, #2a4a3a 30%, #f7f3ec 30%)" }}>

      {/* Nav */}
      <div className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(26,58,42,0.95)", backdropFilter: "blur(8px)" }}>
        <button onClick={() => router.back()} className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="text-white/60 text-sm font-medium">Historia familiar</span>
        <Link href="/tree" className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors">
          <TreePine size={18} />
        </Link>
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center text-center px-4 pt-6 pb-10"
        style={{ background: "linear-gradient(180deg, #2a4a3a 0%, #2a4a3a 60%, transparent 100%)" }}>
        {loading ? (
          <>
            <div className="w-28 h-28 rounded-full bg-white/20 animate-pulse mb-4" />
            <Skeleton h={8} w="40" rounded="full" />
            <div className="mt-2"><Skeleton h={4} w="28" rounded="full" /></div>
          </>
        ) : error ? null : person ? (
          <>
            {/* Avatar */}
            <div className="w-28 h-28 rounded-full overflow-hidden bg-ceiba-800 flex items-center justify-center mb-4 ring-4 ring-white/20"
              style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.35)" }}>
              {person.avatarUrl && !person.avatarConfig ? (
                <img src={person.avatarUrl} alt={person.first_name} className="w-full h-full object-cover" />
              ) : (
                <div style={{ transform: "scale(1.4)" }}>
                  <AvatarFigure node={makePreviewNode(person)} labelVisible={false} />
                </div>
              )}
            </div>

            {/* Name */}
            <h1 className="text-white font-bold text-2xl leading-tight" style={{ letterSpacing: "-0.02em" }}>
              {fullName}
            </h1>

            {/* Badge: Ceiba user */}
            {person.hasAccount && (
              <div className="mt-2 flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1">
                <CheckCircle size={12} className="text-green-300" />
                <span className="text-white/80 text-xs font-medium">En Ceiba</span>
              </div>
            )}

            {/* Birth quick info */}
            {person.birth_date && (
              <div className="mt-3 flex items-center gap-1.5 text-white/70 text-sm">
                <Cake size={13} />
                <span>{formatDate(person.birth_date)}</span>
                {personAge !== null && (
                  <span className="text-white/50">· {personAge} años</span>
                )}
              </div>
            )}
            {person.birth_city && (
              <div className="mt-1 flex items-center gap-1.5 text-white/60 text-sm">
                <MapPin size={13} />
                <span>{[person.birth_city, person.birth_country].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 -mt-4 space-y-4">

        {error ? (
          <div className="card text-center py-10">
            <p className="text-ceiba-700 font-semibold mb-2">No disponible</p>
            <p className="text-sm text-gray-500">{error}</p>
            <button onClick={() => router.back()} className="mt-4 btn-primary text-sm">Volver</button>
          </div>
        ) : loading ? (
          <>
            <Skeleton h={24} rounded="2xl" />
            <Skeleton h={20} rounded="2xl" />
            <Skeleton h={32} rounded="2xl" />
          </>
        ) : person ? (
          <>
            {/* Datos de vida */}
            <div className="card">
              <h2 className="font-bold text-ceiba-800 mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-ceiba-600" /> Su historia
              </h2>
              <div className="space-y-2.5">
                {person.birth_date && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Cake size={14} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Fecha de nacimiento</p>
                      <p className="text-sm font-semibold text-gray-800">{formatDate(person.birth_date)}</p>
                      {personAge !== null && (
                        <p className="text-xs text-gray-400">{personAge} años</p>
                      )}
                    </div>
                  </div>
                )}
                {person.birth_city && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <MapPin size={14} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-medium">Lugar de nacimiento</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {[person.birth_city, person.birth_country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </div>
                )}
                {!person.birth_date && !person.birth_city && (
                  <p className="text-sm text-gray-400 italic">Aún no hay información biográfica registrada.</p>
                )}
              </div>
            </div>

            {/* Familia en Ceiba */}
            {(family.length > 0 || totalInSpace > 1) && (
              <div className="card">
                <h2 className="font-bold text-ceiba-800 mb-3 flex items-center gap-2">
                  <Users size={16} className="text-ceiba-600" /> Familia en Ceiba
                </h2>
                {family.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {family.map((m) => (
                      <div key={m.id} className="flex items-center gap-1.5 bg-cream-100 rounded-full px-3 py-1.5">
                        <div className="w-5 h-5 rounded-full bg-ceiba-700 flex items-center justify-center">
                          <span className="text-white text-[9px] font-bold">
                            {m.first_name[0]}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-ceiba-800">
                          {m.first_name} {m.first_surname || ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">
                    Hay {totalInSpace - 1} familiar{totalInSpace - 1 !== 1 ? "es" : ""} en el árbol.
                    Invítalos a unirse a Ceiba.
                  </p>
                )}
              </div>
            )}

            {/* Eventos de vida */}
            {events.length > 0 && (
              <div className="card">
                <h2 className="font-bold text-ceiba-800 mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-ceiba-600" /> Momentos de la familia
                </h2>
                <div className="space-y-3">
                  {events.slice(0, 4).map((ev) => (
                    <div key={ev.id} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-cream-200 flex items-center justify-center shrink-0 text-base">
                        {EVENT_EMOJI[ev.event_type] ?? "📅"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 leading-tight">{ev.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {EVENT_LABEL[ev.event_type] ?? "Evento"} · {formatDate(ev.event_date)}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-gray-500 mt-1 italic">"{ev.description}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {events.length > 4 && (
                  <Link href="/events" className="block text-center text-xs text-ceiba-600 font-medium mt-3 hover:underline">
                    Ver todos los momentos →
                  </Link>
                )}
              </div>
            )}

            {/* CTAs */}
            <div className="grid grid-cols-2 gap-3 pb-4">
              <Link href="/tree"
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-ceiba-800 text-white text-center hover:bg-ceiba-700 transition-colors">
                <TreePine size={20} />
                <span className="text-xs font-semibold">Ver en el árbol</span>
              </Link>
              <Link href="/events"
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-cream-200 text-ceiba-800 text-center hover:bg-cream-300 transition-colors">
                <Calendar size={20} />
                <span className="text-xs font-semibold">Agregar momento</span>
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

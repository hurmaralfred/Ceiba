import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
} from "@/lib/server/family";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  emoji: string;
  earned: boolean;
  progress?: number; // 0-1 for unearned, to show progress bar
}

export interface GamificationStats {
  treeCompletion: number; // 0-100
  totalPersons: number;
  personsWithBirthDate: number;
  personsWithBirthCity: number;
  familyInCeiba: number;
  totalEvents: number;
  totalPhotos: number;
  achievements: Achievement[];
  weeklyChallenge: { text: string; href: string } | null;
}

const ACHIEVEMENTS_DEFINITIONS = [
  {
    id: "pioneer",
    name: "Pionero",
    emoji: "🌱",
    description: "Agregaste tu primer familiar",
    check: (s: any) => s.totalPersons >= 1,
    progress: (s: any) => Math.min(s.totalPersons, 1),
  },
  {
    id: "growing",
    name: "Galaxia en crecimiento",
    emoji: "🌳",
    description: "10 o más familiares en la galaxia",
    check: (s: any) => s.totalPersons >= 10,
    progress: (s: any) => Math.min(s.totalPersons / 10, 1),
  },
  {
    id: "birthday_keeper",
    name: "Guardián de cumpleaños",
    emoji: "🎂",
    description: "5 o más familiares con fecha de nacimiento",
    check: (s: any) => s.personsWithBirthDate >= 5,
    progress: (s: any) => Math.min(s.personsWithBirthDate / 5, 1),
  },
  {
    id: "historian",
    name: "Historiador",
    emoji: "📖",
    description: "3 o más eventos históricos registrados",
    check: (s: any) => s.totalEvents >= 3,
    progress: (s: any) => Math.min(s.totalEvents / 3, 1),
  },
  {
    id: "photographer",
    name: "Fotógrafo familiar",
    emoji: "📸",
    description: "5 o más fotos compartidas",
    check: (s: any) => s.totalPhotos >= 5,
    progress: (s: any) => Math.min(s.totalPhotos / 5, 1),
  },
  {
    id: "connected",
    name: "Familia conectada",
    emoji: "🤝",
    description: "3 o más familiares con cuenta en Ceiba",
    check: (s: any) => s.familyInCeiba >= 3,
    progress: (s: any) => Math.min(s.familyInCeiba / 3, 1),
  },
  {
    id: "roots",
    name: "Raíces profundas",
    emoji: "🗺️",
    description: "5 o más familiares con lugar de nacimiento",
    check: (s: any) => s.personsWithBirthCity >= 5,
    progress: (s: any) => Math.min(s.personsWithBirthCity / 5, 1),
  },
  {
    id: "complete_tree",
    name: "Galaxia completo",
    emoji: "⭐",
    description: "Galaxia con 90% o más de completitud",
    check: (s: any) => s.treeCompletion >= 90,
    progress: (s: any) => s.treeCompletion / 100,
  },
];

function computeChallenge(s: any): { text: string; href: string } | null {
  if (s.totalPersons === 0) return { text: "Agrega tu primer familiar", href: "/tree" };
  if (s.personsWithBirthDate < s.totalPersons) {
    const missing = s.totalPersons - s.personsWithBirthDate;
    return {
      text: `Agrega la fecha de nacimiento de ${missing} familiar${missing > 1 ? "es" : ""}`,
      href: "/tree",
    };
  }
  if (s.totalPhotos < 3) return { text: "Sube 3 fotos familiares", href: "/photos" };
  if (s.totalEvents < 2) return { text: "Registra un momento histórico de tu familia", href: "/events" };
  if (s.familyInCeiba < 3) return { text: "Invita a un familiar más a Ceiba", href: "/invitar" };
  if (s.personsWithBirthCity < s.totalPersons) {
    const missing = s.totalPersons - s.personsWithBirthCity;
    return {
      text: `Agrega el lugar de nacimiento de ${missing} familiar${missing > 1 ? "es" : ""}`,
      href: "/tree",
    };
  }
  return { text: "Invita a alguien nuevo a Ceiba", href: "/invitar" };
}

export async function GET(_req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);

  let totalPersons = 0;
  let personsWithBirthDate = 0;
  let personsWithBirthCity = 0;
  let familyInCeiba = 0;

  if (myPersonId) {
    const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
    const allPersonIds = [myPersonId, ...familyPersonIds];
    totalPersons = allPersonIds.length;

    const { data: persons } = await service
      .from("persons")
      .select("id, birth_date, birth_city")
      .in("id", allPersonIds);

    for (const p of (persons ?? []) as any[]) {
      if (p.birth_date) personsWithBirthDate++;
      if (p.birth_city) personsWithBirthCity++;
    }

    const { data: claims } = await service
      .from("person_claims")
      .select("person_id")
      .in("person_id", allPersonIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);
    familyInCeiba = (claims ?? []).length;
  }

  // Total events + photos from family
  const { data: allClaims } = await service
    .from("person_claims")
    .select("user_id")
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  // Scope to family space users only if we have an identity
  let familyUserIds: string[] = [user.id];
  if (myPersonId) {
    const myPersonIds = myPersonId
      ? [myPersonId, ...(await resolveFamilySpaceMemberIds(service, myPersonId))]
      : [];
    const { data: fClaims } = await service
      .from("person_claims")
      .select("user_id")
      .in("person_id", myPersonIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);
    familyUserIds = [...new Set([user.id, ...((fClaims ?? []) as any[]).map((c) => c.user_id as string)])];
  }

  const [{ count: eventsCount }, { count: photosCount }] = await Promise.all([
    service.from("family_events").select("id", { count: "exact", head: true }).in("created_by", familyUserIds),
    service.from("photos").select("id", { count: "exact", head: true }).in("uploader_user_id", familyUserIds),
  ]);

  const totalEvents = eventsCount ?? 0;
  const totalPhotos = photosCount ?? 0;

  // Tree completion: avg of (birth_date / 2 + birth_city / 2) per person, plus family_in_ceiba bonus
  const fieldScore = totalPersons > 0
    ? Math.round(
        ((personsWithBirthDate + personsWithBirthCity) / (totalPersons * 2)) * 75 +
        (familyInCeiba / Math.max(totalPersons, 1)) * 25
      )
    : 0;
  const treeCompletion = Math.min(fieldScore, 100);

  const stats = { totalPersons, personsWithBirthDate, personsWithBirthCity, familyInCeiba, totalEvents, totalPhotos, treeCompletion };

  const achievements: Achievement[] = ACHIEVEMENTS_DEFINITIONS.map((def) => ({
    id: def.id,
    name: def.name,
    emoji: def.emoji,
    description: def.description,
    earned: def.check(stats),
    progress: def.progress(stats),
  }));

  const weeklyChallenge = computeChallenge(stats);

  return NextResponse.json({ ...stats, achievements, weeklyChallenge });
}

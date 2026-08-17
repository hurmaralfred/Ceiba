import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolvePersonsByUserIds,
} from "@/lib/server/family";

/**
 * GET /api/feed
 * Agrega, únicamente de mi(s) family_space:
 *   - cumpleaños próximos (persons.birth_date de mi familia)
 *   - fotos recientes (photos)
 *   - anuncios recientes (broadcasts)
 *   - eventos familiares recientes (family_events, creados por mi familia)
 */
export async function GET(_req: NextRequest) {
  const birthdayDays = Number(new URL(_req.url).searchParams.get("birthdayDays") ?? 7);
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) {
    return NextResponse.json({ birthdays: [], photos: [], broadcasts: [], events: [] });
  }

  // Use the same relationship graph as the galaxy view (traverses relationships table at depth 4)
  // This includes ALL family members, not only those in space_memberships.
  const { data: graphData, error: graphError } = await supabase.rpc("get_my_family_graph", { p_depth: 4 });
  const graphPersonIds: string[] = graphData
    ? ((graphData as any).nodes ?? []).map((n: any) => n.id as string)
    : [];
  const allPersonIds = [...new Set([myPersonId, ...graphPersonIds])];
  console.log("[feed] graph nodes:", graphPersonIds.length, "graphError:", graphError?.message ?? null);

  const { data: familyClaims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("person_id", allPersonIds)
    .eq("claim_status", "approved")
    .is("revoked_at", null);

  const familyUserIds = [...new Set([user.id, ...((familyClaims ?? []) as any[]).map((c) => c.user_id as string)])];
  const personDisplayByUser = await resolvePersonsByUserIds(service, familyUserIds);

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: persons }, { data: personsWithDeath }, { data: photos }, { data: broadcasts }, { data: events }] = await Promise.all([
    service
      .from("persons")
      .select("id, first_name, first_surname, birth_date, is_deceased, death_date")
      .in("id", allPersonIds)
      .not("birth_date", "is", null),
    service
      .from("persons")
      .select("id, first_name, first_surname, death_date")
      .in("id", allPersonIds)
      .not("death_date", "is", null),
    service
      .from("photos")
      .select("id, uploader_user_id, storage_path, caption, created_at")
      .in("uploader_user_id", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("broadcasts")
      .select("id, sender_user_id, message, scope, created_at")
      .in("sender_user_id", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(20),
    service
      .from("family_events")
      .select("id, created_by, title, event_type, event_date, created_at")
      .in("created_by", familyUserIds)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const now = new Date();
  const todayMMDD = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // dates stored as "0001-01-01" are empty/null placeholders — skip them
  const isValidBirthDate = (dateStr: string) => parseInt(dateStr.slice(0, 4)) >= 1900;

  const daysUntilBirthday = (dateStr: string) => {
    const bd = new Date(dateStr);
    const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < now) next.setFullYear(now.getFullYear() + 1);
    return (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  };

  const isBirthdaySoon = (dateStr: string, days = 7) =>
    isValidBirthDate(dateStr) && daysUntilBirthday(dateStr) <= days;

  const currentYear = now.getFullYear();
  const birthdays = ((persons ?? []) as any[])
    .filter((p) => isBirthdaySoon(p.birth_date, birthdayDays))
    .map((p) => ({
      person_id: p.id,
      first_name: p.first_name,
      last_name: p.first_surname,
      birth_date: p.birth_date,
      is_deceased: !!(p.is_deceased) || !!p.death_date,
      age_would_be: currentYear - parseInt(p.birth_date.slice(0, 4)),
      days_until: Math.ceil(daysUntilBirthday(p.birth_date)),
    }))
    // sort ascending so the home page slice(0,10) always gets the soonest birthdays first
    .sort((a, b) => a.days_until - b.days_until);

  // "Hoy en la historia familiar" — birth & death anniversaries matching today's month-day
  const anniversaries: Array<{
    person_id: string; first_name: string; last_name: string;
    type: "birth" | "death"; date: string; years: number;
  }> = [];

  ((persons ?? []) as any[]).forEach((p) => {
    if (!isValidBirthDate(p.birth_date)) return;
    const mmdd = p.birth_date.slice(5, 10); // "MM-DD"
    const birthYear = parseInt(p.birth_date.slice(0, 4));
    // Show birth anniversary only if NOT already showing as upcoming birthday, and year is in the past
    if (mmdd === todayMMDD && birthYear < currentYear && !isBirthdaySoon(p.birth_date, birthdayDays)) {
      anniversaries.push({
        person_id: p.id, first_name: p.first_name, last_name: p.first_surname,
        type: "birth", date: p.birth_date, years: currentYear - birthYear,
      });
    }
  });
  ((personsWithDeath ?? []) as any[]).forEach((p) => {
    const mmdd = p.death_date.slice(5, 10);
    const deathYear = parseInt(p.death_date.slice(0, 4));
    if (mmdd === todayMMDD && deathYear < currentYear) {
      anniversaries.push({
        person_id: p.id, first_name: p.first_name, last_name: p.first_surname,
        type: "death", date: p.death_date, years: currentYear - deathYear,
      });
    }
  });

  // Deceased family members with no known birth date — used for daily memory questions
  const deceasedWithoutDate = ((persons ?? []) as any[])
    .filter((p) => (!!(p.is_deceased) || !!p.death_date) && !isValidBirthDate(p.birth_date))
    .map((p) => ({ person_id: p.id, first_name: p.first_name, last_name: p.first_surname }));

  // Also catch deceased persons not in the persons-with-birth_date query (those with null birth_date)
  const { data: deceasedNoBirthDate } = await service
    .from("persons")
    .select("id, first_name, first_surname")
    .in("id", allPersonIds)
    .eq("is_deceased", true)
    .is("birth_date", null);
  ((deceasedNoBirthDate ?? []) as any[]).forEach((p) => {
    if (!deceasedWithoutDate.find((d) => d.person_id === p.id)) {
      deceasedWithoutDate.push({ person_id: p.id, first_name: p.first_name, last_name: p.first_surname });
    }
  });

  return NextResponse.json({
    birthdays,
    anniversaries,
    deceasedWithoutDate,
    photos: ((photos ?? []) as any[]).map((p) => {
      const { data: urlData } = service.storage.from("family-photos").getPublicUrl(p.storage_path as string);
      return {
        ...p,
        url: urlData.publicUrl,
        uploader: personDisplayByUser.get(p.uploader_user_id) ?? null,
      };
    }),
    broadcasts: ((broadcasts ?? []) as any[]).map((b) => ({
      ...b,
      sender: personDisplayByUser.get(b.sender_user_id) ?? null,
    })),
    events: ((events ?? []) as any[]).map((e) => ({
      ...e,
      creator: personDisplayByUser.get(e.created_by) ?? null,
    })),
  });
}

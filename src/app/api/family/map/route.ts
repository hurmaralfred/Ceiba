import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getServiceClient,
  resolveApprovedPersonId,
  resolveFamilySpaceMemberIds,
} from "@/lib/server/family";

// In-memory geocode cache — survives for the lifetime of the server process
const geocodeCache = new Map<string, [number, number] | null>();

async function geocode(city: string, country: string): Promise<[number, number] | null> {
  const key = `${city.toLowerCase().trim()}||${country.toLowerCase().trim()}`;
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  const q = encodeURIComponent(`${city.trim()}, ${country.trim()}`);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {
        headers: {
          "User-Agent": "Ceiba Family App (ceibapp.com)",
          "Accept-Language": "es",
        },
        next: { revalidate: 86400 }, // cache 24h at Next.js level too
      }
    );
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json();
    if (!data[0]) { geocodeCache.set(key, null); return null; }
    const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    geocodeCache.set(key, coords);
    return coords;
  } catch {
    geocodeCache.set(key, null);
    return null;
  }
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = getServiceClient();
  const myPersonId = await resolveApprovedPersonId(service, user.id);
  if (!myPersonId) return NextResponse.json({ pins: [] });

  const familyPersonIds = await resolveFamilySpaceMemberIds(service, myPersonId);
  const allPersonIds = [myPersonId, ...familyPersonIds];

  const { data: persons } = await service
    .from("persons")
    .select("id, first_name, first_surname, second_surname, birth_city, birth_country, birth_date")
    .in("id", allPersonIds)
    .is("deleted_at", null)
    .not("birth_city", "is", null)
    .not("birth_country", "is", null);

  if (!persons?.length) return NextResponse.json({ pins: [] });

  // Group by city+country
  const groups = new Map<string, {
    city: string; country: string;
    people: { name: string; birth_year: string | null }[];
  }>();

  for (const p of persons as any[]) {
    const city: string = (p.birth_city ?? "").trim();
    const country: string = (p.birth_country ?? "").trim();
    if (!city || !country) continue;

    const key = `${city.toLowerCase()}||${country.toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { city, country, people: [] });
    const fullName = [p.first_name, p.first_surname, p.second_surname].filter(Boolean).join(" ");
    const birthYear = p.birth_date ? (p.birth_date as string).slice(0, 4) : null;
    groups.get(key)!.people.push({ name: fullName, birth_year: birthYear });
  }

  // Geocode each unique location (sequential to respect Nominatim 1 req/s limit)
  const pins: {
    lat: number; lng: number;
    city: string; country: string;
    people: { name: string; birth_year: string | null }[];
  }[] = [];

  for (const group of groups.values()) {
    const coords = await geocode(group.city, group.country);
    if (!coords) continue;
    // Small random jitter so overlapping pins are visible separately
    const [lat, lng] = coords;
    pins.push({
      lat: lat + (Math.random() - 0.5) * 0.012,
      lng: lng + (Math.random() - 0.5) * 0.012,
      city: group.city,
      country: group.country,
      people: group.people,
    });
  }

  return NextResponse.json({ pins });
}

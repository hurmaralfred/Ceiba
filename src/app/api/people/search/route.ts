import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

/**
 * GET /api/people/search?q=nombre
 * Busca personas en toda la base de datos de Ceiba por nombre o apellido.
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const service = getServiceClient();

  // Search by first_name, first_surname, or second_surname using ilike
  const term = `%${q}%`;
  const { data, error } = await service
    .from("persons")
    .select("id, first_name, first_surname, second_surname, birth_city, birth_country, birth_date")
    .or(`first_name.ilike.${term},first_surname.ilike.${term},second_surname.ilike.${term}`)
    .is("deleted_at", null)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) return NextResponse.json({ results: [] });

  // Enrich with family space name
  const personIds = data.map((p: any) => p.id);
  const { data: memberships } = await service
    .from("space_memberships")
    .select("person_id, space_id, family_spaces(name)")
    .in("person_id", personIds);

  const spaceByPerson = new Map<string, string>();
  (memberships ?? []).forEach((m: any) => {
    if (!spaceByPerson.has(m.person_id) && m.family_spaces?.name) {
      spaceByPerson.set(m.person_id, m.family_spaces.name);
    }
  });

  const results = data.map((p: any) => ({
    id: p.id,
    first_name:     p.first_name,
    first_surname:  p.first_surname,
    second_surname: p.second_surname,
    birth_city:     p.birth_city,
    birth_country:  p.birth_country,
    birth_date:     p.birth_date,
    family_name:    spaceByPerson.get(p.id) ?? null,
  }));

  return NextResponse.json({ results });
}

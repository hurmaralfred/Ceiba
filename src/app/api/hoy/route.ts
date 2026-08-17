import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

async function getSpaceId(service: ReturnType<typeof getServiceClient>, userId: string): Promise<string | null> {
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", userId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();

  if (claim?.person_id) {
    const { data: mem } = await service
      .from("space_memberships")
      .select("space_id")
      .eq("person_id", claim.person_id)
      .maybeSingle();
    if ((mem as any)?.space_id) return (mem as any).space_id;
  }

  // Fallback: space created by this user directly
  const { data: space } = await service
    .from("family_spaces")
    .select("id")
    .eq("created_by", userId)
    .maybeSingle();
  return (space as any)?.id ?? null;
}

/** GET /api/hoy — recuerdos del mismo mes+día en años anteriores */
export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);
  if (!spaceId) return NextResponse.json({ memories: [] });

  const today = new Date();
  const month = today.getMonth() + 1; // 1-12
  const day   = today.getDate();

  // Postgres: EXTRACT(MONTH FROM memory_date) y EXTRACT(DAY FROM memory_date)
  const { data, error } = await service
    .from("family_memories")
    .select("id, author_user_id, body, memory_date, photo_path, created_at")
    .eq("family_space_id", spaceId)
    .filter("memory_date", "not.is", null)
    .order("memory_date", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by month+day in JS (simpler than a raw SQL filter via PostgREST)
  const memories = (data ?? []).filter((m: any) => {
    const d = new Date(m.memory_date);
    return d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
  });

  // Resolve author names
  const authorIds = [...new Set(memories.map((m: any) => m.author_user_id as string))];
  let authorMap = new Map<string, { name: string; photo: string | null }>();
  if (authorIds.length > 0) {
    const { data: claims } = await service
      .from("person_claims")
      .select("user_id, person_id")
      .in("user_id", authorIds)
      .eq("claim_status", "approved")
      .is("revoked_at", null);
    const personIds = (claims ?? []).map((c: any) => c.person_id as string);
    if (personIds.length > 0) {
      const { data: persons } = await service
        .from("persons")
        .select("id, first_name, first_surname, photo_path")
        .in("id", personIds);
      const personMap = new Map((persons ?? []).map((p: any) => [p.id, p]));
      for (const c of claims ?? []) {
        const p = personMap.get((c as any).person_id);
        if (p) authorMap.set((c as any).user_id, {
          name: `${(p as any).first_name} ${(p as any).first_surname ?? ""}`.trim(),
          photo: (p as any).photo_path ?? null,
        });
      }
    }
  }

  const enriched = memories.map((m: any) => ({
    ...m,
    author: authorMap.get(m.author_user_id) ?? { name: "Familiar", photo: null },
    is_mine: m.author_user_id === user.id,
    year: new Date(m.memory_date).getUTCFullYear(),
    years_ago: today.getFullYear() - new Date(m.memory_date).getUTCFullYear(),
  }));

  return NextResponse.json({ memories: enriched });
}

/** POST /api/hoy — crear un recuerdo */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!checkRateLimit(`hoy-create:${user.id}`, 10, 60_000)) return rateLimitResponse();

  const { body, memory_date, photo_path, person_id } = await req.json().catch(() => ({}));
  if (!body?.trim()) return NextResponse.json({ error: "El recuerdo no puede estar vacío" }, { status: 400 });
  // For memories linked to a deceased person, allow today's date
  const dateToUse = memory_date ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateToUse))
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);
  if (!spaceId) return NextResponse.json({ error: "No perteneces a un espacio familiar" }, { status: 403 });

  const insertData: Record<string, unknown> = {
    author_user_id: user.id,
    family_space_id: spaceId,
    body: body.trim(),
    memory_date: dateToUse,
    photo_path: photo_path ?? null,
  };
  if (person_id) insertData.person_id = person_id;

  const { data, error } = await service
    .from("family_memories")
    .insert(insertData)
    .select("id, memory_date, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memory: data }, { status: 201 });
}

/** DELETE /api/hoy?id=... */
export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  await service.from("family_memories").delete().eq("id", id).eq("author_user_id", user.id);
  return NextResponse.json({ ok: true });
}

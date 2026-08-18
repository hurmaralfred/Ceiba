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
      .eq("person_id", (claim as any).person_id)
      .maybeSingle();
    if ((mem as any)?.space_id) return (mem as any).space_id;
  }

  const { data: space } = await service
    .from("family_spaces")
    .select("id")
    .eq("created_by", userId)
    .maybeSingle();
  return (space as any)?.id ?? null;
}

async function resolveAuthors(
  service: ReturnType<typeof getServiceClient>,
  userIds: string[],
): Promise<Map<string, { name: string; photo: string | null }>> {
  const map = new Map<string, { name: string; photo: string | null }>();
  if (userIds.length === 0) return map;

  const { data: claims } = await service
    .from("person_claims")
    .select("user_id, person_id")
    .in("user_id", userIds)
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
      if (p)
        map.set((c as any).user_id, {
          name: `${(p as any).first_name} ${(p as any).first_surname ?? ""}`.trim(),
          photo: (p as any).photo_path ?? null,
        });
    }
  }
  return map;
}

/**
 * GET /api/muro?date=YYYY-MM-DD
 * Returns:
 *   question   – pregunta del día para esa fecha
 *   responses  – todos los recuerdos/respuestas publicados ese día (por created_at)
 *   dates      – últimas 7 fechas con actividad (para navegar el historial)
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);
  if (!spaceId) return NextResponse.json({ question: null, responses: [], dates: [] });

  const dateParam = req.nextUrl.searchParams.get("date");
  const targetDate = dateParam ?? new Date().toISOString().slice(0, 10);

  // ── Pregunta del día ──────────────────────────────────────────────────────
  const { data: qRow } = await service
    .from("daily_family_question")
    .select("question_text")
    .eq("space_id", spaceId)
    .eq("question_date", targetDate)
    .maybeSingle();

  const question: string | null = (qRow as any)?.question_text ?? null;

  // ── Respuestas: memories cuyo created_at cae en targetDate ──────────────
  // We use created_at::date = targetDate (the day the response was written)
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd   = `${targetDate}T23:59:59.999Z`;

  const { data: memories } = await service
    .from("family_memories")
    .select("id, author_user_id, body, photo_path, created_at")
    .eq("family_space_id", spaceId)
    .gte("created_at", dayStart)
    .lte("created_at", dayEnd)
    .order("created_at", { ascending: true });

  const authorIds = [...new Set((memories ?? []).map((m: any) => m.author_user_id as string))];
  const authorMap = await resolveAuthors(service, authorIds);

  const responses = (memories ?? []).map((m: any) => ({
    id: m.id as string,
    body: m.body as string,
    photo_path: m.photo_path as string | null,
    created_at: m.created_at as string,
    is_mine: m.author_user_id === user.id,
    author: authorMap.get(m.author_user_id) ?? { name: "Familiar", photo: null },
  }));

  // ── Últimas fechas con actividad (historial de navegación) ───────────────
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: recentMemories } = await service
    .from("family_memories")
    .select("created_at")
    .eq("family_space_id", spaceId)
    .gte("created_at", thirtyDaysAgo)
    .order("created_at", { ascending: false });

  const dateSet = new Set<string>();
  for (const m of recentMemories ?? []) {
    const d = (m as any).created_at.slice(0, 10);
    dateSet.add(d);
  }
  const dates = [...dateSet].sort((a, b) => b.localeCompare(a)).slice(0, 14);

  return NextResponse.json({ question, responses, dates, targetDate });
}

/**
 * POST /api/muro
 * Body: { body: string, question_text?: string, photo_path?: string }
 * Creates a memory response for today's daily question.
 * If question_text is provided, it is upserted to daily_family_question
 * so the question is always retrievable for this date.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!checkRateLimit(`muro-post:${user.id}`, 20, 60_000)) return rateLimitResponse();

  const { body, photo_path, question_text } = await req.json().catch(() => ({}));
  if (!body?.trim()) return NextResponse.json({ error: "El texto no puede estar vacío" }, { status: 400 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);
  if (!spaceId) return NextResponse.json({ error: "Sin espacio familiar" }, { status: 403 });

  const today = new Date().toISOString().slice(0, 10);

  // Persist the question so future readers always have context for this date
  if (question_text?.trim()) {
    await service
      .from("daily_family_question")
      .upsert(
        { space_id: spaceId, question_date: today, question_text: question_text.trim() },
        { onConflict: "space_id,question_date", ignoreDuplicates: true }
      );
  }

  const { data, error } = await service
    .from("family_memories")
    .insert({
      author_user_id: user.id,
      family_space_id: spaceId,
      body: body.trim(),
      memory_date: today,
      photo_path: photo_path ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ response: data }, { status: 201 });
}

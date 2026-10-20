import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk@0.27.3";
import { SYSTEM_PROMPT } from "./prompt.ts";

const DAILY_LIMIT = parseInt(Deno.env.get("RAICES_DAILY_LIMIT") ?? "10");
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) ||
      origin.startsWith("http://localhost"));
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : ALLOWED_ORIGINS[0] ?? "",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  // ── 1. JWT requerido ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "No autorizado" }, 401, cors);
  }

  // Cliente con el JWT del usuario — lectura de datos familiares
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) {
    return json({ error: "Token inválido" }, 401, cors);
  }

  // ── 2. Límite diario ─────────────────────────────────────────
  // Leer con el user client (RLS aplica — ve su propia fila)
  const today = new Date().toISOString().slice(0, 10);
  const { data: usage } = await userClient
    .from("ai_usage")
    .select("requests_count")
    .eq("user_id", user.id)
    .eq("day", today)
    .maybeSingle();

  const usedToday = usage?.requests_count ?? 0;
  if (usedToday >= DAILY_LIMIT) {
    return json(
      {
        error: "Límite diario alcanzado",
        remaining_today: 0,
        limit: DAILY_LIMIT,
      },
      429,
      cors,
    );
  }

  // ── 3. Consentimiento ─────────────────────────────────────────
  const { data: consent } = await userClient
    .from("consents")
    .select("granted")
    .eq("user_id", user.id)
    .eq("consent_type", "ai_processing")
    .eq("granted", true)
    .maybeSingle();

  if (!consent) {
    return json(
      { error: "consent_required", message: "Se requiere aceptar el uso de IA para continuar." },
      403,
      cors,
    );
  }

  // ── 4. Leer datos del árbol (con JWT del usuario, no service role) ──
  const body = await req.json().catch(() => ({}));
  const spaceId: string | undefined = body.space_id;
  const userMessage: string | undefined = body.message;

  if (!spaceId) {
    return json({ error: "space_id requerido" }, 400, cors);
  }

  // Verificar membresía/permiso via can_view_space
  const { data: canView, error: spaceErr } = await userClient
    .rpc("can_view_space", { p_space_id: spaceId });

  if (spaceErr || !canView) {
    return json({ error: "Sin acceso a este árbol" }, 403, cors);
  }

  // Personas del espacio
  const { data: members, error: memberErr } = await userClient
    .from("space_memberships")
    .select(`
      person_id,
      persons (
        id, first_name, middle_name, first_surname, second_surname,
        birth_date, birth_city, birth_country,
        gender, is_deceased, death_date
      )
    `)
    .eq("space_id", spaceId);

  if (memberErr) {
    return json({ error: "Error leyendo el árbol" }, 500, cors);
  }

  const persons = (members ?? [])
    .map((m: any) => m.persons)
    .filter(Boolean);

  const personIds = persons.map((p: any) => p.id as string);

  // Relaciones entre esas personas
  const { data: rels, error: relErr } = await userClient
    .from("relationships")
    .select("id, person_a_id, person_b_id, relationship_type, parent_kind, union_kind")
    .in("person_a_id", personIds)
    .in("person_b_id", personIds)
    .is("deleted_at", null);

  if (relErr) {
    return json({ error: "Error leyendo relaciones" }, 500, cors);
  }

  // ── 5. Llamar a Anthropic ─────────────────────────────────────
  const anthropic = new Anthropic({
    apiKey: Deno.env.get("ANTHROPIC_API_KEY")!,
  });

  const treeContext = JSON.stringify({
    space_id: spaceId,
    persons,
    relationships: rels ?? [],
  });

  const userPrompt = userMessage
    ? `El usuario pregunta: "${userMessage}"\n\nÁrbol familiar:\n${treeContext}`
    : `Analiza este árbol familiar y sugiere conexiones que podrían faltar:\n${treeContext}`;

  let aiRaw = "";
  let parsed: any = { findings: [], suggestions: [] };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    aiRaw = msg.content[0].type === "text" ? msg.content[0].text : "";
    // Extraer bloque JSON si viene envuelto en ```
    const jsonMatch = aiRaw.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);

    // ── 6. Persistir sugerencias + uso (service role) ─────────────
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Incrementar uso
    await serviceClient.from("ai_usage").upsert(
      {
        user_id: user.id,
        day: today,
        requests_count: usedToday + 1,
        tokens_used: msg.usage.input_tokens + msg.usage.output_tokens,
      },
      { onConflict: "user_id,day" },
    );

    // Guardar sugerencias
    if (parsed.suggestions?.length) {
      const rows = parsed.suggestions.map((s: any) => ({
        user_id: user.id,
        space_id: spaceId,
        person_id: s.suggested_data?.anchor_person_id ?? null,
        suggestion_type: s.suggestion_type,
        confidence: s.confidence,
        sources: s.sources ?? [],
        suggested_data: s.suggested_data ?? {},
        ai_raw_response: aiRaw,
      }));
      await serviceClient.from("ai_suggestions").insert(rows);
    }
  } catch (err: any) {
    console.error("Anthropic error:", err);
    return json({ error: "Error procesando con IA" }, 502, cors);
  }

  return json(
    {
      findings: parsed.findings ?? [],
      suggestions: parsed.suggestions ?? [],
      remaining_today: DAILY_LIMIT - usedToday - 1,
      limit: DAILY_LIMIT,
    },
    200,
    cors,
  );
});

function json(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

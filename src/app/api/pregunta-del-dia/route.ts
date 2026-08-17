import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/server/family";

const FALLBACK_QUESTIONS = [
  "¿Cuál es el recuerdo más feliz que tienes compartiendo con un familiar?",
  "¿Qué tradición familiar te gustaría que nunca se perdiera?",
  "¿Cuál es la historia más memorable que has escuchado sobre tus abuelos?",
  "¿Qué lugar de tu infancia te gustaría volver a visitar con tu familia?",
  "¿Cuál es el consejo más valioso que te dio un familiar?",
  "¿Qué momento con tu familia te gustaría revivir?",
  "¿Quién en tu familia te ha enseñado algo que nunca olvidarás?",
  "¿Cuál es la comida que más asocias con los momentos especiales en familia?",
  "¿Qué canción o música evoca un recuerdo familiar significativo para ti?",
  "¿Cuál ha sido el viaje en familia más especial que recuerdas?",
  "¿Hay alguna historia familiar que crees que debería escribirse?",
  "¿Cuál es el mayor logro familiar del que te sientes orgulloso?",
  "¿Qué valores familiares quieres transmitir a las próximas generaciones?",
  "¿Cuál fue la primera aventura que tuviste con algún familiar?",
  "¿Qué superpoder familiar tiene cada miembro de tu familia?",
  "¿Cómo celebraban las navidades o fechas especiales cuando eras niño?",
  "¿Quién en tu familia te ha dado la lección de vida más importante?",
  "¿Cuál es el chiste o anécdota que siempre se repite en las reuniones familiares?",
  "¿Qué quisierías contarles a tus familiares y que todavía no les has dicho?",
  "¿Cuál es el regalo más significativo que has recibido de un familiar?",
  "¿Qué actividad o juego jugabas con tu familia cuando eras pequeño?",
  "¿Cuál es el momento en que más has sentido el apoyo de tu familia?",
  "¿Hay alguna foto familiar que represente perfectamente quiénes son como familia?",
  "¿Qué enseñanza de tus padres o abuelos aplicas en tu vida diaria?",
  "¿Cuál es la historia de amor favorita dentro de tu familia?",
  "¿Qué sueño familiar aún está pendiente de cumplirse?",
  "¿Cuál es la reunión familiar que más recuerdas con cariño?",
  "¿Qué aprendiste de un familiar que te sorprendió?",
  "¿Cuál es la historia de origen de tu familia que más te emociona?",
  "¿Qué le preguntarías a un antepasado tuyo si pudieras hacerlo?",
];

async function getSpaceId(
  service: ReturnType<typeof getServiceClient>,
  userId: string
): Promise<string | null> {
  const { data: claim } = await service
    .from("person_claims")
    .select("person_id")
    .eq("user_id", userId)
    .eq("claim_status", "approved")
    .is("revoked_at", null)
    .maybeSingle();
  if (!claim?.person_id) return null;

  const { data: mem } = await service
    .from("space_memberships")
    .select("space_id")
    .eq("person_id", claim.person_id)
    .maybeSingle();
  return (mem as any)?.space_id ?? null;
}

async function generateWithClaude(context: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [
        {
          role: "user",
          content: `Eres un asistente que genera preguntas reflexivas para familias latinoamericanas.
Basándote en la actividad reciente de esta familia: ${context}

Genera UNA sola pregunta reflexiva, emotiva y personal que invite a compartir recuerdos o historias familiares.
La pregunta debe ser relevante a lo que está pasando en su familia.
Responde SOLO con la pregunta, sin explicaciones ni comillas.`,
        },
      ],
    });

    const text = message.content[0];
    if (text.type === "text") return text.text.trim();
    return null;
  } catch {
    return null;
  }
}

async function getFamilyContext(
  service: ReturnType<typeof getServiceClient>,
  spaceId: string
): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const parts: string[] = [];

  // Recent photos
  const { data: photos } = await service
    .from("family_photos")
    .select("id, created_at")
    .eq("space_id", spaceId)
    .gte("created_at", sinceIso)
    .limit(10);
  if (photos && photos.length > 0)
    parts.push(`${photos.length} fotos subidas esta semana`);

  // Recent memories/stories
  const { data: memories } = await service
    .from("family_memories")
    .select("id, body, memory_date")
    .eq("family_space_id", spaceId)
    .gte("created_at", sinceIso)
    .limit(5);
  if (memories && memories.length > 0)
    parts.push(`${memories.length} recuerdos o historias añadidas`);

  // Upcoming birthdays (next 30 days)
  const { data: persons } = await service
    .from("persons")
    .select("first_name, birth_date")
    .not("birth_date", "is", null)
    .limit(50);

  if (persons) {
    const today = new Date();
    const upcoming = persons.filter((p: any) => {
      if (!p.birth_date) return false;
      const bd = new Date(p.birth_date);
      const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      const diff = thisYear.getTime() - today.getTime();
      return diff >= 0 && diff <= 30 * 24 * 60 * 60 * 1000;
    });
    if (upcoming.length > 0)
      parts.push(
        `cumpleaños próximos: ${upcoming.map((p: any) => p.first_name).join(", ")}`
      );
  }

  // Family size
  const { count } = await service
    .from("space_memberships")
    .select("id", { count: "exact", head: true })
    .eq("space_id", spaceId);
  if (count) parts.push(`${count} miembros en la familia`);

  return parts.length > 0 ? parts.join("; ") : "familia activa en Ceiba";
}

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const service = getServiceClient();
  const spaceId = await getSpaceId(service, user.id);

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // If no space, return a rotating fallback
  if (!spaceId) {
    const idx = Math.floor(Date.now() / 86400000) % FALLBACK_QUESTIONS.length;
    return NextResponse.json({ question: FALLBACK_QUESTIONS[idx] });
  }

  // Check cache
  const { data: cached } = await service
    .from("daily_family_question")
    .select("question_text")
    .eq("space_id", spaceId)
    .eq("question_date", today)
    .maybeSingle();

  if (cached?.question_text) {
    return NextResponse.json({ question: cached.question_text });
  }

  // Generate new question
  const context = await getFamilyContext(service, spaceId);
  const aiQuestion = await generateWithClaude(context);

  // Fallback: pick from pool based on day + space hash
  const spaceHash = spaceId
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const dayNumber = Math.floor(Date.now() / 86400000);
  const fallbackIdx = (dayNumber + spaceHash) % FALLBACK_QUESTIONS.length;
  const question = aiQuestion ?? FALLBACK_QUESTIONS[fallbackIdx];

  // Save to cache
  await service.from("daily_family_question").upsert(
    {
      space_id: spaceId,
      question_date: today,
      question_text: question,
      context_summary: context,
    },
    { onConflict: "space_id,question_date" }
  );

  return NextResponse.json({ question });
}

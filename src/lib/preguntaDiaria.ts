import { SupabaseClient } from "@supabase/supabase-js";

// ── Pool de preguntas por eje temático ───────────────────────────────────────
export const QUESTION_POOL: { theme: string; questions: string[] }[] = [
  {
    theme: "infancia",
    questions: [
      "¿Cuál es el olor que más te transporta a tu infancia?",
      "¿Qué juego de tu niñez te gustaría enseñarle a los más pequeños de la familia?",
      "¿Cuál fue la travesura más grande que hiciste de niño?",
      "¿Recuerdas cuál fue tu primer héroe o heroína dentro de la familia?",
      "¿Qué canción de cuna o nana te cantaban cuando eras pequeño?",
      "¿Cuál era tu lugar secreto o favorito cuando eras niño?",
      "¿Qué objeto de tu infancia conservas o desearías haber conservado?",
      "¿Cuál fue la primera mentira que le dijiste a tus padres siendo niño?",
      "¿Cómo era el cuarto donde dormías de niño?",
      "¿Cuál fue el primer trabajo o responsabilidad que tuviste en casa?",
      "¿Qué programa de TV o película veía toda la familia juntos?",
      "¿Qué actividad extraescolar o deporte practicabas de niño?",
      "¿Cuál fue el regalo de cumpleaños que más ilusión te hizo de pequeño?",
      "¿Cuál era el plato que más pedías que te cocinaran en casa?",
      "¿Qué mascota tuviste o siempre quisiste tener de niño?",
      "¿Cuál fue la primera vez que viajaste lejos de casa?",
      "¿Qué libro, cuento o historia te contaban antes de dormir?",
      "¿A qué querías dedicarte cuando fueras grande, de niño?",
      "¿Cuál fue el momento en que sentiste que ya no eras un niño?",
      "¿Qué cosa de tu infancia extrañas más en el día a día?",
    ],
  },
  {
    theme: "tradiciones",
    questions: [
      "¿Cuál es la tradición familiar que esperas con más ilusión cada año?",
      "¿Hay alguna receta familiar que sea un secreto guardado por generaciones?",
      "¿Cómo celebraba tu familia las fechas especiales cuando eras pequeño?",
      "¿Qué tradición de tu familia de origen llevas a tu vida actual?",
      "¿Hay una tradición que se perdió y que te gustaría rescatar?",
      "¿Cuál es el ritual de tu familia antes de sentarse a comer juntos?",
      "¿Qué tradición nueva ha creado tu familia en los últimos años?",
      "¿Cómo celebraban el Año Nuevo en tu casa cuando eras niño?",
      "¿Hay alguna superstición o creencia que tu familia repite de generación en generación?",
      "¿Qué hace especial la Navidad o las fiestas en tu familia?",
      "¿Cuál es la tradición más curiosa o inusual de tu familia?",
      "¿Tienen algún ritual para despedirse cuando alguien viaja lejos?",
      "¿Cómo se enteraban las buenas noticias dentro de la familia antes de los celulares?",
      "¿Existe alguna tradición diferente en la familia de tu pareja que hayas adoptado?",
      "¿Qué tradición le has transmitido o quieres transmitir a tus hijos o sobrinos?",
      "¿Hay alguna fecha en el calendario que solo tu familia celebra?",
      "¿Cuál era la tradición del cumpleaños en tu casa?",
      "¿Tienen alguna canción, frase o grito que sea exclusivo de su familia?",
      "¿Qué hacía toda la familia junta los domingos?",
      "¿Hay algún objeto, como un mantel o una copa, que siempre aparece en las reuniones?",
    ],
  },
  {
    theme: "relaciones",
    questions: [
      "¿Con cuál familiar te identificas más y por qué?",
      "¿A quién en tu familia extrañas más cuando estás lejos?",
      "¿Cuál es la persona de la familia con quien tienes la relación más inesperada o sorprendente?",
      "¿Qué familiar te ha enseñado algo que no esperabas aprender?",
      "¿Hay algún malentendido familiar que con el tiempo se convirtió en una historia graciosa?",
      "¿Quién en tu familia siempre sabe cómo animarte cuando estás mal?",
      "¿Cuál es el familiar más diferente a ti y qué admiras de esa diferencia?",
      "¿Recuerdas cuándo fue la última vez que le dijiste 'te quiero' a un familiar?",
      "¿Con quién de la familia tienes conversaciones que duran horas sin darte cuenta?",
      "¿Qué es lo que más te cuesta entender de algún familiar y que a la vez te parece fascinante?",
      "¿Hay alguien en la familia cuya historia de vida sientes que merece ser contada?",
      "¿Cuál es la relación entre dos familiares que más admiras?",
      "¿Qué familiar te ha sorprendido más en los últimos años?",
      "¿Con quién de la familia compartirías un viaje largo y por qué?",
      "¿Hay algún familiar con quien sientas que nunca te alcanzará el tiempo para hablar de todo?",
      "¿Quién en tu familia tiene el mejor sentido del humor?",
      "¿A quién de la familia le pedirías consejo si tuvieras un dilema difícil?",
      "¿Con quién de la familia compartirías una comida de tres horas?",
      "¿Hay algún familiar con quien tengas un lenguaje propio, palabras o chistes que solo ustedes entienden?",
      "¿Quién en tu familia ha cambiado más con el tiempo y de qué forma positiva?",
    ],
  },
  {
    theme: "valores",
    questions: [
      "¿Cuál es el valor que tu familia te inculcó y que más agradeces hoy?",
      "¿Qué frase de un familiar llevas grabada en la memoria?",
      "¿Cuál es la lección de vida más dura que aprendiste dentro de tu familia?",
      "¿Qué principio familiar quieres que nunca se pierda en las próximas generaciones?",
      "¿Hay alguna decisión de un familiar que en su momento no entendiste y ahora admiras?",
      "¿Cómo definirías en una palabra el carácter de tu familia?",
      "¿Qué es lo que tu familia hace diferente al resto y de lo que te sientes orgulloso?",
      "¿Cuál fue el momento en que tu familia demostró una fortaleza que no esperabas?",
      "¿Qué enseñanza sobre el dinero o el trabajo te dieron en casa?",
      "¿Qué te enseñó tu familia sobre cómo tratar a los demás?",
      "¿Cuál es la actitud ante la adversidad que distingue a tu familia?",
      "¿Qué historia de sacrificio familiar te ha marcado más?",
      "¿Hay algún acto de generosidad de un familiar que nunca olvidarás?",
      "¿Qué te enseñó tu familia sobre el perdón?",
      "¿Cuál es el error que tu familia cometió y del que aprendió algo valioso?",
      "¿Qué valores de tu cultura o región siente que tu familia preserva especialmente?",
      "¿Qué te enseñó tu familia sobre la honestidad con palabras o con el ejemplo?",
      "¿Cuál es la forma en que tu familia expresa el amor que más te gusta?",
      "¿Qué significa para ti el éxito, y de dónde viene esa idea en tu familia?",
      "¿Qué te gustaría que tu familia recordara de ti?",
    ],
  },
  {
    theme: "comida_y_cultura",
    questions: [
      "¿Cuál es el plato que define a tu familia y cuál es su historia?",
      "¿Quién era el mejor cocinero o cocinera de la familia y qué preparaba?",
      "¿Hay algún ingrediente o sabor que te recuerde inmediatamente a tu hogar?",
      "¿Cuál es la receta familiar que más temes perder si no se escribe?",
      "¿Recuerdas alguna comida de celebración que preparaban en tu familia?",
      "¿Qué música sonaba en las reuniones familiares cuando eras pequeño?",
      "¿Hay alguna canción que toda tu familia sabe de memoria?",
      "¿Qué baile o ritmo es el favorito en las fiestas de tu familia?",
      "¿Qué película o libro ha unido a tu familia en alguna conversación memorable?",
      "¿Cuál es la lengua, dialecto o forma de hablar que es característica de tu familia?",
      "¿Qué expresión o dicho familiar nunca escuchas en ningún otro lado?",
      "¿Hay alguna artesanía, arte u oficio que alguien en tu familia domina?",
      "¿Cómo se vivía la música en tu familia cuando eras niño?",
      "¿Qué objeto decorativo o cultural tiene tu familia que venga de otro lugar o época?",
      "¿Hay alguna historia de inmigración o desplazamiento en tu familia que haya cambiado todo?",
      "¿Qué aspectos de tu cultura transmites conscientemente a las nuevas generaciones?",
      "¿Cuál es el postre o dulce que más asocias con las fiestas en familia?",
      "¿Hay alguna bebida, infusión o remedio casero que sea el sello de tu familia?",
      "¿Qué tradición culinaria de tus abuelos te gustaría recuperar?",
      "¿Si tu familia fuera un plato de comida, cuál sería y por qué?",
    ],
  },
  {
    theme: "lugares_y_viajes",
    questions: [
      "¿Cuál es el lugar del mundo que tu familia considera su hogar espiritual?",
      "¿Qué viaje familiar recuerdas como el más especial?",
      "¿Hay algún lugar que visitas o has visitado que sientes que tiene la energía de tu familia?",
      "¿Cuál fue el viaje más corto pero más significativo que hiciste con un familiar?",
      "¿A dónde llevarías a toda tu familia si pudieras hacer un viaje ahora mismo?",
      "¿Cuál es el lugar de la casa de tu infancia que más recuerdas con cariño?",
      "¿Hay alguna ciudad o pueblo que sientas como parte de la identidad de tu familia?",
      "¿Cuál fue el primer viaje largo que hiciste en familia?",
      "¿Qué lugar de tu país desconocido desearías explorar con tu familia?",
      "¿Si pudieras volver a un lugar de tu infancia, cuál sería y con quién irías?",
      "¿Hay algún lugar que tu familia perdió por la migración o el tiempo y que aún añoras?",
      "¿Cuál es el rincón secreto o favorito de la familia que pocos conocen?",
      "¿Qué lugar de vacaciones era el favorito cuando eras niño?",
      "¿Hay algún viaje que tu familia planeó pero nunca pudo hacer?",
      "¿Cuál es el recuerdo más gracioso de un viaje familiar?",
      "¿Cuál es la aventura más loca que has tenido viajando con algún familiar?",
      "¿Si pudieras vivir en otro lugar con tu familia, dónde sería?",
      "¿Qué lugar de tu familia paterna o materna nunca has visitado pero te gustaría conocer?",
      "¿Cuál fue la primera vez que te alejaste mucho de tu familia y cómo fue esa experiencia?",
      "¿Hay algún lugar al que siempre quieres volver con tu familia?",
    ],
  },
  {
    theme: "logros_y_orgullo",
    questions: [
      "¿Cuál es el logro de un familiar del que más te sientes orgulloso?",
      "¿Qué obstáculo superó alguien en tu familia que te parece admirable?",
      "¿Hay algún talento oculto de un familiar que te sorprendió cuando lo descubriste?",
      "¿Cuál es el emprendimiento o proyecto de un familiar que te inspira?",
      "¿Qué sacrificio de tus padres o abuelos te llena de gratitud cuando lo recuerdas?",
      "¿Cuál es el mayor cambio positivo que ha logrado alguien en tu familia?",
      "¿Recuerdas la primera vez que sentiste orgullo de pertenecer a tu familia?",
      "¿Hay alguien en tu familia que haya roto una barrera o hecho algo que nadie había hecho antes?",
      "¿Cuál es el logro tuyo que más les has querido compartir a tu familia?",
      "¿Qué familiar ha superado algo muy difícil y sale fortalecido?",
      "¿Cuál es la historia de éxito más humilde pero inspiradora de tu familia?",
      "¿Hay algún familiar que haya cambiado de rumbo en su vida y lo admiras por eso?",
      "¿Cuál es el acto de valentía de un familiar que nunca olvidarás?",
      "¿Qué familiar ha hecho algo por la comunidad o por otros que te llena de orgullo?",
      "¿Hay algún familiar que haya aprendido algo nuevo en una etapa avanzada de su vida?",
      "¿Cuál es la historia de superación más poderosa que conoces dentro de tu familia?",
      "¿Qué familiar ha encontrado su vocación o pasión tarde en la vida y te inspira?",
      "¿Cuál es el primer gran logro que recuerdas haber celebrado en familia?",
      "¿Qué historia de resiliencia familiar te contarías a ti mismo cuando necesitas fuerza?",
      "¿Qué legado quieres dejar tú para las próximas generaciones de tu familia?",
    ],
  },
  {
    theme: "sueños_y_futuro",
    questions: [
      "¿Cuál es el sueño que tienes para tu familia en los próximos cinco años?",
      "¿Hay algo que siempre quisiste preguntarle a un familiar mayor y aún no has preguntado?",
      "¿Qué proyecto familiar te gustaría empezar este año?",
      "¿Cuál es el sueño de un familiar que quisieras ver cumplirse pronto?",
      "¿Si pudieras hacer una cosa por tu familia que les cambiara la vida, qué harías?",
      "¿Cuál es la conversación pendiente más importante que tienes con algún familiar?",
      "¿Hay algún sueño familiar que quedó a medias y merece retomarse?",
      "¿Qué le desearías a cada miembro de tu familia para los próximos años?",
      "¿Cómo imaginas una reunión familiar dentro de diez años?",
      "¿Qué quisieras que las futuras generaciones de tu familia supieran de ti?",
      "¿Cuál es el cambio más importante que quieres hacer en tu propia familia?",
      "¿Hay algún talento o habilidad que quieras desarrollar para compartir con tu familia?",
      "¿Qué historia quieres escribir con tu familia que aún no ha comenzado?",
      "¿Cuál es la reunión familiar con la que más sueñas?",
      "¿Qué le gustaría a tu familia lograr juntos como colectivo?",
      "¿Hay algo que quieras aprender de un familiar antes de que sea tarde?",
      "¿Qué tradición nueva quisieras comenzar en tu familia este año?",
      "¿Cuál es el regalo más valioso que puedes darle a tu familia hoy?",
      "¿Qué palabras le dirías a la versión joven de tu familia si pudieras volver atrás?",
      "¿Cuál es el próximo capítulo que quieres vivir junto a tu familia?",
    ],
  },
  {
    theme: "humor_y_anecdotas",
    questions: [
      "¿Cuál es la anécdota familiar que hace reír a todos cada vez que se cuenta?",
      "¿Quién en tu familia tiene el sobrenombre más gracioso y por qué?",
      "¿Cuál es el malentendido más épico que ha ocurrido en tu familia?",
      "¿Hay alguna reunión familiar donde algo salió completamente diferente a lo planeado?",
      "¿Cuál es el chiste interno que solo tu familia entiende?",
      "¿Quién es el mejor imitador o imitadora de la familia?",
      "¿Cuál fue la vez que la risa fue tan grande que nadie pudo parar?",
      "¿Hay algún malentendido de idioma o expresión que causó un momento gracioso?",
      "¿Cuál fue la travesura más legendaria de la familia?",
      "¿Recuerdas alguna anécdota de viaje familiar que fuera un desastre pero terminó siendo perfecta?",
      "¿Cuál es la foto familiar más ridícula pero más querida que tienen?",
      "¿Hay algún miembro de la familia que siempre llega tarde o siempre llega primero?",
      "¿Qué le pasa a tu familia invariablemente cuando se reúnen?",
      "¿Cuál fue el regalo más insólito o inesperado que alguien dio en la familia?",
      "¿Hay algún tema que en tu familia siempre termina en debate o discusión amistosa?",
      "¿Cuál es el hábito o costumbre más extraño que tiene alguien de la familia?",
      "¿Qué película o serie veían juntos que ahora les produce vergüenza ajena?",
      "¿Hay algún apodo que le pusiste o te pusieron que ya no te puedes quitar?",
      "¿Cuál fue el momento más inesperado de una celebración familiar?",
      "¿Qué frase de un familiar siempre viene a tu mente en el momento menos esperado?",
    ],
  },
  {
    theme: "memoria_y_homenaje",
    questions: [
      "¿Cuál es el recuerdo de un familiar que ya no está que más atesoras?",
      "¿Qué le dirías a un familiar que perdiste si pudieras hablar con él o ella un momento?",
      "¿Qué aspecto de un ser querido que ya no está sientes que vive en ti?",
      "¿Cuál es la historia de un familiar fallecido que quieres que nunca se olvide?",
      "¿Hay algún objeto que te recuerde a alguien que ya no está y que cuidas con cariño?",
      "¿Cómo honra tu familia la memoria de quienes ya no están?",
      "¿Cuál es la enseñanza más grande que te dejó alguien que perdiste?",
      "¿Hay alguna historia sin terminar de un familiar que sientes el deber de continuar?",
      "¿Cuál es la fecha del año en que más recuerdas a alguien especial que ya no está?",
      "¿Qué harías para honrar la memoria de tus ancestros si tuvieras un día para ello?",
      "¿Hay alguna tradición en tu familia que nació para recordar a alguien?",
      "¿Cuál es el rasgo de carácter de un familiar fallecido que ves en los vivos?",
      "¿Si pudieras hacerle una pregunta a un antepasado tuyo, cuál sería?",
      "¿Hay alguna fotografía de un familiar que sientes que cuenta toda su historia?",
      "¿Qué lugar frecuentaba alguien que ya no está y que visitas pensando en él o ella?",
      "¿Cómo hablan de los que ya no están en tu familia?",
      "¿Cuál es el legado más tangible que dejó alguien en tu familia?",
      "¿Qué historia de tus bisabuelos o antepasados te emociona o te llena de curiosidad?",
      "¿Hay algo que le prometiste a alguien que ya no está y que aún quieres cumplir?",
      "¿Qué le deberías agradecer a alguien de tu familia que ya partió?",
    ],
  },
];

export const TOTAL_QUESTIONS = QUESTION_POOL.reduce((s, t) => s + t.questions.length, 0);

export function getDayTheme(dayNumber: number) {
  return QUESTION_POOL[dayNumber % QUESTION_POOL.length];
}

export function getFallbackQuestion(dayNumber: number, spaceHash: number): string {
  const pool = getDayTheme(dayNumber);
  return pool.questions[(dayNumber + spaceHash) % pool.questions.length];
}

export async function getRecentQuestions(
  service: SupabaseClient,
  spaceId: string,
): Promise<string[]> {
  const { data } = await service
    .from("daily_family_question")
    .select("question_text")
    .eq("space_id", spaceId)
    .order("question_date", { ascending: false })
    .limit(10);
  return ((data ?? []) as any[]).map((r) => r.question_text as string);
}

export async function generateWithClaude(
  context: string,
  recentQuestions: string[],
  dayTheme: string,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const themeLabels: Record<string, string> = {
    infancia: "recuerdos de infancia",
    tradiciones: "tradiciones familiares",
    relaciones: "vínculos y relaciones entre familiares",
    valores: "valores, lecciones de vida y principios",
    comida_y_cultura: "comida, música y cultura familiar",
    lugares_y_viajes: "lugares, hogares y viajes",
    logros_y_orgullo: "logros, orgullo y superación",
    sueños_y_futuro: "sueños, proyectos y el futuro",
    humor_y_anecdotas: "humor, anécdotas y momentos graciosos",
    memoria_y_homenaje: "memoria de seres queridos y homenajes",
  };

  const avoidBlock =
    recentQuestions.length > 0
      ? `\n\nPreguntas ya hechas (NO repitas enfoque ni emoción):\n${recentQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
      : "";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 160,
      messages: [
        {
          role: "user",
          content: `Eres un motor de preguntas del día para Ceiba, una app de historia familiar latinoamericana.

Contexto de la familia hoy: ${context}
Eje temático del día: ${themeLabels[dayTheme] ?? "dinámicas familiares"}${avoidBlock}

Genera UNA pregunta reflexiva, emotiva y específica sobre el eje temático.
Debe invitar a un recuerdo concreto, una historia o una emoción genuina.
Directa, en español natural latinoamericano, termina con signo de interrogación.
Responde SOLO con la pregunta. Sin comillas, sin explicaciones.`,
        },
      ],
    });
    const text = message.content[0];
    return text.type === "text" ? text.text.trim() : null;
  } catch {
    return null;
  }
}

export async function generateAndCacheQuestion(
  service: SupabaseClient,
  spaceId: string,
  today: string,
  dayNumber: number,
): Promise<string> {
  // Return cached question if it already exists for today
  const { data: cached } = await service
    .from("daily_family_question")
    .select("question_text")
    .eq("space_id", spaceId)
    .eq("question_date", today)
    .maybeSingle();

  if ((cached as any)?.question_text) return (cached as any).question_text as string;

  const [recentQuestions, context] = await Promise.all([
    getRecentQuestions(service, spaceId),
    getFamilyContext(service, spaceId),
  ]);

  const dayTheme = getDayTheme(dayNumber).theme;
  const aiQuestion = await generateWithClaude(context, recentQuestions, dayTheme);
  const spaceHash = spaceId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const question = aiQuestion ?? getFallbackQuestion(dayNumber, spaceHash);

  await service.from("daily_family_question").upsert(
    { space_id: spaceId, question_date: today, question_text: question, context_summary: context },
    { onConflict: "space_id,question_date" },
  );

  return question;
}

async function getFamilyContext(service: SupabaseClient, spaceId: string): Promise<string> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();
  const parts: string[] = [];

  const [photosRes, memoriesRes, personsRes, countRes] = await Promise.allSettled([
    service.from("family_photos").select("id").eq("space_id", spaceId).gte("created_at", sinceIso).limit(10),
    service.from("family_memories").select("id").eq("family_space_id", spaceId).gte("created_at", sinceIso).limit(5),
    service.from("persons").select("first_name, birth_date").not("birth_date", "is", null).limit(50),
    service.from("space_memberships").select("id", { count: "exact", head: true }).eq("space_id", spaceId),
  ]);

  if (photosRes.status === "fulfilled" && photosRes.value.data?.length)
    parts.push(`${photosRes.value.data.length} fotos subidas esta semana`);
  if (memoriesRes.status === "fulfilled" && memoriesRes.value.data?.length)
    parts.push(`${memoriesRes.value.data.length} recuerdos añadidos`);

  if (personsRes.status === "fulfilled" && personsRes.value.data) {
    const today = new Date();
    const upcoming = (personsRes.value.data as any[]).filter((p) => {
      if (!p.birth_date) return false;
      const bd = new Date(p.birth_date);
      const thisYear = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
      return thisYear.getTime() - today.getTime() >= 0 &&
             thisYear.getTime() - today.getTime() <= 30 * 86400000;
    });
    if (upcoming.length) parts.push(`cumpleaños próximos: ${upcoming.map((p: any) => p.first_name).join(", ")}`);
  }

  if (countRes.status === "fulfilled" && (countRes.value as any).count)
    parts.push(`${(countRes.value as any).count} miembros`);

  return parts.length > 0 ? parts.join("; ") : "familia activa en Ceiba";
}

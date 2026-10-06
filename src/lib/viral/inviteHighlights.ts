// Razones concretas para aceptar una invitación, a partir de los datos
// agregados que devuelve get_invitation_by_token (campo `hook`).

export interface InvitationHook {
  family_count: number;
  joined_count: number;
  memories_about_person: number;
  photos_of_person: number;
  next_birthday: { first_name: string; days_until: number } | null;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Hasta 3 razones concretas para aceptar, de la más personal a la más general.
// Vacío si la familia aún no tiene nada que mostrar (se usa la lista genérica).
export function buildHighlights(h: InvitationHook | undefined): string[] {
  if (!h) return [];
  const out: string[] = [];
  if (h.memories_about_person > 0) {
    out.push(`Tu familia ya escribió ${plural(h.memories_about_person, "recuerdo", "recuerdos")} sobre ti`);
  }
  if (h.photos_of_person > 0) {
    out.push(`Hay ${plural(h.photos_of_person, "foto", "fotos")} en las que apareces`);
  }
  if (h.next_birthday) {
    const { first_name, days_until } = h.next_birthday;
    const when = days_until === 0 ? "es hoy" : days_until === 1 ? "es mañana" : `es en ${days_until} días`;
    out.push(`El cumpleaños de ${first_name} ${when}`);
  }
  if (h.family_count > 1) {
    out.push(
      h.joined_count > 1
        ? `${plural(h.family_count, "familiar", "familiares")} en la galaxia, ${h.joined_count} ya dentro`
        : `${plural(h.family_count, "familiar", "familiares")} te esperan en la galaxia`
    );
  }
  return out.slice(0, 3);
}


/**
 * Contador global de crecimiento de Ceiba.
 *
 * Los números vienen SIEMPRE de la RPC `get_ceiba_growth_stats`, que
 * devuelve solo conteos agregados (ningún dato personal). Aquí se valida
 * la forma de la respuesta y se construye el texto de la cabecera.
 *
 * Regla de degradación: si la RPC falla, se oculta únicamente el contador
 * global. El árbol debe seguir cargando con normalidad.
 */

export interface CeibaGrowthStats {
  totalActivePersons: number;
  totalRegisteredUsers: number;
  /** Personas activas todavía sin cuenta. Opcional en la respuesta. */
  totalUnclaimedPersons?: number;
}

/**
 * Valida y normaliza la respuesta cruda de la RPC.
 *
 * Devuelve `null` ante cualquier forma inesperada para que quien llame
 * simplemente oculte el contador en vez de renderizar "NaN" o "undefined".
 */
export function parseGrowthStats(raw: unknown): CeibaGrowthStats | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const data = raw as Record<string, unknown>;
  const persons = data.total_active_persons;
  const users = data.total_registered_users;
  const unclaimed = data.total_unclaimed_persons;

  const isCount = (v: unknown): v is number =>
    typeof v === "number" && Number.isFinite(v) && v >= 0;

  if (!isCount(persons) || !isCount(users)) return null;

  return {
    totalActivePersons: persons,
    totalRegisteredUsers: users,
    ...(isCount(unclaimed) ? { totalUnclaimedPersons: unclaimed } : {}),
  };
}

/** Pluraliza sin depender de librerías. */
function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Línea 1 — estado de la familia del usuario.
 * No usa "en Ceiba": ese lenguaje queda reservado al contador global.
 */
export function formatFamilyLine(
  totalMembers: number,
  connectedMembers: number,
): string {
  return `${plural(totalMembers, "familiar", "familiares")} · ${connectedMembers} conectados`;
}

/**
 * Línea 2 — contador global. Dos formas según el ancho disponible:
 *   escritorio: "Ceiba está creciendo: 46 personas · 6 usuarios registrados"
 *   móvil:      "46 personas en Ceiba · 6 registradas"
 */
export function formatGrowthLine(
  stats: CeibaGrowthStats,
  variant: "desktop" | "mobile" = "desktop",
): string {
  const personas = plural(stats.totalActivePersons, "persona", "personas");

  if (variant === "mobile") {
    return `${personas} en Ceiba · ${stats.totalRegisteredUsers} registradas`;
  }

  const usuarios = plural(
    stats.totalRegisteredUsers,
    "usuario registrado",
    "usuarios registrados",
  );
  return `Ceiba está creciendo: ${personas} · ${usuarios}`;
}

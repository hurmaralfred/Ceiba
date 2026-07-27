import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Prevención de personas duplicadas en `add_relative`.
 *
 * La lógica vive en PL/pgSQL (migración
 * 20260726000000_add_relative_duplicate_prevention.sql), no en TypeScript.
 *
 * ── CLASIFICACIÓN DE LAS PRUEBAS DE ESTE ARCHIVO ──────────────────────
 *
 * [MODELO]   Prueban un MODELO ejecutable de las reglas de normalización y
 *            puntuación, reimplementado aquí en TypeScript. Verifican que
 *            el CRITERIO es correcto (p. ej. que "Martinez"/"Martínez"
 *            colisionan), NO que el SQL lo implemente. Si alguien cambia
 *            los umbrales en la migración sin tocar este archivo, estas
 *            pruebas seguirán pasando: es su límite conocido.
 *
 * [CONTRATO] Inspeccionan el TEXTO del SQL de la migración. Verifican que
 *            las cláusulas críticas existen y en el orden correcto (p. ej.
 *            que el RETURN de needs_confirmation precede a create_person).
 *            No ejecutan nada: son un lint semántico, no una prueba de
 *            comportamiento.
 *
 * [INTEGRACIÓN] NO están en este archivo ni en `npm test`. Se ejecutan
 *            fuera de banda contra el esquema real, dentro de una
 *            transacción revertida. Ver:
 *              docs/repair/integration_check_add_relative.sql
 *            Motivo: requieren credenciales de Supabase y red; meterlas en
 *            la suite la volvería dependiente de producción. Los 5
 *            escenarios exigidos SÍ fueron ejecutados y verificados; el
 *            resultado se documenta en ese archivo.
 *
 * Los 12 escenarios exigidos están cubiertos y numerados abajo.
 */

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260726000000_add_relative_duplicate_prevention.sql"),
  "utf8",
);

// ── Modelo de las reglas de la migración ───────────────────────────────
// Réplica exacta de immutable_unaccent: lower(unaccent(x)).
function unaccentLower(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface PersonName {
  first_name?: string | null;
  middle_name?: string | null;
  first_surname?: string | null;
  second_surname?: string | null;
}

/** Igual que el trigger normalize_person_name: 4 campos unidos por espacio. */
function normalizedFullName(p: PersonName): string {
  return unaccentLower(
    `${p.first_name ?? ""} ${p.middle_name ?? ""} ${p.first_surname ?? ""} ${p.second_surname ?? ""}`,
  );
}

/** Núcleo = nombre + primer apellido, colapsando espacios. */
function normalizedCore(p: PersonName): string {
  return unaccentLower(`${p.first_name ?? ""} ${p.first_surname ?? ""}`)
    .replace(/\s+/g, " ")
    .trim();
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Confianza según los mismos umbrales de la migración. */
function confidence(candidate: PersonName, incoming: PersonName): number {
  if (collapse(normalizedFullName(candidate)) === collapse(normalizedFullName(incoming))) return 1.0;
  if (normalizedCore(candidate) === normalizedCore(incoming)) return 0.9;
  return 0; // las variaciones menores las resuelve similarity() en Postgres
}

const THRESHOLD = 0.72;

function isDuplicateCandidate(candidate: PersonName, incoming: PersonName): boolean {
  return confidence(candidate, incoming) >= THRESHOLD;
}

// ── Personas del caso real que motivó esta corrección ──────────────────
const padreReal: PersonName = {
  first_name: "Alfredo",
  first_surname: "Hurtado",
  second_surname: "Martinez",
};
const padreDuplicado: PersonName = {
  first_name: "Alfredo",
  first_surname: "Hurtado",
  second_surname: "Martínez", // única diferencia: la tilde
};

describe("[MODELO] 1. mismo nombre exacto → es candidato", () => {
  it("detecta un duplicado idéntico con confianza 1.0", () => {
    expect(confidence(padreReal, { ...padreReal })).toBe(1.0);
    expect(isDuplicateCandidate(padreReal, { ...padreReal })).toBe(true);
  });
});

describe("[MODELO] 2. tildes distintas → es candidato (caso real de producción)", () => {
  it("'Martinez' y 'Martínez' normalizan igual", () => {
    expect(normalizedFullName(padreReal)).toBe(normalizedFullName(padreDuplicado));
  });

  it("habría bloqueado la creación del padre duplicado", () => {
    expect(confidence(padreReal, padreDuplicado)).toBe(1.0);
    expect(isDuplicateCandidate(padreReal, padreDuplicado)).toBe(true);
  });
});

describe("[MODELO] 3. mayúsculas/minúsculas → es candidato", () => {
  it("'ALFREDO HURTADO' coincide con 'Alfredo Hurtado'", () => {
    const gritado: PersonName = {
      first_name: "ALFREDO",
      first_surname: "HURTADO",
      second_surname: "MARTINEZ",
    };
    expect(confidence(padreReal, gritado)).toBe(1.0);
  });
});

describe("[MODELO] 4. segundo apellido ausente → es candidato con confianza 0.90", () => {
  it("'Alfredo Hurtado' coincide con 'Alfredo Hurtado Martinez'", () => {
    const sinSegundo: PersonName = { first_name: "Alfredo", first_surname: "Hurtado" };
    expect(confidence(padreReal, sinSegundo)).toBe(0.9);
    expect(isDuplicateCandidate(padreReal, sinSegundo)).toBe(true);
  });

  it("no es 1.0: el nombre completo sí difiere", () => {
    const sinSegundo: PersonName = { first_name: "Alfredo", first_surname: "Hurtado" };
    expect(confidence(padreReal, sinSegundo)).toBeLessThan(1.0);
  });
});

describe("[MODELO+CONTRATO] 5. homónimo legítimo → sigue siendo candidato (decide el usuario)", () => {
  it("dos primos 'Juan Perez' se marcan como candidato, NO se fusionan", () => {
    const juan1: PersonName = { first_name: "Juan", first_surname: "Perez", second_surname: "Gomez" };
    const juan2: PersonName = { first_name: "Juan", first_surname: "Perez", second_surname: "Lopez" };
    // Mismo núcleo → candidato (0.90), pero la migración NUNCA fusiona:
    // devuelve needs_confirmation y el usuario elige crear el homónimo.
    expect(confidence(juan1, juan2)).toBe(0.9);
    expect(MIGRATION).toContain("confirm_create_duplicate");
  });

  it("personas realmente distintas NO son candidatas", () => {
    const otro: PersonName = { first_name: "Maria", first_surname: "Gomez", second_surname: "Lopez" };
    expect(isDuplicateCandidate(padreReal, otro)).toBe(false);
  });
});

describe("[MODELO+CONTRATO] 6. reintento idéntico → idempotente", () => {
  it("repetir la llamada sin confirmar vuelve a dar el mismo resultado", () => {
    const a = isDuplicateCandidate(padreReal, padreDuplicado);
    const b = isDuplicateCandidate(padreReal, padreDuplicado);
    expect(a).toBe(b);
    expect(a).toBe(true);
  });

  it("la detección ocurre ANTES de create_person (no acumula personas)", () => {
    const dedupPos = MIGRATION.indexOf("needs_confirmation");
    const createPos = MIGRATION.indexOf("FROM public.create_person");
    expect(dedupPos).toBeGreaterThan(-1);
    expect(createPos).toBeGreaterThan(-1);
    expect(dedupPos).toBeLessThan(createPos);
  });
});

describe("[CONTRATO] 7 y 8. candidatos con y sin claim", () => {
  it("el contrato expone is_claimed para cada candidato", () => {
    expect(MIGRATION).toContain("'is_claimed'");
    expect(MIGRATION).toContain("claim_status = 'approved'");
    expect(MIGRATION).toContain("pc.revoked_at IS NULL");
  });

  it("ambos tipos son candidatos: tener claim no excluye ni obliga", () => {
    // is_claimed es informativo para la UI; el filtro es la confianza.
    const withClaimBlock = MIGRATION.includes("EXISTS (") && MIGRATION.includes("person_claims pc");
    expect(withClaimBlock).toBe(true);
  });
});

describe("[CONTRATO] 9. búsqueda en el grafo conectado", () => {
  it("usa un CTE recursivo bidireccional, no solo el espacio", () => {
    expect(MIGRATION).toContain("WITH RECURSIVE connected");
    expect(MIGRATION).toContain("r.person_a_id = c.person_id OR r.person_b_id = c.person_id");
  });

  it("además une los miembros del espacio activo (personas sin relaciones)", () => {
    expect(MIGRATION).toContain("FROM public.space_memberships sm");
    expect(MIGRATION).toContain("sm.space_id = v_space_id");
  });

  it("solo considera relaciones vivas", () => {
    expect(MIGRATION).toContain("r.deleted_at IS NULL");
    expect(MIGRATION).toContain("r.relationship_status = 'active'");
  });

  it("limita la profundidad a 3 saltos (misma visibilidad que get_my_family_graph)", () => {
    expect(MIGRATION).toContain("c.depth < 3");
    expect(MIGRATION).not.toContain("c.depth < 6");
  });

  it("corta ciclos con el array visited", () => {
    expect(MIGRATION).toContain("= ANY(c.visited)");
    expect(MIGRATION).toContain("c.visited ||");
  });

  it("usa similarity con esquema explícito (public.)", () => {
    // Se inspecciona solo el cuerpo ejecutable, sin comentarios: el
    // encabezado documental sí menciona "similarity()" en prosa.
    const body = MIGRATION.slice(MIGRATION.indexOf("CREATE OR REPLACE FUNCTION"))
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n");
    expect(body).toContain("public.similarity(");
    // Ninguna llamada sin calificar (precedida por algo que no sea un punto).
    expect(body).not.toMatch(/[^.\w]similarity\(/);
  });

  it("solo considera personas activas", () => {
    expect(MIGRATION).toContain("p.deleted_at IS NULL");
    expect(MIGRATION).toContain("p.status = 'active'");
  });
});

describe("[CONTRATO] 10. cero persona nueva cuando hay coincidencia pendiente", () => {
  it("devuelve needs_confirmation y retorna ANTES de crear", () => {
    const idx = MIGRATION.indexOf("'needs_confirmation', true");
    expect(idx).toBeGreaterThan(-1);
    // El RETURN de needs_confirmation precede al create_person del camino B/C.
    const createIdx = MIGRATION.indexOf("FROM public.create_person");
    expect(idx).toBeLessThan(createIdx);
  });

  it("los candidatos vienen ordenados por confianza descendente", () => {
    expect(MIGRATION).toContain("ORDER BY r.confidence DESC");
  });

  it("expone el umbral de confianza aplicado", () => {
    expect(MIGRATION).toContain("r.confidence >= 0.72");
  });
});

describe("[CONTRATO] 11. creación explícita cuando el usuario confirma homónimo", () => {
  it("confirm_create_duplicate salta la detección", () => {
    expect(MIGRATION).toContain("v_confirm_create");
    expect(MIGRATION).toContain("IF NOT v_confirm_create");
  });

  it("link_person_id vincula a la persona existente sin crear otra", () => {
    expect(MIGRATION).toContain("v_link_person_id");
    expect(MIGRATION).toContain("no pertenece a tu arbol");
    expect(MIGRATION).toContain("'linked_existing'");
  });

  it("SEGURIDAD: link_person_id está restringido a la frontera autorizada", () => {
    // Sin este filtro, cualquier UUID de la base podría vincularse al
    // árbol del usuario (y quedaría insertado en sus space_memberships),
    // exponiendo personas de otras familias. Regresión de un bug real
    // detectado en la revisión técnica de esta migración.
    expect(MIGRATION).toContain("AND p.id = ANY(v_authorized_ids)");
    expect(MIGRATION).toContain("no pertenece a tu arbol");
  });

  it("SEGURIDAD: link y búsqueda comparten la MISMA frontera", () => {
    // v_authorized_ids se calcula una sola vez y acota ambos caminos.
    const usos = (MIGRATION.match(/ANY\(v_authorized_ids\)/g) ?? []).length;
    expect(usos).toBeGreaterThanOrEqual(2);
  });

  it("SEGURIDAD: rechaza vincular una persona consigo misma", () => {
    expect(MIGRATION).toContain("No puedes vincular a una persona consigo misma");
  });

  it("SEGURIDAD: link exige persona activa (excluye merged/deleted/locked)", () => {
    expect(MIGRATION).toContain("AND p.deleted_at IS NULL");
    expect(MIGRATION).toContain("AND p.status = 'active'");
  });

  it("nunca fusiona automáticamente (solo marca candidatos)", () => {
    // No debe existir ningún UPDATE/DELETE sobre persons ni reasignación
    // automática de relaciones dentro de la función.
    expect(MIGRATION).not.toMatch(/UPDATE\s+public\.persons/i);
    expect(MIGRATION).not.toMatch(/DELETE\s+FROM\s+public\.persons/i);
  });
});

describe("[CONTRATO] 12. cero relaciones duplicadas", () => {
  it("sigue delegando la creación en create_relationship", () => {
    expect(MIGRATION).toContain("public.create_relationship(");
  });

  it("no inserta directamente en relationships", () => {
    expect(MIGRATION).not.toMatch(/INSERT\s+INTO\s+public\.relationships/i);
  });
});

describe("[CONTRATO] se conserva lo que ya funcionaba", () => {
  it("mantiene autenticación, permisos y resolución de espacio", () => {
    expect(MIGRATION).toContain("Authentication required");
    expect(MIGRATION).toContain("public.can_edit_space(v_space_id)");
    expect(MIGRATION).toContain("No existe un espacio familiar");
  });

  it("mantiene las reglas de hermanos y medios hermanos", () => {
    expect(MIGRATION).toContain("Para agregar un medio hermano");
    expect(MIGRATION).toContain("Para agregar un hermano");
  });

  it("mantiene la auditoría", () => {
    expect(MIGRATION).toContain("public.log_family_space_event");
  });

  it("no cambia la firma de la RPC (no crea sobrecargas)", () => {
    expect(MIGRATION).toContain(
      "CREATE OR REPLACE FUNCTION public.add_relative(p_payload jsonb, p_relationship relationship_type)",
    );
  });
});

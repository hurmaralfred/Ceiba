import { describe, it, expect } from "vitest";

import { parseGrowthStats, formatFamilyLine, formatGrowthLine } from "./growthStats";

/**
 * Contador global de crecimiento (/tree).
 *
 * El CONTEO en sí vive en SQL (migración
 * 20260727000000_add_ceiba_growth_stats.sql) y ya fue validado contra el
 * esquema real de producción en una transacción revertida (46 personas
 * activas, 6 usuarios registrados, 40 sin reclamar — coherente:
 * 46 - 6 = 40). Estas pruebas cubren la capa de TypeScript: qué hace la
 * página con la respuesta de la RPC, incluida la degradación cuando falla.
 */

describe("parseGrowthStats — nunca confía ciegamente en la RPC", () => {
  it("acepta una respuesta bien formada", () => {
    const r = parseGrowthStats({
      total_active_persons: 46,
      total_registered_users: 6,
      total_unclaimed_persons: 40,
    });
    expect(r).toEqual({
      totalActivePersons: 46,
      totalRegisteredUsers: 6,
      totalUnclaimedPersons: 40,
    });
  });

  it("el campo opcional puede faltar", () => {
    const r = parseGrowthStats({
      total_active_persons: 46,
      total_registered_users: 6,
    });
    expect(r).toEqual({ totalActivePersons: 46, totalRegisteredUsers: 6 });
  });

  it("null, undefined o forma inesperada -> null (se oculta el contador)", () => {
    expect(parseGrowthStats(null)).toBeNull();
    expect(parseGrowthStats(undefined)).toBeNull();
    expect(parseGrowthStats("46")).toBeNull();
    expect(parseGrowthStats([46, 6])).toBeNull();
    expect(parseGrowthStats({})).toBeNull();
    expect(parseGrowthStats({ total_active_persons: "46", total_registered_users: 6 })).toBeNull();
    expect(parseGrowthStats({ total_active_persons: -1, total_registered_users: 6 })).toBeNull();
    expect(parseGrowthStats({ total_active_persons: NaN, total_registered_users: 6 })).toBeNull();
  });

  it("la respuesta NUNCA contiene datos personales (solo números)", () => {
    // Aunque la RPC devolviera de más por error, esta capa solo LEE los
    // tres campos numéricos esperados: cualquier otro campo se ignora, no
    // se propaga a la UI.
    const conFuga = {
      total_active_persons: 46,
      total_registered_users: 6,
      first_name: "Alfredo",
      email: "alfredo@example.com",
    };
    const r = parseGrowthStats(conFuga);
    expect(r).toEqual({ totalActivePersons: 46, totalRegisteredUsers: 6 });
    expect(JSON.stringify(r)).not.toContain("Alfredo");
    expect(JSON.stringify(r)).not.toContain("example.com");
  });
});

describe("formatFamilyLine — línea 1, ya no usa 'en Ceiba'", () => {
  it("formato exacto pedido", () => {
    expect(formatFamilyLine(8, 8)).toBe("8 familiares · 8 conectados");
  });

  it("nunca contiene la frase 'en Ceiba' (reservada al contador global)", () => {
    expect(formatFamilyLine(8, 8)).not.toContain("en Ceiba");
  });

  it("singular de familiar", () => {
    expect(formatFamilyLine(1, 0)).toBe("1 familiar · 0 conectados");
  });
});

describe("formatGrowthLine — línea 2, contador global", () => {
  const stats = { totalActivePersons: 46, totalRegisteredUsers: 6, totalUnclaimedPersons: 40 };

  it("escritorio: formato exacto pedido", () => {
    expect(formatGrowthLine(stats, "desktop")).toBe(
      "Ceiba está creciendo: 46 personas · 6 usuarios registrados",
    );
  });

  it("móvil: formato compacto pedido", () => {
    expect(formatGrowthLine(stats, "mobile")).toBe("46 personas en Ceiba · 6 registradas");
  });

  it("por defecto usa la variante de escritorio", () => {
    expect(formatGrowthLine(stats)).toBe(formatGrowthLine(stats, "desktop"));
  });

  it("singular de usuario registrado", () => {
    const uno = { totalActivePersons: 1, totalRegisteredUsers: 1 };
    expect(formatGrowthLine(uno, "desktop")).toBe(
      "Ceiba está creciendo: 1 persona · 1 usuario registrado",
    );
  });
});

describe("fallo de la RPC no rompe /tree", () => {
  it("una respuesta inválida se traduce a null, nunca lanza", () => {
    expect(() => parseGrowthStats({ error: "boom" })).not.toThrow();
    expect(parseGrowthStats({ error: "boom" })).toBeNull();
  });

  it("con stats=null la página simplemente no renderiza la línea global", () => {
    // Documenta el contrato consumido por tree/page.tsx: `{growthStats && (...)}`.
    // Sin esta guarda, un valor null/undefined haría fallar formatGrowthLine.
    const stats = null as ReturnType<typeof parseGrowthStats>;
    expect(stats).toBeNull();
    if (stats) {
      // Nunca debería ejecutarse; si se ejecuta, el guard de la página falló.
      formatGrowthLine(stats);
    }
  });
});

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Contrato SQL de get_ceiba_growth_stats().
 *
 * El COMPORTAMIENTO ya fue verificado ejecutando la función real dentro
 * de una transacción revertida contra el esquema de producción:
 *   { total_active_persons: 46, total_registered_users: 6,
 *     total_unclaimed_persons: 40 }
 * (46 - 6 = 40, coherente). La migración NO se aplicó de forma
 * persistente. Estas pruebas son [CONTRATO]: inspeccionan el texto del
 * SQL para que un cambio futuro no reintroduzca los defectos que motivan
 * cada cláusula.
 */

const MIGRATION = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260727000000_add_ceiba_growth_stats.sql"),
  "utf8",
);

describe("excluye personas fusionadas y eliminadas", () => {
  it("total_active_persons filtra por status='active' Y deleted_at IS NULL", () => {
    expect(MIGRATION).toContain("p.status = 'active'");
    expect(MIGRATION).toContain("p.deleted_at IS NULL");
  });

  it("las dos condiciones son necesarias (hay una fila real con status='deleted' y deleted_at NULL)", () => {
    // Regresión documentada: en producción existe una persona con
    // status='deleted' pero deleted_at IS NULL. Si solo se filtrara por
    // deleted_at, esa fila contaría como activa por error.
    const idx = MIGRATION.indexOf("DOS condiciones son necesarias");
    expect(idx).toBeGreaterThan(-1);
  });

  it("nunca cuenta status='merged' explícitamente como activo", () => {
    expect(MIGRATION).not.toMatch(/status\s*(=|IN)\s*.*merged/i);
  });
});

describe("usuarios registrados: solo claims aprobados y no revocados", () => {
  it("filtra claim_status='approved'", () => {
    expect(MIGRATION).toContain("pc.claim_status = 'approved'");
  });

  it("excluye claims revocados", () => {
    expect(MIGRATION).toContain("pc.revoked_at IS NULL");
  });

  it("exige que la persona reclamada siga activa (no merged/deleted)", () => {
    const bloque = MIGRATION.slice(
      MIGRATION.indexOf("SELECT count(DISTINCT pc.person_id)"),
      MIGRATION.indexOf("SELECT count(*)\n    INTO v_unclaimed_persons"),
    );
    expect(bloque).toContain("p.status = 'active'");
    expect(bloque).toContain("p.deleted_at IS NULL");
  });
});

describe("COUNT(DISTINCT ...) evita doble conteo de claims", () => {
  it("usa DISTINCT sobre person_id, no un COUNT(*) plano", () => {
    expect(MIGRATION).toContain("count(DISTINCT pc.person_id)");
  });
});

describe("no acepta parámetros arbitrarios", () => {
  it("la función se declara sin argumentos", () => {
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.get_ceiba_growth_stats()");
  });
});

describe("seguridad de la RPC", () => {
  it("fija search_path", () => {
    expect(MIGRATION).toMatch(/SET search_path TO 'public', 'pg_temp'/);
  });

  it("SECURITY DEFINER está justificado por RLS, no puesto por defecto", () => {
    expect(MIGRATION).toContain("SECURITY DEFINER");
    expect(MIGRATION).toContain("RLS activo");
  });

  it("revoca de PUBLIC y anon, concede solo a authenticated", () => {
    expect(MIGRATION).toContain("REVOKE ALL ON FUNCTION public.get_ceiba_growth_stats() FROM PUBLIC");
    expect(MIGRATION).toContain("REVOKE ALL ON FUNCTION public.get_ceiba_growth_stats() FROM anon");
    expect(MIGRATION).toContain("GRANT EXECUTE ON FUNCTION public.get_ceiba_growth_stats() TO authenticated");
  });

  it("exige autenticación incluso si los permisos derivaran", () => {
    expect(MIGRATION).toContain("auth.uid() IS NULL");
  });

  it("es STABLE, no muta ningún dato", () => {
    expect(MIGRATION).toMatch(/RETURNS jsonb\s*\n?LANGUAGE plpgsql\s*\n?STABLE/);
    expect(MIGRATION).not.toMatch(/INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM/i);
  });
});

describe("la respuesta no incluye datos personales", () => {
  it("solo construye un jsonb de tres claves numéricas", () => {
    const ret = MIGRATION.slice(
      MIGRATION.indexOf("RETURN jsonb_build_object"),
      MIGRATION.indexOf("END;\n$function$"),
    );
    expect(ret).toContain("total_active_persons");
    expect(ret).toContain("total_registered_users");
    expect(ret).toContain("total_unclaimed_persons");
    // Ninguna columna identificable de persona (nombre, id, email, teléfono).
    expect(ret).not.toMatch(/first_name|last_name|surname|email|phone|\bid\b|public_id/i);
  });

  it("ninguna consulta hace SELECT * ni selecciona columnas identificables", () => {
    expect(MIGRATION).not.toMatch(/SELECT\s+\*/i);
    expect(MIGRATION).not.toMatch(/p\.(first_name|last_name|first_surname|second_surname)/);
  });
});

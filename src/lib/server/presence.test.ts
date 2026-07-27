import { describe, it, expect, vi } from "vitest";
import { resolveApprovedPersonId, resolveFamilySpaceMemberIds } from "./presence";

// Fake query builder mínimo: cada método de filtro devuelve `this` y guarda
// las llamadas; el método terminal (maybeSingle) resuelve con la respuesta
// programada para esa tabla. Suficiente para verificar QUÉ se filtró, sin
// depender de un cliente Supabase real.
function makeFakeSupabase(responses: Record<string, any>) {
  const calls: { table: string; method: string; args: any[] }[] = [];

  function builder(table: string) {
    const chain: any = {
      _filters: {} as Record<string, any>,
      select(...args: any[]) { calls.push({ table, method: "select", args }); return chain; },
      eq(col: string, val: any) { calls.push({ table, method: "eq", args: [col, val] }); chain._filters[col] = val; return chain; },
      neq(col: string, val: any) { calls.push({ table, method: "neq", args: [col, val] }); chain._filters[`neq_${col}`] = val; return chain; },
      in(col: string, vals: any[]) { calls.push({ table, method: "in", args: [col, vals] }); chain._filters[`in_${col}`] = vals; return chain; },
      is(col: string, val: any) { calls.push({ table, method: "is", args: [col, val] }); chain._filters[col] = val; return chain; },
      maybeSingle() {
        return Promise.resolve(responses[table]?.maybeSingle ?? { data: null, error: null });
      },
      then(resolve: any) {
        // permite `await service.from(...).select(...)` sin maybeSingle()
        return Promise.resolve(responses[table]?.list ?? { data: [], error: null }).then(resolve);
      },
    };
    return chain;
  }

  return { from: (t: string) => builder(t), _calls: calls };
}

describe("resolveApprovedPersonId — límites de autorización", () => {
  it("nunca acepta un person_id del cliente: siempre filtra por user_id, claim_status=approved, revoked_at=null", async () => {
    const service = makeFakeSupabase({
      person_claims: { maybeSingle: { data: { person_id: "person-1" }, error: null } },
    });

    const result = await resolveApprovedPersonId(service as any, "user-abc");

    expect(result).toBe("person-1");
    const filters = (service.from("person_claims") as any)._filters;
    // Verifica que la resolución use exactamente user_id + claim_status + revoked_at,
    // nunca un person_id arbitrario ni linked_user_id.
    const calls = service._calls.filter((c) => c.table === "person_claims");
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "user_id" && c.args[1] === "user-abc")).toBe(true);
    expect(calls.some((c) => c.method === "eq" && c.args[0] === "claim_status" && c.args[1] === "approved")).toBe(true);
    expect(calls.some((c) => c.method === "is" && c.args[0] === "revoked_at" && c.args[1] === null)).toBe(true);
    expect(calls.some((c) => c.args[0] === "linked_user_id")).toBe(false);
  });

  it("devuelve null si no hay claim aprobado (sin lanzar ni inventar un person_id)", async () => {
    const service = makeFakeSupabase({
      person_claims: { maybeSingle: { data: null, error: null } },
    });
    const result = await resolveApprovedPersonId(service as any, "user-sin-claim");
    expect(result).toBeNull();
  });

  it("devuelve null (no un person_id) si la consulta falla, en vez de propagar un error crudo", async () => {
    const service = makeFakeSupabase({
      person_claims: { maybeSingle: { data: null, error: { message: "boom" } } },
    });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await resolveApprovedPersonId(service as any, "user-x");
    expect(result).toBeNull();
    errSpy.mockRestore();
  });
});

describe("resolveFamilySpaceMemberIds — límite de family_space", () => {
  it("nunca incluye a la propia persona en el resultado", async () => {
    const service = makeFakeSupabase({
      space_memberships: {
        list: { data: [{ space_id: "space-1" }], error: null },
      },
    });
    // Segunda llamada a space_memberships (miembros del espacio) — mismo mock table,
    // así que forzamos la respuesta vía una segunda instancia con datos distintos.
    let call = 0;
    const service2 = {
      from: (table: string) => {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: (col: string, vals: string[]) => { chain._in = vals; return chain; },
          neq: (col: string, val: string) => { chain._neq = val; return chain; },
          then: (resolve: any) => {
            call++;
            if (table === "space_memberships" && call === 1) {
              return Promise.resolve({ data: [{ space_id: "space-1" }], error: null }).then(resolve);
            }
            return Promise.resolve({
              data: [{ person_id: "person-2" }, { person_id: "person-3" }, { person_id: "person-1" }],
              error: null,
            }).then(resolve);
          },
        };
        return chain;
      },
    };

    const result = await resolveFamilySpaceMemberIds(service2 as any, "person-1");
    expect(result).not.toContain("person-1");
    expect(result.sort()).toEqual(["person-2", "person-3"]);
  });

  it("devuelve [] si la persona no pertenece a ningún family_space (no filtra por todos los espacios)", async () => {
    const service = makeFakeSupabase({
      space_memberships: { list: { data: [], error: null } },
    });
    const result = await resolveFamilySpaceMemberIds(service as any, "person-aislada");
    expect(result).toEqual([]);
  });
});

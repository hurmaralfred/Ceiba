import { describe, it, expect, vi } from "vitest";
import { resolvePersonsByUserIds } from "./family";

/**
 * Mock de un cliente Supabase con builder encadenable. Cada tabla devuelve
 * una respuesta programada en su método terminal. Verifica QUÉ se consulta
 * sin depender de un cliente real.
 */
function makeFakeSupabase(responses: Record<string, { data: any; error: any }>) {
  const calls: { table: string; method: string; args: any[] }[] = [];
  function builder(table: string) {
    const chain: any = {
      select(...a: any[]) { calls.push({ table, method: "select", args: a }); return chain; },
      eq(...a: any[]) { calls.push({ table, method: "eq", args: a }); return chain; },
      in(...a: any[]) { calls.push({ table, method: "in", args: a }); return chain; },
      is(...a: any[]) { calls.push({ table, method: "is", args: a }); return chain; },
      neq(...a: any[]) { calls.push({ table, method: "neq", args: a }); return chain; },
      maybeSingle() { return Promise.resolve(responses[table] ?? { data: null, error: null }); },
      then(resolve: any) { return Promise.resolve(responses[table] ?? { data: [], error: null }).then(resolve); },
    };
    return chain;
  }
  return { from: (t: string) => builder(t), _calls: calls };
}

describe("resolvePersonsByUserIds — identidad canónica", () => {
  it("resuelve nombre/foto únicamente vía person_claims aprobado + persons", async () => {
    const service = makeFakeSupabase({
      person_claims: { data: [{ user_id: "u1", person_id: "p1" }, { user_id: "u2", person_id: "p2" }], error: null },
      persons: {
        data: [
          { id: "p1", first_name: "Ana", first_surname: "Gómez", photo_path: "ana.jpg" },
          { id: "p2", first_name: "Beto", first_surname: "Ruiz", photo_path: null },
        ],
        error: null,
      },
    });

    const map = await resolvePersonsByUserIds(service as any, ["u1", "u2"]);

    expect(map.get("u1")).toEqual({ person_id: "p1", user_id: "u1", first_name: "Ana", last_name: "Gómez", photo_path: "ana.jpg" });
    expect(map.get("u2")?.first_name).toBe("Beto");
    expect(map.get("u2")?.photo_path).toBeNull();

    // Nunca consulta profiles legado ni columnas legadas.
    const claimCalls = service._calls.filter((c) => c.table === "person_claims");
    expect(claimCalls.some((c) => c.method === "eq" && c.args[0] === "claim_status" && c.args[1] === "approved")).toBe(true);
    expect(claimCalls.some((c) => c.method === "is" && c.args[0] === "revoked_at")).toBe(true);
    expect(service._calls.some((c) => c.table === "profiles")).toBe(false);
    const personSelect = service._calls.find((c) => c.table === "persons" && c.method === "select");
    expect(personSelect?.args[0]).toContain("first_name");
    expect(personSelect?.args[0]).not.toContain("first_names");
  });

  it("un usuario sin claim aprobado no aparece en el mapa (no inventa identidad)", async () => {
    const service = makeFakeSupabase({
      person_claims: { data: [{ user_id: "u1", person_id: "p1" }], error: null },
      persons: { data: [{ id: "p1", first_name: "Ana", first_surname: "Gómez", photo_path: null }], error: null },
    });
    const map = await resolvePersonsByUserIds(service as any, ["u1", "u-sin-claim"]);
    expect(map.has("u1")).toBe(true);
    expect(map.has("u-sin-claim")).toBe(false);
  });

  it("con lista vacía no consulta nada y devuelve mapa vacío", async () => {
    const service = makeFakeSupabase({});
    const map = await resolvePersonsByUserIds(service as any, []);
    expect(map.size).toBe(0);
    expect(service._calls.length).toBe(0);
  });
});

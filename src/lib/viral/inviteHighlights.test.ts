import { describe, it, expect } from "vitest";
import { buildHighlights, type InvitationHook } from "./inviteHighlights";

const base: InvitationHook = {
  family_count: 1,
  joined_count: 1,
  memories_about_person: 0,
  photos_of_person: 0,
  next_birthday: null,
};

describe("buildHighlights", () => {
  it("devuelve vacío sin hook o sin contenido (se usa la lista genérica)", () => {
    expect(buildHighlights(undefined)).toEqual([]);
    expect(buildHighlights(base)).toEqual([]);
  });

  it("prioriza lo personal: recuerdos, fotos, cumpleaños, tamaño de la familia", () => {
    const out = buildHighlights({
      family_count: 55,
      joined_count: 10,
      memories_about_person: 2,
      photos_of_person: 3,
      next_birthday: { first_name: "Cindy", days_until: 18 },
    });
    expect(out).toEqual([
      "Tu familia ya escribió 2 recuerdos sobre ti",
      "Hay 3 fotos en las que apareces",
      "El cumpleaños de Cindy es en 18 días",
    ]);
  });

  it("singular y casos de cumpleaños hoy/mañana", () => {
    expect(buildHighlights({ ...base, memories_about_person: 1 })).toEqual([
      "Tu familia ya escribió 1 recuerdo sobre ti",
    ]);
    expect(buildHighlights({ ...base, photos_of_person: 1 })).toEqual([
      "Hay 1 foto en las que apareces",
    ]);
    expect(buildHighlights({ ...base, next_birthday: { first_name: "Ana", days_until: 0 } })).toEqual([
      "El cumpleaños de Ana es hoy",
    ]);
    expect(buildHighlights({ ...base, next_birthday: { first_name: "Ana", days_until: 1 } })).toEqual([
      "El cumpleaños de Ana es mañana",
    ]);
  });

  it("describe el tamaño de la familia según cuántos ya están dentro", () => {
    expect(buildHighlights({ ...base, family_count: 12, joined_count: 5 })).toEqual([
      "12 familiares en la galaxia, 5 ya dentro",
    ]);
    expect(buildHighlights({ ...base, family_count: 12, joined_count: 1 })).toEqual([
      "12 familiares te esperan en la galaxia",
    ]);
  });
});

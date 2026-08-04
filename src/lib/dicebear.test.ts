import { describe, it, expect } from "vitest";
import { getDiceBearUrl, getDiceBearPngUrl } from "./dicebear";

describe("getDiceBearUrl", () => {
  it("returns an SVG adventurer URL with the given seed", () => {
    const url = getDiceBearUrl("abc-123");
    expect(url).toContain("adventurer/svg");
    expect(url).toContain("seed=abc-123");
  });

  it("encodes special characters in the seed", () => {
    const url = getDiceBearUrl("José García");
    expect(url).toContain("seed=Jos%C3%A9%20Garc%C3%ADa");
  });

  it("is deterministic for the same seed", () => {
    expect(getDiceBearUrl("same")).toBe(getDiceBearUrl("same"));
  });

  it("produces different URLs for different seeds", () => {
    expect(getDiceBearUrl("alice")).not.toBe(getDiceBearUrl("bob"));
  });
});

describe("getDiceBearPngUrl", () => {
  it("returns a PNG URL", () => {
    const url = getDiceBearPngUrl("test");
    expect(url).toContain("adventurer/png");
    expect(url).toContain("seed=test");
  });

  it("includes size param for galaxy SVG compatibility", () => {
    const url = getDiceBearPngUrl("test");
    expect(url).toContain("size=128");
  });
});

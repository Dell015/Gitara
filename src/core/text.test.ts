import { describe, expect, it } from "vitest";
import { looseKey, normalize } from "./text";
import { TapTempo } from "./tempo";

describe("normalize", () => {
  it("matches the database rule", () => {
    expect(normalize("  MIDNIGHT   ember ")).toBe("midnight ember");
  });
  it("loose key ignores punctuation and a leading 'the'", () => {
    expect(looseKey("The Scientist!")).toBe(looseKey("scientist"));
  });
});

describe("TapTempo", () => {
  it("averages taps", () => {
    const t = new TapTempo();
    expect(t.tap(0)).toBeNull();
    expect(t.tap(500)).toBe(120);
    expect(t.tap(1000)).toBe(120);
  });
  it("starts over after a pause", () => {
    const t = new TapTempo();
    t.tap(0);
    t.tap(1000);
    expect(t.tap(5000)).toBeNull();
    expect(t.tap(5500)).toBe(120);
  });
});

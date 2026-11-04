import { describe, expect, it } from "vitest";
import { detectPitch, nearest, nearestString } from "./pitch";

const SR = 44100;
function tone(freq: number, n = 4096, harmonics = true) {
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    b[i] = 0.5 * Math.sin(2 * Math.PI * freq * t) + (harmonics ? 0.3 * Math.sin(2 * Math.PI * 2 * freq * t) + 0.15 * Math.sin(2 * Math.PI * 3 * freq * t) : 0);
  }
  return b;
}

describe("tuner pitch detection", () => {
  it("hears every open string of a guitar within 2 cents", () => {
    for (const midi of [40, 45, 50, 55, 59, 64]) {
      const f = 440 * Math.pow(2, (midi - 69) / 12);
      const got = detectPitch(tone(f), SR)!;
      expect(Math.abs(1200 * Math.log2(got / f))).toBeLessThan(2);
    }
  });
  it("stays quiet on silence", () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull();
  });
  it("names the note and the string", () => {
    expect(nearest(442)).toEqual({ midi: 69, cents: 8 });
    expect(nearestString(110, [40, 45, 50, 55, 59, 64]).string).toBe(1);
  });
});

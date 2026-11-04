import { describe, expect, it } from "vitest";
import { bestChords, ChordTracker, chromaFromDb } from "./chordlisten";
import { fftMagnitudes, toDb } from "./fft";

const SR = 44100;
const N = 16384;
const STD = [40, 45, 50, 55, 59, 64];
const frets = (s: string) => s.split("").map((c) => (c === "x" ? -1 : Number(c)));

/** A guitar-ish chord: every fretted/open string as a note with decaying harmonics. */
function chordSignal(shape: string, noise = 0, detuneCents = 0): Float32Array {
  const buf = new Float32Array(N);
  frets(shape).forEach((f, s) => {
    if (f < 0) return;
    const midi = STD[s]! + f;
    const hz = 440 * Math.pow(2, (midi - 69) / 12 + detuneCents / 1200);
    for (let h = 1; h <= 6; h++) {
      const amp = 1 / h;
      for (let i = 0; i < N; i++) buf[i]! += amp * Math.sin((2 * Math.PI * hz * h * i) / SR);
    }
  });
  let peak = 0;
  for (const v of buf) peak = Math.max(peak, Math.abs(v));
  let seed = 7;
  for (let i = 0; i < N; i++) {
    seed = (seed * 16807) % 2147483647;
    buf[i] = buf[i]! / peak + noise * ((seed / 2147483647) * 2 - 1);
  }
  return buf;
}
const read = (shape: string, noise = 0, detune = 0) => chromaFromDb(toDb(fftMagnitudes(chordSignal(shape, noise, detune))), SR);
const top = (shape: string, noise = 0, detune = 0) => {
  const r = read(shape, noise, detune);
  return bestChords(r.chroma, r.bass)[0]!.name;
};

describe("chord listener", () => {
  const cases: [string, string][] = [
    ["x32010", "C"],
    ["022100", "E"],
    ["xx0232", "D"],
    ["320003", "G"],
    ["x02220", "A"],
    ["x02210", "Am"],
    ["022000", "Em"],
    ["xx0231", "Dm"],
    ["x32310", "C7"],
    ["320001", "G7"],
    ["x02020", "A7"],
    ["xx0222", "Dmaj7"],
    ["x02200", "Asus2"],
    ["xx0233", "Dsus4"],
    ["133211", "F"],
    ["x24442", "B"],
  ];
  for (const [shape, name] of cases) {
    it(`hears ${name}`, () => expect(top(shape)).toBe(name));
  }

  it("copes with a little noise and a slightly flat guitar", () => {
    expect(top("x32010", 0.05, -20)).toBe("C");
    expect(top("022000", 0.05, 25)).toBe("Em");
  });

  it("hears silence as nothing", () => {
    const r = chromaFromDb(new Float32Array(8192).fill(-140), SR);
    expect(r.energy).toBe(0);
    expect(bestChords(r.chroma, r.bass)).toEqual([]);
  });

  it("holds a chord steady, switches after a few readings, and clears on silence", () => {
    const t = new ChordTracker();
    const c = read("x32010");
    const g = read("320003");
    let heard = null as ReturnType<ChordTracker["update"]>;
    for (let i = 0; i < 6; i++) heard = t.update(c, true);
    expect(heard?.name).toBe("C");
    // one stray reading of G does not flip it
    heard = t.update(g, true);
    expect(heard?.name).toBe("C");
    // sustained G does
    for (let i = 0; i < 6; i++) heard = t.update(g, true);
    expect(heard?.name).toBe("G");
    // silence clears it
    for (let i = 0; i < 10; i++) heard = t.update({ chroma: new Array(12).fill(0), bass: new Array(12).fill(0), energy: 0 }, false);
    expect(heard).toBeNull();
  });
});

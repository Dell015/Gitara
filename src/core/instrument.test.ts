import { describe, expect, it } from "vitest";
import { GUITAR, GUITAR_TUNINGS, noteName, pitchAt, pitchClassName } from "./instrument";

describe("instrument basics", () => {
  it("names the standard open strings E A D G B E", () => {
    const names = GUITAR.standardTuning.map((m) => noteName(m));
    expect(names).toEqual(["E2", "A2", "D3", "G3", "B3", "E4"]);
  });

  it("every preset has one pitch per string", () => {
    for (const t of GUITAR_TUNINGS) {
      expect(t.tuning).toHaveLength(GUITAR.strings);
    }
  });

  it("presets sound like their names", () => {
    const names = (id: string) =>
      GUITAR_TUNINGS.find((t) => t.id === id)!.tuning.map((m) => pitchClassName(m)).join(" ");
    expect(names("standard")).toBe("E A D G B E");
    expect(names("drop-d")).toBe("D A D G B E");
    expect(names("open-g")).toBe("D G D G B D");
    expect(names("dadgad")).toBe("D A D G A D");
    expect(names("half-step-down")).toBe("D# G# C# F# A# D#");
  });
});

describe("pitchAt", () => {
  it("fret 12 is an octave above the open string", () => {
    expect(pitchAt(GUITAR.standardTuning, 0, 12)).toBe(GUITAR.standardTuning[0] + 12);
  });

  it("a capo raises every string, and G shapes at capo 2 sound as A", () => {
    // the open D string with capo 2 sounds E
    expect(pitchClassName(pitchAt(GUITAR.standardTuning, 2, 0, 2))).toBe("E");
    // and a G major root (low E string, fret 3) with capo 2 sounds A
    expect(pitchClassName(pitchAt(GUITAR.standardTuning, 0, 3, 2))).toBe("A");
  });

  it("rejects strings that do not exist", () => {
    expect(() => pitchAt(GUITAR.standardTuning, 6, 0)).toThrow(RangeError);
    expect(() => pitchAt(GUITAR.standardTuning, 0, -1)).toThrow(RangeError);
  });

  it("can spell notes with flats", () => {
    expect(pitchClassName(61, "flat")).toBe("Db");
    expect(pitchClassName(61, "sharp")).toBe("C#");
  });
});

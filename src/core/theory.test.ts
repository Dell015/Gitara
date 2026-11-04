import { describe, expect, it } from "vitest";
import { computeDifficulty, contentHash, formatBars, parseBars } from "./chart";
import { GUITAR_TUNINGS } from "./instrument";
import type { VersionContent } from "./model";
import { familyForms, findVoicings, formSuffix, moveShape, SHAPE_FAMILIES } from "./shapes";
import { accidentalForKey, chordTones, identifyChord, normalizeChordName, parseChord, suggestKey, transposeChord, transposeKey } from "./theory";

const STD = [40, 45, 50, 55, 59, 64];
const DROP_D = GUITAR_TUNINGS.find((t) => t.id === "drop-d")!.tuning;
const f = (s: string) => s.split("").map((c) => (c === "x" ? -1 : Number(c)));

describe("chord names", () => {
  it("reads common spellings", () => {
    expect(normalizeChordName("Amin7")).toBe("Am7");
    expect(normalizeChordName("CM7")).toBe("Cmaj7");
    expect(normalizeChordName("Dsus")).toBe("Dsus4");
    expect(normalizeChordName("Bbmaj7")).toBe("Bbmaj7");
    expect(parseChord("C/G")?.bass).toBe(7);
    expect(parseChord("Hello")).toBeNull();
  });
  it("transposes with the right accidentals", () => {
    expect(transposeChord("G", 2, "sharp")).toBe("A");
    expect(transposeChord("C/G", 1, "flat")).toBe("Db/Ab");
    expect(transposeKey("G", 3)).toBe("Bb");
    expect(accidentalForKey("F")).toBe("flat");
    expect(accidentalForKey("Em")).toBe("sharp");
  });
});

describe("naming a shape from its notes (§5.6)", () => {
  it("names the examples in the bible", () => {
    expect(identifyChord(f("x32010"), STD)).toBe("C");
    expect(identifyChord(f("x32033"), STD)).toBe("Cadd9");
    expect(identifyChord(f("332010"), STD)).toBe("C/G");
  });
  it("names other open chords", () => {
    expect(identifyChord(f("022000"), STD)).toBe("Em");
    expect(identifyChord(f("x02210"), STD)).toBe("Am");
    expect(identifyChord(f("xx0232"), STD)).toBe("D");
    expect(identifyChord(f("320003"), STD)).toBe("G");
    expect(identifyChord(f("x02010"), STD)).toBe("Am7");
  });
});

describe("finding shapes", () => {
  it("finds the familiar open shapes first", () => {
    expect(findVoicings("C", STD)[0]!.frets).toEqual(f("x32010"));
    expect(findVoicings("Am", STD)[0]!.frets).toEqual(f("x02210"));
    expect(findVoicings("E", STD)[0]!.frets).toEqual(f("022100"));
    expect(findVoicings("D", STD)[0]!.frets).toEqual(f("xx0232"));
  });
  it("finds a barre where there's no open shape", () => {
    const v = findVoicings("Bm", STD)[0]!;
    expect(identifyChord(v.frets, STD)).toBe("Bm");
  });
  it("works in other tunings", () => {
    const d = findVoicings("D", DROP_D)[0]!;
    expect(identifyChord(d.frets, DROP_D)).toBe("D");
    expect(d.frets[0]).toBe(0); // the low D rings open in drop D
  });
  it("every shape it returns really is that chord", () => {
    for (const n of ["G", "F", "Bb", "C#m", "E7", "Amaj7", "Dsus2", "Fsus4", "Bdim", "Gadd9"]) {
      for (const v of findVoicings(n, STD, 3)) {
        expect(parseChord(identifyChord(v.frets, STD) ?? "")?.root).toBe(parseChord(n)!.root);
        expect(v.fingers.filter((x) => x > 0).every((x) => x >= 1 && x <= 4)).toBe(true);
      }
    }
  });
});

describe("typing a chart", () => {
  it("one chord per bar, or several with |", () => {
    expect(parseBars("Am F C G", 4).bars.map((b) => b.chords[0]!.name)).toEqual(["Am", "F", "C", "G"]);
    const two = parseBars("Am C | F G", 4).bars;
    expect(two).toHaveLength(2);
    expect(two[0]!.chords).toEqual([
      { name: "Am", beats: 2 },
      { name: "C", beats: 2 },
    ]);
  });
  it("dots hold a chord, and unknown words are reported", () => {
    expect(parseBars("Am . . F", 4).bars).toHaveLength(2);
    expect(parseBars("Am . . F | G", 4).bars[0]!.chords).toEqual([
      { name: "Am", beats: 3 },
      { name: "F", beats: 1 },
    ]);
    expect(parseBars("Am Hmm", 4).unknown).toEqual(["Hmm"]);
  });
  it("round-trips", () => {
    for (const s of ["Am F C G", "Am C | F G", "Am . . F | G"]) {
      const bars = parseBars(s, 4).bars;
      expect(parseBars(formatBars(bars, 4), 4).bars).toEqual(bars);
    }
  });
});

const content = (text: string): VersionContent => ({
  sections: [{ id: "a", kind: "verse", bars: parseBars(text, 4).bars }],
  arrangement: [{ sectionId: "a", repeat: 2 }],
});

describe("system-made facts", () => {
  it("suggests the key", () => {
    expect(suggestKey(["G", "D", "Em", "C", "G"])).toBe("G");
    expect(suggestKey(["Am", "F", "C", "G", "Am"])).toBe("Am");
    expect(suggestKey(["Em", "C", "G", "D"])).toBe("Em");
  });
  it("rates difficulty with reasons", () => {
    const easy = computeDifficulty(content("G C D G"), STD, 80);
    const hard = computeDifficulty(content("F Bm C#m G#7 Ebmaj7 Bb"), STD, 140);
    expect(easy.level).toBe("beginner");
    expect(hard.score).toBeGreaterThan(easy.score);
    expect(easy.reasons[0]).toBe("3 chords");
  });
  it("same chords give the same fingerprint", () => {
    expect(contentHash(content("Am F C G"))).toBe(contentHash(content("Am  F C  G")));
    expect(contentHash(content("Am F C G"))).not.toBe(contentHash(content("Am F G C")));
  });
});

describe("extended chord types", () => {
  it("reads the added names and their aliases", () => {
    for (const n of ["C7b5", "C7#5", "Caug7", "C7b9", "C7#9", "C9sus4", "C69", "C6/9".replace("/", ""), "Cadd11", "Cmadd11", "Cmaj7#5", "Cmaj7#11", "C11", "Cm11", "C13", "Cm13", "Cmaj13", "Bb13", "F#m11", "Ab7b9"]) {
      expect(parseChord(n), n).not.toBeNull();
    }
    expect(parseChord("C7+5")?.quality.suffix).toBe("7#5");
    expect(parseChord("Cmin13")?.quality.suffix).toBe("m13");
  });

  it("builds the right notes", () => {
    expect(chordTones(parseChord("C13")!).sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9, 10]);
    // E G# B D F
    expect(chordTones(parseChord("E7b9")!).sort((a, b) => a - b)).toEqual([2, 4, 5, 8, 11]);
  });

  it("still names the common open shapes the same way", () => {
    const std = [40, 45, 50, 55, 59, 64];
    expect(identifyChord([-1, 3, 2, 0, 1, 0], std)).toBe("C");
    expect(identifyChord([0, 2, 2, 1, 0, 0], std)).toBe("E");
    expect(identifyChord([-1, 0, 2, 2, 2, 0], std)).toBe("A");
    expect(identifyChord([-1, 0, 2, 0, 2, 0], std)).toBe("A7");
    expect(identifyChord([3, 2, 0, 0, 0, 1], std)).toBe("G7");
  });
});

describe("moveable shapes (barre and power chords)", () => {
  const fam = (id: string) => SHAPE_FAMILIES.find((f) => f.id === id)!;

  it("slides the E and A shapes to the right fret", () => {
    expect(moveShape(fam("E"), "", 5)).toMatchObject({ shift: 1, voicing: { frets: [1, 3, 3, 2, 1, 1] } }); // F
    expect(moveShape(fam("E"), "m", 10)?.voicing.frets).toEqual([6, 8, 8, 6, 6, 6]); // Bbm
    expect(moveShape(fam("A"), "", 11)).toMatchObject({ shift: 2, voicing: { frets: [-1, 2, 4, 4, 4, 2] } }); // B
    expect(moveShape(fam("E"), "7", 7)?.voicing.frets).toEqual([3, 5, 3, 4, 3, 3]); // G7
  });

  it("plays the open chord when the root is the shape's own", () => {
    expect(moveShape(fam("E"), "", 4)).toMatchObject({ shift: 0, voicing: { frets: [0, 2, 2, 1, 0, 0] } });
    expect(moveShape(fam("D"), "", 2)?.voicing.frets).toEqual([-1, -1, 0, 2, 3, 2]);
    expect(moveShape(fam("C"), "", 0)?.voicing.frets).toEqual([-1, 3, 2, 0, 1, 0]);
    expect(moveShape(fam("G"), "", 7)?.voicing.frets).toEqual([3, 2, 0, 0, 0, 3]);
  });

  it("makes power chords on three strings", () => {
    expect(moveShape(fam("P6"), "5", 7)?.voicing.frets).toEqual([3, 5, 5, -1, -1, -1]); // G5
    expect(moveShape(fam("P5"), "5", 0)?.voicing.frets).toEqual([-1, 3, 5, 5, -1, -1]); // C5
    expect(moveShape(fam("P4"), "5~Two notes", 5)?.voicing.frets).toEqual([-1, -1, 3, 5, -1, -1]); // F5
  });

  it("every shape, in every key, is exactly its chord's notes and nothing else", () => {
    let checked = 0;
    for (const f of SHAPE_FAMILIES) {
      for (const key of familyForms(f)) {
        const q = parseChord("C" + formSuffix(key))!.quality;
        for (let root = 0; root < 12; root++) {
          const m = moveShape(f, key, root);
          if (!m) continue;
          const pcs = new Set(m.voicing.frets.map((fr, i) => (fr < 0 ? -1 : (STD[i]! + fr) % 12)).filter((x) => x >= 0));
          const allowed = new Set(q.intervals.map((iv) => (root + iv) % 12));
          for (const pc of pcs) expect(allowed.has(pc), `${f.id} ${key} root ${root}: stray note ${pc}`).toBe(true);
          for (const iv of q.intervals) if (!(q.optional ?? []).includes(iv)) expect(pcs.has((root + iv) % 12), `${f.id} ${key} root ${root}: missing ${iv}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it("lists every family with types", () => {
    for (const f of SHAPE_FAMILIES) expect(familyForms(f).length, f.id).toBeGreaterThan(1);
    expect(SHAPE_FAMILIES.map((f) => f.id)).toEqual(["E", "A", "D", "C", "G", "P6", "P5", "P4"]);
  });
});

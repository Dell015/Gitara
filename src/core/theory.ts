/**
 * Chord theory for Gitara: names, notes, transposing, naming a shape from its notes (§5.6),
 * and suggesting a key from the chords in a version. Pure functions, no UI.
 *
 * A chord's name comes from its notes, not its fingers: the app reads which notes a shape plays,
 * finds the root and matches the pattern (major, minor, 7, sus, add9…).
 */

export type Accidental = "sharp" | "flat";

const SHARP = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;
const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function parseNote(s: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]*)$/.exec(s.trim());
  if (!m) return null;
  let pc = LETTER[m[1]!.toUpperCase()]!;
  for (const c of m[2]!) pc += c === "#" || c === "♯" ? 1 : -1;
  return mod12(pc);
}

export function noteName(pc: number, acc: Accidental = "sharp"): string {
  return (acc === "flat" ? FLAT : SHARP)[mod12(pc)]!;
}

// ---------------------------------------------------------------- qualities

export interface Quality {
  /** Canonical suffix as Gitara writes it: "", "m", "7", "maj7"… */
  suffix: string;
  /** Intervals from the root, in semitones (0 = root). */
  intervals: number[];
  /** Intervals that may be left out of a shape (usually the 5th). */
  optional?: number[];
}

export const QUALITIES: Quality[] = [
  { suffix: "", intervals: [0, 4, 7] },
  { suffix: "m", intervals: [0, 3, 7] },
  { suffix: "5", intervals: [0, 7] },
  { suffix: "7", intervals: [0, 4, 7, 10], optional: [7] },
  { suffix: "maj7", intervals: [0, 4, 7, 11], optional: [7] },
  { suffix: "m7", intervals: [0, 3, 7, 10], optional: [7] },
  { suffix: "mMaj7", intervals: [0, 3, 7, 11], optional: [7] },
  { suffix: "6", intervals: [0, 4, 7, 9], optional: [7] },
  { suffix: "m6", intervals: [0, 3, 7, 9], optional: [7] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "7sus4", intervals: [0, 5, 7, 10], optional: [7] },
  { suffix: "add9", intervals: [0, 2, 4, 7], optional: [7] },
  { suffix: "madd9", intervals: [0, 2, 3, 7], optional: [7] },
  { suffix: "9", intervals: [0, 2, 4, 7, 10], optional: [7] },
  { suffix: "maj9", intervals: [0, 2, 4, 7, 11], optional: [7] },
  { suffix: "m9", intervals: [0, 2, 3, 7, 10], optional: [7] },
  { suffix: "dim", intervals: [0, 3, 6] },
  { suffix: "dim7", intervals: [0, 3, 6, 9] },
  { suffix: "m7b5", intervals: [0, 3, 6, 10] },
  { suffix: "aug", intervals: [0, 4, 8] },
  // added later, after the common ones so naming a shape still prefers the simpler names
  { suffix: "7b5", intervals: [0, 4, 6, 10] },
  { suffix: "7#5", intervals: [0, 4, 8, 10] },
  { suffix: "7b9", intervals: [0, 1, 4, 7, 10], optional: [7] },
  { suffix: "7#9", intervals: [0, 3, 4, 7, 10], optional: [7] },
  { suffix: "9sus4", intervals: [0, 2, 5, 7, 10], optional: [7] },
  { suffix: "69", intervals: [0, 2, 4, 7, 9], optional: [7] },
  { suffix: "add11", intervals: [0, 4, 5, 7], optional: [7] },
  { suffix: "madd11", intervals: [0, 3, 5, 7], optional: [7] },
  { suffix: "maj7#5", intervals: [0, 4, 8, 11] },
  { suffix: "maj7#11", intervals: [0, 4, 6, 7, 11], optional: [7] },
  { suffix: "11", intervals: [0, 2, 4, 5, 7, 10], optional: [7, 2, 4] },
  { suffix: "m11", intervals: [0, 2, 3, 5, 7, 10], optional: [7, 2] },
  { suffix: "13", intervals: [0, 2, 4, 7, 9, 10], optional: [7, 2] },
  { suffix: "m13", intervals: [0, 2, 3, 7, 9, 10], optional: [7, 2] },
  { suffix: "maj13", intervals: [0, 2, 4, 7, 9, 11], optional: [7, 2] },
];

/** Other ways people write the same quality → canonical suffix. */
const ALIASES: Record<string, string> = {
  "": "",
  M: "",
  maj: "",
  min: "m",
  mi: "m",
  "-": "m",
  M7: "maj7",
  Maj7: "maj7",
  "△7": "maj7",
  "Δ7": "maj7",
  ma7: "maj7",
  min7: "m7",
  "-7": "m7",
  mi7: "m7",
  sus: "sus4",
  "7sus": "7sus4",
  "+": "aug",
  "°": "dim",
  o: "dim",
  "°7": "dim7",
  o7: "dim7",
  ø: "m7b5",
  "ø7": "m7b5",
  "m(maj7)": "mMaj7",
  mM7: "mMaj7",
  add2: "add9",
  "2": "sus2",
  "4": "sus4",
  M9: "maj9",
  min9: "m9",
  min6: "m6",
  "7-5": "7b5",
  "7(b5)": "7b5",
  "7+5": "7#5",
  "7+": "7#5",
  aug7: "7#5",
  "7-9": "7b9",
  "7(b9)": "7b9",
  "7(#9)": "7#9",
  "9sus": "9sus4",
  "6/9": "69",
  "6add9": "69",
  "maj7+5": "maj7#5",
  "maj7(#5)": "maj7#5",
  "maj7(#11)": "maj7#11",
  "M7#11": "maj7#11",
  "m(add11)": "madd11",
  "min11": "m11",
  "min13": "m13",
  "M13": "maj13",
};

const BY_SUFFIX = new Map(QUALITIES.map((q) => [q.suffix, q]));

export interface ParsedChord {
  root: number;
  quality: Quality;
  /** Slash bass, if different from the root. */
  bass?: number;
}

/** "Am7", "C/G", "F#m", "Bbmaj7", "Dsus" … → parts. Null for "N.C." and anything unrecognised. */
export function parseChord(name: string): ParsedChord | null {
  const m = /^([A-G][#b♯♭]?)([^/]*)(?:\/([A-G][#b♯♭]?))?$/.exec(name.trim());
  if (!m) return null;
  const root = parseNote(m[1]!);
  if (root === null) return null;
  const raw = m[2]!;
  const suffix = raw in ALIASES ? ALIASES[raw]! : raw;
  const quality = BY_SUFFIX.get(suffix);
  if (!quality) return null;
  const bass = m[3] ? parseNote(m[3]) : null;
  return { root, quality, bass: bass !== null && bass !== root ? bass : undefined };
}

export function isChordName(name: string): boolean {
  return parseChord(name) !== null;
}

export function chordName(c: ParsedChord, acc: Accidental = "sharp"): string {
  return noteName(c.root, acc) + c.quality.suffix + (c.bass !== undefined ? `/${noteName(c.bass, acc)}` : "");
}

/** Pitch classes in a chord (bass first if it's a slash chord). */
export function chordTones(c: ParsedChord): number[] {
  const tones = c.quality.intervals.map((i) => mod12(c.root + i));
  if (c.bass !== undefined && !tones.includes(c.bass)) tones.unshift(c.bass);
  return tones;
}

/** Writes a name the canonical way ("Amin7" → "Am7"), keeping the user's text if it can't be read. */
export function normalizeChordName(name: string, acc?: Accidental): string {
  const c = parseChord(name);
  if (!c) return name.trim();
  const useAcc = acc ?? (/[b♭]/.test(name.slice(1, 2)) ? "flat" : "sharp");
  return chordName(c, useAcc);
}

// ---------------------------------------------------------------- transposing

export function transposeChord(name: string, semitones: number, acc: Accidental): string {
  const c = parseChord(name);
  if (!c) return name;
  return chordName({ ...c, root: mod12(c.root + semitones), bass: c.bass === undefined ? undefined : mod12(c.bass + semitones) }, acc);
}

/** Keys that are written with flats (F major and the flat keys, and their relative minors). */
const FLAT_MAJORS = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb
export function accidentalForKey(key: string | undefined): Accidental {
  if (!key) return "sharp";
  const minor = /m$/.test(key) && !/maj$/.test(key);
  const pc = parseNote(minor ? key.slice(0, -1) : key);
  if (pc === null) return /b/.test(key) ? "flat" : "sharp";
  const major = minor ? mod12(pc + 3) : pc;
  return FLAT_MAJORS.has(major) ? "flat" : "sharp";
}

export function transposeKey(key: string | undefined, semitones: number): string | undefined {
  if (!key) return key;
  const minor = /m$/.test(key);
  const pc = parseNote(minor ? key.slice(0, -1) : key);
  if (pc === null) return key;
  const np = mod12(pc + semitones);
  const probe = noteName(np, "sharp") + (minor ? "m" : "");
  return noteName(np, accidentalForKey(probe)) + (minor ? "m" : "");
}

// ---------------------------------------------------------------- key suggestion

const MAJOR_DEGREES: [number, string][] = [
  [0, ""],
  [2, "m"],
  [4, "m"],
  [5, ""],
  [7, ""],
  [9, "m"],
  [11, "dim"],
];

/** Suggests the key from the chords, weighting the first and last chord as likely home. */
export function suggestKey(names: string[]): string | undefined {
  const chords = names.map(parseChord).filter((c): c is ParsedChord => !!c);
  if (!chords.length) return undefined;
  const triad = (c: ParsedChord) => (c.quality.intervals.includes(3) ? (c.quality.intervals.includes(6) ? "dim" : "m") : "");
  let best: { key: string; score: number } | undefined;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const minor of [false, true]) {
      const major = minor ? mod12(tonic + 3) : tonic;
      const set = new Map(MAJOR_DEGREES.map(([d, q]) => [mod12(major + d), q]));
      let score = 0;
      chords.forEach((c, i) => {
        const q = set.get(c.root);
        const t = triad(c);
        if (q !== undefined && q === t) score += 2;
        else if (q !== undefined) score += 0.5;
        else score -= 1.5;
        // V7 in minor keys (harmonic minor) is common
        if (minor && c.root === mod12(tonic + 7) && t === "") score += 1.5;
        if (c.root === tonic && t === (minor ? "m" : "")) score += i === 0 || i === chords.length - 1 ? 2.5 : 0.8;
      });
      const name = noteName(tonic, "sharp") + (minor ? "m" : "");
      const key = noteName(tonic, accidentalForKey(name)) + (minor ? "m" : "");
      if (!best || score > best.score) best = { key, score };
    }
  }
  return best?.key;
}

// ---------------------------------------------------------------- naming a shape

/**
 * Names a shape from its notes. frets: one per string, lowest string first, -1 = muted.
 * Returns the best name, or null if no known chord matches (the user names it).
 */
export function identifyChord(frets: number[], tuning: readonly number[], acc: Accidental = "sharp"): string | null {
  const notes: number[] = [];
  frets.forEach((f, i) => {
    if (f >= 0) notes.push(tuning[i]! + f);
  });
  if (notes.length < 2) return null;
  const bass = mod12(Math.min(...notes));
  const pcs = new Set(notes.map(mod12));
  let best: { name: string; score: number } | null = null;
  for (const root of pcs) {
    const rel = new Set([...pcs].map((p) => mod12(p - root)));
    for (const q of QUALITIES) {
      const needed = q.intervals.filter((i) => !(q.optional ?? []).includes(i));
      if (!needed.every((i) => rel.has(i))) continue;
      if (![...rel].every((i) => q.intervals.includes(i))) continue;
      let score = 10 - q.intervals.length; // simpler names first
      if (root === bass) score += 6;
      if (q.optional?.some((i) => !rel.has(i))) score -= 1;
      const name = chordName({ root, quality: q, bass: root === bass ? undefined : bass }, acc);
      if (!best || score > best.score) best = { name, score };
    }
  }
  return best?.name ?? null;
}

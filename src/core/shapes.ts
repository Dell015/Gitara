/**
 * Finds playable shapes ("voicings") for a chord in any tuning, so drop D, open G or DADGAD work
 * without a separate chord book. Shapes are scored the way a guitarist would choose: low on the neck,
 * open strings, the root in the bass, no muted strings in the middle, and a hand that can reach it.
 */
import { chordTones, mod12, parseChord } from "./theory";

export interface Voicing {
  /** One per string, lowest string first. -1 = muted, 0 = open. */
  frets: number[];
  /** Finger per string: 0 = none, 1–4 = index…little. */
  fingers: number[];
  /** Lowest fret shown in the diagram (1 = at the nut). */
  baseFret: number;
  /** A barre with finger 1 across these strings (indexes), if any. */
  barre?: { fret: number; from: number; to: number };
  /** 0 easy … 10 hard, from position, stretch, barre and finger count. */
  hardness: number;
}

const MAX_FRET = 15;
const cache = new Map<string, Voicing[]>();

/** Up to `limit` shapes, best first. Empty if the name can't be read. */
export function findVoicings(name: string, tuning: readonly number[], limit = 6): Voicing[] {
  const key = `${name}|${tuning.join(",")}|${limit}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const chord = parseChord(name);
  if (!chord) return [];
  const tones = new Set(chordTones(chord));
  const required = new Set(chord.quality.intervals.filter((i) => !(chord.quality.optional ?? []).includes(i)).map((i) => mod12(chord.root + i)));
  const bass = chord.bass ?? chord.root;
  const n = tuning.length;

  const found: { v: Voicing; score: number }[] = [];
  const seen = new Set<string>();

  for (let start = 0; start <= MAX_FRET - 3; start++) {
    // options per string: muted, open (if a chord tone), or a fret in the 4-fret window
    const opts: number[][] = tuning.map((open) => {
      const o = [-1];
      if (tones.has(mod12(open))) o.push(0);
      for (let f = Math.max(1, start); f <= start + 3; f++) if (tones.has(mod12(open + f))) o.push(f);
      return o;
    });
    const cur = new Array<number>(n).fill(-1);
    const walk = (s: number) => {
      if (s === n) {
        const v = evaluate(cur, tuning, required, bass);
        if (!v) return;
        const id = v.v.frets.join(",");
        if (seen.has(id)) return;
        seen.add(id);
        found.push(v);
        return;
      }
      for (const f of opts[s]!) {
        cur[s] = f;
        walk(s + 1);
      }
    };
    walk(0);
  }
  found.sort((a, b) => b.score - a.score);
  // In standard tuning the shapes everyone learns come first, then the barre forms, then the rest.
  const book = isStandard(tuning) ? [...bookShapes(name), ...barreForms(chord, tuning)] : [];
  const out: Voicing[] = [];
  const ids = new Set<string>();
  for (const v of [...book, ...found.map((f) => f.v)]) {
    const id = v.frets.join(",");
    if (ids.has(id)) continue;
    ids.add(id);
    out.push(v);
    if (out.length >= limit) break;
  }
  cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------- the chord book (standard tuning)

const STANDARD = [40, 45, 50, 55, 59, 64];
const isStandard = (t: readonly number[]) => t.length === 6 && t.every((x, i) => x === STANDARD[i]);

/** The shapes people learn first, written thickest string first; x = muted. */
const BOOK: Record<string, string[]> = {
  C: ["x32010"], Cm: ["x35543"], C7: ["x32310"], Cmaj7: ["x32000"], Cm7: ["x35343"], Csus2: ["x30033"], Csus4: ["x33011"], Cadd9: ["x32033"], C6: ["x32210"],
  D: ["xx0232"], Dm: ["xx0231"], D7: ["xx0212"], Dmaj7: ["xx0222"], Dm7: ["xx0211"], Dsus2: ["xx0230"], Dsus4: ["xx0233"], "D/F#": ["200232"],
  E: ["022100"], Em: ["022000"], E7: ["020100"], Emaj7: ["021100"], Em7: ["020000"], Esus4: ["022200"], E5: ["022xxx"],
  F: ["133211", "xx3211"], Fm: ["133111"], F7: ["131211"], Fmaj7: ["xx3210"], Fm7: ["131111"],
  G: ["320003", "320033"], Gm: ["355333"], G7: ["320001"], Gmaj7: ["320002"], Gm7: ["353333"], Gsus4: ["330013"], "G/B": ["x20003"],
  A: ["x02220"], Am: ["x02210"], A7: ["x02020"], Amaj7: ["x02120"], Am7: ["x02010"], Asus2: ["x02200"], Asus4: ["x02230"], A5: ["x022xx"],
  B: ["x24442"], Bm: ["x24432"], B7: ["x21202"], Bmaj7: ["x24342"], Bm7: ["x24232"],
  Bb: ["x13331"], Bbm: ["x13321"], Bb7: ["x13131"], Bbmaj7: ["x13231"],
  "C/G": ["332010"], "Am/G": ["302210"], "C/E": ["032010"], "Em/D": ["xx0000"],
};

const parseFrets = (s: string) => s.split("").map((c) => (c === "x" ? -1 : Number(c)));

function bookShapes(name: string): Voicing[] {
  return (BOOK[name] ?? []).map((s) => withFingers(parseFrets(s)));
}

/** E-shape (root on the 6th string) and A-shape (root on the 5th) barre chords. */
const E_FORMS: Record<string, number[]> = { "": [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "7": [0, 2, 0, 1, 0, 0], m7: [0, 2, 0, 0, 0, 0], sus4: [0, 2, 2, 2, 0, 0], "5": [0, 2, 2, -1, -1, -1] };
const A_FORMS: Record<string, number[]> = { "": [-1, 0, 2, 2, 2, 0], m: [-1, 0, 2, 2, 1, 0], "7": [-1, 0, 2, 0, 2, 0], m7: [-1, 0, 2, 0, 1, 0], maj7: [-1, 0, 2, 1, 2, 0], sus2: [-1, 0, 2, 2, 0, 0], sus4: [-1, 0, 2, 2, 3, 0], "5": [-1, 0, 2, 2, -1, -1] };

function barreForms(chord: NonNullable<ReturnType<typeof parseChord>>, tuning: readonly number[]): Voicing[] {
  if (chord.bass !== undefined) return [];
  const out: Voicing[] = [];
  const add = (form: number[] | undefined, stringIdx: number) => {
    if (!form) return;
    const fret = mod12(chord.root - tuning[stringIdx]!);
    if (fret === 0) return; // that's the open shape, already in the book
    out.push(withFingers(form.map((x) => (x < 0 ? -1 : x + fret))));
  };
  add(E_FORMS[chord.quality.suffix], 0);
  add(A_FORMS[chord.quality.suffix], 1);
  // lower on the neck first
  return out.sort((a, b) => Math.min(...a.frets.filter((f) => f > 0)) - Math.min(...b.frets.filter((f) => f > 0)));
}

/** Works out the barre and the fingers for a known shape. */
function withFingers(frets: number[]): Voicing {
  const fretted = frets.map((f, i) => (f > 0 ? i : -1)).filter((i) => i >= 0);
  const fs = fretted.map((i) => frets[i]!);
  const minF = fs.length ? Math.min(...fs) : 0;
  const maxF = fs.length ? Math.max(...fs) : 0;
  const onMin = fretted.filter((i) => frets[i] === minF);
  let barre: Voicing["barre"];
  if ((fretted.length > 4 || (onMin.length >= 2 && minF > 0 && fretted.length >= 4 && onMin[onMin.length - 1]! - onMin[0]! >= 2)) && onMin.length >= 2) {
    const covers = frets.every((f, i) => i < onMin[0]! || i > onMin[onMin.length - 1]! || f !== 0);
    if (covers) barre = { fret: minF, from: onMin[0]!, to: onMin[onMin.length - 1]! };
  }
  const fingers = assignFingers(frets, barre);
  const fingerCount = new Set(fingers.filter((x) => x > 0)).size;
  const hardness = Math.max(0, Math.min(10, Math.round((barre ? 3 : 0) + (fingerCount - 1) * 0.8 + (maxF - minF) * 0.9 + (minF > 4 ? 1.5 : 0))));
  return { frets, fingers, baseFret: maxF <= 4 ? 1 : minF, barre, hardness };
}

function evaluate(frets: number[], tuning: readonly number[], required: Set<number>, bass: number): { v: Voicing; score: number } | null {
  const played = frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
  if (played.length < Math.min(3, tuning.length)) return null;
  const first = played[0]!;
  // lowest sounding note must be the bass (root, or the slash note)
  if (mod12(tuning[first]! + frets[first]!) !== bass) return null;
  const pcs = new Set(played.map((i) => mod12(tuning[i]! + frets[i]!)));
  for (const r of required) if (!pcs.has(r)) return null;

  const fretted = played.filter((i) => frets[i]! > 0);
  const fs = fretted.map((i) => frets[i]!);
  const minF = fs.length ? Math.min(...fs) : 0;
  const maxF = fs.length ? Math.max(...fs) : 0;
  if (maxF - minF > 3) return null;

  // muted strings between played strings are hard to keep quiet
  const last = played[played.length - 1]!;
  let innerMutes = 0;
  for (let i = first; i <= last; i++) if (frets[i]! < 0) innerMutes++;
  if (innerMutes > 1) return null;

  // fingers: a barre on the lowest fret if more than four notes need fretting
  let barre: Voicing["barre"];
  let fingersNeeded = fretted.length;
  const onMin = fretted.filter((i) => frets[i] === minF);
  if (fretted.length > 4 && onMin.length >= 2) {
    const from = onMin[0]!;
    const to = fretted[fretted.length - 1]!;
    // a barre can't cover an open string
    if (played.some((i) => i > from && i <= to && frets[i] === 0)) return null;
    barre = { fret: minF, from, to: Math.max(...onMin) };
    fingersNeeded = 1 + fretted.filter((i) => frets[i]! > minF).length;
  }
  if (fingersNeeded > 4) return null;

  const fingers = assignFingers(frets, barre);
  const opens = played.filter((i) => frets[i] === 0).length;
  const lowMutes = first;
  const highMutes = tuning.length - 1 - last;
  const openBonus = maxF <= 4 ? opens * 1.2 : -opens * 1.5; // open strings ring oddly against high shapes
  let score = played.length * 2 + openBonus - minF * 1.4 - innerMutes * 5 - lowMutes * 0.6 - highMutes * 1.5 - (maxF - minF) * 0.8;
  if (barre) score -= 2.5;
  if (minF === 0 || (fs.length && maxF <= 3)) score += 2;

  const hardness = Math.max(0, Math.min(10, Math.round((barre ? 3 : 0) + (fingersNeeded - 1) * 0.8 + (maxF - minF) * 0.9 + (minF > 4 ? 1.5 : 0) + innerMutes * 1.5)));
  const baseFret = maxF <= 4 ? 1 : minF;
  return { v: { frets: [...frets], fingers, baseFret, barre, hardness }, score };
}

function assignFingers(frets: number[], barre?: Voicing["barre"]): number[] {
  const fingers = frets.map(() => 0);
  const notes = frets
    .map((f, i) => ({ f, i }))
    .filter((x) => x.f > 0 && !(barre && x.f === barre.fret && x.i >= barre.from && x.i <= barre.to));
  let next = 1;
  if (barre) {
    for (let i = barre.from; i <= barre.to; i++) if (frets[i] === barre.fret) fingers[i] = 1;
    next = 2;
  }
  // lower frets take lower fingers; same fret: lower string first
  notes.sort((a, b) => a.f - b.f || a.i - b.i);
  const base = barre ? barre.fret : notes.length ? notes[0]!.f : 1;
  for (const nt of notes) {
    // keep the finger roughly at its fret (index on the lowest fret, and so on)
    const ideal = Math.min(4, Math.max(next, nt.f - base + (barre ? 1 : 1)));
    fingers[nt.i] = Math.min(4, Math.max(next, ideal));
    next = fingers[nt.i]! + 1;
  }
  return fingers;
}

/** The default shape for a chord (or null). */
export function defaultVoicing(name: string, tuning: readonly number[]): Voicing | null {
  return findVoicings(name, tuning, 1)[0] ?? null;
}

/** Shapes shift with a capo: a shape's frets are relative to the capo. Diagrams stay the same. */
export function voicingFromFrets(frets: number[], fingers?: number[]): Voicing {
  const fs = frets.filter((f) => f > 0);
  const minF = fs.length ? Math.min(...fs) : 0;
  const maxF = fs.length ? Math.max(...fs) : 0;
  return {
    frets,
    fingers: fingers ?? frets.map(() => 0),
    baseFret: maxF <= 4 ? 1 : minF,
    hardness: Math.min(10, (maxF - minF) + fs.length),
  };
}

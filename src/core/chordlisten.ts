/**
 * Names the chord you are playing, from the microphone. Pure maths (no browser), so it is tested with
 * synthetic chords.
 *
 *  1. The spectrum is folded into 12 "pitch classes" (a chromagram): how much C, C#, D… is sounding,
 *     whatever the octave. Only clear peaks count, and low notes count more (guitar's bass notes and
 *     first harmonics are the most reliable).
 *  2. The 12 numbers are compared with a template for each chord (root + quality). The best match wins,
 *     with a nudge for the lowest note being the root and for simpler names.
 *  3. A tracker smooths this over time so the answer doesn't flicker between neighbours while a
 *     chord rings out, and clears when you stop playing.
 */
import { chordName, mod12, noteName, QUALITIES, type Accidental, type Quality } from "./theory";

export const MIN_HZ = 70; // just under low E (82 Hz), so a drop-D bass (73 Hz) still counts
export const MAX_HZ = 2200;

/** What we listen for. The common chords only: more names means more wrong guesses. */
const LISTEN_FOR = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "5", "6", "m6", "add9", "9", "dim", "aug"];
const WEIGHT: Record<number, number> = { 0: 1, 3: 0.85, 4: 0.9, 7: 0.75, 10: 0.7, 11: 0.7, 2: 0.6, 5: 0.7, 9: 0.65, 6: 0.7, 8: 0.7 };

interface Template {
  root: number;
  quality: Quality;
  vec: number[];
  norm: number;
  size: number;
}

const TEMPLATES: Template[] = (() => {
  const out: Template[] = [];
  const qs = LISTEN_FOR.map((s) => QUALITIES.find((q) => q.suffix === s)!).filter(Boolean);
  for (let root = 0; root < 12; root++) {
    for (const quality of qs) {
      const vec = new Array<number>(12).fill(0);
      for (const i of quality.intervals) vec[mod12(root + i)] = WEIGHT[i] ?? 0.6;
      const norm = Math.sqrt(vec.reduce((a, b) => a + b * b, 0));
      out.push({ root, quality, vec, norm, size: quality.intervals.length });
    }
  }
  return out;
})();

export interface Chroma {
  /** Strength of each pitch class, 0…1 (sums to roughly 1 for a clean chord). */
  chroma: number[];
  /** The same, from the low strings only (below ~260 Hz): shows the bass note. */
  bass: number[];
  /** Overall loudness of the clear peaks, 0 when nothing is playing. */
  energy: number;
}

/**
 * `db`: the analyser's spectrum in decibels (getFloatFrequencyData), bin k = k * sampleRate / fftSize.
 * `floorDb`: anything quieter than this is treated as silence.
 */
export function chromaFromDb(db: ArrayLike<number>, sampleRate: number, floorDb = -85): Chroma {
  const bins = db.length;
  const binHz = sampleRate / (bins * 2);
  const lin = new Float32Array(bins);
  let max = 0;
  for (let k = 0; k < bins; k++) {
    const d = db[k]!;
    const v = d > floorDb ? Math.pow(10, d / 20) : 0;
    lin[k] = v;
    const f = k * binHz;
    if (f >= MIN_HZ && f <= MAX_HZ && v > max) max = v;
  }
  const chroma = new Array<number>(12).fill(0);
  const bass = new Array<number>(12).fill(0);
  if (max <= 0) return { chroma, bass, energy: 0 };
  const lo = Math.max(1, Math.floor(MIN_HZ / binHz));
  const hi = Math.min(bins - 2, Math.ceil(MAX_HZ / binHz));
  let energy = 0;
  for (let k = lo; k <= hi; k++) {
    const v = lin[k]!;
    // clear peaks only, and not the faint ones
    if (v < max * 0.06 || v < lin[k - 1]! || v <= lin[k + 1]!) continue;
    // refine the peak position (parabolic) so a note between two bins still lands on the right pitch
    const a = lin[k - 1]!;
    const c = lin[k + 1]!;
    const denom = a - 2 * v + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const f = (k + Math.max(-0.5, Math.min(0.5, shift))) * binHz;
    const midi = 69 + 12 * Math.log2(f / 440);
    const nearest = Math.round(midi);
    const off = Math.abs(midi - nearest); // 0 = in tune, 0.5 = between two notes
    if (off > 0.4) continue; // between notes: probably noise
    const pc = mod12(nearest);
    // low notes count more; sharper peaks count more
    const w = (v / max) * (1 / (1 + f / 600)) * (1 - off * 1.2);
    chroma[pc]! += w;
    if (f < 260) bass[pc]! += w;
    energy += v;
  }
  const sum = chroma.reduce((x, y) => x + y, 0);
  if (sum > 0) for (let i = 0; i < 12; i++) chroma[i]! /= sum;
  const bsum = bass.reduce((x, y) => x + y, 0);
  if (bsum > 0) for (let i = 0; i < 12; i++) bass[i]! /= bsum;
  return { chroma, bass, energy };
}

export interface Guess {
  root: number;
  quality: Quality;
  name: string;
  /** 0…1: how well the notes fit this chord. */
  score: number;
  /** The pitch classes that make up the chord. */
  notes: number[];
}

/** The best few chords for these notes, best first. */
export function bestChords(chroma: number[], bass: number[] | null, acc: Accidental = "sharp", count = 3): Guess[] {
  const cn = Math.sqrt(chroma.reduce((a, b) => a + b * b, 0));
  if (cn === 0) return [];
  const lowest = bass && bass.some((x) => x > 0) ? bass.indexOf(Math.max(...bass)) : -1;
  const scored = TEMPLATES.map((t) => {
    let dot = 0;
    for (let i = 0; i < 12; i++) dot += chroma[i]! * t.vec[i]!;
    let score = dot / (cn * t.norm);
    // notes that sound but aren't in the chord count against it
    let outside = 0;
    for (let i = 0; i < 12; i++) if (t.vec[i] === 0) outside += chroma[i]!;
    score -= outside * 0.6;
    if (lowest === t.root) score += 0.06;
    else if (lowest >= 0 && !t.quality.intervals.some((iv) => mod12(t.root + iv) === lowest)) score -= 0.08;
    // simpler names first; five-note names need real evidence (a string's own overtones can fake a 9th)
    score -= Math.max(0, t.size - 3) * 0.03 + (t.size >= 5 ? 0.06 : 0);
    return { t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map(({ t, score }) => ({
    root: t.root,
    quality: t.quality,
    name: chordName({ root: t.root, quality: t.quality }, acc),
    score: Math.max(0, Math.min(1, score)),
    notes: t.quality.intervals.map((i) => mod12(t.root + i)),
  }));
}

export const notesText = (notes: number[], acc: Accidental = "sharp") => notes.map((n) => noteName(n, acc)).join(" ");

export interface Heard {
  name: string;
  notes: number[];
  confidence: number;
  /** Other chords that fit nearly as well, e.g. C and Am7. */
  alternatives: string[];
}

/**
 * Smooths readings over time. Feed it a reading every ~100 ms. It holds the chord steady while it
 * rings, switches only after a new chord has led for a few readings, and clears after silence.
 */
export class ChordTracker {
  private ema = new Array<number>(12).fill(0);
  private bassEma = new Array<number>(12).fill(0);
  private shown: Guess | null = null;
  private challenger: string | null = null;
  private lead = 0;
  private quiet = 0;
  private lastAll: Guess[] = [];

  constructor(
    private acc: Accidental = "sharp",
    private opts = { minEnergy: 0, minScore: 0.62, switchAfter: 3, quietAfter: 7 },
  ) {}

  reset() {
    this.ema.fill(0);
    this.bassEma.fill(0);
    this.shown = null;
    this.challenger = null;
    this.lead = 0;
    this.quiet = 0;
  }

  update(r: Chroma, loudEnough: boolean): Heard | null {
    if (!loudEnough || r.energy <= this.opts.minEnergy) {
      this.quiet++;
      if (this.quiet >= this.opts.quietAfter) this.reset();
      return this.present();
    }
    this.quiet = 0;
    // a new strum replaces the old picture quickly; a ringing chord is averaged for steadiness
    const a = this.shown ? 0.3 : 0.7;
    for (let i = 0; i < 12; i++) {
      this.ema[i] = this.ema[i]! * (1 - a) + r.chroma[i]! * a;
      this.bassEma[i] = this.bassEma[i]! * (1 - a) + r.bass[i]! * a;
    }
    const guesses = bestChords(this.ema, this.bassEma, this.acc, 3);
    this.lastAll = guesses;
    const top = guesses[0];
    if (!top || top.score < this.opts.minScore) {
      this.lead = 0;
      this.challenger = null;
      return this.present();
    }
    if (!this.shown) {
      this.shown = top;
    } else if (top.name !== this.shown.name) {
      if (this.challenger === top.name) this.lead++;
      else {
        this.challenger = top.name;
        this.lead = 1;
      }
      if (this.lead >= this.opts.switchAfter) {
        this.shown = top;
        this.challenger = null;
        this.lead = 0;
      }
    } else {
      this.shown = top;
      this.challenger = null;
      this.lead = 0;
    }
    return this.present();
  }

  private present(): Heard | null {
    if (!this.shown) return null;
    const mine = this.lastAll.find((g) => g.name === this.shown!.name) ?? this.shown;
    const alts = this.lastAll.filter((g) => g.name !== this.shown!.name && g.score >= mine.score - 0.06 && g.score >= this.opts.minScore).map((g) => g.name);
    return { name: this.shown.name, notes: this.shown.notes, confidence: mine.score, alternatives: alts.slice(0, 2) };
  }
}

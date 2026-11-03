/**
 * The chord chart: typing it, reading it back, and what the system works out from it
 * (chords used, difficulty, the duplicate fingerprint).
 *
 * How you type a section (the "simple list"; the app turns it into bars):
 *   Am F C G          four bars, one chord each
 *   Am C | F G        two bars, two chords each (beats split evenly)
 *   Am . . . | F      "." holds the chord before it for another beat slot
 *   N.C.              no chord (a rest bar)
 */
import type { Bar, BarChord, Section, StrumStep, VersionContent } from "./model";
import { findVoicings } from "./shapes";
import { isChordName, normalizeChordName, transposeChord, type Accidental } from "./theory";

export const NO_CHORD = "N.C.";

export interface ParseResult {
  bars: Bar[];
  /** Words that aren't chords, so the editor can point at them. */
  unknown: string[];
}

export function parseBars(text: string, beatsPerBar: number): ParseResult {
  const unknown: string[] = [];
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return { bars: [], unknown };
  const groups = clean.includes("|") ? clean.split("|").map((g) => g.trim()).filter(Boolean) : clean.split(" ").map((g) => g.trim());
  const bars: Bar[] = [];
  for (const g of groups) {
    const tokens = g.split(" ").filter(Boolean);
    // "." extends the previous chord in this bar by one slot
    const slots: string[] = [];
    for (const t of tokens) {
      if (t === "." || t === "-") {
        if (slots.length) slots.push(slots[slots.length - 1]!);
        continue;
      }
      if (/^n\.?c\.?$/i.test(t)) {
        slots.push(NO_CHORD);
        continue;
      }
      if (!isChordName(t)) unknown.push(t);
      slots.push(isChordName(t) ? normalizeChordName(t) : t);
    }
    if (!slots.length) continue;
    bars.push({ chords: splitBeats(slots, beatsPerBar) });
  }
  return { bars, unknown };
}

/** Slots → chords with beats, merging repeats ("Am Am C C" in 4/4 → Am 2, C 2). */
function splitBeats(slots: string[], beats: number): BarChord[] {
  const n = slots.length;
  const out: BarChord[] = [];
  let used = 0;
  for (let i = 0; i < n; i++) {
    const end = Math.round(((i + 1) * beats) / n);
    const len = Math.max(0, end - used);
    used = end;
    if (!len) continue;
    const prev = out[out.length - 1];
    if (prev && prev.name === slots[i]) prev.beats += len;
    else out.push({ name: slots[i]!, beats: len });
  }
  return out;
}

/** Bars → the text you'd type to get them back. */
export function formatBars(bars: Bar[], beatsPerBar: number): string {
  const simple = bars.every((b) => b.chords.length === 1);
  if (simple) return bars.map((b) => b.chords[0]!.name).join(" ");
  return bars
    .map((b) => {
      if (b.chords.length === 1) return b.chords[0]!.name;
      const evenly = b.chords.every((c) => c.beats === beatsPerBar / b.chords.length);
      if (evenly) return b.chords.map((c) => c.name).join(" ");
      return b.chords.map((c) => [c.name, ...Array(Math.max(0, c.beats - 1)).fill(".")].join(" ")).join(" ");
    })
    .join(" | ");
}

export function beatsPerBar(timeSignature?: string): number {
  const m = /^(\d+)\/(\d+)$/.exec(timeSignature ?? "4/4");
  if (!m) return 4;
  const top = Number(m[1]);
  // compound meters are felt in dotted beats: 6/8 → 2, 12/8 → 4
  if (m[2] === "8" && top % 3 === 0 && top > 3) return top / 3;
  return top;
}

// ---------------------------------------------------------------- the whole chart

/** Sections in the order they're played (arrangement), with repeats expanded. */
export function playOrder(content: VersionContent): Section[] {
  const byId = new Map(content.sections.map((s) => [s.id, s]));
  const order = content.arrangement.length ? content.arrangement : content.sections.map((s) => ({ sectionId: s.id, repeat: 1 }));
  const out: Section[] = [];
  for (const a of order) {
    const s = byId.get(a.sectionId);
    if (!s) continue;
    for (let r = 0; r < Math.max(1, a.repeat); r++) out.push(s);
  }
  return out;
}

export function chordsUsed(content: VersionContent): string[] {
  const seen = new Set<string>();
  for (const s of content.sections) for (const b of s.bars) for (const c of b.chords) if (c.name !== NO_CHORD && isChordName(c.name)) seen.add(c.name);
  return [...seen];
}

export function transposeContent(content: VersionContent, semitones: number, acc: Accidental): VersionContent {
  if (!semitones) return content;
  return {
    ...content,
    sections: content.sections.map((s) => ({
      ...s,
      bars: s.bars.map((b) => ({ chords: b.chords.map((c) => ({ ...c, name: c.name === NO_CHORD ? c.name : transposeChord(c.name, semitones, acc) })) })),
    })),
  };
}

export const DEFAULT_STRUM: StrumStep[] = ["D", "-", "D", "U", "-", "U", "D", "U"];

// ---------------------------------------------------------------- difficulty (system-generated)

export interface Difficulty {
  level: "beginner" | "intermediate" | "advanced";
  score: number; // 0–100
  reasons: string[];
}

export function computeDifficulty(content: VersionContent, tuning: readonly number[], bpm?: number): Difficulty {
  const names = chordsUsed(content);
  const shapes = names.map((n) => findVoicings(n, tuning, 1)[0]);
  const barres = shapes.filter((s) => s?.barre).length;
  const hard = shapes.reduce((s, v) => s + (v?.hardness ?? 6), 0) / Math.max(1, shapes.length);
  const order = playOrder(content);
  let changes = 0;
  let beats = 0;
  let prev = "";
  for (const s of order)
    for (const b of s.bars)
      for (const c of b.chords) {
        beats += c.beats;
        if (c.name !== prev) changes++;
        prev = c.name;
      }
  const minutes = beats / Math.max(30, bpm ?? 90);
  const perMin = minutes > 0 ? changes / minutes : 0;
  const strumSteps = content.sections.map((s) => (s.strum?.steps ?? []).filter((x) => x === "U").length);
  const ups = strumSteps.length ? Math.max(...strumSteps) : 0;

  let score = 0;
  score += Math.min(30, Math.max(0, names.length - 3) * 5);
  score += Math.min(30, barres * 10);
  score += Math.min(20, hard * 2.2);
  score += Math.min(15, Math.max(0, perMin - 12) * 0.8);
  score += Math.min(5, ups);
  score = Math.round(Math.min(100, score));

  const reasons = [`${names.length} chord${names.length === 1 ? "" : "s"}`];
  reasons.push(barres ? `${barres} barre${barres === 1 ? "" : "s"}` : "no barres");
  reasons.push(perMin < 15 ? "slow changes" : perMin < 30 ? "steady changes" : "fast changes");
  const level = score < 30 ? "beginner" : score < 60 ? "intermediate" : "advanced";
  return { level, score, reasons };
}

// ---------------------------------------------------------------- duplicate fingerprint

/** Same chords in every section and the same order → same hash (labels, notes and strums ignored). */
export function contentHash(content: VersionContent): string {
  const canon = playOrder(content)
    .map((s) => s.kind + ":" + s.bars.map((b) => b.chords.map((c) => `${c.name}*${c.beats}`).join(",")).join("|"))
    .join(";");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canon.length; i++) {
    const c = canon.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

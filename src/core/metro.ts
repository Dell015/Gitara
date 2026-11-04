/**
 * Metronome building blocks, kept free of audio and UI so they can be tested: meters with their
 * groupings (7/8 as 2+2+3), the rhythm cells played inside one beat, accent levels, the "silent bars"
 * trainer, tempo words and one-tap setups.
 */

/** 0 = silent beat, 1 = soft, 2 = normal, 3 = accent */
export type Level = 0 | 1 | 2 | 3;

export interface MeterDef {
  id: string;
  /** clicks per bar when counted the usual way */
  beats: number;
  /** ways to group the beats, the first is the default (7/8 → 2+2+3) */
  groupings: number[][];
  /** 6/8, 9/8, 12/8: felt in dotted beats by default; this is the number of eighths when counted one by one */
  compound?: number;
}

export const METERS: MeterDef[] = [
  { id: "2/4", beats: 2, groupings: [[2]] },
  { id: "3/4", beats: 3, groupings: [[3]] },
  { id: "4/4", beats: 4, groupings: [[4]] },
  { id: "5/4", beats: 5, groupings: [[3, 2], [2, 3]] },
  { id: "6/4", beats: 6, groupings: [[3, 3], [2, 2, 2]] },
  { id: "7/4", beats: 7, groupings: [[4, 3], [3, 4]] },
  { id: "5/8", beats: 5, groupings: [[3, 2], [2, 3]] },
  { id: "6/8", beats: 2, groupings: [[2]], compound: 6 },
  { id: "7/8", beats: 7, groupings: [[2, 2, 3], [3, 2, 2], [2, 3, 2]] },
  { id: "9/8", beats: 3, groupings: [[3]], compound: 9 },
  { id: "11/8", beats: 11, groupings: [[3, 3, 3, 2], [2, 3, 3, 3], [3, 2, 3, 3]] },
  { id: "12/8", beats: 4, groupings: [[4]], compound: 12 },
];

export const MAX_BEATS = 16;

export function meterDef(id: string): MeterDef | undefined {
  return METERS.find((m) => m.id === id);
}

/** Clicks in a bar for a meter. `eighths` counts every eighth of 6/8, 9/8 and 12/8 instead of the dotted beats. */
export function meterBeats(id: string, eighths = false, custom = 4): number {
  const m = meterDef(id);
  if (!m) return Math.min(MAX_BEATS, Math.max(1, custom));
  return eighths && m.compound ? m.compound : m.beats;
}

/** The groupings on offer for a meter (6/8 counted in eighths is 3+3). */
export function meterGroupings(id: string, eighths = false, custom = 4): number[][] {
  const m = meterDef(id);
  if (!m) return [[Math.min(MAX_BEATS, Math.max(1, custom))]];
  if (eighths && m.compound) return [Array.from({ length: m.compound / 3 }, () => 3)];
  return m.groupings;
}

/** A group of three-beat or more tells the ear where the pulse falls: first beat accent, group starts normal, the rest soft. */
export function defaultAccents(groups: number[]): Level[] {
  const out: Level[] = [];
  const plain = groups.length === 1;
  groups.forEach((g, gi) => {
    for (let i = 0; i < g; i++) out.push(i === 0 ? (gi === 0 ? 3 : 2) : plain ? 2 : 1);
  });
  return out;
}

/** Next level when a beat pad is tapped: accent → normal → soft → silent → accent. */
export function nextLevel(l: Level): Level {
  return ((l + 3) % 4) as Level;
}

/** A hit inside one beat: `at` is the position (0 = on the beat, 0.5 = halfway), `v` its strength for notes between beats. */
export interface Hit {
  at: number;
  v: number;
}

export interface Rhythm {
  id: string;
  label: string;
  /** how you'd count it */
  count: string;
  hits: Hit[];
}

const h = (...at: number[]): Hit[] => at.map((a) => ({ at: a, v: a === 0 ? 1 : 0.6 }));

export const RHYTHMS: Rhythm[] = [
  { id: "beat", label: "Beats", count: "1", hits: h(0) },
  { id: "eighths", label: "Eighths", count: "1 &", hits: h(0, 1 / 2) },
  { id: "triplets", label: "Triplets", count: "1 trip let", hits: h(0, 1 / 3, 2 / 3) },
  { id: "sixteenths", label: "Sixteenths", count: "1 e & a", hits: h(0, 1 / 4, 1 / 2, 3 / 4) },
  { id: "swing", label: "Swing", count: "1 (trip) let", hits: h(0, 2 / 3) },
  { id: "offbeat", label: "Off-beat", count: "&", hits: h(1 / 2) },
  { id: "gallop", label: "Gallop", count: "1 e a", hits: h(0, 1 / 4, 3 / 4) },
  { id: "revgallop", label: "Reverse gallop", count: "1 & a", hits: h(0, 1 / 2, 3 / 4) },
  { id: "dotted", label: "Dotted eighth", count: "1 a", hits: h(0, 3 / 4) },
  { id: "skip", label: "1 e &", count: "1 e &", hits: h(0, 1 / 4, 1 / 2) },
  { id: "quint", label: "Quintuplets", count: "1 2 3 4 5", hits: h(0, 1 / 5, 2 / 5, 3 / 5, 4 / 5) },
  { id: "sext", label: "Sextuplets", count: "1 2 3 4 5 6", hits: h(0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6) },
];

export function rhythmFor(id: string): Rhythm {
  return RHYTHMS.find((r) => r.id === id) ?? RHYTHMS[0]!;
}

/** "Play 3 bars, then 1 bar of silence": whether bar number `bar` (from 0) is the silent one. */
export interface Gap {
  play: number;
  mute: number;
}

export function isSilentBar(bar: number, gap: Gap | null): boolean {
  if (!gap || gap.mute <= 0) return false;
  return bar % (gap.play + gap.mute) >= gap.play;
}

export const SOUNDS = [
  { id: "click", label: "Click" },
  { id: "wood", label: "Wood block" },
  { id: "beep", label: "Beep" },
  { id: "hat", label: "Hi-hat" },
  { id: "cowbell", label: "Cowbell" },
  { id: "rim", label: "Rim shot" },
  { id: "kit", label: "Kick & hat" },
] as const;
export type ClickSound = (typeof SOUNDS)[number]["id"];

/** The classical word for a tempo, so 72 reads as "Adagio". */
export function tempoWord(bpm: number): string {
  if (bpm < 40) return "Grave";
  if (bpm < 60) return "Largo";
  if (bpm < 66) return "Larghetto";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 176) return "Vivace";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
}

/** Tempo jump-offs shown under the dial. */
export const TEMPO_MARKS = [
  { label: "Largo", bpm: 50 },
  { label: "Adagio", bpm: 70 },
  { label: "Andante", bpm: 90 },
  { label: "Moderato", bpm: 112 },
  { label: "Allegro", bpm: 132 },
  { label: "Vivace", bpm: 164 },
  { label: "Presto", bpm: 184 },
] as const;

export interface MetroConfig {
  bpm: number;
  /** a meter id from METERS, or "custom" */
  meter: string;
  grouping: number;
  /** count every eighth of 6/8, 9/8, 12/8 */
  eighths: boolean;
  /** beats per bar when the meter is "custom" */
  custom: number;
  accents: Level[];
  rhythm: string;
  sound: ClickSound;
  /** 0..1 */
  volume: number;
  gap: Gap | null;
  /** chance (0..1) that a beat is left out at random */
  drop: number;
  vibrate: boolean;
}

export function accentsForConfig(c: Pick<MetroConfig, "meter" | "grouping" | "eighths" | "custom">): Level[] {
  const gs = meterGroupings(c.meter, c.eighths, c.custom);
  return defaultAccents(gs[Math.min(c.grouping, gs.length - 1)]!);
}

export const DEFAULT_CONFIG: MetroConfig = {
  bpm: 90,
  meter: "4/4",
  grouping: 0,
  eighths: false,
  custom: 4,
  accents: [3, 2, 2, 2],
  rhythm: "beat",
  sound: "click",
  volume: 0.8,
  gap: null,
  drop: 0,
  vibrate: false,
};

/** Fixes whatever was saved so an old or hand-edited value never breaks the screen. */
export function sanitizeConfig(raw: Partial<MetroConfig> | null | undefined): MetroConfig {
  const r = raw ?? {};
  const meter = typeof r.meter === "string" && (r.meter === "custom" || meterDef(r.meter)) ? r.meter : DEFAULT_CONFIG.meter;
  const custom = Math.min(MAX_BEATS, Math.max(1, Math.round(Number(r.custom) || 4)));
  const eighths = !!r.eighths && !!meterDef(meter)?.compound;
  const gs = meterGroupings(meter, eighths, custom);
  const grouping = Math.min(gs.length - 1, Math.max(0, Math.round(Number(r.grouping) || 0)));
  const beats = meterBeats(meter, eighths, custom);
  const fixed = Array.isArray(r.accents) && r.accents.length === beats && r.accents.every((a) => a === 0 || a === 1 || a === 2 || a === 3);
  return {
    bpm: Math.min(300, Math.max(20, Math.round(Number(r.bpm) || DEFAULT_CONFIG.bpm))),
    meter,
    grouping,
    eighths,
    custom,
    accents: fixed ? (r.accents as Level[]) : accentsForConfig({ meter, grouping, eighths, custom }),
    rhythm: RHYTHMS.some((x) => x.id === r.rhythm) ? r.rhythm! : "beat",
    sound: SOUNDS.some((s) => s.id === r.sound) ? r.sound! : "click",
    volume: Math.min(1, Math.max(0.1, Number(r.volume) || DEFAULT_CONFIG.volume)),
    gap: r.gap && r.gap.play >= 1 && r.gap.mute >= 1 ? { play: Math.min(8, Math.round(r.gap.play)), mute: Math.min(8, Math.round(r.gap.mute)) } : null,
    drop: [0, 0.15, 0.3, 0.5].includes(Number(r.drop)) ? Number(r.drop) : 0,
    vibrate: !!r.vibrate,
  };
}

/** One-tap setups for common practice. Each lists only what it changes. */
export interface MetroSetup {
  id: string;
  label: string;
  note: string;
  set: Partial<MetroConfig>;
}

export const SETUPS: MetroSetup[] = [
  { id: "warm", label: "Warm-up", note: "Slow and even", set: { bpm: 60, meter: "4/4", rhythm: "eighths", sound: "click" } },
  { id: "shuffle", label: "Blues shuffle", note: "Swung, backbeat on 2 and 4", set: { bpm: 92, meter: "4/4", rhythm: "swing", sound: "wood", accents: [2, 3, 2, 3] } },
  { id: "waltz", label: "Waltz", note: "Strong one, light two three", set: { bpm: 126, meter: "3/4", rhythm: "beat", sound: "wood", accents: [3, 1, 1] } },
  { id: "reggae", label: "Reggae skank", note: "Only the off-beats", set: { bpm: 76, meter: "4/4", rhythm: "offbeat", sound: "rim" } },
  { id: "gallop", label: "Metal gallop", note: "1 e a, over and over", set: { bpm: 150, meter: "4/4", rhythm: "gallop", sound: "click" } },
  { id: "funk", label: "Funk sixteenths", note: "Hat on every sixteenth", set: { bpm: 98, meter: "4/4", rhythm: "sixteenths", sound: "hat", accents: [3, 1, 2, 1] } },
  { id: "ballad", label: "Slow 6/8", note: "Two big beats, three each", set: { bpm: 54, meter: "6/8", eighths: false, rhythm: "triplets", sound: "click" } },
  { id: "odd", label: "Odd meter 7/8", note: "Grouped 2+2+3", set: { bpm: 160, meter: "7/8", grouping: 0, rhythm: "beat", sound: "wood" } },
  { id: "hold", label: "Hold the time", note: "3 bars on, 1 bar silent", set: { bpm: 100, meter: "4/4", rhythm: "beat", gap: { play: 3, mute: 1 } } },
  { id: "honest", label: "Stay honest", note: "Beats drop out at random", set: { bpm: 90, meter: "4/4", rhythm: "beat", drop: 0.3 } },
];

/** Applies a setup on top of the current config, then re-derives the accents unless the setup gave its own. */
export function applySetup(c: MetroConfig, s: MetroSetup): MetroConfig {
  const base: MetroConfig = { ...c, gap: null, drop: 0, eighths: false, grouping: 0, ...s.set };
  return sanitizeConfig({ ...base, accents: s.set.accents ?? accentsForConfig(base) });
}

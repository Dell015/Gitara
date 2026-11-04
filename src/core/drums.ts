/**
 * Backing tracks, v1 (§5.9): drum patterns on a step grid. A track has one or more patterns
 * (A, B, C…); each section of a song can use its own pattern (verse on A, chorus on B).
 * The same data will open in the piano roll and timeline later (Phase 8).
 */
import type { SectionKind } from "./model";

export const DRUM_SOUNDS = ["kick", "snare", "rim", "clap", "hatClosed", "hatOpen", "tomLow", "tomHigh", "shaker", "crash"] as const;
export type DrumSound = (typeof DRUM_SOUNDS)[number];

export const SOUND_LABEL: Record<DrumSound, string> = {
  kick: "Kick",
  snare: "Snare",
  rim: "Rim",
  clap: "Clap",
  hatClosed: "Hi-hat",
  hatOpen: "Open hat",
  tomLow: "Low tom",
  tomHigh: "High tom",
  shaker: "Shaker",
  crash: "Crash",
};

export interface Lane {
  sound: DrumSound;
  /** One value per step: 0 = off, 0.5 = soft (ghost), 1 = normal, 1.2 = accent. */
  steps: number[];
  volume: number; // 0…1
  muted?: boolean;
}

export interface Pattern {
  id: string;
  name: string; // "A", "B" or a name
  bars: number; // 1, 2 or 4
  lanes: Lane[];
}

export interface TrackContent {
  patterns: Pattern[];
  /** Which pattern plays under each kind of section; anything missing uses the first pattern. */
  sectionPatterns?: Partial<Record<SectionKind, string>>;
}

export interface Track {
  id: string;
  ownerId: string | null;
  songId?: string;
  name: string;
  bpm: number;
  timeSignature: string;
  /** 0 = straight, 0.5+ = heavy shuffle (pushes every second step late). */
  swing: number;
  content: TrackContent;
  visibility: "private" | "unlisted" | "public";
  createdAt: string;
  updatedAt: string;
}

/** Steps per bar: 16ths in 4/4, 8ths-of-a-triplet feel in 6/8 and 12/8. */
export function stepsPerBar(timeSignature: string): number {
  const [top, bottom] = timeSignature.split("/").map(Number) as [number, number];
  if (bottom === 8) return top * 2; // 6/8 → 12 steps (16ths of dotted beats)
  return top * 4;
}

/** Steps that start a beat, for drawing the grid in groups. */
export function stepsPerBeat(timeSignature: string): number {
  const [top, bottom] = timeSignature.split("/").map(Number) as [number, number];
  if (bottom === 8 && top % 3 === 0) return 6; // dotted-quarter beats
  return 4;
}

export function emptyPattern(id: string, name: string, timeSignature: string, bars = 1, sounds: DrumSound[] = ["kick", "snare", "hatClosed", "hatOpen", "crash"]): Pattern {
  const n = stepsPerBar(timeSignature) * bars;
  return { id, name, bars, lanes: sounds.map((sound) => ({ sound, steps: new Array(n).fill(0), volume: 0.8 })) };
}

/** Resize a pattern's steps when bars or the time signature change, keeping what fits. */
export function resizePattern(p: Pattern, timeSignature: string, bars: number): Pattern {
  const n = stepsPerBar(timeSignature) * bars;
  return {
    ...p,
    bars,
    // keep what fits; a longer pattern repeats the existing steps
    lanes: p.lanes.map((l) => ({ ...l, steps: Array.from({ length: n }, (_, i) => l.steps[i] ?? l.steps[i % Math.max(1, l.steps.length)] ?? 0) })),
  };
}

export function patternForSection(content: TrackContent, kind: SectionKind | undefined): Pattern | undefined {
  const id = kind ? content.sectionPatterns?.[kind] : undefined;
  return content.patterns.find((p) => p.id === id) ?? content.patterns[0];
}

// ---------------------------------------------------------------- loop library (built-in grooves)

/** Write a lane from a picture: x = hit, o = accent, - = soft, . = rest. */
function lane(sound: DrumSound, pic: string, volume = 0.8): Lane {
  return { sound, volume, steps: pic.replace(/\s/g, "").split("").map((c) => (c === "x" ? 1 : c === "o" ? 1.2 : c === "-" ? 0.5 : 0)) };
}

export interface Preset {
  id: string;
  name: string;
  style: string;
  timeSignature: string;
  bpm: number;
  swing?: number;
  lanes: Lane[];
}

export const PRESETS: Preset[] = [
  {
    id: "rock",
    name: "Straight rock",
    style: "Rock",
    timeSignature: "4/4",
    bpm: 100,
    lanes: [lane("kick", "x... .... x.x. ...."), lane("snare", ".... x... .... x..."), lane("hatClosed", "x.x. x.x. x.x. x.x.", 0.6)],
  },
  {
    id: "pop",
    name: "Pop four on the floor",
    style: "Pop",
    timeSignature: "4/4",
    bpm: 112,
    lanes: [lane("kick", "x... x... x... x..."), lane("clap", ".... x... .... x..."), lane("hatClosed", "..x. ..x. ..x. ..x.", 0.6), lane("shaker", "-x-x -x-x -x-x -x-x", 0.4)],
  },
  {
    id: "ballad",
    name: "Slow ballad",
    style: "Ballad",
    timeSignature: "4/4",
    bpm: 72,
    lanes: [lane("kick", "x... .... ..x. ...."), lane("rim", ".... x... .... x..."), lane("hatClosed", "x.-. x.-. x.-. x.-.", 0.5)],
  },
  {
    id: "shuffle",
    name: "Blues shuffle",
    style: "Blues",
    timeSignature: "4/4",
    bpm: 92,
    swing: 0.5,
    lanes: [lane("kick", "x... ..x. x... ..x."), lane("snare", ".... x... .... x..."), lane("hatClosed", "x.x. x.x. x.x. x.x.", 0.6)],
  },
  {
    id: "funk",
    name: "Funk sixteenths",
    style: "Funk",
    timeSignature: "4/4",
    bpm: 98,
    lanes: [lane("kick", "x..x ..x. .x.. x..."), lane("snare", ".... o..- .-.. o..."), lane("hatClosed", "xxxx xxxx xxxx xxxx", 0.45), lane("hatOpen", ".... .... .... ..x.", 0.5)],
  },
  {
    id: "reggae",
    name: "One drop",
    style: "Reggae",
    timeSignature: "4/4",
    bpm: 76,
    lanes: [lane("kick", ".... .... x... ...."), lane("rim", ".... .... x... ...."), lane("hatClosed", "x.x. x.x. x.x. x.x.", 0.5)],
  },
  {
    id: "bossa",
    name: "Bossa nova",
    style: "Latin",
    timeSignature: "4/4",
    bpm: 128,
    lanes: [lane("kick", "x..x x..x x..x x..x", 0.6), lane("rim", "x..x ..x. ..x. .x..", 0.6), lane("shaker", "xxxx xxxx xxxx xxxx", 0.35)],
  },
  {
    id: "acoustic",
    name: "Campfire (cajón feel)",
    style: "Acoustic",
    timeSignature: "4/4",
    bpm: 96,
    lanes: [lane("kick", "x... ..x. x... ...."), lane("snare", ".... x... .... x..-", 0.7), lane("shaker", "x-x- x-x- x-x- x-x-", 0.45)],
  },
  {
    id: "waltz",
    name: "Waltz",
    style: "3/4",
    timeSignature: "3/4",
    bpm: 90,
    lanes: [lane("kick", "x... .... ...."), lane("snare", ".... x... x...", 0.6), lane("hatClosed", "x.x. x.x. x.x.", 0.5)],
  },
  {
    id: "six-eight",
    name: "6/8 ballad",
    style: "6/8",
    timeSignature: "6/8",
    bpm: 60,
    lanes: [lane("kick", "x..... ......"), lane("snare", "...... x....."), lane("hatClosed", "x.x.x. x.x.x.", 0.5)],
  },
];

/** A preset as a pattern that fits the track's time signature and length. */
export function presetPattern(p: Preset, id: string, name: string, bars: number): Pattern {
  const base: Pattern = { id, name, bars: 1, lanes: p.lanes.map((l) => ({ ...l, steps: [...l.steps] })) };
  return resizePattern(base, p.timeSignature, bars);
}

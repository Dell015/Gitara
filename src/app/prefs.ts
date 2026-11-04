/** Display preferences (§5.7): sharps or flats, left-handed diagrams, chart text size. Per device. */
import { useSyncExternalStore } from "react";

export interface TrainerPrefs {
  /** Play-along: start speed, how much to add, every how many loops, up to what, then what. */
  start: number;
  step: number;
  every: number;
  target: number;
  thenStop: number; // loops at the target before stopping; 0 = keep looping
  /** Metronome: bpm to add, every how many bars, up to what bpm. */
  metroStep: number;
  metroEvery: number;
  metroTarget: number;
}

export const TRAINER_DEFAULTS: TrainerPrefs = { start: 0.7, step: 0.05, every: 1, target: 1, thenStop: 0, metroStep: 5, metroEvery: 4, metroTarget: 160 };

export interface Prefs {
  trainer: TrainerPrefs;
  accidentals: "auto" | "sharp" | "flat";
  leftHanded: boolean;
  chartSize: 0 | 1 | 2;
}

const KEY = "gitara.prefs.v1";
const DEFAULTS: Prefs = { accidentals: "auto", leftHanded: false, chartSize: 1, trainer: TRAINER_DEFAULTS };
let state: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    return { ...DEFAULTS, ...saved, trainer: { ...TRAINER_DEFAULTS, ...(saved.trainer ?? {}) } };
  } catch {
    return DEFAULTS;
  }
}

export function setPrefs(patch: Partial<Prefs>) {
  state = { ...state, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

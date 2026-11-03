/** Display preferences (§5.7): sharps or flats, left-handed diagrams, chart text size. Per device. */
import { useSyncExternalStore } from "react";

export interface Prefs {
  accidentals: "auto" | "sharp" | "flat";
  leftHanded: boolean;
  chartSize: 0 | 1 | 2;
}

const KEY = "gitara.prefs.v1";
const DEFAULTS: Prefs = { accidentals: "auto", leftHanded: false, chartSize: 1 };
let state: Prefs = load();
const listeners = new Set<() => void>();

function load(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>) };
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

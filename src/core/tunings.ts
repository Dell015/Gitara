import { GUITAR_TUNINGS } from "./instrument";
import { noteName } from "./theory";

/** "Standard", "Drop D", or the notes ("D A D G A D") for anything else. */
export function tuningName(tuning: readonly number[]): string {
  const t = GUITAR_TUNINGS.find((x) => x.tuning.length === tuning.length && x.tuning.every((m, i) => m === tuning[i]));
  return t ? t.name : tuning.map((m) => noteName(m % 12)).join(" ");
}

export function isStandardTuning(tuning: readonly number[]): boolean {
  return tuningName(tuning) === "Standard";
}

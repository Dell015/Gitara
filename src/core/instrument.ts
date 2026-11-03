/**
 * An instrument is "number of strings + tuning + number of frets" (docs/aboutproject.md §5.14).
 * Bass and ukulele reuse everything built on top of this later.
 *
 * Pitches are MIDI note numbers (60 = middle C), listed from the lowest string to the highest.
 */

export type InstrumentId = "guitar";

export interface Instrument {
  id: InstrumentId;
  name: string;
  strings: number;
  frets: number;
  /** Standard tuning, MIDI note per string, lowest string first. */
  standardTuning: readonly number[];
}

export const GUITAR: Instrument = {
  id: "guitar",
  name: "Guitar",
  strings: 6,
  frets: 24,
  standardTuning: [40, 45, 50, 55, 59, 64], // E2 A2 D3 G3 B3 E4
};

export const INSTRUMENTS: Record<InstrumentId, Instrument> = { guitar: GUITAR };

export interface TuningPreset {
  id: string;
  name: string;
  /** MIDI note per string, lowest first. Always as many entries as the instrument has strings. */
  tuning: readonly number[];
}

/** Presets for the tuning picker. Users can also enter a custom tuning (Q50). */
export const GUITAR_TUNINGS: readonly TuningPreset[] = [
  { id: "standard", name: "Standard", tuning: [40, 45, 50, 55, 59, 64] },
  { id: "drop-d", name: "Drop D", tuning: [38, 45, 50, 55, 59, 64] },
  { id: "half-step-down", name: "Half step down", tuning: [39, 44, 49, 54, 58, 63] },
  { id: "full-step-down", name: "Whole step down", tuning: [38, 43, 48, 53, 57, 62] },
  { id: "open-g", name: "Open G", tuning: [38, 43, 50, 55, 59, 62] },
  { id: "open-d", name: "Open D", tuning: [38, 45, 50, 54, 57, 62] },
  { id: "dadgad", name: "DADGAD", tuning: [38, 45, 50, 55, 57, 62] },
];

export const MAX_CAPO = 12;

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"] as const;

export type Accidental = "sharp" | "flat";

/** Note name without octave, e.g. 61 -> "C#" (or "Db" when asked for flats). */
export function pitchClassName(midi: number, accidental: Accidental = "sharp"): string {
  const names = accidental === "sharp" ? SHARP_NAMES : FLAT_NAMES;
  return names[((midi % 12) + 12) % 12];
}

/** Note name with octave, e.g. 40 -> "E2". Scientific pitch notation (middle C = C4). */
export function noteName(midi: number, accidental: Accidental = "sharp"): string {
  return `${pitchClassName(midi, accidental)}${Math.floor(midi / 12) - 1}`;
}

/**
 * The pitch you hear when pressing `fret` on `stringIndex` (0 = lowest string).
 * `capo` raises every string, so it is added on top of the fret.
 * Fret 0 means the open string (or the capo position, if a capo is on).
 */
export function pitchAt(tuning: readonly number[], stringIndex: number, fret: number, capo = 0): number {
  if (stringIndex < 0 || stringIndex >= tuning.length) {
    throw new RangeError(`String ${stringIndex} does not exist (instrument has ${tuning.length} strings)`);
  }
  if (fret < 0) throw new RangeError("Fret cannot be negative");
  return tuning[stringIndex] + capo + fret;
}

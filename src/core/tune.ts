/**
 * What the tuner screen shows, from the raw pitch readings: steadier than reading the microphone
 * directly. It ignores a one-off octave jump, smooths the needle, keeps the last reading on screen for a
 * moment after the string dies away, and only calls a string "in tune" once it has stayed there.
 * Pure logic, tested with made-up readings.
 */
import { freqFromMidi, midiFromFreq, nearestString } from "./pitch";

export interface TuneReading {
  /** smoothed frequency */
  hz: number;
  /** index into the tuning: the locked string, or the nearest one */
  string: number;
  /** the note that string should sound, in hertz */
  targetHz: number;
  /** whole cents from the target (negative = flat) */
  cents: number;
  /** the same without rounding, for placing the needle */
  exact: number;
  /** true while the last reading is being kept after the sound stopped */
  held: boolean;
  inTune: boolean;
}

const centsBetween = (a: number, b: number) => 1200 * Math.log2(a / b);

export class TuneTracker {
  private recent: number[] = [];
  private smooth: number | null = null;
  private last: TuneReading | null = null;
  private lastAt = 0;
  private steady = 0;
  private jumps = 0;

  constructor(
    private tuning: readonly number[],
    private a4 = 440,
    private target: number | null = null,
    /** how long the last reading stays after the sound stops (ms) */
    private readonly holdMs = 1200,
    /** how close counts as in tune (cents) and how many readings in a row it takes */
    private readonly tolerance = 4,
    private readonly needSteady = 4,
  ) {}

  configure(tuning: readonly number[], a4: number, target: number | null): void {
    this.tuning = tuning;
    this.a4 = a4;
    this.target = target;
    this.reset();
  }

  reset(): void {
    this.recent = [];
    this.smooth = null;
    this.last = null;
    this.steady = 0;
    this.jumps = 0;
  }

  /** Feed one reading (`hz` null = no clear pitch). `now` in ms. Returns what to show, or null for nothing. */
  update(hz: number | null, now: number): TuneReading | null {
    if (hz !== null && this.recent.length >= 3) {
      const med = [...this.recent].sort((a, b) => a - b)[Math.floor(this.recent.length / 2)]!;
      if (Math.abs(centsBetween(hz, med)) > 90) {
        // a single wild reading (often an octave error on the attack) is ignored; a second one in a row means a new note
        if (++this.jumps < 2) hz = null;
        else {
          this.recent = [];
          this.smooth = null;
          this.steady = 0;
          this.jumps = 0;
        }
      } else this.jumps = 0;
    }
    if (hz === null) {
      if (this.last && now - this.lastAt <= this.holdMs) return { ...this.last, held: true };
      this.reset();
      return null;
    }
    this.recent.push(hz);
    if (this.recent.length > 5) this.recent.shift();
    const prev = this.smooth;
    const s = prev !== null && Math.abs(centsBetween(hz, prev)) < 60 ? prev * 0.65 + hz * 0.35 : hz;
    this.smooth = s;
    const string = this.target ?? nearestString(s, this.tuning, this.a4).string;
    const targetHz = freqFromMidi(this.tuning[string]!, this.a4);
    const exact = centsBetween(s, targetHz);
    this.steady = Math.abs(exact) <= this.tolerance ? this.steady + 1 : 0;
    this.last = { hz: s, string, targetHz, cents: Math.round(exact), exact, held: false, inTune: this.steady >= this.needSteady };
    this.lastAt = now;
    return this.last;
  }
}

/** Octave number for a MIDI note (E2 = 40). */
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;

export { midiFromFreq };

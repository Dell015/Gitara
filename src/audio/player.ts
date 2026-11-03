/**
 * Plays a chord chart: strums each section's pattern at the version's tempo and reports where it is,
 * so the chart can highlight the bar and the light can breathe on the beat.
 * Uses a look-ahead scheduler (timing from the audio clock, not timers), so it stays in time.
 * Phase 3 adds count-in, looping a section, the speed trainer and backing tracks on top of this.
 */
import { beatsPerBar, DEFAULT_STRUM, NO_CHORD } from "../core/chart";
import type { Section, StrumStep } from "../core/model";
import { audio, strumStep } from "./guitar";

export interface PlayPosition {
  /** Index into the play order (sections with repeats expanded). */
  part: number;
  bar: number;
  beat: number;
}

export interface PlayOptions {
  order: Section[];
  bpm: number;
  timeSignature?: string;
  tuning: readonly number[];
  capo: number;
  /** Shape for a chord name as it's shown (after transpose/capo view tools). */
  shapeFor: (name: string) => number[] | null;
  /** Name as played (transposed for the view). */
  nameFor: (name: string) => string;
  onPosition: (p: PlayPosition | null) => void;
  onBeat?: (accent: boolean) => void;
  /** Start from this part (section in play order). */
  fromPart?: number;
}

export interface Playback {
  stop(): void;
}

export function playChart(o: PlayOptions): Playback {
  const { ctx } = audio();
  const bpb = beatsPerBar(o.timeSignature);
  const beatSec = 60 / Math.max(30, o.bpm);

  // Flatten to a list of steps with absolute times.
  type Step = { t: number; step: StrumStep; shape: number[] | null; len: number; pos: PlayPosition; beatStart: boolean; accent: boolean };
  const steps: Step[] = [];
  let t = 0;
  o.order.forEach((sec, part) => {
    if (part < (o.fromPart ?? 0)) return;
    const pattern = sec.strum?.steps?.length ? sec.strum.steps : DEFAULT_STRUM;
    const perBeat = pattern.length / bpb;
    sec.bars.forEach((bar, bi) => {
      const total = bar.chords.reduce((s, c) => s + c.beats, 0) || bpb;
      const stepSec = (total * beatSec) / Math.max(1, Math.round(perBeat * total));
      const n = Math.max(1, Math.round(perBeat * total));
      for (let k = 0; k < n; k++) {
        const beatPos = k / perBeat;
        let acc = 0;
        let chord = bar.chords[0];
        for (const c of bar.chords) {
          if (beatPos >= acc && beatPos < acc + c.beats) {
            chord = c;
            break;
          }
          acc += c.beats;
        }
        const name = chord ? o.nameFor(chord.name) : NO_CHORD;
        const shape = name === NO_CHORD ? null : o.shapeFor(name);
        const step = pattern[k % pattern.length]!;
        steps.push({
          t: t + k * stepSec,
          step,
          shape,
          len: stepSec * 2.2,
          pos: { part, bar: bi, beat: Math.floor(beatPos) },
          beatStart: Math.abs(beatPos - Math.round(beatPos)) < 1e-6,
          accent: k === 0,
        });
      }
      t += total * beatSec;
    });
  });

  const start = ctx.currentTime + 0.12;
  let next = 0;
  let stopped = false;
  const shown: number[] = [];

  const tick = () => {
    if (stopped) return;
    const horizon = ctx.currentTime + 0.12;
    while (next < steps.length && start + steps[next]!.t < horizon) {
      const s = steps[next]!;
      const when = start + s.t;
      if (s.shape) strumStep(s.step, s.shape, o.tuning, o.capo, when, s.len, s.accent);
      if (s.beatStart) {
        const delay = Math.max(0, (when - ctx.currentTime) * 1000);
        const pos = s.pos;
        const accent = s.accent;
        shown.push(window.setTimeout(() => !stopped && (o.onPosition(pos), o.onBeat?.(accent)), delay));
      }
      next++;
    }
    if (next >= steps.length) {
      const endDelay = Math.max(0, (start + t - ctx.currentTime) * 1000);
      shown.push(window.setTimeout(() => !stopped && o.onPosition(null), endDelay));
      return;
    }
    timer = window.setTimeout(tick, 25);
  };
  let timer = window.setTimeout(tick, 0);

  return {
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      shown.forEach((id) => window.clearTimeout(id));
      o.onPosition(null);
    },
  };
}

/**
 * Plays a chord chart: strums each section's pattern at the version's tempo and reports where it is,
 * so the chart can highlight the bar and the light can breathe on the beat.
 * Uses a look-ahead scheduler (timing from the audio clock, not timers), so it stays in time.
 * Count-in, looping a section, the speed trainer and a click track are options here; backing tracks
 * (Phase 4) will be scheduled alongside.
 */
import { beatsPerBar, DEFAULT_STRUM, NO_CHORD } from "../core/chart";
import type { Section, StrumStep } from "../core/model";
import { patternForSection, stepsPerBar, stepsPerBeat, type Pattern, type Track } from "../core/drums";
import { schedulePattern } from "./drums";
import { audio, click, strumStep } from "./guitar";

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
  /** Play only these parts (inclusive) and repeat them until stopped. */
  loop?: { from: number; to: number };
  /** Tempo as a share of the version's tempo (0.5 = half speed). */
  speed?: number;
  /** Speed trainer: add this much speed each time the loop comes round, up to 1. */
  speedStep?: number;
  /** Raise the speed every this many times round (default 1). */
  speedEvery?: number;
  /** Stop raising at this speed (default 1 = the song's tempo). */
  speedTarget?: number;
  /** After this many loops at the target speed, stop by itself (0 = keep going). */
  stopAfterTargetLoops?: number;
  /** One bar of clicks before the first strum. */
  countIn?: boolean;
  /** A click on every beat under the strums. */
  clickTrack?: boolean;
  onLoop?: (speed: number, loop: number) => void;
  /** A backing track to play under the chords (each section uses its pattern). */
  track?: Track;
  /** Chord strums on or off (off = just the backing track and click). */
  guitar?: boolean;
}

export interface Playback {
  stop(): void;
}

export function playChart(o: PlayOptions): Playback {
  const { ctx } = audio();
  const bpb = beatsPerBar(o.timeSignature);
  type Step = { t: number; step: StrumStep; shape: number[] | null; len: number; pos: PlayPosition; beatStart: boolean; accent: boolean };
  type DrumBar = { t: number; pattern: Pattern; from: number; to: number; done?: boolean };

  /** One pass through the chosen parts at a speed; times start at 0. */
  const build = (speed: number) => {
    const beatSec = 60 / Math.max(20, o.bpm * speed);
    const steps: Step[] = [];
    const drumBars: DrumBar[] = [];
    let t = 0;
    const from = o.loop ? o.loop.from : (o.fromPart ?? 0);
    const to = o.loop ? o.loop.to : o.order.length - 1;
    o.order.forEach((sec, part) => {
      if (part < from || part > to) return;
      const pattern = sec.strum?.steps?.length ? sec.strum.steps : DEFAULT_STRUM;
      const perBeat = pattern.length / bpb;
      const pat = o.track ? patternForSection(o.track.content, sec.kind) : undefined;
      sec.bars.forEach((bar, bi) => {
        const total = bar.chords.reduce((s, c) => s + c.beats, 0) || bpb;
        if (pat && o.track) {
          const spb = stepsPerBar(o.track.timeSignature);
          const within = bi % Math.max(1, pat.bars);
          drumBars.push({ t, pattern: pat, from: within * spb, to: within * spb + spb });
        }
        const n = Math.max(1, Math.round(perBeat * total));
        const stepSec = (total * beatSec) / n;
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
          steps.push({
            t: t + k * stepSec,
            step: pattern[k % pattern.length]!,
            shape: name === NO_CHORD ? null : o.shapeFor(name),
            len: stepSec * 2.2,
            pos: { part, bar: bi, beat: Math.floor(beatPos) },
            beatStart: Math.abs(beatPos - Math.round(beatPos)) < 1e-6,
            accent: k === 0,
          });
        }
        t += total * beatSec;
      });
    });
    return { steps, drumBars, length: t, beatSec };
  };

  let speed = o.speed ?? 1;
  let pass = build(speed);
  let passStart = ctx.currentTime + 0.12;
  if (o.countIn) {
    for (let b = 0; b < bpb; b++) click(passStart + b * pass.beatSec, b === 0);
    passStart += bpb * pass.beatSec;
  }
  let next = 0;
  let loops = 0;
  let atTarget = 0;
  let stopped = false;
  const timers: number[] = [];
  const later = (when: number, fn: () => void) => timers.push(window.setTimeout(() => !stopped && fn(), Math.max(0, (when - ctx.currentTime) * 1000)));

  const tick = () => {
    if (stopped) return;
    const horizon = ctx.currentTime + 0.12;
    // drums for any bar that starts soon
    if (o.track)
      for (const d of pass.drumBars) {
        if (d.done) continue;
        const when = passStart + d.t;
        if (when >= horizon) break;
        d.done = true;
        schedulePattern(d.pattern, when, o.bpm * speed, stepsPerBeat(o.track.timeSignature), o.track.swing, d.from, d.to);
      }
    for (;;) {
      if (next >= pass.steps.length) {
        if (!o.loop) {
          later(passStart + pass.length, () => o.onPosition(null));
          return;
        }
        // next time round, a little faster if the speed trainer is on
        passStart += pass.length;
        loops++;
        const target = o.speedTarget ?? 1;
        if (o.speedStep && loops % Math.max(1, o.speedEvery ?? 1) === 0) speed = Math.min(target, Math.round((speed + o.speedStep) * 1000) / 1000);
        if (o.speedStep && o.stopAfterTargetLoops && speed >= target) {
          atTarget++;
          if (atTarget > o.stopAfterTargetLoops) {
            later(passStart, () => o.onPosition(null));
            return;
          }
        }
        pass = build(speed);
        next = 0;
        const sp = speed;
        const lp = loops;
        later(passStart, () => o.onLoop?.(sp, lp));
      }
      const s = pass.steps[next]!;
      const when = passStart + s.t;
      if (when >= horizon) break;
      if (s.shape && o.guitar !== false) strumStep(s.step, s.shape, o.tuning, o.capo, when, s.len, s.accent);
      if (s.beatStart) {
        if (o.clickTrack) click(when, s.accent && s.pos.beat === 0);
        const pos = s.pos;
        const accent = s.accent;
        later(when, () => (o.onPosition(pos), o.onBeat?.(accent)));
      }
      next++;
    }
    if (timers.length > 256) timers.splice(0, 128);
    timer = window.setTimeout(tick, 25);
  };
  let timer = window.setTimeout(tick, 0);

  return {
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      timers.forEach((id) => window.clearTimeout(id));
      o.onPosition(null);
    },
  };
}

/**
 * Metronome: clicks scheduled on the audio clock (look-ahead), so it stays in time even when the
 * screen is busy. Each beat has its own level (accent, normal, soft, silent), each beat can hold a
 * rhythm (eighths, triplets, gallop…), and tempo, accents and sound changes apply on the next beat.
 */
import { isSilentBar, type ClickSound, type Gap, type Hit, type Level } from "../core/metro";
import { audio } from "./guitar";
import { playDrum } from "./drums";

export interface MetronomeOptions {
  bpm: number;
  /** one level per beat of the bar */
  accents: Level[];
  /** the notes inside every beat */
  hits: Hit[];
  sound: ClickSound;
  /** 0..1 */
  volume: number;
  gap: Gap | null;
  /** chance (0..1) that a beat is left out at random */
  drop: number;
  /** called as each beat starts: its place in the bar, the bar number from 0, and whether it is silent */
  onBeat?: (beat: number, bar: number, silent: boolean) => void;
}

export interface Metronome {
  update(o: Partial<MetronomeOptions>): void;
  stop(): void;
}

export function startMetronome(initial: MetronomeOptions): Metronome {
  const { ctx } = audio();
  let o = { ...initial };
  let next = ctx.currentTime + 0.08;
  let beat = 0;
  let bar = 0;
  let stopped = false;
  const timers: number[] = [];

  const loop = () => {
    if (stopped) return;
    while (next < ctx.currentTime + 0.12) {
      if (beat >= Math.max(1, o.accents.length)) {
        beat = 0;
        bar++;
      }
      const level = o.accents[beat] ?? 2;
      const silent = isSilentBar(bar, o.gap) || level === 0 || (o.drop > 0 && Math.random() < o.drop);
      const dur = 60 / Math.max(20, o.bpm);
      if (!silent) for (const h of o.hits) tickSound(o.sound, next + h.at * dur, h.at === 0 ? level : 0, h.v, o.volume);
      const delay = Math.max(0, (next - ctx.currentTime) * 1000);
      const b = beat;
      const br = bar;
      timers.push(window.setTimeout(() => !stopped && o.onBeat?.(b, br, silent), delay));
      next += dur;
      beat++;
    }
    if (timers.length > 64) timers.splice(0, 32);
    timer = window.setTimeout(loop, 25);
  };
  let timer = window.setTimeout(loop, 0);

  return {
    update(p) {
      o = { ...o, ...p };
    },
    stop() {
      stopped = true;
      window.clearTimeout(timer);
      timers.forEach((t) => window.clearTimeout(t));
    },
  };
}

/** How loud each level is, relative to an accent. A note between beats (level 0) uses its own strength. */
const AMP: Record<number, number> = { 3: 1, 2: 0.72, 1: 0.45 };

/** One click. `level` 3/2/1 for a beat, 0 for a note between beats (strength `v`). */
export function tickSound(sound: ClickSound, when: number, level: number, v: number, volume: number): void {
  const sub = level === 0;
  const amp = (sub ? 0.5 * v : (AMP[level] ?? 0.72)) * volume;
  const accent = level === 3;
  switch (sound) {
    case "click":
      osc("sine", sub ? 900 : accent ? 1800 : level === 1 ? 1000 : 1200, when, 0.045, 0.42 * amp);
      break;
    case "wood": {
      const f = sub ? 700 : accent ? 1250 : level === 1 ? 800 : 950;
      osc("sine", f, when, 0.05, 0.6 * amp, f * 0.6);
      osc("triangle", f * 2.4, when, 0.012, 0.18 * amp);
      break;
    }
    case "beep":
      osc("sine", sub ? 660 : accent ? 1320 : level === 1 ? 660 : 880, when, 0.085, 0.4 * amp, undefined, true);
      break;
    case "hat":
      playDrum(accent ? "hatOpen" : "hatClosed", when, (sub ? 0.7 : accent ? 1.25 : 1) * amp * 1.3);
      break;
    case "cowbell": {
      const f = sub ? 470 : accent ? 640 : level === 1 ? 500 : 540;
      osc("square", f, when, 0.22, 0.12 * amp, undefined, false, 2000);
      osc("square", f * 1.48, when, 0.22, 0.12 * amp, undefined, false, 2000);
      break;
    }
    case "rim":
      playDrum("rim", when, (sub ? 0.7 : accent ? 1.3 : 1) * amp * 1.3);
      break;
    case "kit":
      if (accent) playDrum("kick", when, 0.9 * volume);
      else if (sub) playDrum("shaker", when, amp * 2);
      else playDrum("hatClosed", when, amp * 1.4);
      break;
  }
}

function osc(type: OscillatorType, freq: number, when: number, decay: number, peak: number, to?: number, flat = false, bandpass?: number) {
  const { ctx, out } = audio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, when);
  if (to) o.frequency.exponentialRampToValueAtTime(to, when + decay);
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.002);
  if (flat) g.gain.setValueAtTime(Math.max(0.0002, peak), when + decay * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  if (bandpass) {
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = bandpass;
    f.Q.value = 0.7;
    o.connect(f).connect(g).connect(out);
  } else o.connect(g).connect(out);
  o.start(when);
  o.stop(when + decay + 0.02);
}

/** Keeps the screen on while practising (where the browser allows it). */
export async function keepAwake(): Promise<() => void> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> } };
    const lock = await nav.wakeLock?.request("screen");
    return () => void lock?.release().catch(() => undefined);
  } catch {
    return () => undefined;
  }
}

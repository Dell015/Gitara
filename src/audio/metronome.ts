/**
 * Metronome: clicks scheduled on the audio clock (look-ahead), so it stays in time even when the
 * screen is busy. Accent on beat one, optional subdivisions, tempo changes apply on the next beat.
 */
import { audio, click } from "./guitar";

export interface MetronomeOptions {
  bpm: number;
  beatsPerBar: number;
  /** 1 = quarter notes, 2 = eighths, 3 = triplets, 4 = sixteenths */
  subdivision: number;
  accent: boolean;
  onBeat?: (beat: number) => void;
}

export interface Metronome {
  update(o: Partial<MetronomeOptions>): void;
  stop(): void;
}

export function startMetronome(initial: MetronomeOptions): Metronome {
  const { ctx } = audio();
  let o = { ...initial };
  let next = ctx.currentTime + 0.08;
  let tick = 0; // counts subdivisions
  let stopped = false;
  const timers: number[] = [];

  const loop = () => {
    if (stopped) return;
    while (next < ctx.currentTime + 0.12) {
      const sub = Math.max(1, o.subdivision);
      const beatIndex = Math.floor(tick / sub) % Math.max(1, o.beatsPerBar);
      const onBeat = tick % sub === 0;
      if (onBeat) {
        click(next, o.accent && beatIndex === 0);
        const delay = Math.max(0, (next - ctx.currentTime) * 1000);
        const b = beatIndex;
        timers.push(window.setTimeout(() => !stopped && o.onBeat?.(b), delay));
      } else {
        subClick(next);
      }
      next += 60 / Math.max(20, o.bpm) / sub;
      tick++;
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

function subClick(when: number) {
  const { ctx, out } = audio();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = 900;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(0.1, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.03);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + 0.04);
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

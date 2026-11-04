/**
 * Synthesized drum kit (no samples: tiny, offline, no licensing). Each sound is a few oscillators
 * or filtered noise shaped by an envelope. Real sample packs can replace these later.
 */
import type { DrumSound, Pattern } from "../core/drums";
import { audio } from "./guitar";

let noiseBuf: AudioBuffer | null = null;
function noise(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate * 1;
  noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

let bus: GainNode | null = null;
function drumBus(): { ctx: AudioContext; out: GainNode } {
  const { ctx, out } = audio();
  if (!bus || bus.context !== ctx) {
    bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(out);
  }
  return { ctx, out: bus };
}

function env(ctx: AudioContext, when: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  return g;
}

function noiseHit(when: number, vel: number, type: BiquadFilterType, freq: number, q: number, decay: number) {
  const { ctx, out } = drumBus();
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = env(ctx, when, vel, decay);
  src.connect(f).connect(g).connect(out);
  src.start(when, Math.random() * 0.5);
  src.stop(when + decay + 0.05);
}

function toneHit(when: number, vel: number, from: number, to: number, decay: number, type: OscillatorType = "sine") {
  const { ctx, out } = drumBus();
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, when);
  o.frequency.exponentialRampToValueAtTime(to, when + decay * 0.6);
  const g = env(ctx, when, vel, decay);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + decay + 0.05);
}

export function playDrum(sound: DrumSound, when: number, velocity = 1): void {
  const v = Math.min(1.3, velocity);
  switch (sound) {
    case "kick":
      toneHit(when, 0.95 * v, 140, 42, 0.42);
      noiseHit(when, 0.08 * v, "lowpass", 1200, 0.7, 0.02);
      break;
    case "snare":
      toneHit(when, 0.32 * v, 240, 170, 0.12, "triangle");
      noiseHit(when, 0.5 * v, "highpass", 1400, 0.7, 0.2);
      break;
    case "rim":
      toneHit(when, 0.35 * v, 1700, 1500, 0.04, "square");
      noiseHit(when, 0.12 * v, "bandpass", 3000, 2, 0.03);
      break;
    case "clap":
      for (const d of [0, 0.011, 0.023]) noiseHit(when + d, 0.32 * v, "bandpass", 1500, 1.4, d === 0.023 ? 0.16 : 0.03);
      break;
    case "hatClosed":
      noiseHit(when, 0.26 * v, "highpass", 7500, 0.8, 0.045);
      break;
    case "hatOpen":
      noiseHit(when, 0.22 * v, "highpass", 7000, 0.8, 0.32);
      break;
    case "tomLow":
      toneHit(when, 0.6 * v, 130, 85, 0.36);
      break;
    case "tomHigh":
      toneHit(when, 0.55 * v, 210, 150, 0.28);
      break;
    case "shaker":
      noiseHit(when, 0.16 * v, "bandpass", 6000, 1.2, 0.06);
      break;
    case "crash":
      noiseHit(when, 0.3 * v, "highpass", 4500, 0.5, 1.4);
      break;
  }
}

/**
 * Schedules one pass of a pattern starting at `when`. Returns the pass length in seconds.
 * Swing pushes every second step late by up to a third of a step pair.
 */
export function schedulePattern(p: Pattern, when: number, bpm: number, stepsPerBeat: number, swing: number, fromStep = 0, toStep?: number): number {
  const stepSec = 60 / bpm / stepsPerBeat;
  const n = p.lanes[0]?.steps.length ?? 0;
  const end = Math.min(n, toStep ?? n);
  for (let i = fromStep; i < end; i++) {
    const offset = i % 2 === 1 ? swing * stepSec * 0.66 : 0;
    const t = when + (i - fromStep) * stepSec + offset;
    for (const l of p.lanes) {
      const v = l.steps[i] ?? 0;
      if (v > 0 && !l.muted) playDrum(l.sound, t, v * l.volume);
    }
  }
  return (end - fromStep) * stepSec;
}

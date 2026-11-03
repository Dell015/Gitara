/**
 * A synthesized acoustic guitar (Karplus–Strong plucked string), so chords and strums can be heard
 * offline with no sample downloads. Good enough to check a chord or a pattern; real samples later.
 *
 * Browsers only allow sound after a tap, so the audio engine starts on the first play.
 */
import type { StrumStep } from "../core/model";

let ctx: AudioContext | null = null;
let out: GainNode | null = null;
const buffers = new Map<number, AudioBuffer>();

export function audio(): { ctx: AudioContext; out: GainNode } {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC({ latencyHint: "interactive" });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 5200;
    out = ctx.createGain();
    out.gain.value = 0.7;
    out.connect(tone).connect(comp).connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: out! };
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** One plucked string, rendered once per pitch and reused. */
function pluckBuffer(midi: number): AudioBuffer {
  const hit = buffers.get(midi);
  if (hit) return hit;
  const { ctx } = audio();
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2.4);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const period = Math.max(2, Math.round(sr / mtof(midi)));
  const ring = new Float32Array(period);
  // a slightly filtered noise burst = the pick hitting the string
  let prev = 0;
  for (let i = 0; i < period; i++) {
    const n = Math.random() * 2 - 1;
    prev = prev * 0.5 + n * 0.5;
    ring[i] = prev;
  }
  // higher notes die faster on a real guitar
  const decay = 0.996 - Math.min(0.006, (midi - 40) * 0.00012);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const a = ring[idx]!;
    const b = ring[(idx + 1) % period]!;
    const v = (a + b) * 0.5 * decay;
    ring[idx] = v;
    data[i] = a;
    idx = (idx + 1) % period;
  }
  // soft attack so there's no click
  for (let i = 0; i < 64 && i < len; i++) data[i]! *= i / 64;
  buffers.set(midi, buf);
  return buf;
}

function playNote(midi: number, when: number, gain: number, length: number) {
  const { ctx, out } = audio();
  const src = ctx.createBufferSource();
  src.buffer = pluckBuffer(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, when);
  // let it ring for `length`, then damp quickly (the next strum stops the strings)
  g.gain.setTargetAtTime(0, when + length, 0.04);
  src.connect(g).connect(out);
  src.start(when);
  src.stop(when + length + 0.4);
}

/** Damped "chick" for a muted strum (x). */
function playMute(when: number) {
  const { ctx, out } = audio();
  const len = Math.floor(ctx.sampleRate * 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3) * 0.6;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass";
  f.frequency.value = 1800;
  src.connect(f).connect(out);
  src.start(when);
}

export interface StrumOptions {
  direction?: "D" | "U";
  when?: number;
  /** How long the strings ring before they're damped, in seconds. */
  length?: number;
  velocity?: number;
}

/** Strums a shape. frets: lowest string first, -1 muted. Capo raises every string. */
export function strum(frets: number[], tuning: readonly number[], capo: number, o: StrumOptions = {}): void {
  const { ctx } = audio();
  const when = o.when ?? ctx.currentTime + 0.01;
  const dir = o.direction ?? "D";
  const strings = frets.map((f, i) => ({ f, i })).filter((s) => s.f >= 0);
  if (dir === "U") strings.reverse();
  // up-strums hit fewer, higher strings, a little quieter
  const used = dir === "U" ? strings.slice(0, Math.min(strings.length, 4)) : strings;
  const gap = dir === "U" ? 0.009 : 0.013;
  const vel = (o.velocity ?? 1) * (dir === "U" ? 0.7 : 1);
  used.forEach((s, k) => playNote(tuning[s.i]! + capo + s.f, when + k * gap, 0.32 * vel, o.length ?? 1.6));
}

export function strumStep(step: StrumStep, frets: number[], tuning: readonly number[], capo: number, when: number, length: number, accent = false): void {
  if (step === "-") return;
  if (step === "x") return playMute(when);
  strum(frets, tuning, capo, { direction: step, when, length, velocity: accent ? 1.1 : 0.9 });
}

/** A short click for counting in (Phase 3 brings the full metronome). */
export function click(when: number, accent: boolean): void {
  const { ctx, out } = audio();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.value = accent ? 1800 : 1200;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(accent ? 0.4 : 0.25, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  o.connect(g).connect(out);
  o.start(when);
  o.stop(when + 0.06);
}

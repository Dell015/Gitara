/**
 * Microphone input for the tuner. Asked for only when the tuner opens (never at start-up).
 * Echo cancellation and noise suppression are switched off: they bend a guitar's pitch.
 */
import { detectPitch } from "../core/pitch";
import { audio } from "./guitar";

export type MicState = "idle" | "asking" | "listening" | "denied" | "unavailable" | "insecure";

export interface Listener {
  stop(): void;
}

/**
 * Opens the microphone and the audio engine. The engine is created and woken inside the tap, before we wait
 * for the permission prompt: phones (iPhone above all) only let audio run if it starts straight from a tap, and
 * a context made after the prompt stays silent. Throws "insecure" when the page isn't on https (or localhost),
 * which is the one case where the browser hides the microphone completely.
 */
async function openMic(): Promise<{ ctx: AudioContext; stream: MediaStream }> {
  if (!window.isSecureContext) throw new Error("insecure");
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
  const { ctx } = audio();
  void ctx.resume().catch(() => undefined);
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  if (ctx.state !== "running") await ctx.resume().catch(() => undefined);
  return { ctx, stream };
}

/** Which screen message fits an error from opening the microphone. */
export function micStateFor(e: unknown): MicState {
  const text = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  if (/insecure/i.test(text)) return "insecure";
  if (/denied|NotAllowed|Permission/i.test(text)) return "denied";
  return "unavailable";
}

export async function listen(onPitch: (hz: number | null, level: number) => void): Promise<Listener> {
  const { ctx, stream } = await openMic();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 4096;
  src.connect(an);
  const buf = new Float32Array(an.fftSize);
  let raf = 0;
  let last = 0;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    if (t - last < 45) return; // ~20 readings a second is plenty
    last = t;
    an.getFloatTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i += 8) peak = Math.max(peak, Math.abs(buf[i]!));
    onPitch(detectPitch(buf, ctx.sampleRate), peak);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      src.disconnect();
      stream.getTracks().forEach((tr) => tr.stop());
    },
  };
}

/**
 * Chord listening: like `listen`, but hands over the whole spectrum (in decibels) ten times a second
 * instead of a single pitch, so several notes at once can be read. Same mic rules as the tuner.
 */
export async function listenSpectrum(onFrame: (db: Float32Array, sampleRate: number, level: number) => void): Promise<Listener> {
  const { ctx, stream } = await openMic();
  const src = ctx.createMediaStreamSource(stream);
  const an = ctx.createAnalyser();
  an.fftSize = 16384; // fine enough to tell neighbouring low notes apart (about 3 Hz per step)
  an.smoothingTimeConstant = 0.4;
  src.connect(an);
  const spectrum = new Float32Array(an.frequencyBinCount);
  const wave = new Float32Array(2048);
  let raf = 0;
  let last = 0;
  const frame = (t: number) => {
    raf = requestAnimationFrame(frame);
    if (t - last < 100) return;
    last = t;
    an.getFloatFrequencyData(spectrum);
    an.getFloatTimeDomainData(wave);
    let peak = 0;
    for (let i = 0; i < wave.length; i += 4) peak = Math.max(peak, Math.abs(wave[i]!));
    onFrame(spectrum, ctx.sampleRate, peak);
  };
  raf = requestAnimationFrame(frame);
  return {
    stop() {
      cancelAnimationFrame(raf);
      src.disconnect();
      stream.getTracks().forEach((tr) => tr.stop());
    },
  };
}

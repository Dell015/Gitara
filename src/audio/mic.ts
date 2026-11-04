/**
 * Microphone input for the tuner. Asked for only when the tuner opens (never at start-up).
 * Echo cancellation and noise suppression are switched off: they bend a guitar's pitch.
 */
import { detectPitch } from "../core/pitch";
import { audio } from "./guitar";

export type MicState = "idle" | "asking" | "listening" | "denied" | "unavailable";

export interface Listener {
  stop(): void;
}

export async function listen(onPitch: (hz: number | null, level: number) => void): Promise<Listener> {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("unavailable");
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const { ctx } = audio();
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

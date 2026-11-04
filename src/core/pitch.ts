/**
 * Pitch detection for the tuner: autocorrelation with parabolic interpolation (the "ACF2+" method),
 * which is steady for a plucked guitar string. Pure maths; tested with synthetic tones.
 */

/** Returns the frequency in Hz, or null if the signal is too quiet or has no clear pitch. */
export function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const n = buf.length;
  let rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i]! * buf[i]!;
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return null;

  // trim quiet edges so the correlation sees the steady part
  const thr = 0.2;
  let r1 = 0;
  let r2 = n - 1;
  for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]!) < thr) { r1 = i; break; }
  for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]!) < thr) { r2 = n - i; break; }
  const x = buf.subarray(r1, r2);
  const m = x.length;
  if (m < 64) return null;

  // only search lags for 60 Hz … 1400 Hz (below low B on a 7-string, above any open-string harmonic we need)
  const minLag = Math.floor(sampleRate / 1400);
  const maxLag = Math.min(m - 1, Math.ceil(sampleRate / 60));
  const c = new Float32Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i < m - lag; i++) s += x[i]! * x[i + lag]!;
    c[lag] = s;
  }
  // skip the first descent, then take the highest peak
  let d = 0;
  while (d < maxLag && c[d]! > c[d + 1]!) d++;
  let best = -1;
  let bestVal = -Infinity;
  for (let i = Math.max(d, minLag); i <= maxLag; i++) {
    if (c[i]! > bestVal) {
      bestVal = c[i]!;
      best = i;
    }
  }
  if (best <= 0 || bestVal < c[0]! * 0.3) return null;
  // parabolic interpolation around the peak
  const a = c[best - 1] ?? c[best]!;
  const b = c[best]!;
  const g = c[best + 1] ?? c[best]!;
  const shift = (a - g) / (2 * (a - 2 * b + g) || 1);
  return sampleRate / (best + (Number.isFinite(shift) ? shift : 0));
}

export const midiFromFreq = (f: number, a4 = 440) => 69 + 12 * Math.log2(f / a4);
export const freqFromMidi = (m: number, a4 = 440) => a4 * Math.pow(2, (m - 69) / 12);

/** Nearest note and how far off it is, in cents (−50…+50). */
export function nearest(f: number, a4 = 440): { midi: number; cents: number } {
  const m = midiFromFreq(f, a4);
  const midi = Math.round(m);
  return { midi, cents: Math.round((m - midi) * 100) };
}

/** Which string of a tuning a frequency is closest to, and the cents from that string's note. */
export function nearestString(f: number, tuning: readonly number[], a4 = 440): { string: number; cents: number } {
  const m = midiFromFreq(f, a4);
  let best = 0;
  for (let i = 1; i < tuning.length; i++) if (Math.abs(m - tuning[i]!) < Math.abs(m - tuning[best]!)) best = i;
  return { string: best, cents: Math.round((m - tuning[best]!) * 100) };
}

/** A small radix-2 FFT. Used to test the chord listener with synthetic sound (the browser does this for the live mic). */
export function fftMagnitudes(input: Float32Array): Float32Array {
  const n = input.length;
  if (n & (n - 1)) throw new Error("length must be a power of two");
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  // Hann window
  for (let i = 0; i < n; i++) re[i] = input[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  const out = new Float32Array(n / 2);
  for (let k = 0; k < n / 2; k++) out[k] = Math.hypot(re[k]!, im[k]!) / n;
  return out;
}

/** Magnitudes → decibels, the way an AnalyserNode reports them. */
export const toDb = (mags: Float32Array): Float32Array => mags.map((m) => 20 * Math.log10(m + 1e-12));

/**
 * Tap tempo: tap along with a song to get its BPM. Uses the last few taps; a pause longer than
 * `resetMs` starts over, so a stray tap never drags the average.
 */
export class TapTempo {
  private taps: number[] = [];
  constructor(
    private readonly keep = 6,
    private readonly resetMs = 2000,
  ) {}

  /** Record a tap at time `t` (ms). Returns the BPM once there are two taps, else null. */
  tap(t: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && t - last > this.resetMs) this.taps = [];
    this.taps.push(t);
    if (this.taps.length > this.keep) this.taps.shift();
    if (this.taps.length < 2) return null;
    const span = this.taps[this.taps.length - 1]! - this.taps[0]!;
    const avg = span / (this.taps.length - 1);
    return Math.round(Math.min(400, Math.max(20, 60000 / avg)));
  }

  reset(): void {
    this.taps = [];
  }

  get count(): number {
    return this.taps.length;
  }
}

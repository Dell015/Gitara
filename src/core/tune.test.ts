import { describe, expect, it } from "vitest";
import { TuneTracker } from "./tune";

const STD = [40, 45, 50, 55, 59, 64];
const hzOf = (midi: number, cents = 0) => 440 * Math.pow(2, (midi - 69 + cents / 100) / 12);
const feed = (t: TuneTracker, hz: number | null, n: number, start = 0, step = 45) => {
  let r = null;
  for (let i = 0; i < n; i++) r = t.update(hz, start + i * step);
  return r;
};

describe("tuner tracker", () => {
  it("names the string and reports how far off it is", () => {
    const r = feed(new TuneTracker(STD), hzOf(45, -20), 6)!;
    expect(r.string).toBe(1);
    expect(r.cents).toBe(-20);
    expect(r.inTune).toBe(false);
    expect(r.held).toBe(false);
  });
  it("calls it in tune only after it has stayed there", () => {
    const t = new TuneTracker(STD);
    expect(feed(t, hzOf(50, 2), 3)!.inTune).toBe(false);
    expect(feed(t, hzOf(50, 2), 3, 200)!.inTune).toBe(true);
    expect(feed(t, hzOf(50, 15), 2, 400)!.inTune).toBe(false);
  });
  it("ignores a single octave blip but follows a real change", () => {
    const t = new TuneTracker(STD);
    feed(t, hzOf(45), 5);
    const blip = t.update(hzOf(57), 300)!;
    expect(blip.string).toBe(1);
    expect(blip.held).toBe(true);
    t.update(hzOf(57), 345);
    const after = feed(t, hzOf(57), 3, 400)!;
    expect(after.hz).toBeGreaterThan(200);
  });
  it("keeps the last reading for a moment after the string dies away, then clears", () => {
    const t = new TuneTracker(STD, 440, null, 1200);
    feed(t, hzOf(40, -8), 5, 0);
    const held = t.update(null, 600)!;
    expect(held.held).toBe(true);
    expect(held.cents).toBe(-8);
    expect(t.update(null, 2000)).toBeNull();
  });
  it("a locked string measures against that string, however far away you are", () => {
    const t = new TuneTracker(STD, 440, 0);
    const r = feed(t, hzOf(40, -45), 5)!;
    expect(r.string).toBe(0);
    expect(r.cents).toBe(-45);
  });
  it("follows the chosen tuning and reference pitch", () => {
    const t = new TuneTracker([38, 45, 50, 55, 59, 64], 442);
    const r = feed(t, 442 * Math.pow(2, (38 - 69) / 12), 5)!;
    expect(r.string).toBe(0);
    expect(Math.abs(r.cents)).toBeLessThanOrEqual(1);
  });
});

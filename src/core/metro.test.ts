import { describe, expect, it } from "vitest";
import { accentsForConfig, applySetup, DEFAULT_CONFIG, defaultAccents, isSilentBar, meterBeats, meterGroupings, METERS, nextLevel, RHYTHMS, sanitizeConfig, SETUPS, tempoWord } from "./metro";

describe("metronome meters", () => {
  it("groupings add up to the number of clicks", () => {
    for (const m of METERS)
      for (const eighths of [false, true]) {
        const beats = meterBeats(m.id, eighths);
        for (const g of meterGroupings(m.id, eighths)) expect(g.reduce((a, b) => a + b, 0)).toBe(beats);
      }
  });
  it("6/8 is two beats, or six eighths grouped 3+3", () => {
    expect(meterBeats("6/8")).toBe(2);
    expect(meterBeats("6/8", true)).toBe(6);
    expect(meterGroupings("6/8", true)).toEqual([[3, 3]]);
  });
  it("accents: first beat strongest, group starts next, plain meters keep normal beats", () => {
    expect(defaultAccents([4])).toEqual([3, 2, 2, 2]);
    expect(defaultAccents([2, 2, 3])).toEqual([3, 1, 2, 1, 2, 1, 1]);
  });
  it("tapping a pad cycles accent, normal, soft, silent and back", () => {
    expect([3, 2, 1, 0].map((l) => nextLevel(l as 0 | 1 | 2 | 3))).toEqual([2, 1, 0, 3]);
  });
});

describe("metronome rhythms", () => {
  it("every hit sits inside its beat, in order", () => {
    for (const r of RHYTHMS) {
      expect(r.hits.length).toBeGreaterThan(0);
      r.hits.forEach((x, i) => {
        expect(x.at).toBeGreaterThanOrEqual(0);
        expect(x.at).toBeLessThan(1);
        if (i) expect(x.at).toBeGreaterThan(r.hits[i - 1]!.at);
      });
    }
  });
});

describe("silent bars", () => {
  it("plays N bars then rests M", () => {
    const gap = { play: 3, mute: 1 };
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((b) => isSilentBar(b, gap))).toEqual([false, false, false, true, false, false, false, true]);
    expect(isSilentBar(5, null)).toBe(false);
  });
});

describe("metronome settings", () => {
  it("tempo words", () => {
    expect(tempoWord(72)).toBe("Adagio");
    expect(tempoWord(120)).toBe("Allegro");
  });
  it("bad saved data falls back to safe values", () => {
    const c = sanitizeConfig({ bpm: 9999, meter: "13/16", accents: [9, 9], rhythm: "nope", volume: 5, drop: 0.7 } as never);
    expect(c.bpm).toBe(300);
    expect(c.meter).toBe("4/4");
    expect(c.accents).toEqual([3, 2, 2, 2]);
    expect(c.rhythm).toBe("beat");
    expect(c.volume).toBe(1);
    expect(c.drop).toBe(0);
    expect(sanitizeConfig(null)).toEqual({ ...DEFAULT_CONFIG, accents: accentsForConfig(DEFAULT_CONFIG) });
  });
  it("every setup gives a valid config with one accent per beat", () => {
    for (const s of SETUPS) {
      const c = applySetup(DEFAULT_CONFIG, s);
      expect(c.accents.length).toBe(meterBeats(c.meter, c.eighths, c.custom));
      expect(c.rhythm).toBe(s.set.rhythm ?? "beat");
    }
  });
  it("a setup clears the previous gap and drop-outs", () => {
    const c = applySetup({ ...DEFAULT_CONFIG, gap: { play: 1, mute: 1 }, drop: 0.5 }, SETUPS.find((s) => s.id === "warm")!);
    expect(c.gap).toBeNull();
    expect(c.drop).toBe(0);
  });
});

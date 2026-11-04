import { describe, expect, it } from "vitest";
import { patternForSection, PRESETS, presetPattern, resizePattern, stepsPerBar } from "./drums";

describe("backing tracks", () => {
  it("steps per bar follow the time signature", () => {
    expect(stepsPerBar("4/4")).toBe(16);
    expect(stepsPerBar("3/4")).toBe(12);
    expect(stepsPerBar("6/8")).toBe(12);
  });
  it("every built-in groove is exactly one bar long", () => {
    for (const p of PRESETS) for (const l of p.lanes) expect(l.steps.length).toBe(stepsPerBar(p.timeSignature));
  });
  it("lengthening a pattern repeats it; shortening keeps the start", () => {
    const one = presetPattern(PRESETS[0]!, "a", "A", 1);
    const two = resizePattern(one, "4/4", 2);
    expect(two.lanes[0]!.steps).toEqual([...one.lanes[0]!.steps, ...one.lanes[0]!.steps]);
    expect(resizePattern(two, "4/4", 1).lanes[0]!.steps).toEqual(one.lanes[0]!.steps);
  });
  it("sections use their own pattern, else the first", () => {
    const a = presetPattern(PRESETS[0]!, "a", "A", 1);
    const b = presetPattern(PRESETS[1]!, "b", "B", 1);
    const c = { patterns: [a, b], sectionPatterns: { chorus: "b" as const } };
    expect(patternForSection(c, "chorus")!.id).toBe("b");
    expect(patternForSection(c, "verse")!.id).toBe("a");
  });
});

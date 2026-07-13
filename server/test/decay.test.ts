import { describe, expect, it } from "vitest";
import {
  HALF_LIFE_DAYS,
  OBSERVER_MULTIPLIER,
  PRUNE_THRESHOLD,
  deterministicRoll,
  recallProbability,
  recallState,
} from "../src/engine/decay.js";

describe("recallProbability", () => {
  it("is 1.0 for a fresh participated memory", () => {
    expect(recallProbability(0, true)).toBeCloseTo(1.0, 10);
  });

  it("halves after one half-life", () => {
    expect(recallProbability(HALF_LIFE_DAYS, true)).toBeCloseTo(0.5, 10);
    expect(recallProbability(HALF_LIFE_DAYS * 2, true)).toBeCloseTo(0.25, 10);
  });

  it("decays observer memories faster by the flat multiplier", () => {
    for (const age of [0, 10, 45]) {
      expect(recallProbability(age, false)).toBeCloseTo(
        recallProbability(age, true) * OBSERVER_MULTIPLIER,
        10,
      );
    }
  });

  it("never increases with age", () => {
    let prev = Infinity;
    for (let d = 0; d <= 365; d += 5) {
      const p = recallProbability(d, true);
      expect(p).toBeLessThanOrEqual(prev);
      prev = p;
    }
  });

  it("clamps negative ages to fresh", () => {
    expect(recallProbability(-5, true)).toBeCloseTo(1.0, 10);
  });
});

describe("deterministicRoll", () => {
  it("is deterministic for the same memory and day", () => {
    expect(deterministicRoll("mem-1", "2026-07-12")).toBe(deterministicRoll("mem-1", "2026-07-12"));
  });

  it("differs across memories and across days", () => {
    expect(deterministicRoll("mem-1", "2026-07-12")).not.toBe(
      deterministicRoll("mem-2", "2026-07-12"),
    );
    expect(deterministicRoll("mem-1", "2026-07-12")).not.toBe(
      deterministicRoll("mem-1", "2026-07-13"),
    );
  });

  it("stays within [0, 1)", () => {
    for (let i = 0; i < 200; i++) {
      const r = deterministicRoll(`mem-${i}`, "2026-07-12");
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });
});

describe("recallState", () => {
  const daysAgo = (n: number, from: Date) => new Date(from.getTime() - n * 86_400_000);

  it("always recalls a fresh participated memory (p = 1)", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    for (let i = 0; i < 50; i++) {
      expect(recallState(`mem-${i}`, daysAgo(0, now), true, now)).toBe("recalled");
    }
  });

  it("fully forgets once probability drops below the prune threshold", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    // p = exp(-ln2 * 200/30) ≈ 0.0098 < 0.02
    expect(recallProbability(200, true)).toBeLessThan(PRUNE_THRESHOLD);
    expect(recallState("mem-x", daysAgo(200, now), true, now)).toBe("forgotten");
  });

  it("gives a stable answer within the same day", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    const later = new Date("2026-07-12T23:00:00Z");
    for (let i = 0; i < 50; i++) {
      const created = daysAgo(40, now);
      expect(recallState(`mem-${i}`, created, false, now)).toBe(
        recallState(`mem-${i}`, created, false, later),
      );
    }
  });

  it("recalls observer memories roughly half as often as participated ones at the same age", () => {
    const now = new Date("2026-07-12T12:00:00Z");
    const created = daysAgo(1, now);
    let participated = 0;
    let observed = 0;
    for (let i = 0; i < 500; i++) {
      if (recallState(`mem-${i}`, created, true, now) === "recalled") participated++;
      if (recallState(`mem-${i}`, created, false, now) === "recalled") observed++;
    }
    expect(participated).toBeGreaterThan(450); // p ≈ 0.977 → ~489 of 500
    expect(observed).toBeGreaterThan(170);     // p ≈ 0.489 → ~244 of 500, ± hash noise
    expect(observed).toBeLessThan(320);
  });
});

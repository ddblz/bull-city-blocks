import { describe, expect, it } from "vitest";
import { mean, quantile, wilson } from "./stats";

describe("stats", () => {
  it.each([
    // Reference values; 81/263 is Newcombe's (1998) worked example.
    [0, 10, 0, 0.2775],
    [5, 10, 0.2366, 0.7634],
    [10, 10, 0.7225, 1],
    [81, 263, 0.2553, 0.3662],
    [1, 1000, 0.0002, 0.0056],
  ])("§6 Wilson 95%% interval for %i/%i is [%f, %f]", (k, n, low, high) => {
    const e = wilson(k, n);
    expect(e.value).toBeCloseTo(k / n, 10);
    expect(e.low).toBeCloseTo(low, 4);
    expect(e.high).toBeCloseTo(high, 4);
  });

  it("Wilson with no trials is all zeros", () => {
    expect(wilson(0, 0)).toEqual({ value: 0, low: 0, high: 0 });
  });

  it("mean has a normal-approximation 95% interval", () => {
    const e = mean([2, 4, 4, 4, 5, 5, 7, 9]); // sample sd = 2.138
    expect(e.value).toBe(5);
    expect(e.high - e.value).toBeCloseTo((1.96 * 2.13809) / Math.sqrt(8), 2);
    expect(mean([3])).toEqual({ value: 3, low: 3, high: 3 });
  });

  it("quantile uses the nearest rank", () => {
    const xs = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
    expect([quantile(xs, 0.5), quantile(xs, 0.9), quantile(xs, 1), quantile([], 0.5)]).toEqual([
      5, 9, 10, 0,
    ]);
  });
});

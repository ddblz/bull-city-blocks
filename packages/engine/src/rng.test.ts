import { describe, expect, it } from "vitest";
import { nextUint32, randomInt, seedRng, shuffle } from "./rng";

describe("rng", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    expect(nextUint32(seedRng("a"))).toEqual(nextUint32(seedRng("a")));
    expect(nextUint32(seedRng("a")).value).not.toBe(nextUint32(seedRng("b")).value);
  });

  it("randomInt stays in range and covers it", () => {
    let rng = seedRng("range");
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const r = randomInt(rng, 6);
      rng = r.rng;
      seen.add(r.value);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("shuffle is a permutation and does not mutate its input", () => {
    const input = Array.from({ length: 50 }, (_, i) => i);
    const { value } = shuffle(seedRng("s"), input);
    expect(input).toEqual(Array.from({ length: 50 }, (_, i) => i));
    expect([...value].sort((a, b) => a - b)).toEqual(input);
    expect(value).not.toEqual(input);
  });
});

/**
 * Seeded PRNG kept in game state: sfc32, seeded by hashing the seed string with cyrb128.
 * Pure: every call takes the RNG state and returns the next one. Never use Math.random.
 */
export type RngState = readonly [number, number, number, number];

export function seedRng(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** Next 32-bit unsigned integer. */
export function nextUint32([a, b, c, d]: RngState): { value: number; rng: RngState } {
  const nd = (d + 1) | 0;
  const t = (((a + b) | 0) + nd) | 0;
  const na = b ^ (b >>> 9);
  const nb = (c + (c << 3)) | 0;
  const nc = (((c << 21) | (c >>> 11)) + t) | 0;
  return { value: t >>> 0, rng: [na >>> 0, nb >>> 0, nc >>> 0, nd >>> 0] };
}

/** Uniform integer in [0, n). */
export function randomInt(rng: RngState, n: number): { value: number; rng: RngState } {
  const next = nextUint32(rng);
  return { value: Math.floor((next.value / 2 ** 32) * n), rng: next.rng };
}

/** Fisher–Yates shuffle. Returns a new array; the input is not modified. */
export function shuffle<T>(rng: RngState, items: readonly T[]): { value: T[]; rng: RngState } {
  const out = [...items];
  let state = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const r = randomInt(state, i + 1);
    state = r.rng;
    [out[i], out[r.value]] = [out[r.value] as T, out[i] as T];
  }
  return { value: out, rng: state };
}

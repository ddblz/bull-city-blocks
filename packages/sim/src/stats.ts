/** Small statistics helpers for the simulator (SPEC §6: 95% confidence intervals). */

export interface Estimate {
  value: number;
  low: number;
  high: number;
}

const Z95 = 1.959963984540054;

/** Wilson score interval for a rate of `k` successes in `n` trials. */
export function wilson(k: number, n: number, z = Z95): Estimate {
  if (n === 0) return { value: 0, low: 0, high: 0 };
  const p = k / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return { value: p, low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Mean with a normal-approximation 95% interval. */
export function mean(xs: readonly number[]): Estimate {
  const n = xs.length;
  if (n === 0) return { value: 0, low: 0, high: 0 };
  const m = xs.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : 0;
  const half = (Z95 * sd) / Math.sqrt(n);
  return { value: m, low: m - half, high: m + half };
}

/** The q-quantile (0–1) by the nearest-rank method; 0 for no data. */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(q * sorted.length) - 1)] as number;
}

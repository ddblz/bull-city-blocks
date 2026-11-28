/** WCAG 2.1 contrast, for the colour tokens and the district colours (#56). Pure; hex colours only. */

/** Relative luminance of `#rgb` or `#rrggbb`. */
export function luminance(hex: string): number {
  const h = hex.trim().replace(/^#/, "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = Number.parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colours, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WHITE = "#ffffff";
/** The page's dark text colour (`--on-surface` in light mode). */
export const INK = "#1c1c18";

/** The more readable of white and ink text on `background`. */
export const textOn = (background: string): string =>
  contrast(background, WHITE) >= contrast(background, INK) ? WHITE : INK;

/** WCAG AA for normal text. */
export const AA = 4.5;

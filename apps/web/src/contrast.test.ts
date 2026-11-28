import { describe, expect, it } from "vitest";
import { AA, contrast, INK, luminance, textOn, WHITE } from "./contrast";
import tokens from "./tokens.css?raw";

describe("contrast (#56)", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 1); // the classic just-fails-AA grey
    expect(contrast("#767676", "#ffffff")).toBeCloseTo(4.54, 1); // and the grey that just passes
    expect(luminance("#fff")).toBeCloseTo(1, 5);
    expect(luminance("#000")).toBe(0);
  });

  it("is symmetric, and rejects things that aren't hex colours", () => {
    expect(contrast("#a6331b", "#fcf9f3")).toBe(contrast("#fcf9f3", "#a6331b"));
    expect(() => luminance("red")).toThrow(/not a hex colour/);
    expect(() => luminance("#12345")).toThrow(/not a hex colour/);
  });

  it("picks the more readable of white and ink text", () => {
    expect(textOn("#1e3a8a")).toBe(WHITE);
    expect(textOn("#feb63c")).toBe(INK);
  });
});

/** The custom properties declared in a CSS block, as { "--name": "#hex" }. */
const declared = (css: string) =>
  Object.fromEntries(
    [...css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]),
  );
/** The light values are the first `:root` block; the dark values are the one inside `prefers-color-scheme: dark`. */
const light = declared(tokens.slice(0, tokens.indexOf("@media (prefers-color-scheme: dark)")));
const darkBlock = tokens.slice(tokens.indexOf("@media (prefers-color-scheme: dark)"));
const dark = { ...light, ...declared(darkBlock) };

/** Every text-on-background pair the stylesheet uses. */
const PAIRS: [text: string, background: string][] = [
  ["--on-surface", "--surface"],
  ["--on-surface", "--surface-raised"],
  ["--on-surface", "--surface-sunken"],
  ["--on-surface-muted", "--surface"],
  ["--on-surface-muted", "--surface-raised"],
  ["--on-surface-muted", "--surface-sunken"],
  ["--primary", "--surface"],
  ["--primary", "--surface-raised"],
  ["--primary", "--surface-sunken"],
  ["--on-primary", "--primary"],
  ["--on-primary-container", "--primary-container"],
  ["--secondary", "--surface"],
  ["--on-secondary", "--secondary"],
  ["--on-secondary-container", "--secondary-container"],
  ["--tertiary", "--surface"],
  ["--tertiary", "--surface-sunken"],
  ["--on-tertiary", "--tertiary"],
  ["--on-tertiary-container", "--tertiary-container"],
  ["--on-card-ink", "--card-ink"],
  ["--error", "--surface"],
  ["--error", "--surface-raised"],
  ["--on-error", "--error"],
  ["--on-error-container", "--error-container"],
];

describe.each([
  ["light", light],
  ["dark", dark],
])("colour tokens, %s mode (#56)", (_mode, theme) => {
  it.each(PAIRS)("%s on %s reaches 4.5:1", (text, background) => {
    const [fg, bg] = [theme[text], theme[background]];
    expect(fg, `${text} is declared`).toBeDefined();
    expect(bg, `${background} is declared`).toBeDefined();
    expect(contrast(fg as string, bg as string)).toBeGreaterThanOrEqual(AA);
  });
});

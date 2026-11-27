import { describe, expect, it } from "vitest";
import { isExcluded, measureDiff } from "./diff-size";

describe("isExcluded", () => {
  it.each([
    ["pnpm-lock.yaml", true],
    ["packages/engine/pnpm-lock.yaml", true],
    ["content/durham.json", true],
    ["reports/rodeo-cap-4.md", true],
    ["docs/SPEC.md", true],
    ["packages/engine/src/fixtures/game.json", true],
    ["fixtures/a.json", true],
    ["packages/engine/src/index.ts", false],
    ["README.md", false],
    ["packages/docs/index.ts", false],
    ["packages/engine/src/fixtures.ts", false],
    ["rulesets/base.json", false],
    ["rulesets/__fixtures__/x.json", true],
    ["packages/engine/src/__fixtures__/a.json", true],
    ["apps/web/src/styles.css", true],
    ["apps/web/src/tokens.css", true],
    ["a/b/c.css", true],
    ["styles.css", true],
    ["apps/web/src/styles.css.ts", false],
    ["apps/web/src/styles.scss", false],
    ["apps/web/src/css.ts", false],
    ["docs-css/index.ts", false],
    ["packages/engine/src/turn.test.ts", true],
    ["scripts/diff-size.test.ts", true],
    ["packages/engine/src/turn.ts", false],
    ["packages/engine/src/__fixtures__.ts", false],
    ["packages/my__fixtures__/a.json", false],
    ["packages/engine/src/test.ts", false],
    ["packages/engine/src/test-content.ts", false],
  ])("%s → %s", (path, expected) => {
    expect(isExcluded(path)).toBe(expected);
  });
});

describe("measureDiff", () => {
  it.each([
    ["empty diff", "", 0, 0, true],
    ["counts added + deleted", "10\t5\tsrc/a.ts\n1\t1\tsrc/b.ts", 17, 0, true],
    [
      "skips excluded paths",
      "3\t0\tsrc/a.ts\n900\t100\tpnpm-lock.yaml\n50\t0\tdocs/x.md",
      3,
      1050,
      true,
    ],
    ["test files are excluded", "5\t0\tsrc/a.ts\n90\t10\tsrc/a.test.ts", 5, 100, true],
    ["CSS is excluded", "5\t0\tsrc/a.ts\n300\t100\tapps/web/src/styles.css", 5, 400, true],
    ["a CSS-only PR counts 0", "250\t50\tapps/web/src/styles.css", 0, 300, true],
    [
      "a big .tsx change still fails next to CSS",
      "401\t0\tsrc/a.tsx\n90\t0\tsrc/a.css",
      401,
      90,
      false,
    ],
    ["binary files count as 0", "-\t-\tassets/logo.png\n2\t0\tsrc/a.ts", 2, 0, true],
    ["exactly 400 passes", "400\t0\tsrc/a.ts", 400, 0, true],
    ["401 fails", "200\t201\tsrc/a.ts", 401, 0, false],
  ])("%s", (_name, numstat, counted, excluded, ok) => {
    expect(measureDiff(numstat)).toEqual({ counted, excluded, ok });
  });
});

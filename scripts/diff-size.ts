/** Pure logic for the CI diff-size gate (WORKFLOW §2). No I/O here; see diff-size.cli.mjs. */

export const MAX_CHANGED_LINES = 400;

/** True when a path does not count toward the diff-size limit. */
export function isExcluded(path: string): boolean {
  const segments = path.split("/");
  const top = segments[0];
  const file = segments[segments.length - 1] ?? "";
  const dirs = segments.slice(0, -1);
  return (
    file === "pnpm-lock.yaml" ||
    file.endsWith(".test.ts") ||
    top === "content" ||
    top === "reports" ||
    top === "docs" ||
    dirs.includes("fixtures") ||
    dirs.includes("__fixtures__")
  );
}

export interface DiffSize {
  counted: number;
  excluded: number;
  ok: boolean;
}

/** Sums `git diff --numstat --no-renames` output. Binary files ("-") count as 0 lines. */
export function measureDiff(numstat: string, max = MAX_CHANGED_LINES): DiffSize {
  let counted = 0;
  let excluded = 0;
  for (const line of numstat.split("\n")) {
    const [added, deleted, path] = line.split("\t");
    if (added === undefined || deleted === undefined || path === undefined) continue;
    const lines = (Number(added) || 0) + (Number(deleted) || 0);
    if (isExcluded(path)) excluded += lines;
    else counted += lines;
  }
  return { counted, excluded, ok: counted <= max };
}

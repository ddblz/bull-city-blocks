/** Pure logic for the CI dependency gate (WORKFLOW §2). No I/O here; see deps-gate.cli.mjs. */

export const APPROVAL_LABEL = "deps-approved";
const DEP_FIELDS = ["dependencies", "devDependencies"] as const;

/** One package.json before and after the PR. `null` means the file didn't exist on that side. */
export interface ManifestChange {
  path: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

function normalize(deps: unknown): string {
  if (typeof deps !== "object" || deps === null) return "{}";
  return JSON.stringify(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)));
}

/** Paths whose `dependencies` or `devDependencies` differ. */
export function changedManifests(changes: readonly ManifestChange[]): string[] {
  return changes
    .filter((c) => DEP_FIELDS.some((f) => normalize(c.before?.[f]) !== normalize(c.after?.[f])))
    .map((c) => c.path);
}

/** The issue number from the first `Closes #N` in a PR body, or null. */
export function closedIssue(prBody: string): number | null {
  const match = /\bclos(?:e|es|ed)\s+#(\d+)\b/i.exec(prBody);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export interface GateResult {
  ok: boolean;
  message: string;
}

export async function checkDepsGate(input: {
  changes: readonly ManifestChange[];
  prBody: string;
  issueLabels: (issue: number) => Promise<readonly string[]>;
}): Promise<GateResult> {
  const changed = changedManifests(input.changes);
  if (changed.length === 0) return { ok: true, message: "No dependency changes." };
  const files = changed.join(", ");
  const issue = closedIssue(input.prBody);
  if (issue === null) {
    return {
      ok: false,
      message: `Dependencies changed in ${files}, but the PR body has no "Closes #N".`,
    };
  }
  const labels = await input.issueLabels(issue);
  if (labels.includes(APPROVAL_LABEL)) {
    return {
      ok: true,
      message: `Dependencies changed in ${files}; #${issue} has ${APPROVAL_LABEL}.`,
    };
  }
  return {
    ok: false,
    message: `Dependencies changed in ${files}, but #${issue} lacks the ${APPROVAL_LABEL} label.`,
  };
}

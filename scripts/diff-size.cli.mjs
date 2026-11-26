// CI entry point for the diff-size gate. Usage: node scripts/diff-size.cli.mjs [base] [head]
// Defaults to the merge base with origin/main. CI passes `HEAD^1 HEAD` on the PR merge commit.
import { execFileSync } from "node:child_process";
import { MAX_CHANGED_LINES, measureDiff } from "./diff-size.ts";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const head = process.argv[3] ?? "HEAD";
const base = process.argv[2] ?? git("merge-base", "origin/main", head);

const { counted, excluded, ok } = measureDiff(git("diff", "--numstat", "--no-renames", base, head));
console.log(`Counted ${counted} changed lines (limit ${MAX_CHANGED_LINES}); ${excluded} excluded.`);
if (!ok) {
  console.log(`::error::PR changes ${counted} lines, over the ${MAX_CHANGED_LINES}-line limit.`);
  process.exit(1);
}

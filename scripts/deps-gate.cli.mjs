// CI entry point for the dependency gate. Usage: node scripts/deps-gate.cli.mjs [base] [head]
// Reads PR_BODY, GITHUB_TOKEN, GITHUB_REPOSITORY and GITHUB_API_URL from the environment.
import { execFileSync } from "node:child_process";
import { checkDepsGate } from "./deps-gate.ts";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const head = process.argv[3] ?? "HEAD";
const base = process.argv[2] ?? git("merge-base", "origin/main", head);

const readJson = (rev, path) => {
  try {
    return JSON.parse(git("show", `${rev}:${path}`));
  } catch {
    return null;
  }
};

const changes = git("diff", "--name-only", "--no-renames", base, head)
  .split("\n")
  .filter((p) => p === "package.json" || p.endsWith("/package.json"))
  .map((path) => ({ path, before: readJson(base, path), after: readJson(head, path) }));

async function issueLabels(issue) {
  const {
    GITHUB_API_URL = "https://api.github.com",
    GITHUB_REPOSITORY,
    GITHUB_TOKEN,
  } = process.env;
  const url = `${GITHUB_API_URL}/repos/${GITHUB_REPOSITORY}/issues/${issue}/labels?per_page=100`;
  const headers = { Accept: "application/vnd.github+json" };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return (await res.json()).map((label) => label.name);
}

const result = await checkDepsGate({ changes, prBody: process.env.PR_BODY ?? "", issueLabels });
console.log(result.ok ? result.message : `::error::${result.message}`);
if (!result.ok) process.exit(1);

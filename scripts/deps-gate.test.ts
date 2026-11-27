import { describe, expect, it } from "vitest";
import { checkDepsGate, closedIssue, type ManifestChange } from "./deps-gate";

const pkg = (deps: Record<string, string>, devDeps: Record<string, string> = {}) => ({
  name: "x",
  dependencies: deps,
  devDependencies: devDeps,
});

const noDepChange: ManifestChange = {
  path: "package.json",
  before: { ...pkg({ a: "1" }), scripts: { test: "vitest" } },
  after: { ...pkg({ a: "1" }), scripts: { test: "vitest run" } },
};
const depAdded: ManifestChange = {
  path: "packages/engine/package.json",
  before: pkg({}),
  after: pkg({ zod: "4.0.0" }),
};
const devDepBumped: ManifestChange = {
  path: "package.json",
  before: pkg({}, { vitest: "5.1.2" }),
  after: pkg({}, { vitest: "5.2.0" }),
};
const newManifest: ManifestChange = {
  path: "packages/x/package.json",
  before: null,
  after: pkg({ a: "1" }),
};

const labels: Record<number, string[]> = { 7: ["ready", "deps-approved"], 8: ["ready"] };
const issueLabels = async (n: number) => labels[n] ?? [];

describe("checkDepsGate", () => {
  it.each([
    ["no package.json changes", [], "", true],
    ["no dependency change passes", [noDepChange], "", true],
    [
      "reordered deps are not a change",
      [{ path: "p", before: pkg({ a: "1", b: "2" }), after: pkg({ b: "2", a: "1" }) }],
      "",
      true,
    ],
    ["dependency change with label passes", [depAdded], "Closes #7", true],
    ["devDependency change with label passes", [devDepBumped], "closes #7", true],
    ["dependency change without label fails", [depAdded], "Closes #8", false],
    ["new manifest with deps without label fails", [newManifest], "Closes #8", false],
    ["dependency change with missing Closes fails", [depAdded], "Part of #7", false],
    // Internal workspace links aren't registry dependencies (#43).
    [
      "new package with only workspace links passes",
      [
        {
          path: "packages/x/package.json",
          before: null,
          after: pkg({ "@bcb/engine": "workspace:*" }),
        },
      ],
      "",
      true,
    ],
    [
      "adding a workspace link passes",
      [{ path: "p", before: pkg({ a: "1" }), after: pkg({ a: "1", "@bcb/bots": "workspace:*" }) }],
      "",
      true,
    ],
    [
      "changing a workspace link passes",
      [
        {
          path: "p",
          before: pkg({ "@bcb/bots": "workspace:*" }),
          after: pkg({ "@bcb/bots": "workspace:^" }),
        },
      ],
      "",
      true,
    ],
    [
      "workspace links plus a registry dep still need the label",
      [{ path: "p", before: null, after: pkg({ "@bcb/engine": "workspace:*", zod: "4.0.0" }) }],
      "Closes #8",
      false,
    ],
    [
      "workspace link → registry version needs the label",
      [
        {
          path: "p",
          before: pkg({ "@bcb/bots": "workspace:*" }),
          after: pkg({ "@bcb/bots": "1.0.0" }),
        },
      ],
      "Closes #8",
      false,
    ],
    [
      "registry version → workspace link needs the label",
      [
        {
          path: "p",
          before: pkg({ "@bcb/bots": "1.0.0" }),
          after: pkg({ "@bcb/bots": "workspace:*" }),
        },
      ],
      "Closes #8",
      false,
    ],
  ])("%s", async (_name, changes, prBody, ok) => {
    const result = await checkDepsGate({ changes, prBody, issueLabels });
    expect(result.ok).toBe(ok);
  });
});

describe("closedIssue", () => {
  it.each([
    ["Closes #2", 2],
    ["Summary\n\nCloses #12\nCloses #13", 12],
    ["closed #5", 5],
    ["Encloses #3", null],
    ["Refs #4", null],
    ["", null],
  ])("%j → %s", (body, expected) => {
    expect(closedIssue(body)).toBe(expected);
  });
});

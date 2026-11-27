import { createGame, loadRuleset, type Prediction, parseContent } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import rodeo from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };
import {
  compareMetrics,
  formatReport,
  judge,
  overallVerdict,
  overlaps,
  type PlayerCount,
} from "./compare";
import type { Metrics } from "./metrics";
import { type BatchSpec, runBatch, seedFor } from "./run";
import type { Estimate } from "./stats";

const est = (value: number, low: number, high: number): Estimate => ({ value, low, high });
const flat = est(0.5, 0.4, 0.6);

/** Synthetic metrics: everything `flat` unless overridden. */
function metrics(players: number, over: Partial<Metrics> = {}): Metrics {
  return {
    players,
    games: 100,
    winRateBySeat: Array.from({ length: players }, () => flat),
    turnsToWin: { mean: flat, median: 0, p90: 0 },
    roundsToWin: { mean: flat, median: 0, p90: 0 },
    stallRate: flat,
    comebackRate: { ...flat, games: 100 },
    cardImpact: [],
    botWinRate: { greedy: flat, random: flat },
    reshuffles: flat,
    ...over,
  };
}
const comeback = (e: Estimate) => ({ comebackRate: { ...e, games: 100 } });

describe("variant comparison (§5–6)", () => {
  it("both rulesets use identical seeds", () => {
    const files = [base, rodeo];
    const spec = (ruleset: string, players: number): BatchSpec => ({
      rulesetFiles: files,
      ruleset,
      content: durham,
      players,
      bots: ["greedy", "random"],
      from: 0,
      to: 20,
    });
    // At 4 players the cap of 4 never binds, so paired seeds must give identical games.
    expect(runBatch(spec("rodeo-cap-4", 4))).toEqual(runBatch(spec("base", 4)));
    // At 10 players the rules differ but the seeded deal does not.
    const content = parseContent(durham);
    const rules = ["base", "rodeo-cap-4"].map((id) => loadRuleset(id, files));
    if (!content.ok || !rules.every((r) => r.ok)) throw new Error("bad fixtures");
    const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const deals = rules.map((r) =>
      r.ok ? createGame(r.value, content.value, ids, seedFor(10, 7)) : null,
    );
    const hands = deals.map((g) => (g?.ok ? g.value.players.map((p) => p.hand) : null));
    expect(hands[1]).toEqual(hands[0]);
  });

  it.each([
    ["overlapping", est(0.5, 0.4, 0.6), est(0.55, 0.45, 0.65), false],
    ["touching at an edge", est(0.5, 0.4, 0.6), est(0.7, 0.6, 0.8), false],
    ["separated above", est(0.5, 0.4, 0.6), est(0.75, 0.61, 0.9), true],
    ["separated below", est(0.5, 0.4, 0.6), est(0.2, 0.1, 0.39), true],
  ])("the changed flag matches CI overlap: %s → %s", (_name, b, v, changed) => {
    expect(overlaps(b, v)).toBe(!changed);
    const rows = compareMetrics(metrics(3), metrics(3, { stallRate: v, ...comeback(v) }));
    for (const metric of ["stallRate", "comebackRate"]) {
      expect(rows.find((r) => r.metric === metric)?.changed).toBe(changed);
    }
    expect(rows.find((r) => r.metric === "win rate, seat 1")?.changed).toBe(false);
  });

  const lower: Prediction = { metric: "comebackRate", players: [8, 10], expect: "lower" };
  const at = (players: number, v: Estimate): PlayerCount => ({
    players,
    base: metrics(players),
    variant: metrics(players, comeback(v)),
  });
  it.each([
    ["all lower → supported", [est(0.2, 0.1, 0.3), est(0.2, 0.1, 0.3)], "supported"],
    ["one unclear → inconclusive", [est(0.2, 0.1, 0.3), est(0.45, 0.35, 0.55)], "inconclusive"],
    ["one higher → not supported", [est(0.2, 0.1, 0.3), est(0.8, 0.7, 0.9)], "not supported"],
  ] as const)("the verdict is computed from the data: %s", (_name, [v8, v9], verdict) => {
    const counts = [at(4, est(0.9, 0.8, 1)), at(8, v8), at(9, v9)];
    const judged = judge(lower, counts);
    expect(judged.outcomes.map((o) => o.players)).toEqual([8, 9]); // 4 players is outside the prediction
    expect(judged.verdict).toBe(verdict);
  });

  it("a 'same' prediction is contradicted by any change", () => {
    const same: Prediction = { metric: "comebackRate", players: [2, 4], expect: "same" };
    expect(judge(same, [at(3, flat)]).verdict).toBe("supported");
    expect(judge(same, [at(3, est(0.9, 0.8, 1))]).verdict).toBe("not supported");
  });

  it("combines prediction verdicts, and the report shows the computed result", () => {
    expect(overallVerdict(["supported", "supported"])).toBe("supported");
    expect(overallVerdict(["supported", "inconclusive"])).toBe("inconclusive");
    expect(overallVerdict(["inconclusive", "not supported"])).toBe("not supported");
    expect(overallVerdict([])).toBe("inconclusive");
    const loaded = loadRuleset("rodeo-cap-4", [base, rodeo]);
    if (!loaded.ok) throw new Error(loaded.error);
    const report = formatReport(loaded.value, "base", 100, ["greedy"], [at(9, est(0.8, 0.7, 0.9))]);
    expect(report).toContain("**Verdict: not supported**");
    expect(report).toContain(
      "| comebackRate | 50.0% [40.0–60.0] | 80.0% [70.0–90.0] | **changed** |",
    );
  });
});

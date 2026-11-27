import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { computeMetrics, formatMetrics } from "./metrics";
import { type BatchSpec, runBatch } from "./run";

const spec = (players: number, from: number, to: number): BatchSpec => ({
  rulesetFiles: [base],
  ruleset: "base",
  content: durham,
  players,
  bots: ["greedy", "random"],
  from,
  to,
});

describe("sim end to end", () => {
  const games = runBatch(spec(3, 0, 60));
  const metrics = computeMetrics(3, games);

  it("reports every SPEC §6 metric for the player count", () => {
    expect(metrics.games).toBe(60);
    expect(metrics.winRateBySeat).toHaveLength(3);
    const seatWins = metrics.winRateBySeat.reduce((n, e) => n + e.value, 0);
    expect(seatWins + metrics.stallRate.value).toBeCloseTo(1, 10);
    for (const e of [
      metrics.stallRate,
      metrics.comebackRate,
      metrics.reshuffles,
      metrics.turnsToWin.mean,
      metrics.roundsToWin.mean,
    ]) {
      expect(e.low).toBeLessThanOrEqual(e.value);
      expect(e.high).toBeGreaterThanOrEqual(e.value);
    }
    expect(metrics.turnsToWin.p90).toBeGreaterThanOrEqual(metrics.turnsToWin.median);
    expect(Object.keys(metrics.botWinRate)).toEqual(["greedy", "random"]);
    expect(metrics.cardImpact.length).toBeGreaterThan(10);
    expect(formatMetrics(metrics)).toContain("== 3 players, 60 games ==");
  });

  it("is reproducible, however the games are split into batches", () => {
    const split = [...runBatch(spec(3, 0, 25)), ...runBatch(spec(3, 25, 60))];
    expect(split).toEqual(games);
    expect(computeMetrics(3, split)).toEqual(metrics);
  });

  it("rotates bots through the seats", () => {
    expect(games[0]?.bots).toEqual(["greedy", "random", "greedy"]);
    expect(games[1]?.bots).toEqual(["random", "greedy", "random"]);
  });
});

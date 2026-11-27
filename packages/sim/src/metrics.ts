import type { GameSummary } from "./run";
import { type Estimate, mean, quantile, wilson } from "./stats";

/** SPEC §6 metrics for one player count. Rates use Wilson intervals, means a normal interval. */
export interface Metrics {
  players: number;
  games: number;
  winRateBySeat: Estimate[];
  turnsToWin: { mean: Estimate; median: number; p90: number };
  roundsToWin: { mean: Estimate; median: number; p90: number };
  stallRate: Estimate;
  /** Of games still running after round 5: the winner was last in complete districts then. */
  comebackRate: Estimate & { games: number };
  /** Per card id: win rate of players who played it vs players who didn't. */
  cardImpact: { card: string; played: Estimate; notPlayed: Estimate }[];
  /** Per bot: wins per seat it occupied. */
  botWinRate: Record<string, Estimate>;
  reshuffles: Estimate;
}

const spread = (xs: number[]) => ({
  mean: mean(xs),
  median: quantile(xs, 0.5),
  p90: quantile(xs, 0.9),
});

export function computeMetrics(players: number, games: readonly GameSummary[]): Metrics {
  const n = games.length;
  const wins = games.filter((g) => g.winner !== null);
  const seats = Array.from({ length: players }, (_, i) => i);

  // Comeback: the winner had the fewest complete districts after round 5, and not everyone tied.
  const eligible = wins.filter((g) => g.atRound5 !== null);
  const comebacks = eligible.filter((g) => {
    const counts = g.atRound5 as number[];
    const mine = counts[g.winner as number] as number;
    return counts.every((c) => mine <= c) && counts.some((c) => mine < c);
  }).length;

  const cards = [...new Set(games.flatMap((g) => g.played.flat()))].sort();
  const cardImpact = cards.map((card) => {
    let [pw, pn, nw, nn] = [0, 0, 0, 0];
    for (const g of games) {
      for (const seat of seats) {
        const won = g.winner === seat ? 1 : 0;
        if (g.played[seat]?.includes(card)) [pw, pn] = [pw + won, pn + 1];
        else [nw, nn] = [nw + won, nn + 1];
      }
    }
    return { card, played: wilson(pw, pn), notPlayed: wilson(nw, nn) };
  });

  const botWinRate: Record<string, Estimate> = {};
  for (const bot of [...new Set(games.flatMap((g) => g.bots))].sort()) {
    const occupied = games
      .flatMap((g) => g.bots.map((b, seat) => ({ b, won: g.winner === seat })))
      .filter((x) => x.b === bot);
    botWinRate[bot] = wilson(occupied.filter((x) => x.won).length, occupied.length);
  }

  return {
    players,
    games: n,
    winRateBySeat: seats.map((seat) => wilson(games.filter((g) => g.winner === seat).length, n)),
    turnsToWin: spread(wins.map((g) => g.turns)),
    roundsToWin: spread(wins.map((g) => g.rounds)),
    stallRate: wilson(n - wins.length, n),
    comebackRate: { ...wilson(comebacks, eligible.length), games: eligible.length },
    cardImpact,
    botWinRate,
    reshuffles: mean(games.map((g) => g.reshuffles)),
  };
}

const pct = (e: Estimate) =>
  `${(100 * e.value).toFixed(1)}% [${(100 * e.low).toFixed(1)}–${(100 * e.high).toFixed(1)}]`;
const num = (e: Estimate) => `${e.value.toFixed(2)} [${e.low.toFixed(2)}–${e.high.toFixed(2)}]`;

/** A plain-text table for one player count. */
export function formatMetrics(m: Metrics): string {
  const swing = [...m.cardImpact].sort(
    (a, b) =>
      Math.abs(b.played.value - b.notPlayed.value) - Math.abs(a.played.value - a.notPlayed.value),
  );
  return [
    `== ${m.players} players, ${m.games} games ==`,
    `win rate by seat   ${m.winRateBySeat.map((e, i) => `${i + 1}: ${pct(e)}`).join("  ")}`,
    `turns to win       mean ${num(m.turnsToWin.mean)}  median ${m.turnsToWin.median}  p90 ${m.turnsToWin.p90}`,
    `rounds to win      mean ${num(m.roundsToWin.mean)}  median ${m.roundsToWin.median}  p90 ${m.roundsToWin.p90}`,
    `stall rate         ${pct(m.stallRate)}`,
    `comeback rate      ${pct(m.comebackRate)} of ${m.comebackRate.games} games past round 5`,
    `bot win rate       ${Object.entries(m.botWinRate)
      .map(([b, e]) => `${b}: ${pct(e)}`)
      .join("  ")}`,
    `reshuffles/game    ${num(m.reshuffles)}`,
    "card impact (biggest swings; full list in the JSON)",
    ...swing
      .slice(0, 5)
      .map((c) => `  ${c.card.padEnd(32)} played ${pct(c.played)}  not ${pct(c.notPlayed)}`),
  ].join("\n");
}

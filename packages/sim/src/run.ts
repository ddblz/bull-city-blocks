import { greedy, type Policy, playGame, random } from "@bull-city-blocks/bots";
import { completeDistricts, loadRuleset, parseContent } from "@bull-city-blocks/engine";

export const BOTS: Record<string, Policy> = { greedy, random };

/** Everything the metrics need from one game (plain JSON, so workers can send it back). */
export interface GameSummary {
  game: number;
  /** Winning seat, or null for a stall. */
  winner: number | null;
  turns: number;
  rounds: number;
  reshuffles: number;
  /** Bot name in each seat. */
  bots: string[];
  /** Per seat: the card ids (not instances) played for their effect. */
  played: string[][];
  /** Per seat: complete districts when round 5 ended, or null if the game ended first. */
  atRound5: number[] | null;
}

export interface BatchSpec {
  rulesetFiles: unknown[];
  ruleset: string;
  content: unknown;
  players: number;
  bots: string[];
  /** Game indexes [from, to). Seeds depend only on the player count and index, not the ruleset. */
  from: number;
  to: number;
}

/** Runs games `from`..`to` at one player count. Bots rotate seats so each plays every seat. */
export function runBatch(spec: BatchSpec): GameSummary[] {
  const rules = loadRuleset(spec.ruleset, spec.rulesetFiles);
  const content = parseContent(spec.content);
  if (!rules.ok) throw new Error(rules.error);
  if (!content.ok) throw new Error(content.error);
  const out: GameSummary[] = [];
  for (let game = spec.from; game < spec.to; game++) {
    const bots = Array.from(
      { length: spec.players },
      (_, i) => spec.bots[(i + game) % spec.bots.length] as string,
    );
    const played: Set<string>[] = bots.map(() => new Set());
    let reshuffles = 0;
    let atRound5: number[] | null = null;
    const record = playGame(
      rules.value,
      content.value,
      bots.map((b) => BOTS[b] as Policy),
      `sim:${spec.players}:${game}`,
      (move, events, state) => {
        const seat = state.players.findIndex((p) => p.id === move.player);
        const cardOf = (instance: string) => state.cards[instance]?.id ?? instance;
        if (
          move.type === "playProperty" ||
          move.type === "playUpgrade" ||
          move.type === "playAction" ||
          move.type === "playRent"
        ) {
          played[seat]?.add(cardOf(move.card));
          if (move.type === "playRent" && move.hike) played[seat]?.add(cardOf(move.hike));
        }
        reshuffles += events.filter((e) => e.type === "deckReshuffled").length;
        if (atRound5 === null && state.round > 5)
          atRound5 = state.players.map((p) => completeDistricts(state, p.id).size);
      },
    );
    out.push({
      game,
      winner: record.result === "stall" ? null : record.result,
      turns: record.state.turn,
      rounds: record.state.round,
      reshuffles,
      bots,
      played: played.map((s) => [...s].sort()),
      atRound5,
    });
  }
  return out;
}

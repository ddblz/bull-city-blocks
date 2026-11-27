import {
  applyMove,
  type Content,
  createGame,
  type GameState,
  legalMoves,
  loadRuleset,
  type Move,
  parseContent,
  type RuleSet,
  viewFor,
} from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { greedy, type Policy, playGame, Rng, random } from "./index";

declare const process: { env: Record<string, string | undefined> };
/** Games per player count. CI runs 100; `BOTS_GAMES=1000 pnpm test` runs the full soak. */
const GAMES = Number(process.env.BOTS_GAMES ?? 100);

const loaded = loadRuleset("base", [base]);
const parsed = parseContent(durham);
if (!loaded.ok || !parsed.ok) throw new Error("bad fixtures");
const rules: RuleSet = loaded.value;
const content: Content = parsed.value;

/** Greedy and random alternate seats, starting with a different bot each game. */
const mixed = (n: number, g: number): Policy[] =>
  Array.from({ length: n }, (_, i) => ((i + g) % 2 ? greedy : random));

describe("bots", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    `both bots finish ${GAMES} seeded %i-player games with zero errors`,
    (n) => {
      for (let g = 0; g < GAMES; g++) {
        const game = playGame(rules, content, mixed(n, g), `soak-${n}-${g}`);
        expect(game.state.phase).toBe("gameOver");
      }
    },
    600_000,
  );

  it("greedy beats random in more than 70% of 2-player games", () => {
    const games = 400;
    let wins = 0;
    for (let g = 0; g < games; g++) {
      const greedySeat = g % 2;
      const game = playGame(
        rules,
        content,
        greedySeat ? [random, greedy] : [greedy, random],
        `duel-${g}`,
      );
      if (game.result === greedySeat) wins += 1;
    }
    expect(wins / games).toBeGreaterThan(0.7);
  });

  it("bots are deterministic given a seed", () => {
    for (const seats of [[random, random, random], [greedy, greedy, greedy], mixed(5, 0)]) {
      const a = playGame(rules, content, seats, "same");
      const b = playGame(rules, content, seats, "same");
      expect(b).toEqual(a);
    }
    expect(playGame(rules, content, [random, random], "one").state).not.toEqual(
      playGame(rules, content, [random, random], "two").state,
    );
  });

  it("random picks uniformly among the legal moves", () => {
    const rng = new Rng("uniform");
    const legal: Move[] = ["a", "b", "c", "d"].map((card) => ({
      type: "discard",
      player: "p1",
      card,
    }));
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const m = random(undefined as never, legal, rng);
      if (m.type === "discard") counts.set(m.card, (counts.get(m.card) ?? 0) + 1);
    }
    for (const n of counts.values()) expect(n).toBeGreaterThan(850);
  });

  it("greedy pays with its lowest-value bank card first", () => {
    const g = createGame(rules, content, ["p1", "p2"], "pay");
    if (!g.ok) throw new Error(g.error);
    const s: GameState = JSON.parse(JSON.stringify(g.value));
    const debtor = s.players.find((p) => p.id !== s.currentPlayer);
    if (!debtor) throw new Error("no debtor");
    for (const card of ["cash-5:1:1", "cash-1:1:1", "cash-3:1:1"]) {
      s.deck.splice(s.deck.indexOf(card), 1);
      debtor.bank.push(card);
    }
    s.pending = [{ type: "debt", debtor: debtor.id, creditor: s.currentPlayer, amount: 2 }];
    s.phase = "pay";
    const move = greedy(viewFor(s, debtor.id), legalMoves(s, debtor.id), new Rng("x"));
    expect(move).toEqual({ type: "pay", player: debtor.id, cards: ["cash-1:1:1"] });
    expect(applyMove(s, move).ok).toBe(true);
  });
});

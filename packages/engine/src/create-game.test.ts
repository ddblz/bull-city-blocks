import { describe, expect, it } from "vitest";
import { createGame } from "./create-game";
import { baseRules, durhamContent } from "./test-content";
import type { GameState } from "./types";

const content = durhamContent();
const rules = baseRules();
const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const game = (n: number, seed = "seed") => {
  const result = createGame(rules, content, players(n), seed);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const allCards = (s: GameState) => [
  ...s.deck,
  ...s.discard,
  ...s.players.flatMap((p) => [...p.hand, ...p.bank]),
];

describe("createGame", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])("§3.1 sets up %i players", (n) => {
    const s = game(n);
    const deckSize = n <= 5 ? 139 : 278;
    expect(Object.keys(s.cards)).toHaveLength(deckSize);
    // Everyone is dealt 5; the starting player has also drawn 2 for their first turn (§3.2).
    expect(s.players.map((p) => p.hand.length)).toEqual(
      s.players.map((p) => (p.id === s.currentPlayer ? 7 : 5)),
    );
    expect(s.deck).toHaveLength(deckSize - 5 * n - 2);
    expect(s).toMatchObject({
      phase: "play",
      playsRemaining: 3,
      startingPlayer: s.currentPlayer,
      result: null,
    });
    // Conservation: every instance is in exactly one place.
    const placed = allCards(s);
    expect(placed).toHaveLength(deckSize);
    expect(new Set(placed)).toEqual(new Set(Object.keys(s.cards)));
    expect(players(n)).toContain(s.currentPlayer);
  });

  it.each([0, 1, 11])("§3.1 returns an error result for %i players", (n) => {
    const result = createGame(rules, content, players(n), "seed");
    expect(result.ok).toBe(false);
  });

  it("returns an error result for duplicate player ids", () => {
    expect(createGame(rules, content, ["a", "a"], "seed").ok).toBe(false);
  });

  it("§3.1 the same seed gives an identical state", () => {
    expect(game(4, "abc")).toEqual(game(4, "abc"));
    expect(JSON.parse(JSON.stringify(game(7, "abc")))).toEqual(game(7, "abc"));
  });

  it("§3.1 a different seed gives a different shuffle", () => {
    expect(game(4, "abc").deck).not.toEqual(game(4, "abd").deck);
  });

  it("§3.1 the starting player is chosen by the seeded RNG", () => {
    const starters = new Set(Array.from({ length: 50 }, (_, i) => game(4, `s${i}`).currentPlayer));
    expect(starters.size).toBeGreaterThan(1);
  });

  it("starts with empty banks and tableaux, and auto-pass on (§3.6)", () => {
    for (const p of game(3).players) {
      expect(p).toMatchObject({ bank: [], tableau: [], prefs: { autoPass: true } });
    }
  });
});

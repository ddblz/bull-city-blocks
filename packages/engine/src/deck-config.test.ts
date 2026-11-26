import { describe, expect, it } from "vitest";
import cheapTakeover from "../../../rulesets/__fixtures__/cheap-takeover.json" with {
  type: "json",
};
import dukeRent from "../../../rulesets/__fixtures__/duke-rent.json" with { type: "json" };
import fewerWalkOffs from "../../../rulesets/__fixtures__/fewer-walk-offs.json" with {
  type: "json",
};
import { buildDeck, createGame } from "./create-game";
import { applyDeckConfig } from "./deck-config";
import { loadRuleset } from "./ruleset";
import { baseJson, baseRules, durhamContent } from "./test-content";
import type { GameState } from "./types";

const content = durhamContent();
const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

/** Loads `base` plus an inline variant with these overrides, then creates a game. */
function setup(overrides: Record<string, unknown>, n = 4) {
  return createFrom("v", n, { id: "v", extends: "base", description: "", overrides });
}
const game = (result: ReturnType<typeof setup>): GameState => {
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
const instancesOf = (s: GameState, cardId: string) =>
  Object.values(s.cards).filter((c) => c.id === cardId);

describe("§5 deck overrides", () => {
  it("base produces exactly today's SPEC §4 deck: same instance ids and same shuffle", () => {
    const four = game(createGame(baseRules(), content, players(4), "golden"));
    expect(Object.keys(four.cards)).toEqual(Object.keys(buildDeck(content, 1)));
    // Recorded from main before this change (PR #19): the shuffled deck began golden-belt,
    // assessment, ninth-st. Since #5 the starting player (p3) draws those first two.
    expect(four.deck[0]).toBe("ninth-st:1:1");
    expect(four.players[2]?.hand.slice(-2)).toEqual(["golden-belt:1:1", "assessment:1:2"]);
    expect(four.players[0]?.hand).toEqual([
      "hostile-takeover:1:2",
      "food-truck-rodeo:1:1",
      "rent-north-durham-the-eno:1:2",
      "walk-off-win:1:7",
      "alston-ave:1:1",
    ]);
    expect(four.currentPlayer).toBe("p3");
    const eight = game(createGame(baseRules(), content, players(8), "golden"));
    expect(Object.keys(eight.cards)).toHaveLength(278);
    expect(eight.deck[0]).toBe("cash-1:1:4"); // p6 drew dbap and berkeley-st
    expect(eight.players[5]?.hand.slice(-2)).toEqual(["dbap:1:1", "berkeley-st:1:1"]);
    expect(eight.currentPlayer).toBe("p6");
  });

  it.each([
    [4, 136, 6],
    [8, 272, 12],
  ])(
    "counts: fewer-walk-offs at %i players has %i cards, %i Walk-Off Wins",
    (n, size, walkOffs) => {
      const s = game(createFrom("fewer-walk-offs", n, fewerWalkOffs));
      expect(Object.keys(s.cards)).toHaveLength(size);
      expect(instancesOf(s, "walk-off-win")).toHaveLength(walkOffs);
    },
  );

  it("counts: appeal 0 removes every Appeal", () => {
    const s = game(setup({ "deck.counts.appeal": 0 }, 8));
    expect(instancesOf(s, "appeal")).toHaveLength(0);
    expect(Object.keys(s.cards)).toHaveLength(278 - 8);
  });

  it.each([4, 8])("values: cheap-takeover at %i players revalues every Hostile Takeover", (n) => {
    const s = game(createFrom("cheap-takeover", n, cheapTakeover));
    expect(instancesOf(s, "hostile-takeover").map((c) => c.value)).toEqual(
      Array(n <= 5 ? 2 : 4).fill(4),
    );
  });

  it("values: applies to property cards too", () => {
    const s = game(setup({ "deck.values.ninth-st": 3 }, 8));
    expect(instancesOf(s, "ninth-st").map((c) => c.value)).toEqual([3, 3]);
    expect(instancesOf(s, "hillsborough-rd").map((c) => c.value)).toEqual([1, 1]);
  });

  it.each([4, 8])("rent: duke-rent at %i players replaces the Duke ladder only", (n) => {
    const s = game(createFrom("duke-rent", n, dukeRent));
    expect(s.districts.duke?.rent).toEqual([3, 5, 9]);
    expect(s.districts.downtown?.rent).toEqual([2, 4, 7]);
  });

  it.each([
    ["unknown card in counts", { "deck.counts.joker": 1 }, '"joker"'],
    ["unknown card in values", { "deck.values.joker": 1 }, '"joker"'],
    ["unknown district in rent", { "deck.rent.chapel-hill": [1, 2] }, '"chapel-hill"'],
    ["property card in counts", { "deck.counts.ninth-st": 2 }, '"ninth-st"'],
    ["negative count", { "deck.counts.walk-off-win": -1 }, "walk-off-win"],
    ["rent ladder of the wrong length", { "deck.rent.duke": [3, 5] }, '"duke"'],
  ])("%s is an error result naming the id", (_name, overrides, id) => {
    const result = setup(overrides);
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.error).toContain(id);
  });

  it("does not mutate the content", () => {
    const before = JSON.stringify(content);
    const rules = loadRuleset("cheap-takeover", [baseJson, cheapTakeover]);
    if (rules.ok) applyDeckConfig(content, rules.value);
    expect(JSON.stringify(content)).toBe(before);
  });
});

function createFrom(id: string, n: number, file: unknown) {
  const rules = loadRuleset(id, [baseJson, file]);
  if (!rules.ok) return rules;
  return createGame(rules.value, content, players(n), "seed");
}

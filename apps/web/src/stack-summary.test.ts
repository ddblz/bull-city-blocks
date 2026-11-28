import {
  createGame,
  type GameState,
  loadRuleset,
  parseContent,
  viewFor,
} from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { bankSummary, MAX_TILES, setSummary } from "./stack-summary";
import type { Card, PropertySet, View } from "./types";

const content = (() => {
  const c = parseContent(durham);
  if (!c.ok) throw new Error(c.error);
  return c.value;
})();
const def = (id: string): Card => {
  const c = content.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const INSTANCES: Record<string, string> = {
  h1: "fayetteville-st",
  h2: "lawson-st",
  h3: "alston-ave",
  w1: "wild-east-durham-hayti",
  lm: "carolina-theatre",
  ic: "dpac",
};
const viewWith = (tableau: PropertySet[], bank: string[] = []): View => {
  const rules = loadRuleset("base", [base]);
  if (!rules.ok) throw new Error(rules.error);
  const g = createGame(rules.value, content, ["p1", "p2"], "stacks");
  if (!g.ok) throw new Error(g.error);
  const s: GameState = structuredClone(g.value);
  for (const [id, card] of Object.entries(INSTANCES)) s.cards[id] = def(card);
  const me = s.players[0] as GameState["players"][number];
  me.tableau = tableau;
  me.bank = bank;
  return viewFor(s, "p1");
};

describe("setSummary (#79)", () => {
  it("an unfinished set: name, progress, rent now and the district colour", () => {
    const set = { district: "hayti", cards: ["h1", "h2"] };
    expect(setSummary(set, viewWith([set]))).toMatchObject({
      name: "Hayti",
      label: "2/3",
      full: false,
      tiles: 2,
      rent: 2,
      landmark: false,
      icon: false,
    });
  });

  it("a complete set with a Landmark and an Icon", () => {
    const set = { district: "hayti", cards: ["h1", "h2", "h3"], landmark: "lm", icon: "ic" };
    expect(setSummary(set, viewWith([set]))).toMatchObject({
      label: "FULL",
      full: true,
      rent: 11,
      landmark: true,
      icon: true,
    });
  });

  it("a wild completes it; a set of only wilds is not complete", () => {
    const done = { district: "hayti", cards: ["h1", "h2", "w1"] };
    expect(setSummary(done, viewWith([done])).full).toBe(true);
    const wilds = { district: "hayti", cards: ["w1", "w1", "w1"] };
    expect(setSummary(wilds, viewWith([wilds])).full).toBe(false);
  });

  it("draws at most MAX_TILES cards", () => {
    const set = { district: "hayti", cards: ["h1", "h2", "h3", "w1", "w1", "w1", "w1", "w1"] };
    expect(setSummary(set, viewWith([set])).tiles).toBe(MAX_TILES);
  });
});

describe("bankSummary", () => {
  it("the total, the count and the tiles", () => {
    const bank = ["h1", "h2"];
    const total = bank.reduce((n, id) => n + def(INSTANCES[id] as string).value, 0);
    expect(bankSummary(bank, viewWith([], bank))).toEqual({ total, count: 2, tiles: 2 });
    expect(bankSummary([], viewWith([]))).toEqual({ total: 0, count: 0, tiles: 0 });
  });

  it("draws at most MAX_TILES cards", () => {
    const bank = Array(9).fill("h1");
    expect(bankSummary(bank, viewWith([], bank)).tiles).toBe(MAX_TILES);
  });
});

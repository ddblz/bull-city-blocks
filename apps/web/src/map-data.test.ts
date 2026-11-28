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
import { districtHolders, holderText, MAP_SIZE, TILES } from "./map-data";
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
  d1: "angier-ave",
};
const set = (district: string, cards: string[]): PropertySet => ({ district, cards });
/** A real view with these tableaux for p1 and p2. */
const viewWith = (p1: PropertySet[], p2: PropertySet[]): View => {
  const rules = loadRuleset("base", [base]);
  if (!rules.ok) throw new Error(rules.error);
  const g = createGame(rules.value, content, ["p1", "p2"], "map");
  if (!g.ok) throw new Error(g.error);
  const s: GameState = structuredClone(g.value);
  for (const [id, card] of Object.entries(INSTANCES)) s.cards[id] = def(card);
  (s.players[0] as GameState["players"][number]).tableau = p1;
  (s.players[1] as GameState["players"][number]).tableau = p2;
  return viewFor(s, "p1");
};

describe("map tiles (#62)", () => {
  it("every district in the content has a tile, and only those", () => {
    expect(TILES.map((t) => t.id).sort()).toEqual(content.districts.map((d) => d.id).sort());
  });

  it("tiles are inside the viewBox and don't overlap", () => {
    for (const t of TILES) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.x + t.w).toBeLessThanOrEqual(MAP_SIZE.width);
      expect(t.y + t.h).toBeLessThanOrEqual(MAP_SIZE.height);
    }
    for (const [i, a] of TILES.entries())
      for (const b of TILES.slice(i + 1)) {
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.id} and ${b.id}`).toBe(true);
      }
  });

  it("is laid out roughly like Durham: the Eno north, Duke west, East Durham east, RTP south", () => {
    const at = (id: string) => TILES.find((t) => t.id === id) as (typeof TILES)[number];
    expect(at("the-eno").y).toBeLessThan(at("downtown").y);
    expect(at("duke").x).toBeLessThan(at("downtown").x);
    expect(at("east-durham").x).toBeGreaterThan(at("downtown").x);
    expect(at("rtp").y).toBeGreaterThan(at("downtown").y);
  });
});

describe("districtHolders", () => {
  it("shows progress for an unfinished set", () => {
    const v = viewWith([set("hayti", ["h1", "h2"])], []);
    expect(districtHolders(v).hayti).toEqual([{ player: "p1", have: 2, size: 3, full: false }]);
  });

  it("a full set of properties is complete", () => {
    const v = viewWith([set("hayti", ["h1", "h2", "h3"])], []);
    expect(districtHolders(v).hayti?.[0]).toMatchObject({ player: "p1", full: true });
  });

  it("a wild can complete a set, but a set of only wilds isn't complete (§3.5)", () => {
    const wild = districtHolders(viewWith([set("hayti", ["h1", "h2", "w1"])], []));
    expect(wild.hayti?.[0]).toMatchObject({ have: 3, full: true });
    const onlyWilds = districtHolders(viewWith([set("hayti", ["w1", "w1", "w1"])], []));
    expect(onlyWilds.hayti?.[0]).toMatchObject({ have: 3, full: false });
  });

  it("lists everyone with cards there, complete first, and keeps a player's best set", () => {
    const v = viewWith(
      [set("hayti", ["h1"]), set("hayti", ["h1", "h2"])],
      [set("hayti", ["h1", "h2", "h3"]), set("east-durham", ["d1"])],
    );
    const holders = districtHolders(v);
    expect(holders.hayti?.map((h) => [h.player, h.have, h.full])).toEqual([
      ["p2", 3, true],
      ["p1", 2, false],
    ]);
    expect(holders["east-durham"]).toHaveLength(1);
    expect(holders.walltown).toBeUndefined();
  });

  it("text reads 'Ana 2/3' or 'Ana complete'", () => {
    expect(holderText({ player: "p1", have: 2, size: 3, full: false }, "Ana")).toBe("Ana 2/3");
    expect(holderText({ player: "p1", have: 3, size: 3, full: true }, "Ana")).toBe("Ana complete");
  });
});

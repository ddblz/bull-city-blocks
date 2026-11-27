import { describe, expect, it } from "vitest";
import { rentFor } from "./rent";
import { apply, arena, game, giveSet, rules } from "./test-content";
import { applyMove, legalMoves } from "./turn";
import type { GameState, Move, PlayerState } from "./types";

const DUKE = ["west-campus:1:1", "east-campus:1:1", "erwin-rd:1:1"];
const TRANSIT = ["durham-station:1:1", "amtrak-station:1:1", "godurham:1:1", "durham-freeway:1:1"];
const LANDMARK = "golden-belt:1:1";
const ICON = "dpac:1:1";
const upgrades = (s: GameState, id: string) =>
  legalMoves(s, id).flatMap((m) => (m.type === "playUpgrade" ? [[m.card, m.district]] : []));
/** Puts a Landmark (and Icon) straight onto `p`'s first set. */
function upgrade(s: GameState, p: PlayerState, cards: string[]) {
  const set = p.tableau[0];
  for (const card of cards) {
    s.deck.splice(s.deck.indexOf(card), 1);
    if (set) set[s.cards[card]?.kind === "icon" ? "icon" : "landmark"] = card;
  }
}

describe("upgrades (§4.3)", () => {
  it("§3.5 a Landmark adds the ruleset bonus to rent, and an Icon on top adds its bonus", () => {
    const { s, me } = arena(3, [LANDMARK, ICON]);
    giveSet(s, me, "duke", DUKE);
    expect(rentFor(s, me.id, "duke")).toBe(8);
    expect(upgrades(s, me.id)).toEqual([[LANDMARK, "duke"]]); // no Icon before a Landmark
    let t = apply(s, {
      type: "playUpgrade",
      player: me.id,
      card: LANDMARK,
      district: "duke",
    }).state;
    expect(rentFor(t, me.id, "duke")).toBe(11);
    expect(t.playsRemaining).toBe(2);
    t = apply(t, { type: "playUpgrade", player: me.id, card: ICON, district: "duke" }).state;
    expect(rentFor(t, me.id, "duke")).toBe(15);
    expect(t.players.find((p) => p.id === me.id)?.tableau).toEqual([
      { district: "duke", cards: DUKE, landmark: LANDMARK, icon: ICON },
    ]);
  });

  it("§3.5 rent bonuses come from the ruleset", () => {
    const r = rules({ "upgrades.landmarkBonus": 5, "upgrades.iconBonus": 1 });
    const { s, me } = arena(3, [], [], game(3, r));
    giveSet(s, me, "duke", DUKE);
    upgrade(s, me, [LANDMARK, ICON]);
    expect(rentFor(s, me.id, "duke")).toBe(8 + 5 + 1);
  });

  it("§4.3 an Icon without a Landmark is illegal", () => {
    const { s, me } = arena(3, [ICON]);
    giveSet(s, me, "duke", DUKE);
    expect(upgrades(s, me.id)).toEqual([]);
    expect(
      applyMove(s, { type: "playUpgrade", player: me.id, card: ICON, district: "duke" }).ok,
    ).toBe(false);
  });

  it("§3.5 upgrades on Transit are illegal", () => {
    const { s, me } = arena(3, [LANDMARK]);
    giveSet(s, me, "transit", TRANSIT);
    expect(upgrades(s, me.id)).toEqual([]);
    expect(
      applyMove(s, { type: "playUpgrade", player: me.id, card: LANDMARK, district: "transit" }).ok,
    ).toBe(false);
  });

  it("§3.5 upgrades need a complete district, and each is one per district", () => {
    const { s, me } = arena(3, [LANDMARK, "carolina-theatre:1:1"]);
    giveSet(s, me, "duke", DUKE.slice(0, 2));
    expect(upgrades(s, me.id)).toEqual([]);
    const { s: t, me: m } = arena(3, ["carolina-theatre:1:1"]);
    giveSet(t, m, "duke", DUKE);
    upgrade(t, m, [LANDMARK]);
    expect(upgrades(t, m.id).filter(([card]) => card === "carolina-theatre:1:1")).toEqual([]);
  });

  it("§3.5 paying with a property from an upgraded district moves the upgrades to the bank", () => {
    const r = rules({ "payments.autoPay": false });
    const { s, me, them } = arena(3, ["rent-trinity-park-forest-hills:1:1"], [], game(3, r));
    giveSet(s, me, "trinity-park", ["watts-st:1:1"]);
    giveSet(s, them, "duke", DUKE);
    upgrade(s, them, [LANDMARK, ICON]);
    const debt: Move = {
      type: "playRent",
      player: me.id,
      card: "rent-trinity-park-forest-hills:1:1",
      district: "trinity-park",
    };
    let t = apply(s, debt).state;
    t = apply(t, { type: "pay", player: them.id, cards: ["erwin-rd:1:1"] }).state;
    const debtor = t.players.find((p) => p.id === them.id);
    expect(debtor?.tableau).toEqual([{ district: "duke", cards: DUKE.slice(0, 2) }]);
    expect(debtor?.bank).toEqual([LANDMARK, ICON]);
  });

  it("§3.4 upgrades can be paid with, and an Icon follows its Landmark to the bank", () => {
    const r = rules({ "payments.autoPay": false });
    const { s, me, them } = arena(3, ["rent-trinity-park-forest-hills:1:1"], [], game(3, r));
    giveSet(s, me, "trinity-park", ["watts-st:1:1"]);
    giveSet(s, them, "duke", DUKE);
    upgrade(s, them, [LANDMARK, ICON]);
    const debt: Move = {
      type: "playRent",
      player: me.id,
      card: "rent-trinity-park-forest-hills:1:1",
      district: "trinity-park",
    };
    let t = apply(s, debt).state;
    expect(legalMoves(t, them.id)).toContainEqual({
      type: "pay",
      player: them.id,
      cards: [LANDMARK],
    });
    t = apply(t, { type: "pay", player: them.id, cards: [LANDMARK] }).state;
    expect(t.players.find((p) => p.id === me.id)?.bank).toEqual([LANDMARK]);
    expect(t.players.find((p) => p.id === them.id)?.bank).toEqual([ICON]);
  });

  it("§3.5 moving a wild out of an upgraded district moves its upgrades to the bank", () => {
    const { s, me } = arena(3, []);
    giveSet(s, me, "duke", [...DUKE.slice(0, 2), "wild-downtown-duke:1:1"]);
    upgrade(s, me, [LANDMARK]);
    const { state } = apply(s, {
      type: "moveWild",
      player: me.id,
      card: "wild-downtown-duke:1:1",
      district: "downtown",
    });
    expect(state.players.find((p) => p.id === me.id)?.bank).toEqual([LANDMARK]);
  });

  it("§4.5 Hostile Takeover moves the upgrades along with the district", () => {
    const { s, me, them } = arena(3, ["hostile-takeover:1:1"]);
    giveSet(s, them, "duke", DUKE);
    upgrade(s, them, [LANDMARK, ICON]);
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "hostile-takeover:1:1",
      target: them.id,
      district: "duke",
    });
    expect(state.players.find((p) => p.id === me.id)?.tableau).toEqual([
      { district: "duke", cards: DUKE, landmark: LANDMARK, icon: ICON },
    ]);
    expect(rentFor(state, me.id, "duke")).toBe(15);
  });
});

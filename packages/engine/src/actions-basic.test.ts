import { describe, expect, it } from "vitest";
import { apply, current, game, next, place, rules } from "./test-content";
import { legalMoves } from "./turn";
import type { GameEvent, GameState, Move } from "./types";

/** The current player holds exactly `hand`; everyone else's bank and tableau are empty. */
function setup(n: number, hand: string[], s: GameState = game(n)) {
  const me = current(s);
  for (const p of s.players) place(s, [...p.bank], s.deck);
  place(s, [...me.hand], s.deck);
  place(s, hand, me.hand);
  return { s, me };
}
const others = (s: GameState, id: string) => {
  const i = s.players.findIndex((p) => p.id === id);
  return [...s.players.slice(i + 1), ...s.players.slice(0, i)].map((p) => p.id);
};
const debtors = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === "debtSettled" ? [e.debtor] : []));

describe("basic actions", () => {
  it("§4.5 Walk-Off Win: draw 2 cards", () => {
    const { s, me } = setup(3, ["walk-off-win:1:1"]);
    const { state, events } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "walk-off-win:1:1",
    });
    expect(state.players.find((p) => p.id === me.id)?.hand).toHaveLength(2);
    expect(events).toContainEqual({ type: "cardsDrawn", player: me.id, count: 2 });
    expect(state.discard.at(-1)).toBe("walk-off-win:1:1");
    expect(state.playsRemaining).toBe(2);
  });

  it("§4.5 Food Truck Rodeo: every other player pays you 2", () => {
    const { s, me } = setup(3, ["food-truck-rodeo:1:1"]);
    const [a, b] = others(s, me.id);
    place(s, ["cash-1:1:1", "cash-1:1:2"], s.players.find((p) => p.id === a)?.bank as string[]);
    place(s, ["cash-5:1:1", "cash-1:1:3"], s.players.find((p) => p.id === b)?.bank as string[]);
    const played = apply(s, { type: "playAction", player: me.id, card: "food-truck-rodeo:1:1" });
    // a owes exactly what they own, so they pay automatically; b has a choice and is asked.
    expect(debtors(played.events)).toEqual([a]);
    expect(played.state.pending).toEqual([{ type: "debt", debtor: b, creditor: me.id, amount: 2 }]);
    const paid = apply(played.state, {
      type: "pay",
      player: b as string,
      cards: ["cash-5:1:1"],
    }).state;
    expect(paid.players.find((p) => p.id === me.id)?.bank.sort()).toEqual([
      "cash-1:1:1",
      "cash-1:1:2",
      "cash-5:1:1",
    ]);
  });

  it.each([
    [null, 9],
    [4, 4],
  ])(
    "§4.5 Food Truck Rodeo at 10 players with maxTargets %s charges %i players",
    (cap, charged) => {
      const r = cap === null ? rules() : rules({ "actions.foodTruckRodeo.maxTargets": cap });
      const { s, me } = setup(10, ["food-truck-rodeo:1:1"], game(10, r));
      const { events } = apply(s, {
        type: "playAction",
        player: me.id,
        card: "food-truck-rodeo:1:1",
      });
      expect(debtors(events)).toEqual(others(s, me.id).slice(0, charged));
    },
  );

  it.each([
    ["base cap 5, 2 properties → pays 2", {}, 2, 2],
    ["base cap 5, 7 properties → pays 5", {}, 7, 5],
    ["ruleset cap 3, 7 properties → pays 3", { "actions.assessment.cap": 3 }, 7, 3],
  ])("§4.5 Assessment: %s", (_name, overrides, props, owed) => {
    const { s, me } = setup(3, ["assessment:1:1"], game(3, rules(overrides)));
    const target = next(s);
    const cards = [
      "ninth-st:1:1",
      "hillsborough-rd:1:1",
      "onslow-st:1:1",
      "berkeley-st:1:1",
      "angier-ave:1:1",
      "driver-st:1:1",
      "holloway-st:1:1",
    ];
    target.tableau.push({ district: "mixed", cards: [] });
    place(s, cards.slice(0, props), target.tableau[0]?.cards as string[]);
    place(s, ["cash-10:1:1"], target.bank); // enough that they choose how to pay
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "assessment:1:1",
      target: target.id,
    });
    expect(state.pending).toEqual([
      { type: "debt", debtor: target.id, creditor: me.id, amount: owed },
    ]);
  });

  it("§4.5 Assessment and Construction Delay offer every other player as a target", () => {
    const { s, me } = setup(4, ["assessment:1:1", "construction-delay:1:1"]);
    const targets = (card: string) =>
      legalMoves(s, me.id).flatMap((m) =>
        m.type === "playAction" && m.card === card ? [m.target] : [],
      );
    expect(targets("assessment:1:1")).toEqual(others(s, me.id));
    expect(targets("construction-delay:1:1")).toEqual(others(s, me.id));
  });

  it("§4.5 Construction Delay: the target draws only 1 card on their next turn, and delays don't stack", () => {
    const { s, me } = setup(2, ["construction-delay:1:1", "construction-delay:1:2"]);
    const target = next(s).id;
    let t = apply(s, {
      type: "playAction",
      player: me.id,
      card: "construction-delay:1:1",
      target,
    }).state;
    t = apply(t, {
      type: "playAction",
      player: me.id,
      card: "construction-delay:1:2",
      target,
    }).state;
    const first = apply(t, { type: "endTurn", player: me.id });
    expect(first.events).toContainEqual({ type: "cardsDrawn", player: target, count: 1 });
    // Only the next draw: the turn after that is a normal 2.
    const second = apply(apply(first.state, { type: "endTurn", player: target }).state, {
      type: "endTurn",
      player: me.id,
    });
    expect(second.events).toContainEqual({ type: "cardsDrawn", player: target, count: 2 });
  });

  it("§4.5 every action card can be banked at its value", () => {
    const s = game(3);
    const me = current(s);
    const actions = Object.keys(s.cards).filter(
      (c) => s.cards[c]?.kind === "action" && c.endsWith(":1:1"),
    );
    expect(actions).toHaveLength(9);
    for (const card of actions) {
      const { s: t } = setup(3, [card], JSON.parse(JSON.stringify(s)));
      const move: Move = { type: "bank", player: me.id, card };
      expect(legalMoves(t, me.id)).toContainEqual(move);
      const after = apply(t, move).state;
      expect(after.players.find((p) => p.id === me.id)?.bank).toEqual([card]);
    }
  });
});

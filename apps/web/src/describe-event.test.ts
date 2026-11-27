import { describe, expect, it } from "vitest";
import { type Context, cardName, describeEvent, type GameEvent } from "./describe-event";
import type { Card } from "./types";

const defs: Record<string, Card> = {
  "erwin-rd:1:1": {
    kind: "property",
    id: "erwin-rd",
    name: "Erwin Rd",
    district: "duke",
    value: 4,
    count: 1,
  },
  "wild:1:1": {
    kind: "wild",
    id: "wild",
    name: "Bull City Wild",
    districts: "any",
    value: 0,
    count: 2,
  },
  "cash-2:1:1": { kind: "cash", id: "cash-2", name: "$2", value: 2, count: 6 },
  "rodeo:1:1": {
    kind: "action",
    id: "food-truck-rodeo",
    name: "Food Truck Rodeo",
    action: "foodTruckRodeo",
    value: 2,
    count: 3,
  },
  "theatre:1:1": { kind: "landmark", id: "theatre", name: "The Theatre", value: 3, count: 1 },
  "rent:1:1": {
    kind: "rent",
    id: "rent",
    name: "Duke / Downtown Rent",
    districts: ["duke", "downtown"],
    value: 1,
    count: 2,
  },
};
const names: Record<string, string> = { me: "Ana", sam: "Sam", alex: "Alex" };
/** As read by `viewer`. */
const ctx = (viewer: string): Context => ({
  viewer,
  playerName: (id) => names[id] ?? id,
  card: (id) => defs[id],
  districtName: (id) => ({ duke: "Duke", downtown: "Downtown" })[id] ?? id,
});
const say = (event: GameEvent, viewer = "me") => describeEvent(event, ctx(viewer));

/** One event per GameEvent type, with what Ana (the subject) and Alex (a bystander) read. */
const cases: [GameEvent, string, string][] = [
  [
    { type: "turnStarted", player: "me", turn: 5, round: 2 },
    "Your turn 5 started (round 2)",
    "Ana's turn 5 started (round 2)",
  ],
  [{ type: "cardsDrawn", player: "me", count: 2 }, "You drew 2 cards", "Ana drew 2 cards"],
  [
    { type: "deckReshuffled", cards: 40 },
    "The discard pile was reshuffled into the deck (40 cards)",
    "The discard pile was reshuffled into the deck (40 cards)",
  ],
  [
    { type: "propertyPlayed", player: "me", card: "erwin-rd:1:1" },
    "You played Erwin Rd to Duke",
    "Ana played Erwin Rd to Duke",
  ],
  [{ type: "banked", player: "me", card: "cash-2:1:1" }, "You banked $2", "Ana banked $2"],
  [
    { type: "upgradePlayed", player: "me", card: "theatre:1:1", district: "duke" },
    "You put The Theatre on Duke",
    "Ana put The Theatre on Duke",
  ],
  [
    { type: "wildMoved", player: "me", card: "wild:1:1", district: "downtown" },
    "You moved Bull City Wild to Downtown",
    "Ana moved Bull City Wild to Downtown",
  ],
  [
    { type: "discarded", player: "me", card: "rodeo:1:1" },
    "You discarded Food Truck Rodeo",
    "Ana discarded Food Truck Rodeo",
  ],
  [
    {
      type: "rentCharged",
      player: "sam",
      card: "rent:1:1",
      district: "duke",
      amount: 4,
      debtors: ["me", "alex"],
    },
    "Sam charged $4 rent on Duke to you and Alex",
    "Sam charged $4 rent on Duke to Ana and you",
  ],
  [
    { type: "actionPlayed", player: "sam", card: "rodeo:1:1" },
    "Sam played Food Truck Rodeo",
    "Sam played Food Truck Rodeo",
  ],
  [
    { type: "paid", debtor: "me", creditor: "sam", cards: ["cash-2:1:1", "erwin-rd:1:1"] },
    "You paid Sam $6 ($2, Erwin Rd)",
    "Ana paid Sam $6 ($2, Erwin Rd)",
  ],
  [
    { type: "debtSettled", debtor: "me", creditor: "sam", forgiven: 3 },
    "You ran out of cards; the last $3 owed to Sam is forgiven",
    "Ana ran out of cards; the last $3 owed to Sam is forgiven",
  ],
  [
    { type: "autoResolved", player: "me", kind: "respond" },
    "Auto-pass answered for you (no Appeal in hand)",
    "Auto-pass answered for Ana (no Appeal in hand)",
  ],
  [
    { type: "responded", player: "me", appeal: true },
    "You played an Appeal",
    "Ana played an Appeal",
  ],
  [
    {
      type: "actionResolved",
      attacker: "sam",
      target: "me",
      card: "rodeo:1:1",
      cancelled: false,
      effect: { kind: "debt", amount: 2 },
    },
    "Sam's Food Truck Rodeo stands: you owe $2",
    "Sam's Food Truck Rodeo stands: Ana owes $2",
  ],
  [
    { type: "prefSet", player: "me", autoPass: false },
    "You turned auto-pass off",
    "Ana turned auto-pass off",
  ],
  [{ type: "gameOver", result: "me" }, "You won the game!", "Ana won the game!"],
];

describe("describeEvent (#41)", () => {
  it("covers every GameEvent type", () => {
    const types = new Set(cases.map(([e]) => e.type));
    expect(types.size).toBe(17);
  });

  it.each(cases)(
    "%j reads well for the player it's about and for others",
    (event, mine, theirs) => {
      expect(say(event, "me")).toBe(mine);
      expect(say(event, "alex")).toBe(theirs);
    },
  );

  it("never shows raw JSON or an undefined", () => {
    for (const [event] of cases)
      for (const viewer of ["me", "alex"]) expect(say(event, viewer)).not.toMatch(/[{}]|undefined/);
  });

  it("counts drawn cards but never names them", () => {
    const text = say({ type: "cardsDrawn", player: "sam", count: 3 });
    expect(text).toBe("Sam drew 3 cards");
  });

  it("describes each action outcome: steals, delay, takeover and Appeals", () => {
    const resolved = (
      effect: Extract<GameEvent, { type: "actionResolved" }>["effect"],
      cancelled = false,
    ) =>
      say({
        type: "actionResolved",
        attacker: "sam",
        target: "me",
        card: "rodeo:1:1",
        cancelled,
        effect,
      });
    expect(resolved({ kind: "buyout", take: "erwin-rd:1:1" })).toBe("Sam bought Erwin Rd from you");
    expect(resolved({ kind: "swap", take: "erwin-rd:1:1", give: "wild:1:1" })).toBe(
      "Sam swapped Bull City Wild for your Erwin Rd",
    );
    expect(resolved({ kind: "takeover", district: "duke" })).toBe("Sam took your Duke set");
    expect(resolved({ kind: "delay" })).toBe(
      "Sam's Food Truck Rodeo stands: you will draw only 1 card next turn",
    );
    expect(resolved({ kind: "delay" }, true)).toBe(
      "Sam's Food Truck Rodeo on you was cancelled by Appeal",
    );
    expect(say({ type: "gameOver", result: "stall" })).toBe(
      "The game stalled at the round limit; nobody won",
    );
    expect(say({ type: "debtSettled", debtor: "sam", creditor: "me", forgiven: 0 })).toBe(
      "Sam settled up with you",
    );
    expect(say({ type: "autoResolved", player: "sam", kind: "pay" })).toMatch(
      /^Auto-pay paid for Sam: /,
    );
  });

  it("names a card it can no longer see from its card id", () => {
    expect(cardName("walk-off-win:1:9", ctx("me"))).toBe("Walk Off Win");
  });
});

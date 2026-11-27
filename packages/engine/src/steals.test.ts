import { describe, expect, it } from "vitest";
import { apply, arena, game, giveSet, place, rules } from "./test-content";
import { applyMove, legalMoves } from "./turn";
import type { GameState, Move } from "./types";

const tableau = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.tableau;
const ofType = (s: GameState, id: string, card: string) =>
  legalMoves(s, id).filter(
    (m): m is Extract<Move, { type: "playAction" }> => m.type === "playAction" && m.card === card,
  );

describe("steals (§4.5)", () => {
  it("§4.5 Buyout takes a property from an incomplete set and the attacker owes its value", () => {
    const { s, me, them } = arena(3, ["buyout:1:1"]);
    giveSet(s, them, "hayti", ["fayetteville-st:1:1"]);
    place(s, ["cash-5:1:1", "cash-1:1:1"], me.bank); // more than 2: the attacker chooses how to pay
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "buyout:1:1",
      target: them.id,
      take: "fayetteville-st:1:1",
    });
    expect(tableau(state, me.id)).toEqual([{ district: "hayti", cards: ["fayetteville-st:1:1"] }]);
    expect(tableau(state, them.id)).toEqual([]);
    expect(state.pending).toEqual([{ type: "debt", debtor: me.id, creditor: them.id, amount: 2 }]);
  });

  it("§4.5 Buyout with payCardValue off costs nothing", () => {
    const { s, me, them } = arena(
      3,
      ["buyout:1:1"],
      [],
      game(3, rules({ "actions.buyout.payCardValue": false })),
    );
    giveSet(s, them, "hayti", ["fayetteville-st:1:1"]);
    const move: Move = {
      type: "playAction",
      player: me.id,
      card: "buyout:1:1",
      target: them.id,
      take: "fayetteville-st:1:1",
    };
    const { state } = apply(s, move);
    expect(state.pending).toEqual([]);
    expect(tableau(state, me.id)).toEqual([{ district: "hayti", cards: ["fayetteville-st:1:1"] }]);
  });

  it("§4.5 Buyout and Swap Meet can't target complete sets", () => {
    const { s, me, them } = arena(3, ["buyout:1:1", "swap-meet:1:1"]);
    giveSet(s, them, "old-west-durham", ["ninth-st:1:1", "hillsborough-rd:1:1"]); // complete
    giveSet(s, them, "duke", ["erwin-rd:1:1"]);
    giveSet(s, me, "walltown", ["onslow-st:1:1", "berkeley-st:1:1"]); // complete
    giveSet(s, me, "rtp", ["southpoint:1:1"]);
    expect(ofType(s, me.id, "buyout:1:1").map((m) => m.take)).toEqual(["erwin-rd:1:1"]);
    expect(ofType(s, me.id, "swap-meet:1:1").map((m) => [m.give, m.take])).toEqual([
      ["southpoint:1:1", "erwin-rd:1:1"],
    ]);
    const illegal: Move = {
      type: "playAction",
      player: me.id,
      card: "buyout:1:1",
      target: them.id,
      take: "ninth-st:1:1",
    };
    expect(applyMove(s, illegal).ok).toBe(false);
  });

  it("§4.5 Swap Meet swaps one of your properties for one of theirs", () => {
    const { s, me, them } = arena(3, ["swap-meet:1:1"]);
    giveSet(s, them, "duke", ["erwin-rd:1:1"]);
    giveSet(s, me, "rtp", ["southpoint:1:1"]);
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "swap-meet:1:1",
      target: them.id,
      take: "erwin-rd:1:1",
      give: "southpoint:1:1",
    });
    expect(tableau(state, me.id)).toEqual([{ district: "duke", cards: ["erwin-rd:1:1"] }]);
    expect(tableau(state, them.id)).toEqual([{ district: "rtp", cards: ["southpoint:1:1"] }]);
  });

  it("§4.5 Hostile Takeover takes a complete district and costs 2 plays", () => {
    const { s, me, them } = arena(3, ["hostile-takeover:1:1"]);
    giveSet(s, them, "old-west-durham", ["ninth-st:1:1", "hillsborough-rd:1:1"]);
    giveSet(s, them, "duke", ["erwin-rd:1:1"]); // incomplete: not offered
    expect(ofType(s, me.id, "hostile-takeover:1:1").map((m) => m.district)).toEqual([
      "old-west-durham",
    ]);
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "hostile-takeover:1:1",
      target: them.id,
      district: "old-west-durham",
    });
    expect(tableau(state, me.id)).toEqual([
      { district: "old-west-durham", cards: ["ninth-st:1:1", "hillsborough-rd:1:1"] },
    ]);
    expect(tableau(state, them.id)).toEqual([{ district: "duke", cards: ["erwin-rd:1:1"] }]);
    expect(state.playsRemaining).toBe(1);
  });

  it("§4.5 Hostile Takeover is illegal with fewer than 2 plays remaining", () => {
    const { s, me, them } = arena(3, ["hostile-takeover:1:1"]);
    giveSet(s, them, "old-west-durham", ["ninth-st:1:1", "hillsborough-rd:1:1"]);
    s.playsRemaining = 1;
    expect(ofType(s, me.id, "hostile-takeover:1:1")).toEqual([]);
    const move: Move = {
      type: "playAction",
      player: me.id,
      card: "hostile-takeover:1:1",
      target: them.id,
      district: "old-west-durham",
    };
    expect(applyMove(s, move).ok).toBe(false);
  });

  it("§3.6 an Appealed steal moves nothing", () => {
    const { s, me, them } = arena(3, ["buyout:1:1"], ["appeal:1:1"]);
    giveSet(s, them, "duke", ["erwin-rd:1:1"]);
    let { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "buyout:1:1",
      target: them.id,
      take: "erwin-rd:1:1",
    });
    state = apply(state, { type: "respond", player: them.id, appeal: "appeal:1:1" }).state;
    expect(tableau(state, them.id)).toEqual([{ district: "duke", cards: ["erwin-rd:1:1"] }]);
    expect(tableau(state, me.id)).toEqual([]);
  });
});

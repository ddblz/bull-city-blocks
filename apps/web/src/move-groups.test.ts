import { describe, expect, it } from "vitest";
import { groupMoves } from "./move-groups";
import type { Move } from "./types";

const player = "p0";

describe("groupMoves (#37, #38)", () => {
  it("groups play and bank per hand card, plus end turn", () => {
    const legal: Move[] = [
      { type: "playProperty", player, card: "a" },
      { type: "bank", player, card: "b" },
      { type: "bank", player, card: "c" },
      { type: "endTurn", player },
    ];
    const g = groupMoves(legal);
    expect(g.hand).toEqual({
      a: { play: legal[0] },
      b: { bank: legal[1] },
      c: { bank: legal[2] },
    });
    expect(g.endTurn).toBe(legal[3]);
    expect(g.accept).toBeUndefined();
  });

  it("offers only moves from legalMoves: nothing is added", () => {
    const g = groupMoves([]);
    expect(g).toEqual({ hand: {}, flows: {}, discard: {}, payable: [] });
  });

  it("groups the moves that need choices per card: wilds, upgrades, moving wilds, rent, actions", () => {
    const legal: Move[] = [
      { type: "playProperty", player, card: "w", district: "owd" },
      { type: "playProperty", player, card: "w", district: "walltown" },
      { type: "playUpgrade", player, card: "u", district: "owd" },
      { type: "moveWild", player, card: "w2", district: "walltown" },
      { type: "playRent", player, card: "r", district: "owd" },
      { type: "playAction", player, card: "x", target: "p1" },
    ];
    const g = groupMoves(legal);
    expect(g.flows).toEqual({
      w: [legal[0], legal[1]],
      u: [legal[2]],
      w2: [legal[3]],
      r: [legal[4]],
      x: [legal[5]],
    });
    expect(g.hand).toEqual({});
  });

  it("groups discards per hand card", () => {
    const legal: Move[] = [
      { type: "discard", player, card: "a" },
      { type: "discard", player, card: "b" },
    ];
    expect(groupMoves(legal).discard).toEqual({ a: legal[0], b: legal[1] });
  });

  it("§3.4 collects the payable cards once each, for a multi-card payment", () => {
    const legal: Move[] = [
      { type: "pay", player, cards: ["a"] },
      { type: "pay", player, cards: ["b"] },
      { type: "pay", player, cards: ["a", "b"] },
    ];
    expect(groupMoves(legal).payable).toEqual(["a", "b"]);
  });

  it("§3.6 offers accepting and, when legal, an Appeal", () => {
    const accept: Move = { type: "respond", player };
    const appeal: Move = { type: "respond", player, appeal: "ap" };
    expect(groupMoves([accept, appeal])).toMatchObject({ accept, appeal });
    expect(groupMoves([accept]).appeal).toBeUndefined();
  });
});

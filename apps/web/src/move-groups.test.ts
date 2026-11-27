import { describe, expect, it } from "vitest";
import { groupMoves } from "./move-groups";
import type { Move } from "./types";

const player = "p0";

describe("groupMoves (#37 simple moves)", () => {
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
    expect(g).toEqual({ hand: {}, discard: {}, pay: {} });
  });

  it("leaves #38's moves out: wilds, upgrades, moving wilds, rent and actions", () => {
    const g = groupMoves([
      { type: "playProperty", player, card: "w", district: "owd" },
      { type: "playUpgrade", player, card: "u", district: "owd" },
      { type: "moveWild", player, card: "w2", district: "walltown" },
      { type: "playRent", player, card: "r", district: "owd" },
      { type: "playAction", player, card: "x", target: "p1" },
    ]);
    expect(g).toEqual({ hand: {}, discard: {}, pay: {} });
  });

  it("groups discards per hand card", () => {
    const legal: Move[] = [
      { type: "discard", player, card: "a" },
      { type: "discard", player, card: "b" },
    ];
    expect(groupMoves(legal).discard).toEqual({ a: legal[0], b: legal[1] });
  });

  it("§3.4 offers paying with one card at a time", () => {
    const legal: Move[] = [
      { type: "pay", player, cards: ["a"] },
      { type: "pay", player, cards: ["b"] },
      { type: "pay", player, cards: ["a", "b"] },
    ];
    expect(groupMoves(legal).pay).toEqual({ a: legal[0], b: legal[1] });
  });

  it("§3.6 offers accepting, but not an Appeal", () => {
    const accept: Move = { type: "respond", player };
    const g = groupMoves([accept, { type: "respond", player, appeal: "ap" }]);
    expect(g.accept).toBe(accept);
    expect(g.hand).toEqual({});
  });
});

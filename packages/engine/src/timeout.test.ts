import { describe, expect, it } from "vitest";
import { apply, arena, game, giveSet, place, rules } from "./test-content";
import { awaiting, timeoutMove, timeoutPayment } from "./timeout";
import { applyMove } from "./turn";
import type { GameState, Move } from "./types";

describe("timeoutMove (SPEC §3.7)", () => {
  it("§3.7 Play: end the turn", () => {
    const s = game(3);
    expect(awaiting(s)).toEqual({ player: s.currentPlayer, kind: "play" });
    expect(timeoutMove(s)).toEqual({ type: "endTurn", player: s.currentPlayer });
  });

  it("§3.7 Discard: discard the lowest-value card", () => {
    const { s, me } = arena(3, [
      "cash-5:1:1",
      "cash-1:1:1",
      "cash-3:1:1",
      "cash-2:1:1",
      "cash-4:1:1",
      "cash-2:1:2",
      "cash-1:1:2",
      "cash-10:1:1",
    ]);
    const t = apply(s, { type: "endTurn", player: me.id }).state;
    expect(awaiting(t)).toEqual({ player: me.id, kind: "discard" });
    expect(timeoutMove(t)).toEqual({ type: "discard", player: me.id, card: "cash-1:1:1" });
  });

  it("§3.7 Respond: accept the action", () => {
    const { s, me, them } = arena(3, ["construction-delay:1:1"], ["appeal:1:1"]);
    const t = apply(s, {
      type: "playAction",
      player: me.id,
      card: "construction-delay:1:1",
      target: them.id,
    }).state;
    expect(awaiting(t)).toEqual({ player: them.id, kind: "respond" });
    expect(timeoutMove(t)).toEqual({ type: "respond", player: them.id });
  });

  /** A debtor holding `bank` and `tableau` (as a Duke set), owing `amount`. */
  function debtor(bank: string[], tableau: string[]) {
    const { s, them } = arena(3, [], [], game(3, rules({ "payments.autoPay": false })));
    place(s, bank, them.bank);
    if (tableau.length) giveSet(s, them, "duke", tableau);
    return { s, them: them.id };
  }
  it.each([
    [
      "one card covers it: the lowest such bank card",
      ["cash-1:1:1", "cash-3:1:1", "cash-4:1:1"],
      [],
      3,
      ["cash-3:1:1"],
    ],
    [
      "fewest cards beats bank-first",
      ["cash-1:1:1", "cash-2:1:1"],
      ["erwin-rd:1:1"],
      3,
      ["erwin-rd:1:1"],
    ],
    ["bank before tableau at equal count", ["cash-4:1:1"], ["erwin-rd:1:1"], 4, ["cash-4:1:1"]],
    [
      "two cards, lowest values that still cover",
      ["cash-1:1:1", "cash-2:1:1", "cash-3:1:1", "cash-5:1:1"],
      [],
      6,
      ["cash-1:1:1", "cash-5:1:1"],
    ],
    [
      "can't cover: pays everything",
      ["cash-1:1:1", "cash-2:1:1"],
      [],
      9,
      ["cash-1:1:1", "cash-2:1:1"],
    ],
  ])("§3.7 Pay: %s", (_name, bank, tableau, amount, expected) => {
    const { s, them } = debtor(bank, tableau);
    expect([...timeoutPayment(s, them, amount)].sort()).toEqual([...expected].sort());
  });

  it("§3.7 Pay: the timeout move is the timeout payment, and it applies", () => {
    const { s, them } = debtor(["cash-1:1:1", "cash-5:1:1", "cash-2:1:1"], []);
    const me = s.currentPlayer;
    s.pending = [{ type: "debt", debtor: them, creditor: me, amount: 2 }];
    s.phase = "pay";
    const move = timeoutMove(s) as Move;
    expect(move).toEqual({ type: "pay", player: them, cards: ["cash-2:1:1"] });
    expect(applyMove(s, move).ok).toBe(true);
  });

  it("is deterministic and null once the game is over", () => {
    const s = game(5);
    expect(timeoutMove(s)).toEqual(timeoutMove(JSON.parse(JSON.stringify(s)) as GameState));
    expect(timeoutMove({ ...s, phase: "gameOver", result: "stall" })).toBeNull();
  });
});

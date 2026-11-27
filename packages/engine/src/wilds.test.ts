import { describe, expect, it } from "vitest";
import { apply, arena, game, giveSet, rules } from "./test-content";
import { applyMove, completeDistricts, legalMoves, winner } from "./turn";
import type { GameState, Move } from "./types";

const OWD_WILD = "wild-old-west-durham-walltown:1:1";
const DUKE_WILD = "wild-downtown-duke:1:1";
const BCW = "bull-city-wild:1:1";
const tableau = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.tableau;

describe("wild properties (§4.2)", () => {
  it("§4.2 a district made of wilds only is not complete", () => {
    const { s, me } = arena(3, []);
    giveSet(s, me, "old-west-durham", [OWD_WILD, BCW]);
    expect(completeDistricts(s, me.id).size).toBe(0);
    giveSet(s, me, "walltown", ["onslow-st:1:1", "wild-old-west-durham-walltown:1:2"]);
    expect([...completeDistricts(s, me.id)]).toEqual(["walltown"]);
  });

  it("§4.2 wilds-only sets don't count toward the win", () => {
    const { s, me } = arena(3, ["southpoint:1:1"]);
    giveSet(s, me, "walltown", ["onslow-st:1:1", "berkeley-st:1:1"]);
    giveSet(s, me, "duke", ["west-campus:1:1", "east-campus:1:1", "erwin-rd:1:1"]);
    giveSet(s, me, "old-west-durham", [OWD_WILD, BCW]);
    const { state } = apply(s, { type: "playProperty", player: me.id, card: "southpoint:1:1" });
    expect(winner(state)).toBeNull();
  });

  it("§4.2 a pair wild is played into one of its two districts, a Bull City Wild into any; each costs a play", () => {
    const { s, me } = arena(3, [OWD_WILD, BCW]);
    const plays = (card: string) =>
      legalMoves(s, me.id).flatMap((m) =>
        m.type === "playProperty" && m.card === card ? [m.district] : [],
      );
    expect(plays(OWD_WILD)).toEqual(["old-west-durham", "walltown"]);
    expect(plays(BCW)).toHaveLength(14);
    const { state } = apply(s, {
      type: "playProperty",
      player: me.id,
      card: OWD_WILD,
      district: "walltown",
    });
    expect(tableau(state, me.id)).toEqual([{ district: "walltown", cards: [OWD_WILD] }]);
    expect(state.playsRemaining).toBe(2);
  });

  it("§3.2 moveWild costs no play and is only legal on your own turn", () => {
    const { s, me, them } = arena(3, []);
    giveSet(s, me, "old-west-durham", ["ninth-st:1:1", OWD_WILD]);
    giveSet(s, them, "duke", [DUKE_WILD]);
    const move: Move = { type: "moveWild", player: me.id, card: OWD_WILD, district: "walltown" };
    expect(legalMoves(s, me.id)).toContainEqual(move);
    const { state } = apply(s, move);
    expect(state.playsRemaining).toBe(3);
    expect(tableau(state, me.id)).toEqual([
      { district: "old-west-durham", cards: ["ninth-st:1:1"] },
      { district: "walltown", cards: [OWD_WILD] },
    ]);
    expect(
      applyMove(s, { type: "moveWild", player: them.id, card: DUKE_WILD, district: "downtown" }).ok,
    ).toBe(false);
  });

  it("§3.2 each wild can be moved once per turn, and every wild gets its own move", () => {
    const { s, me } = arena(2, []);
    giveSet(s, me, "old-west-durham", ["ninth-st:1:1", OWD_WILD]);
    giveSet(s, me, "duke", ["erwin-rd:1:1", DUKE_WILD]);
    let t = apply(s, {
      type: "moveWild",
      player: me.id,
      card: OWD_WILD,
      district: "walltown",
    }).state;
    const back: Move = {
      type: "moveWild",
      player: me.id,
      card: OWD_WILD,
      district: "old-west-durham",
    };
    expect(legalMoves(t, me.id)).not.toContainEqual(back);
    expect(applyMove(t, back).ok).toBe(false);
    t = apply(t, { type: "moveWild", player: me.id, card: DUKE_WILD, district: "downtown" }).state; // a different wild
    // On their next turn, the same wild can move again.
    const them = t.players.find((p) => p.id !== me.id)?.id as string;
    t = apply(t, { type: "endTurn", player: me.id }).state;
    t = apply(t, { type: "endTurn", player: them }).state;
    while (t.phase === "discard") t = apply(t, legalMoves(t, t.currentPlayer)[0] as Move).state;
    expect(t.currentPlayer).toBe(me.id);
    expect(legalMoves(t, me.id)).toContainEqual(back);
  });

  it("§3.4 a wild received as payment goes to the creditor's tableau, in the district it was in", () => {
    const { s, me, them } = arena(
      2,
      ["rent-downtown-duke:1:1"],
      [],
      game(2, rules({ "payments.autoPay": false })),
    );
    giveSet(s, me, "duke", ["erwin-rd:1:1"]);
    giveSet(s, them, "duke", [DUKE_WILD]);
    them.bank.push(...s.deck.splice(s.deck.indexOf("cash-10:1:1"), 1));
    const rent: Move = {
      type: "playRent",
      player: me.id,
      card: "rent-downtown-duke:1:1",
      district: "duke",
    };
    let t = apply(s, rent).state;
    expect(t.phase).toBe("pay");
    t = apply(t, { type: "pay", player: them.id, cards: [DUKE_WILD] }).state;
    expect(tableau(t, me.id)).toEqual([{ district: "duke", cards: ["erwin-rd:1:1", DUKE_WILD] }]);
  });
});

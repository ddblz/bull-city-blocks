import { describe, expect, it } from "vitest";
import { randomInt, seedRng } from "./rng";
import {
  apply,
  baseRules,
  cardsIn,
  current,
  deepFreeze,
  game,
  next,
  ofCard,
  place,
  rules,
} from "./test-content";
import { applyMove, awaitedPlayer, legalMoves, winner } from "./turn";
import type { Move } from "./types";

describe("turn loop", () => {
  it("§3.2 legalMoves during Play offers playProperty, bank and endTurn, respecting playsRemaining", () => {
    const s = game();
    const p = current(s).id;
    const [prop, cash, action, rent, landmark, wild] = [
      "ninth-st",
      "cash-1",
      "walk-off-win",
      "wild-rent",
      "golden-belt",
      "bull-city-wild",
    ].map((c) => ofCard(s, c)[0] as string);
    current(s).hand = [];
    place(s, [prop, cash, action, rent, landmark, wild] as string[], current(s).hand);
    expect(legalMoves(s, p)).toEqual([
      { type: "playProperty", player: p, card: prop },
      { type: "bank", player: p, card: cash },
      { type: "bank", player: p, card: action },
      { type: "bank", player: p, card: rent },
      { type: "playAction", player: p, card: action }, // Walk-Off Win (§4.5, since #7)
      { type: "endTurn", player: p },
    ]);
    expect(legalMoves(s, next(s).id)).toEqual([]);
    let t = apply(s, { type: "bank", player: p, card: cash as string }).state;
    expect(t.playsRemaining).toBe(2);
    t = apply(t, { type: "bank", player: p, card: action as string }).state;
    t = apply(t, { type: "bank", player: p, card: rent as string }).state;
    // The third play uses the last one, so the turn passes on its own (ARCHITECTURE §4.1 T8).
    expect(t.currentPlayer).not.toBe(p);
    expect(t.playsRemaining).toBe(3);
  });

  it("§3.2 a player draws 5 instead of 2 when their hand is empty", () => {
    const s = game();
    const following = next(s);
    place(s, [...following.hand], s.discard);
    const { state, events } = apply(s, { type: "endTurn", player: s.currentPlayer });
    expect(state.players.find((p) => p.id === following.id)?.hand).toHaveLength(5);
    expect(events).toContainEqual({ type: "cardsDrawn", player: following.id, count: 5 });
  });

  it("§3.3 an empty draw pile reshuffles the discard pile", () => {
    const s = game();
    place(s, s.deck.slice(0, 10), s.discard);
    place(s, [...s.deck], current(s).bank);
    const { state, events } = apply(s, { type: "endTurn", player: s.currentPlayer });
    expect(events).toContainEqual({ type: "deckReshuffled", cards: 10 });
    expect([state.deck.length, state.discard.length]).toEqual([8, 0]);
  });

  it("§3.3 with both piles empty, a player draws only what is available", () => {
    const s = game();
    place(s, s.deck.slice(1), current(s).bank);
    const { state, events } = apply(s, { type: "endTurn", player: s.currentPlayer });
    expect(events).toContainEqual({ type: "cardsDrawn", player: state.currentPlayer, count: 1 });
    expect(state.deck).toEqual([]);
  });

  it.each([7, 3])("§3.2 the Discard phase enforces the ruleset hand limit (%i)", (limit) => {
    let s = game(3, rules({ "hand.limit": limit }));
    const p = s.currentPlayer;
    place(s, s.deck.slice(0, 1), current(s).hand); // 8 cards: over the limit either way
    s = apply(s, { type: "endTurn", player: p }).state;
    expect(s).toMatchObject({ phase: "discard", currentPlayer: p });
    const moves = legalMoves(s, p);
    expect(moves.every((m) => m.type === "discard")).toBe(true);
    while (s.phase === "discard") s = apply(s, legalMoves(s, p)[0] as Move).state;
    expect(s.players.find((x) => x.id === p)?.hand).toHaveLength(limit);
    expect(s.currentPlayer).not.toBe(p);
  });

  it("§3.2 completing 3 districts ends the game immediately", () => {
    const s = game();
    const me = current(s);
    for (const [district, cards] of [
      ["old-west-durham", ["ninth-st", "hillsborough-rd"]],
      ["walltown", ["onslow-st", "berkeley-st"]],
      ["rtp", ["research-triangle-park"]],
    ] as const) {
      const set = { district, cards: [] as string[] };
      me.tableau.push(set);
      place(
        s,
        cards.map((c) => ofCard(s, c)[0] as string),
        set.cards,
      );
    }
    const last = ofCard(s, "southpoint")[0] as string;
    place(s, [last], me.hand);
    const { state, events } = apply(s, { type: "playProperty", player: me.id, card: last });
    expect(winner(state)).toBe(me.id);
    expect(events.at(-1)).toEqual({ type: "gameOver", result: me.id });
    expect(legalMoves(state, me.id)).toEqual([]);
    expect(applyMove(state, { type: "endTurn", player: me.id }).ok).toBe(false);
  });

  it("§3.5 two complete sets of the same district count as one district", () => {
    const s = game(8);
    const me = current(s);
    for (const cards of [
      ["ninth-st:1:1", "hillsborough-rd:1:1"],
      ["ninth-st:2:1", "hillsborough-rd:2:1"],
      ["onslow-st:1:1"],
    ]) {
      const set = {
        district: cards[0]?.startsWith("ninth") ? "old-west-durham" : "walltown",
        cards: [] as string[],
      };
      me.tableau.push(set);
      place(s, cards, set.cards);
    }
    place(s, ["berkeley-st:1:1"], me.hand);
    const { state } = apply(s, { type: "playProperty", player: me.id, card: "berkeley-st:1:1" });
    expect(winner(state)).toBeNull();
  });

  it("§3.8 reaching roundLimit is a stall", () => {
    let s = game(3, rules({ roundLimit: 2 }));
    let turns = 0;
    while (s.phase !== "gameOver") {
      const moves = legalMoves(s, s.currentPlayer);
      const move = moves.find((m) => m.type === "endTurn") ?? (moves[0] as Move);
      if (move.type === "endTurn") turns += 1;
      s = apply(s, move).state;
    }
    expect(winner(s)).toBe("stall");
    expect(turns).toBe(6); // 2 full rounds of 3 players
  });

  it("an illegal move returns an error result and never throws or mutates state", () => {
    const s = deepFreeze(game());
    const me = s.currentPlayer;
    const handCash = s.players
      .find((p) => p.id === me)
      ?.hand.find((c) => s.cards[c]?.kind !== "property");
    const notMine = next(s).hand[0] as string;
    const illegal: Move[] = [
      { type: "endTurn", player: next(s).id },
      { type: "bank", player: me, card: notMine },
      { type: "discard", player: me, card: s.players.find((p) => p.id === me)?.hand[0] as string },
      { type: "playProperty", player: me, card: handCash as string },
      { type: "endTurn", player: "nobody" },
    ];
    for (const move of illegal) expect(applyMove(s, move).ok, JSON.stringify(move)).toBe(false);
    // A legal move on the frozen state works too, so applyMove never writes to its input.
    expect(applyMove(s, legalMoves(s, me)[0] as Move).ok).toBe(true);
  });

  it.each([2, 5, 6, 10])("smoke: %i scripted players for 20 rounds conserve every card", (n) => {
    let s = game(n, baseRules(), `smoke-${n}`);
    const total = Object.keys(s.cards).length;
    let rng = seedRng(`script-${n}`);
    while (s.phase !== "gameOver" && s.round <= 20) {
      const moves = legalMoves(s, awaitedPlayer(s) as string);
      const pick = randomInt(rng, moves.length);
      rng = pick.rng;
      s = apply(s, moves[pick.value] as Move).state;
      const cards = cardsIn(s);
      expect(cards).toHaveLength(total);
      expect(new Set(cards).size).toBe(total);
    }
    expect(s.round > 20 || winner(s) !== null).toBe(true);
  });
});

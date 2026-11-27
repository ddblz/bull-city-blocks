import { describe, expect, it } from "vitest";
import { rentFor } from "./rent";
import { apply, current, game, next, place, rules } from "./test-content";
import { legalMoves } from "./turn";
import type { GameState, PlayerState } from "./types";

const DUKE = ["west-campus:1:1", "east-campus:1:1", "erwin-rd:1:1"];
const RENT = "rent-downtown-duke:1:1";

/** The current player holds `dukes` Duke properties and `hand` cards; everyone else owns nothing. */
function setup(n: number, dukes: number, hand: string[], s: GameState = game(n)) {
  const me = current(s);
  for (const p of s.players) place(s, [...p.hand, ...p.bank], s.deck);
  const set = { district: "duke", cards: [] as string[] };
  me.tableau.push(set);
  place(s, DUKE.slice(0, dukes), set.cards);
  place(s, hand, me.hand);
  return { s, me };
}
const seatsAfter = (s: GameState, me: PlayerState) => {
  const i = s.players.indexOf(me);
  return [...s.players.slice(i + 1), ...s.players.slice(0, i)].map((p) => p.id);
};

describe("rent", () => {
  it.each([
    [1, 3],
    [2, 5],
    [3, 8],
  ])("§3.5 rent with %i Duke properties is the ladder value %i", (dukes, rent) => {
    const { s, me } = setup(3, dukes, [RENT]);
    expect(rentFor(s, me.id, "duke")).toBe(rent);
    const { events } = apply(s, { type: "playRent", player: me.id, card: RENT, district: "duke" });
    expect(events).toContainEqual(expect.objectContaining({ type: "rentCharged", amount: rent }));
  });

  it("§3.5 with two Duke sets, rent uses the larger one", () => {
    const { s, me } = setup(8, 3, []);
    me.tableau.push({ district: "duke", cards: [] });
    place(s, ["west-campus:2:1"], me.tableau[1]?.cards as string[]);
    expect(rentFor(s, me.id, "duke")).toBe(8);
  });

  it("§4.6 a pair rent card is offered only for its districts where you hold properties", () => {
    const { s, me } = setup(3, 1, [RENT, "rent-trinity-park-forest-hills:1:1"]);
    const rents = legalMoves(s, me.id).filter((m) => m.type === "playRent");
    expect(rents).toEqual([{ type: "playRent", player: me.id, card: RENT, district: "duke" }]);
  });

  it("§4.6 pair rent charges every other player, in seat order after the attacker", () => {
    const { s, me } = setup(5, 1, [RENT]);
    const { events } = apply(s, { type: "playRent", player: me.id, card: RENT, district: "duke" });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "rentCharged", debtors: seatsAfter(s, me) }),
    );
    const settled = events.filter((e) => e.type === "debtSettled").map((e) => e.debtor);
    expect(settled).toEqual(seatsAfter(s, me)); // they own nothing, so each debt is forgiven in turn
  });

  it("§4.6 rent.pair.maxTargets caps the payers (10 players, cap 4)", () => {
    const { s, me } = setup(10, 1, [RENT], game(10, rules({ "rent.pair.maxTargets": 4 })));
    const { events } = apply(s, { type: "playRent", player: me.id, card: RENT, district: "duke" });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "rentCharged", debtors: seatsAfter(s, me).slice(0, 4) }),
    );
  });

  it("§4.6 Wild Rent charges one chosen player for any of your districts", () => {
    const { s, me } = setup(4, 2, ["wild-rent:1:1"]);
    const wild = legalMoves(s, me.id).filter((m) => m.type === "playRent");
    expect(wild.map((m) => (m.type === "playRent" ? m.target : null))).toEqual(seatsAfter(s, me));
    const target = next(s).id;
    const { events } = apply(s, {
      type: "playRent",
      player: me.id,
      card: "wild-rent:1:1",
      district: "duke",
      target,
    });
    expect(events).toContainEqual(
      expect.objectContaining({ type: "rentCharged", amount: 5, debtors: [target] }),
    );
  });

  it("§4.5 Rent Hike doubles the rent and uses 2 plays in total", () => {
    const { s, me } = setup(3, 3, [RENT, "rent-hike:1:1"]);
    const { state, events } = apply(s, {
      type: "playRent",
      player: me.id,
      card: RENT,
      district: "duke",
      hike: "rent-hike:1:1",
    });
    expect(events).toContainEqual(expect.objectContaining({ type: "rentCharged", amount: 16 }));
    expect(state.playsRemaining).toBe(1);
    expect(state.discard.slice(-2)).toEqual([RENT, "rent-hike:1:1"]);
  });

  it("§4.5 Rent Hike is not offered with only one play left", () => {
    const { s, me } = setup(3, 1, [RENT, "rent-hike:1:1"]);
    s.playsRemaining = 1;
    expect(legalMoves(s, me.id).some((m) => m.type === "playRent" && m.hike !== undefined)).toBe(
      false,
    );
  });
});

import { describe, expect, it } from "vitest";
import type { RuleSet } from "./ruleset";
import { apply, current, deepFreeze, game, next, place, rules } from "./test-content";
import { applyMove, awaitedPlayer, legalMoves } from "./turn";
import type { GameState } from "./types";

const DUKE = ["west-campus:1:1", "east-campus:1:1", "erwin-rd:1:1"];
const RENT = "rent-downtown-duke:1:1";

/**
 * Two players. The attacker holds `dukes` Duke properties and a Duke rent card; the debtor's
 * bank holds `bank`. Returns the state just after the rent card is played.
 */
function charge(
  dukes: number,
  bank: string[],
  r: RuleSet = rules(),
  extra?: (s: GameState) => void,
) {
  const s = game(2, r);
  const me = current(s);
  const debtor = next(s);
  for (const p of s.players) place(s, [...p.hand, ...p.bank], s.deck);
  const set = { district: "duke", cards: [] as string[] };
  me.tableau.push(set);
  place(s, DUKE.slice(0, dukes), set.cards);
  place(s, [RENT], me.hand);
  place(s, bank, debtor.bank);
  extra?.(s);
  const { state, events } = apply(s, {
    type: "playRent",
    player: me.id,
    card: RENT,
    district: "duke",
  });
  const find = (id: string) => state.players.find((p) => p.id === id);
  return { state, events, me: me.id, debtor: debtor.id, find };
}
const manual = () => rules({ "payments.autoPay": false });

describe("payments", () => {
  it("§3.4 the debtor is awaited and may pay with one or more cards", () => {
    const { state, debtor } = charge(1, ["cash-5:1:1", "cash-1:1:1"]);
    expect(state.phase).toBe("pay");
    expect(awaitedPlayer(state)).toBe(debtor);
    expect(legalMoves(state, debtor)).toEqual([
      { type: "pay", player: debtor, cards: ["cash-5:1:1"] },
      { type: "pay", player: debtor, cards: ["cash-1:1:1"] },
    ]);
  });

  it("§3.4 no change is given: overpayment is kept by the creditor", () => {
    const { state, me, debtor, find } = charge(1, ["cash-5:1:1", "cash-1:1:1"]); // rent 3
    const after = apply(state, { type: "pay", player: debtor, cards: ["cash-5:1:1"] });
    expect(after.events).toContainEqual({ type: "debtSettled", debtor, creditor: me, forgiven: 0 });
    expect(after.state.players.find((p) => p.id === me)?.bank).toEqual(["cash-5:1:1"]);
    expect(find(debtor)?.bank).toHaveLength(2); // the input state is unchanged
    expect(after.state).toMatchObject({ phase: "play", currentPlayer: me, playsRemaining: 2 });
  });

  it("§3.4 a player with too little pays everything and the rest is forgiven", () => {
    const { state, debtor, me } = charge(3, ["cash-3:1:1", "cash-2:1:1"], manual()); // rent 8
    let s = apply(state, { type: "pay", player: debtor, cards: ["cash-3:1:1"] }).state;
    expect(s.pending).toEqual([{ type: "debt", debtor, creditor: me, amount: 5 }]);
    const last = apply(s, { type: "pay", player: debtor, cards: ["cash-2:1:1"] });
    s = last.state;
    expect(last.events).toContainEqual({ type: "debtSettled", debtor, creditor: me, forgiven: 3 });
    expect(s.phase).toBe("play");
  });

  it.each([
    ["more than", ["cash-3:1:1", "cash-2:1:1"], 3],
    ["exactly", ["cash-5:1:1", "cash-3:1:1"], 0],
  ])("§3.4 a debt %s the debtor's assets is paid automatically", (_name, bank, forgiven) => {
    const { state, events, me, debtor, find } = charge(3, bank); // rent 8
    expect(events).toContainEqual({ type: "autoResolved", player: debtor, kind: "pay" });
    expect(events).toContainEqual({ type: "debtSettled", debtor, creditor: me, forgiven });
    expect(find(debtor)?.bank).toEqual([]);
    expect(find(me)?.bank).toEqual(bank);
    expect(state.phase).toBe("play");
  });

  it("§3.4 received properties go to the tableau and cash to the bank", () => {
    const { state, me, debtor } = charge(1, ["cash-1:1:1"], manual(), (s) => {
      const d = s.players.find((p) => p.id !== s.currentPlayer);
      d?.tableau.push({ district: "old-west-durham", cards: [] });
      place(s, ["ninth-st:1:1"], d?.tableau[0]?.cards as string[]);
      place(s, ["cash-10:1:1"], d?.bank as string[]); // keeps the debt below their assets
    });
    const s = apply(state, {
      type: "pay",
      player: debtor,
      cards: ["ninth-st:1:1", "cash-1:1:1"],
    }).state;
    const creditor = s.players.find((p) => p.id === me);
    expect(creditor?.tableau).toContainEqual({
      district: "old-west-durham",
      cards: ["ninth-st:1:1"],
    });
    expect(creditor?.bank).toEqual(["cash-1:1:1"]);
    expect(s.players.find((p) => p.id === debtor)?.tableau).toEqual([]);
  });

  it("§4.2 Bull City Wild cards can't be used as payment", () => {
    const wild = (s: GameState) => {
      const d = s.players.find((p) => p.id !== s.currentPlayer);
      d?.tableau.push({ district: "duke", cards: [] });
      place(s, ["bull-city-wild:1:1"], d?.tableau[0]?.cards as string[]);
    };
    const manualCase = charge(1, ["cash-1:1:1", "cash-5:1:1"], manual(), wild);
    expect(
      legalMoves(manualCase.state, manualCase.debtor).flatMap((m) =>
        m.type === "pay" ? m.cards : [],
      ),
    ).not.toContain("bull-city-wild:1:1");
    expect(
      applyMove(manualCase.state, {
        type: "pay",
        player: manualCase.debtor,
        cards: ["bull-city-wild:1:1"],
      }).ok,
    ).toBe(false);
    // Auto-pay counts only payable cards: the wild stays and the shortfall is forgiven.
    const auto = charge(1, ["cash-1:1:1"], rules(), wild);
    expect(auto.events).toContainEqual(
      expect.objectContaining({ type: "debtSettled", forgiven: 2 }),
    );
    expect(auto.find(auto.debtor)?.tableau[0]?.cards).toEqual(["bull-city-wild:1:1"]);
  });

  it("§3.4 an invalid payment is an error result and leaves the state untouched", () => {
    const { state, me, debtor } = charge(1, ["cash-5:1:1", "cash-1:1:1"]);
    deepFreeze(state);
    for (const move of [
      { type: "pay" as const, player: me, cards: ["cash-5:1:1"] },
      { type: "pay" as const, player: debtor, cards: [] },
      { type: "pay" as const, player: debtor, cards: ["cash-5:1:1", "cash-5:1:1"] },
      { type: "pay" as const, player: debtor, cards: ["cash-2:1:1"] },
      { type: "endTurn" as const, player: me },
    ]) {
      expect(applyMove(state, move).ok, JSON.stringify(move)).toBe(false);
    }
  });
});

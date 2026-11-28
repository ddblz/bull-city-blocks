import {
  createGame,
  legalMoves,
  loadRuleset,
  parseContent,
  viewFor,
} from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { groupMoves } from "./move-groups";
import { actionsFor, pick, selectedCard } from "./selection";

describe("selection (#59)", () => {
  it("tapping a card selects it, tapping it again deselects, tapping another switches", () => {
    expect(pick(null, "a", 1)).toEqual({ card: "a", turn: 1 });
    expect(pick("a", "a", 1)).toBeNull();
    expect(pick("a", "b", 1)).toEqual({ card: "b", turn: 1 });
  });

  it("is cleared when the card leaves the hand", () => {
    expect(selectedCard({ card: "a", turn: 1 }, 1, ["a", "b"])).toBe("a");
    expect(selectedCard({ card: "a", turn: 1 }, 1, ["b"])).toBeNull();
    expect(selectedCard(null, 1, ["a"])).toBeNull();
  });

  it("is cleared when the turn changes", () => {
    expect(selectedCard({ card: "a", turn: 1 }, 2, ["a"])).toBeNull();
  });

  it("offers exactly the legal moves for the card, from groupMoves", () => {
    const c = parseContent(durham);
    const r = loadRuleset("base", [base]);
    if (!c.ok || !r.ok) throw new Error("setup");
    const g = createGame(r.value, c.value, ["p1", "p2"], "selection");
    if (!g.ok) throw new Error(g.error);
    const state = g.value;
    const who = state.currentPlayer;
    const legal = legalMoves(state, who);
    const groups = groupMoves(legal);
    const hand = viewFor(state, who).players.find((p) => p.id === who)?.hand ?? [];
    const offered = hand.flatMap((card) => {
      const a = actionsFor(groups, card);
      return [a.play, a.bank, a.discard, ...a.flow].filter((m) => m !== undefined);
    });
    const handMoves = legal.filter((m) => "card" in m && hand.includes(m.card));
    expect(offered).toHaveLength(handMoves.length);
    for (const m of handMoves) expect(offered).toContain(m);
  });

  it("a card with no legal moves offers nothing", () => {
    expect(actionsFor(groupMoves([]), "x")).toEqual({ flow: [] });
  });
});

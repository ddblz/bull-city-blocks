import { describe, expect, it } from "vitest";
import { appealChain, nextStep, payment } from "./choice-flows";
import type { Move, View } from "./types";

const player = "p0";

/** Follows a list of picks, returning every step seen and the finished move. */
function walk(candidates: Move[], picks: (string | null)[]) {
  let picked = {};
  const steps = [nextStep(candidates, picked)];
  for (const value of picks) {
    const step = steps.at(-1);
    if (step?.kind !== "choose") throw new Error(`no choice left for ${value}`);
    picked = { ...picked, [step.field]: value };
    steps.push(nextStep(candidates, picked));
  }
  return steps;
}

describe("choice flows (#38)", () => {
  it("rent: picks the district, then whether to add a Rent Hike", () => {
    const rent: Move[] = [
      { type: "playRent", player, card: "r", district: "owd" },
      { type: "playRent", player, card: "r", district: "owd", hike: "h" },
      { type: "playRent", player, card: "r", district: "walltown" },
      { type: "playRent", player, card: "r", district: "walltown", hike: "h" },
    ];
    const steps = walk(rent, ["walltown", "h"]);
    expect(steps[0]).toEqual({ kind: "choose", field: "district", options: ["owd", "walltown"] });
    expect(steps[1]).toEqual({ kind: "choose", field: "hike", options: [null, "h"] });
    expect(steps[2]).toEqual({ kind: "done", move: rent[3] });
    expect(walk(rent, ["owd", null])[2]).toEqual({ kind: "done", move: rent[0] });
  });

  it("Wild Rent: picks the target and the district", () => {
    const rent: Move[] = [
      { type: "playRent", player, card: "wr", district: "owd", target: "p1" },
      { type: "playRent", player, card: "wr", district: "owd", target: "p2" },
      { type: "playRent", player, card: "wr", district: "duke", target: "p2" },
    ];
    const steps = walk(rent, ["p2", "duke"]);
    expect(steps[0]).toMatchObject({ field: "target", options: ["p1", "p2"] });
    expect(steps[1]).toMatchObject({ field: "district", options: ["owd", "duke"] });
    expect(steps[2]).toEqual({ kind: "done", move: rent[2] });
    // only one district is left for p1, so it isn't asked
    expect(walk(rent, ["p1"])[1]).toEqual({ kind: "done", move: rent[0] });
  });

  it("steals: only offers cards that some legal move takes or gives", () => {
    const swap: Move[] = [
      { type: "playAction", player, card: "s", target: "p1", take: "t1", give: "g1" },
      { type: "playAction", player, card: "s", target: "p1", take: "t1", give: "g2" },
      { type: "playAction", player, card: "s", target: "p1", take: "t2", give: "g1" },
      { type: "playAction", player, card: "s", target: "p2", take: "t3", give: "g1" },
      { type: "playAction", player, card: "s", target: "p2", take: "t3", give: "g2" },
    ];
    const steps = walk(swap, ["p1", "t2"]);
    expect(steps[0]).toMatchObject({ field: "target", options: ["p1", "p2"] });
    expect(steps[1]).toMatchObject({ field: "take", options: ["t1", "t2"] });
    expect(steps[2]).toEqual({ kind: "done", move: swap[2] });
    expect(walk(swap, ["p2", "g2"]).at(-1)).toEqual({ kind: "done", move: swap[4] });

    const takeover: Move[] = [
      { type: "playAction", player, card: "h", target: "p1", district: "owd" },
      { type: "playAction", player, card: "h", target: "p1", district: "duke" },
    ];
    expect(nextStep(takeover, {})).toMatchObject({ field: "district", options: ["owd", "duke"] });
  });

  it("wilds and upgrades: picks the district", () => {
    const wild: Move[] = [
      { type: "playProperty", player, card: "w", district: "owd" },
      { type: "playProperty", player, card: "w", district: "walltown" },
    ];
    expect(walk(wild, ["owd"])).toEqual([
      { kind: "choose", field: "district", options: ["owd", "walltown"] },
      { kind: "done", move: wild[0] },
    ]);
    const move: Move = { type: "moveWild", player, card: "w", district: "duke" };
    expect(nextStep([move], {})).toEqual({ kind: "done", move });
  });

  it("a choice that matches no legal move leads nowhere", () => {
    const move: Move = { type: "playUpgrade", player, card: "l", district: "owd" };
    expect(nextStep([move], { district: "duke" })).toEqual({ kind: "none" });
  });
});

const view = (pending: View["pending"]) =>
  ({
    pending,
    cards: {
      c1: { kind: "cash", id: "cash-1", name: "$1", value: 1, count: 1 },
      c3: { kind: "cash", id: "cash-3", name: "$3", value: 3, count: 1 },
      p2: { kind: "property", id: "p", name: "P", district: "owd", value: 2, count: 1 },
    },
  }) as unknown as View;

describe("payment selection (#38, SPEC §3.4)", () => {
  const debt = view([{ type: "debt", debtor: player, creditor: "p1", amount: 4 }]);

  it("totals the selected cards against the debt", () => {
    expect(payment(["c1", "p2"], ["c1", "c3", "p2"], debt)).toEqual({
      cards: ["c1", "p2"],
      total: 3,
      debt: 4,
      short: true,
      move: { type: "pay", player, cards: ["c1", "p2"] },
    });
    expect(payment(["c1", "c3"], ["c1", "c3", "p2"], debt)).toMatchObject({
      total: 4,
      short: false,
    });
  });

  it("only pays with payable cards, and offers no move with nothing selected", () => {
    expect(payment(["c1", "gone"], ["c1"], debt).cards).toEqual(["c1"]);
    expect(payment([], ["c1"], debt).move).toBeNull();
  });
});

describe("Appeal chain (#38, SPEC §3.6)", () => {
  const response = (appeals: number) =>
    view([
      {
        type: "response",
        card: "a",
        attacker: "p1",
        target: player,
        awaiting: appeals % 2 ? "p1" : player,
        appeals,
        effect: { kind: "delay" },
      },
    ]);

  it("accepting with no Appeals, or two, lets the action go ahead", () => {
    expect(appealChain(response(0))?.cancelsIfAccepted).toBe(false);
    expect(appealChain(response(2))?.cancelsIfAccepted).toBe(false);
  });

  it("accepting after one Appeal cancels the action", () => {
    expect(appealChain(response(1))).toMatchObject({ appeals: 1, cancelsIfAccepted: true });
  });

  it("is null when nobody is responding", () => {
    expect(appealChain(view([]))).toBeNull();
  });
});

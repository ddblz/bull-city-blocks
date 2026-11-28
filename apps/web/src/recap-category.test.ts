import { describe, expect, it } from "vitest";
import type { GameEvent } from "./describe-event";
import { CATEGORY, categorize } from "./recap-category";

const me = "p1";
const resolved = (
  effect: Extract<GameEvent, { type: "actionResolved" }>["effect"],
  cancelled = false,
) =>
  ({
    type: "actionResolved",
    attacker: "p2",
    target: me,
    card: "c",
    cancelled,
    effect,
  }) as GameEvent;

describe("categorize (#61)", () => {
  it("property taken: a buyout, swap or takeover that stands against you", () => {
    expect(categorize(resolved({ kind: "buyout", take: "x" }), me)).toBe("taken");
    expect(categorize(resolved({ kind: "swap", take: "x", give: "y" }), me)).toBe("taken");
    expect(categorize(resolved({ kind: "takeover", district: "hayti" }), me)).toBe("taken");
  });

  it("payment received and payment made", () => {
    const paid = (debtor: string, creditor: string) =>
      ({ type: "paid", debtor, creditor, cards: ["a"] }) as GameEvent;
    expect(categorize(paid("p2", me), me)).toBe("received");
    expect(categorize(paid(me, "p2"), me)).toBe("paid");
  });

  it("rent charged: rent on you, or a charge action that stands", () => {
    const rent = {
      type: "rentCharged",
      player: "p2",
      card: "c",
      district: "hayti",
      amount: 3,
      debtors: [me],
    };
    expect(categorize(rent as GameEvent, me)).toBe("rent");
    expect(categorize(resolved({ kind: "debt", amount: 5 }), me)).toBe("rent");
  });

  it("delay", () => {
    expect(categorize(resolved({ kind: "delay" }), me)).toBe("delay");
  });

  it("Appeal: someone else's, not yours", () => {
    expect(categorize({ type: "responded", player: "p2", appeal: true }, me)).toBe("appeal");
    expect(categorize({ type: "responded", player: me, appeal: true }, me)).toBeNull();
    expect(categorize({ type: "responded", player: "p2", appeal: false }, me)).toBeNull();
  });

  it("events that don't affect the viewer have no category", () => {
    expect(categorize({ type: "paid", debtor: "p2", creditor: "p3", cards: ["a"] }, me)).toBeNull();
    expect(categorize(resolved({ kind: "delay" }, true), me)).toBeNull();
    expect(categorize({ type: "banked", player: "p2", card: "c" }, me)).toBeNull();
  });

  it("every category has a label and an icon", () => {
    for (const c of Object.values(CATEGORY)) expect(c.label && c.icon).toBeTruthy();
  });
});

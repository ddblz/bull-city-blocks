import { ACTIONS, createGame, loadRuleset, parseContent, viewFor } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { actionText } from "./action-text";
import type { View } from "./types";

const rules = (): View["rules"] => {
  const r = loadRuleset("base", [base]);
  const c = parseContent(durham);
  if (!r.ok || !c.ok) throw new Error("setup");
  const g = createGame(r.value, c.value, ["p1", "p2"], "action-text");
  if (!g.ok) throw new Error(g.error);
  return structuredClone(viewFor(g.value, "p1").rules);
};

/** Names and phrases from another game, which SPEC §1 forbids. */
const FORBIDDEN = [/just say no/i, /deal breaker/i, /passing go/i, /monopoly/i, /\$\d+\s?M\b/];

describe("action text (#57)", () => {
  it.each(ACTIONS)("%s has effect text", (action) => {
    const text = actionText(action, rules());
    expect(text.length).toBeGreaterThan(10);
    expect(text).toMatch(/[.]$/);
  });

  it("every action card in the deck has text", () => {
    const actions = durham.cards.flatMap((c) => (c.kind === "action" ? [c.action] : []));
    expect(actions.length).toBeGreaterThan(0);
    for (const action of actions) expect(ACTIONS).toContain(action);
  });

  it("uses no other game's names or phrases", () => {
    for (const action of ACTIONS)
      for (const bad of FORBIDDEN) expect(actionText(action, rules())).not.toMatch(bad);
  });

  it("follows the room's rules, so a variant's cards read correctly", () => {
    const r = rules();
    expect(actionText("foodTruckRodeo", r)).not.toContain("At most"); // base: unlimited
    r.actions.foodTruckRodeo.maxTargets = 4;
    expect(actionText("foodTruckRodeo", r)).toContain("At most 4 players pay");
    r.actions.assessment.cap = 8;
    expect(actionText("assessment", r)).toContain("up to $8");
    expect(actionText("buyout", r)).toContain("You pay them its value");
    r.actions.buyout.payCardValue = false;
    expect(actionText("buyout", r)).not.toContain("You pay");
    r.actions.hostileTakeover.playCost = 3;
    expect(actionText("hostileTakeover", r)).toContain("Costs 3 plays");
  });
});

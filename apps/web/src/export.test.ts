import { createGame, loadRuleset, parseContent } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import rodeo from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };
import { exportVariant, resolveRules } from "./config-form";

const files = [base, rodeo];
const content = (() => {
  const c = parseContent(durham);
  if (!c.ok) throw new Error(c.error);
  return c.value;
})();

describe("export as variant (#39)", () => {
  const overrides = {
    "hand.limit": 9,
    "actions.assessment.cap": 3,
    "deck.counts.appeal": 8,
    "deck.values.erwin-rd": 6,
    "deck.rent.duke": [2, 4, 9],
  };
  const text = exportVariant(
    "bigger-hands",
    "rodeo-cap-4",
    overrides,
    "Hand limit 9, more Appeals",
  );
  const file = JSON.parse(text);

  it("writes rulesets/<id>.json text that extends the chosen ruleset", () => {
    expect(file).toEqual({
      id: "bigger-hands",
      extends: "rodeo-cap-4",
      description: "Hand limit 9, more Appeals",
      overrides,
    });
  });

  it("loads with loadRuleset into the room's rules", () => {
    const loaded = loadRuleset("bigger-hands", [...files, file]);
    const room = resolveRules(files, "rodeo-cap-4", overrides);
    if (!loaded.ok || !room.ok) throw new Error("both should load");
    const { id: _a, description: _b, ...exported } = loaded.value;
    const { id: _c, description: _d, ...inRoom } = room.value;
    expect(exported).toEqual(inRoom);
  });

  it("reproduces the same game for the same seed", () => {
    const loaded = loadRuleset("bigger-hands", [...files, file]);
    const room = resolveRules(files, "rodeo-cap-4", overrides);
    if (!loaded.ok || !room.ok) throw new Error("both should load");
    const players = ["p1", "p2", "p3"];
    const a = createGame(loaded.value, content, players, "seed-39");
    const b = createGame(room.value, content, players, "seed-39");
    if (!a.ok || !b.ok) throw new Error("both games should start");
    const { rules: _r1, ...gameA } = a.value;
    const { rules: _r2, ...gameB } = b.value;
    expect(gameA).toEqual(gameB);
    expect(a.value.rules.hand.limit).toBe(9);
  });
});

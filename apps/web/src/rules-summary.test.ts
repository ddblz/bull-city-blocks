import { loadRuleset } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import base from "../../../rulesets/base.json" with { type: "json" };
import rodeo from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };
import { resolveRules } from "./config-form";
import { rulesRows } from "./rules-summary";

const files = [base, rodeo];
const load = (id: string) => {
  const r = loadRuleset(id, files);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("rulesRows (#60)", () => {
  it("base: the headline rules from the ruleset, none differing", () => {
    const rows = rulesRows(load("base"), load("base"));
    expect(rows.map((r) => [r.label, r.value])).toEqual([
      ["Victory", "3 complete districts"],
      ["Turns", "Draw 2 · up to 3 plays"],
      ["Hand limit", "7 cards"],
      ["Turn clock", "90 s a turn · 20 s to respond"],
      ["Payments", "No change · auto-pay"],
      ["Targets", "Food Truck Rodeo: everyone · pair rent: everyone"],
    ]);
    expect(rows.some((r) => r.differs)).toBe(false);
  });

  it("rodeo-cap-4: only the targets row differs", () => {
    const rows = rulesRows(load("rodeo-cap-4"), load("base"));
    expect(rows.filter((r) => r.differs).map((r) => r.label)).toEqual(["Targets"]);
    expect(rows.at(-1)?.value).toBe("Food Truck Rodeo: 4 players · pair rent: 4 players");
  });

  it("flags a row when the host edits one of its rules", () => {
    const edited = resolveRules(files, "base", { districtsToWin: 4, "hand.limit": 8 });
    if (!edited.ok) throw new Error(edited.error);
    const rows = rulesRows(edited.value, load("base"));
    expect(rows.filter((r) => r.differs).map((r) => r.label)).toEqual(["Victory", "Hand limit"]);
    expect(rows[0]?.value).toBe("4 complete districts");
  });

  it("uses singular words for one", () => {
    const edited = resolveRules(files, "base", { playsPerTurn: 1 });
    if (!edited.ok) throw new Error(edited.error);
    expect(rulesRows(edited.value, load("base"))[1]?.value).toBe("Draw 2 · up to 1 play");
  });
});

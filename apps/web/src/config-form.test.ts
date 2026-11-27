import { parseContent, type RuleSet } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import rodeo from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };
import {
  deckRows,
  differences,
  fieldLabel,
  formFields,
  resolveRules,
  setOverride,
  valueAt,
  withDeckDefaults,
} from "./config-form";

const files = [base, rodeo];
const content = (() => {
  const c = parseContent(durham);
  if (!c.ok) throw new Error(c.error);
  return c.value;
})();
const rules = (ruleset = "base", overrides: Record<string, unknown> = {}): RuleSet => {
  const r = resolveRules(files, ruleset, overrides);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

/** Every number, boolean or null leaf in a ruleset file, by dotted path. */
function leaves(obj: unknown, path = ""): [string, unknown][] {
  if (obj !== null && typeof obj === "object")
    return Object.entries(obj).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  return [[path, obj]];
}

describe("rules editor form (#39)", () => {
  const fields = formFields(rules());

  it("has a field for every ruleset parameter, matching RuleSetSchema", () => {
    const params = leaves(base).filter(([p]) => !/^(id|description|deck)(\.|$)/.test(p));
    expect(fields.map((f) => f.path).sort()).toEqual(params.map(([p]) => p).sort());
    for (const [path, value] of params) {
      const field = fields.find((f) => f.path === path);
      expect(field?.kind, path).toBe(value === null ? "number" : typeof value);
      expect(field?.nullable, path).toBe(value === null); // only the "unlimited" target caps
    }
  });

  it("groups the fields into the editor's sections", () => {
    const section = (path: string) => fields.find((f) => f.path === path)?.section;
    expect(section("hand.limit")).toBe("setup");
    expect(section("deckCopies.1.copies")).toBe("setup");
    expect(section("playsPerTurn")).toBe("turn");
    expect(section("payments.giveChange")).toBe("payments");
    expect(section("upgrades.iconBonus")).toBe("upgrades");
    expect(section("actions.hostileTakeover.playCost")).toBe("actions");
    expect(section("rent.pair.maxTargets")).toBe("rent");
    expect(section("clock.turnSeconds")).toBe("clock");
  });

  it("takes each field's minimum from the schema", () => {
    const min = (path: string) => fields.find((f) => f.path === path)?.min;
    expect(min("hand.starting")).toBe(0);
    expect(min("playsPerTurn")).toBe(1);
  });

  it("turns every edit into an override the loader applies", () => {
    for (const f of fields) {
      const now = valueAt(rules(), f.path);
      const edit = f.kind === "boolean" ? !now : now === null ? 3 : (now as number) + 1;
      const overrides = setOverride({}, rules(), f.path, edit);
      expect(overrides).toEqual({ [f.path]: edit });
      expect(valueAt(rules("base", overrides), f.path), f.path).toEqual(edit);
    }
  });

  it("drops an override that goes back to the chosen ruleset's value", () => {
    const set = setOverride({}, rules(), "hand.limit", 9);
    expect(setOverride(set, rules(), "hand.limit", 7)).toEqual({});
    // on rodeo-cap-4, its own value is the default, not base's
    expect(setOverride({}, rules("rodeo-cap-4"), "actions.foodTruckRodeo.maxTargets", 4)).toEqual(
      {},
    );
  });

  it("fills in each card's own copies and value, so setting one back drops its override", () => {
    const defaults = withDeckDefaults(rules(), content);
    expect(valueAt(defaults, "deck.counts.appeal")).toBe(4);
    expect(valueAt(defaults, "deck.values.ninth-st")).toBe(1);
    expect(valueAt(defaults, "deck.rent.duke")).toEqual([3, 5, 8]);
    const edited = setOverride({}, defaults, "deck.counts.appeal", 9);
    expect(edited).toEqual({ "deck.counts.appeal": 9 });
    expect(setOverride(edited, defaults, "deck.counts.appeal", 4)).toEqual({});
  });

  it("shows the loader's error for an invalid value", () => {
    const r = resolveRules(files, "base", { playsPerTurn: 0 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/playsPerTurn/);
  });

  it("edits deck counts, values and rent ladders, but never a property's count", () => {
    const edited = rules("base", {
      "deck.counts.appeal": 9,
      "deck.values.erwin-rd": 7,
      "deck.rent.duke": [2, 4, 9],
    });
    const rows = deckRows(content, edited);
    expect(rows.cards.find((c) => c.id === "appeal")).toMatchObject({
      count: 9,
      countEditable: true,
    });
    expect(rows.cards.find((c) => c.id === "erwin-rd")).toMatchObject({
      value: 7,
      countEditable: false,
    });
    expect(rows.districts.find((d) => d.id === "duke")?.rent).toEqual([2, 4, 9]);
  });

  it("lists every difference from base, for all players to see", () => {
    expect(differences(rules("rodeo-cap-4"), rules(), content)).toEqual([
      "Actions · food truck rodeo · max targets: unlimited → 4",
      "Rent · pair · max targets: unlimited → 4",
    ]);
    const tweaked = rules("base", {
      "hand.limit": 9,
      "deck.counts.appeal": 9,
      "deck.values.appeal": 1,
      "deck.rent.duke": [2, 4, 9],
    });
    expect(differences(tweaked, rules(), content)).toEqual([
      "Hand · limit: 7 → 9",
      "Appeal copies: 4 → 9",
      "Appeal value: $4 → $1",
      `Duke rent: ${durham.districts.find((d) => d.id === "duke")?.rent.join("/")} → 2/4/9`,
    ]);
    expect(differences(rules(), rules(), content)).toEqual([]);
  });

  it("labels fields readably", () => {
    expect(fieldLabel("actions.foodTruckRodeo.maxTargets")).toBe(
      "Actions · food truck rodeo · max targets",
    );
    expect(fieldLabel("deckCopies.0.copies")).toBe("Deck copies · tier 1 · copies");
  });
});

import { describe, expect, it } from "vitest";
import chained from "../../../rulesets/__fixtures__/chained.json" with { type: "json" };
import cycleA from "../../../rulesets/__fixtures__/cycle-a.json" with { type: "json" };
import cycleB from "../../../rulesets/__fixtures__/cycle-b.json" with { type: "json" };
import missingParent from "../../../rulesets/__fixtures__/missing-parent.json" with {
  type: "json",
};
import rodeoCap4 from "../../../rulesets/__fixtures__/rodeo-cap-4.json" with { type: "json" };
import typeMismatch from "../../../rulesets/__fixtures__/type-mismatch.json" with { type: "json" };
import unknownPath from "../../../rulesets/__fixtures__/unknown-path.json" with { type: "json" };
import { createGame } from "./create-game";
import { loadRuleset } from "./ruleset";
import { baseJson, baseRules, durhamContent } from "./test-content";

const files = [
  baseJson,
  rodeoCap4,
  chained,
  unknownPath,
  typeMismatch,
  cycleA,
  cycleB,
  missingParent,
];
const load = (id: string) => loadRuleset(id, files);
const get = (obj: unknown, path: string) =>
  path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], obj);
const errorOf = (id: string) => {
  const result = load(id);
  return result.ok ? "" : result.error;
};

describe("rulesets/base.json", () => {
  it.each([
    ["§3.1", "players.min", 2],
    ["§3.1", "players.max", 10],
    [
      "§3.1",
      "deckCopies",
      [
        { maxPlayers: 5, copies: 1 },
        { maxPlayers: 10, copies: 2 },
      ],
    ],
    ["§3.1", "hand.starting", 5],
    ["§3.2", "draw.perTurn", 2],
    ["§3.2", "draw.emptyHand", 5],
    ["§3.2", "playsPerTurn", 3],
    ["§3.2", "hand.limit", 7],
    ["§3.2", "districtsToWin", 3],
    ["§3.4", "payments.giveChange", false],
    ["§3.4", "payments.autoPay", true],
    ["§3.5", "upgrades.landmarkBonus", 3],
    ["§3.5", "upgrades.iconBonus", 4],
    ["§3.6", "autoPassDefault", true],
    ["§3.7", "clock.onByDefault", false],
    ["§3.7", "clock.turnSeconds", 90],
    ["§3.7", "clock.responseSeconds", 20],
    ["§3.8", "roundLimit", 60],
    ["§4.5", "actions.foodTruckRodeo.maxTargets", null],
    ["§4.5", "actions.assessment.cap", 5],
    ["§4.5", "actions.buyout.payCardValue", true],
    ["§4.5", "actions.hostileTakeover.playCost", 2],
    ["§4.6", "rent.pair.maxTargets", null],
  ])("%s %s = %j", (_section, path, expected) => {
    expect(get(baseRules(), path)).toEqual(expected);
  });

  it("rejects unknown fields", () => {
    expect(loadRuleset("base", [{ ...baseJson, extra: 1 }]).ok).toBe(false);
  });
});

describe("loadRuleset", () => {
  it("§5 applies dotted-path overrides and keeps everything else from the parent", () => {
    const result = load("rodeo-cap-4");
    if (!result.ok) throw new Error(result.error);
    const { value } = result;
    expect(value.actions.foodTruckRodeo.maxTargets).toBe(4);
    expect(value.rent.pair.maxTargets).toBe(4);
    expect(value).toMatchObject({ id: "rodeo-cap-4", hypothesis: rodeoCap4.hypothesis });
    const base = baseRules();
    expect({
      ...value,
      id: base.id,
      description: base.description,
      hypothesis: undefined,
      actions: base.actions,
      rent: base.rent,
    }).toEqual({ ...base, hypothesis: undefined });
  });

  it("§5 resolves an extends chain", () => {
    const result = load("chained");
    expect(
      result.ok && [result.value.playsPerTurn, result.value.actions.foodTruckRodeo.maxTargets],
    ).toEqual([4, 4]);
  });

  it.each([
    ["unknown-path", "actions.foodTruck.maxTargets"],
    ["type-mismatch", "playsPerTurn"],
    ["cycle-a", "extends cycle: cycle-a → cycle-b → cycle-a"],
    ["missing-parent", 'unknown ruleset "nowhere"'],
    ["no-such-ruleset", 'unknown ruleset "no-such-ruleset"'],
  ])("%s is an error result naming %s", (id, expected) => {
    expect(errorOf(id)).toContain(expected);
  });

  it("rejects duplicate ruleset ids", () => {
    expect(loadRuleset("base", [baseJson, baseJson]).ok).toBe(false);
  });

  it("does not mutate the input files", () => {
    const before = JSON.stringify(files);
    load("chained");
    expect(JSON.stringify(files)).toBe(before);
  });

  it("createGame uses the loaded ruleset", () => {
    const small = {
      id: "small",
      extends: "base",
      description: "",
      overrides: { "players.max": 3 },
    };
    const result = loadRuleset("small", [baseJson, small]);
    if (!result.ok) throw new Error(result.error);
    const players = ["a", "b", "c", "d"];
    expect(createGame(result.value, durhamContent(), players, "s").ok).toBe(false);
    expect(createGame(baseRules(), durhamContent(), players, "s").ok).toBe(true);
  });
});

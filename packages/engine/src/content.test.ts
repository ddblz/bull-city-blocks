import { describe, expect, it } from "vitest";
import { type Card, type CardKind, parseContent } from "./content";
import { durhamContent, durhamJson } from "./test-content";

const content = durhamContent();
const total = (cards: readonly Card[]) => cards.reduce((n, c) => n + c.count, 0);
const ofKind = (...kinds: CardKind[]) => content.cards.filter((c) => kinds.includes(c.kind));

describe("content/durham.json", () => {
  it("§4 one copy is 139 cards", () => {
    expect(total(content.cards)).toBe(139);
  });

  it.each([
    ["§4.1 properties", ["property"], 40],
    ["§4.2 wild properties", ["wild"], 9],
    ["§4.3 upgrades", ["landmark", "icon"], 14],
    ["§4.3 landmarks", ["landmark"], 9],
    ["§4.3 icons", ["icon"], 5],
    ["§4.4 cash", ["cash"], 24],
    ["§4.5 actions", ["action"], 35],
    ["§4.6 rent cards", ["rent"], 17],
  ] as const)("%s: %s", (_name, kinds, expected) => {
    expect(total(ofKind(...kinds))).toBe(expected);
  });

  it("§4.1 each of the 14 districts has set-size properties at its card value", () => {
    expect(content.districts).toHaveLength(14);
    for (const d of content.districts) {
      const props = content.cards.filter((c) => c.kind === "property" && c.district === d.id);
      expect(total(props), d.id).toBe(d.setSize);
      expect(
        props.every((p) => p.value === d.value),
        d.id,
      ).toBe(true);
    }
  });

  it("§4.1–4.2 seven pairs, each with one wild at the higher district value", () => {
    expect(content.pairs).toHaveLength(7);
    const value = (id: string) => content.districts.find((d) => d.id === id)?.value ?? -1;
    for (const [a, b] of content.pairs) {
      const wilds = ofKind("wild").filter(
        (c) => c.kind === "wild" && c.districts !== "any" && c.districts.join() === `${a},${b}`,
      );
      expect(
        wilds.map((w) => [w.count, w.value]),
        `${a}/${b}`,
      ).toEqual([[1, Math.max(value(a), value(b))]]);
    }
  });

  it("§4.2 two Bull City Wilds at value 0", () => {
    const any = ofKind("wild").filter((c) => c.kind === "wild" && c.districts === "any");
    expect(any.map((c) => [c.count, c.value])).toEqual([[2, 0]]);
  });

  it("§4.4 cash denominations", () => {
    const byValue = Object.fromEntries(ofKind("cash").map((c) => [c.value, c.count]));
    expect(byValue).toEqual({ 1: 7, 2: 6, 3: 4, 4: 3, 5: 3, 10: 1 });
  });

  it("§4.6 two rent cards per pair at value 1, plus 3 Wild Rents at value 3", () => {
    const rents = ofKind("rent");
    for (const [a, b] of content.pairs) {
      const r = rents.filter(
        (c) => c.kind === "rent" && c.districts !== "any" && c.districts.join() === `${a},${b}`,
      );
      expect(r.map((c) => [c.count, c.value])).toEqual([[2, 1]]);
    }
    expect(
      rents
        .filter((c) => c.kind === "rent" && c.districts === "any")
        .map((c) => [c.count, c.value]),
    ).toEqual([[3, 3]]);
  });
});

describe("parseContent", () => {
  const withCards = (cards: unknown[]) => ({
    ...durhamJson,
    cards: [...durhamJson.cards, ...cards],
  });
  it.each([
    ["not an object", 42],
    ["unknown card kind", withCards([{ kind: "joker", id: "joker", name: "Joker", value: 1 }])],
    ["negative value", withCards([{ kind: "cash", id: "cash-neg", name: "$-1", value: -1 }])],
    [
      "unknown district",
      withCards([{ kind: "property", id: "x", name: "X", district: "nowhere", value: 1 }]),
    ],
    ["duplicate card id", withCards([{ kind: "cash", id: "cash-1", name: "$1", value: 1 }])],
    [
      "undeclared pair",
      withCards([{ kind: "rent", id: "r", name: "R", districts: ["duke", "hayti"], value: 1 }]),
    ],
    [
      "rent ladder length",
      {
        ...durhamJson,
        districts: [{ ...durhamJson.districts[0], rent: [1] }, ...durhamJson.districts.slice(1)],
      },
    ],
  ])("rejects %s with an error result", (_name, json) => {
    const result = parseContent(json);
    expect(result.ok).toBe(false);
  });
});

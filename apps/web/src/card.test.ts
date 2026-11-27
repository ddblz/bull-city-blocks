import { describe, expect, it } from "vitest";
import { cardLabel, instanceLabel, isComplete, totalValue } from "./card";
import type { Card, View } from "./types";

const district = (id: string, name: string, setSize: number) => ({
  id,
  name,
  setSize,
  rent: Array.from({ length: setSize }, (_, i) => i + 1),
  value: 1,
  upgradable: true,
});

const cards = {
  "ninth-st:0:0": {
    kind: "property",
    id: "ninth-st",
    name: "Ninth St",
    district: "owd",
    value: 1,
    count: 1,
  },
  "hills:0:1": {
    kind: "property",
    id: "hills",
    name: "Hillsborough Rd",
    district: "owd",
    value: 1,
    count: 1,
  },
  "wild:0:2": {
    kind: "wild",
    id: "wild",
    name: "OWD / Walltown Wild",
    districts: ["owd", "walltown"],
    value: 1,
    count: 1,
  },
  "bcw:0:3": {
    kind: "wild",
    id: "bcw",
    name: "Bull City Wild",
    districts: "any",
    value: 0,
    count: 2,
  },
  "theatre:0:4": { kind: "landmark", id: "theatre", name: "The Theatre", value: 3, count: 1 },
  "bull:0:5": { kind: "icon", id: "bull", name: "The Bull", value: 4, count: 1 },
  "cash-2:0:6": { kind: "cash", id: "cash-2", name: "$2", value: 2, count: 6 },
  "hike:0:7": {
    kind: "action",
    id: "hike",
    name: "Rent Hike",
    action: "rentHike",
    value: 1,
    count: 1,
  },
  "rent:0:8": {
    kind: "rent",
    id: "rent",
    name: "OWD / Walltown Rent",
    districts: ["owd", "walltown"],
    value: 1,
    count: 1,
  },
  "wild-rent:0:9": {
    kind: "rent",
    id: "wild-rent",
    name: "Wild Rent",
    districts: "any",
    value: 3,
    count: 1,
  },
} satisfies Record<string, Card>;

const view = {
  districts: {
    owd: district("owd", "Old West Durham", 2),
    walltown: district("walltown", "Walltown", 3),
  },
  cards,
} as unknown as View;

describe("cards (#37 readable cards)", () => {
  it("renders every card kind with its name, kind and value", () => {
    const labels = Object.values(cards).map((c) => cardLabel(c, view));
    expect(labels).toMatchInlineSnapshot(`
      [
        "Ninth St · Old West Durham · $1",
        "Hillsborough Rd · Old West Durham · $1",
        "OWD / Walltown Wild · Wild for Old West Durham / Walltown · $1",
        "Bull City Wild · Wild for any district · $0",
        "The Theatre · Landmark · $3",
        "The Bull · Icon · $4",
        "$2 · Cash",
        "Rent Hike · Action · $1",
        "OWD / Walltown Rent · Rent for Old West Durham / Walltown · $1",
        "Wild Rent · Rent for any district · $3",
      ]
    `);
  });

  it("labels a card this player can't see as hidden", () => {
    expect(instanceLabel("deck:0:99", view)).toBe("Hidden card");
  });

  it("§3.5 marks a set complete at its size with at least one property", () => {
    expect(isComplete({ district: "owd", cards: ["ninth-st:0:0", "hills:0:1"] }, view)).toBe(true);
    expect(isComplete({ district: "owd", cards: ["ninth-st:0:0", "wild:0:2"] }, view)).toBe(true);
    expect(isComplete({ district: "owd", cards: ["ninth-st:0:0"] }, view)).toBe(false);
    expect(isComplete({ district: "owd", cards: ["wild:0:2", "bcw:0:3"] }, view)).toBe(false);
  });

  it("totals the value of visible cards", () => {
    expect(totalValue(["cash-2:0:6", "theatre:0:4", "deck:0:99"], view)).toBe(5);
  });
});

import {
  applyMove,
  createGame,
  type GameState,
  legalMoves,
  loadRuleset,
  parseContent,
  viewFor,
} from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import {
  districtsDone,
  handColumns,
  playPips,
  rentLine,
  rentNow,
  setStatus,
} from "./table-summary";
import type { Card, PropertySet, View } from "./types";

const content = (() => {
  const c = parseContent(durham);
  if (!c.ok) throw new Error(c.error);
  return c.value;
})();
const def = (id: string): Card => {
  const c = content.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const newGame = (): GameState => {
  const rules = loadRuleset("base", [base]);
  if (!rules.ok) throw new Error(rules.error);
  const g = createGame(rules.value, content, ["p1", "p2"], "table-summary");
  if (!g.ok) throw new Error(g.error);
  return structuredClone(g.value);
};

/** Instances to put in sets: three Hayti properties, a wild, a Landmark and an Icon. */
const INSTANCES: Record<string, string> = {
  h1: "fayetteville-st",
  h2: "lawson-st",
  h3: "alston-ave",
  w1: "wild-east-durham-hayti",
  lm: "carolina-theatre",
  ic: "dpac",
  d1: "angier-ave",
  d2: "driver-st",
  d3: "holloway-st",
};
const withCards = (s: GameState) => {
  for (const [id, card] of Object.entries(INSTANCES)) s.cards[id] = def(card);
  return s;
};
const set = (district: string, cards: string[], extra: Partial<PropertySet> = {}): PropertySet => ({
  district,
  cards,
  ...extra,
});
/** A real view with these sets in p1's tableau. */
const viewWith = (tableau: PropertySet[], tweak: (s: GameState) => void = () => {}): View => {
  const s = withCards(newGame());
  const me = s.players[0];
  if (!me) throw new Error("no player");
  me.tableau = tableau;
  tweak(s);
  return viewFor(s, "p1");
};

describe("setStatus (#58, SPEC §3.5)", () => {
  it("shows progress as have/size, and FULL once a set is complete", () => {
    const v = viewWith([set("hayti", ["h1", "h2"]), set("hayti", ["h1", "h2", "h3"])]);
    const [part, full] = v.players[0]?.tableau ?? [];
    expect(setStatus(part as PropertySet, v)).toMatchObject({
      label: "2/3",
      full: false,
      have: 2,
      size: 3,
    });
    expect(setStatus(full as PropertySet, v)).toMatchObject({ label: "FULL", full: true });
  });

  it("a full set of only wilds isn't complete: it needs a property", () => {
    const v = viewWith([set("hayti", ["w1", "w1", "w1"])]);
    expect(setStatus(v.players[0]?.tableau[0] as PropertySet, v)).toMatchObject({
      label: "3/3",
      full: false,
    });
  });
});

describe("districtsDone (§3.2)", () => {
  it("counts different complete districts: two complete sets of one district count once", () => {
    const v = viewWith([
      set("hayti", ["h1", "h2", "h3"]),
      set("hayti", ["h1", "h2", "h3"]),
      set("east-durham", ["d1", "d2", "d3"]),
      set("hayti", ["h1"]),
    ]);
    expect(districtsDone(v.players[0] as View["players"][number], v)).toBe(2);
  });
});

describe("playPips", () => {
  it("shows the plays used and left in the play phase, and nothing at other times", () => {
    const v = viewWith([], (s) => {
      s.phase = "play";
      s.playsRemaining = 2;
    });
    expect(playPips(v)).toEqual({ total: 3, left: 2, used: 1 });
    expect(playPips({ ...v, phase: "pay" })).toBeNull();
  });
});

describe("rent line (§3.5)", () => {
  const hayti = (extra: Partial<PropertySet> = {}, cards = ["h1", "h2", "h3"]) => {
    const s = set("hayti", cards, extra);
    return { s, v: viewWith([s]) };
  };

  it("a base set: its ladder step, and the full-set rent while unfinished (Hayti is 1 / 2 / 4)", () => {
    const { s, v } = hayti({}, ["h1", "h2"]);
    expect(rentNow(s, v)).toBe(2);
    expect(rentLine(s, v)).toBe("Rent $2 · full set $4");
  });

  it("a complete set with no upgrades", () => {
    const { s, v } = hayti();
    expect(rentLine(s, v)).toBe("Rent $4");
  });

  it("with a Landmark", () => {
    const { s, v } = hayti({ landmark: "lm" });
    expect(rentNow(s, v)).toBe(7);
    expect(rentLine(s, v)).toBe("Rent $7 · +$3 Landmark");
  });

  it("with a Landmark and an Icon", () => {
    const { s, v } = hayti({ landmark: "lm", icon: "ic" });
    expect(rentNow(s, v)).toBe(11);
    expect(rentLine(s, v)).toBe("Rent $11 · +$3 Landmark · +$4 Icon");
  });

  it("takes the bonuses from the room's rules", () => {
    const s = set("hayti", ["h1", "h2", "h3"], { landmark: "lm", icon: "ic" });
    const v = viewWith([s], (g) => {
      g.rules.upgrades.landmarkBonus = 5;
      g.rules.upgrades.iconBonus = 6;
    });
    expect(rentLine(s, v)).toBe("Rent $15 · +$5 Landmark · +$6 Icon");
  });

  it("matches what the engine actually charges, with and without upgrades", () => {
    for (const extra of [{}, { landmark: "lm" }, { landmark: "lm", icon: "ic" }]) {
      const s = set("hayti", ["h1", "h2", "h3"], extra);
      // p1 holds a Hayti rent card and it is p1's turn: play it and read the amount from the event
      const state = withCards(newGame());
      state.cards["rent-1"] = def("rent-east-durham-hayti");
      const me = state.players[0] as GameState["players"][number];
      me.tableau = [s];
      me.hand = ["rent-1"];
      state.currentPlayer = me.id;
      state.phase = "play";
      state.playsRemaining = 3;
      state.pending = [];
      const move = legalMoves(state, me.id).find(
        (m) => m.type === "playRent" && m.district === "hayti",
      );
      if (!move) throw new Error("no rent move");
      const result = applyMove(state, move);
      if (!result.ok) throw new Error(result.error);
      const charged = result.value.events.find((e) => e.type === "rentCharged");
      expect(charged && "amount" in charged ? charged.amount : null).toBe(
        rentNow(s, viewFor(state, "p1")),
      );
    }
  });
});

describe("hand layout and selection", () => {
  it("overlaps every card but the last, which stays whole", () => {
    expect(handColumns(1)).toBe("10.5rem");
    expect(handColumns(2)).toBe("repeat(1, minmax(2.75rem, 10.5rem)) 10.5rem");
    expect(handColumns(8)).toBe("repeat(7, minmax(2.75rem, 10.5rem)) 10.5rem");
  });
});

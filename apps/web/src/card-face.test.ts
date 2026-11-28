import { createGame, loadRuleset, parseContent, viewFor } from "@bull-city-blocks/engine";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { CardFace } from "./CardFace";
import type { Card, View } from "./types";

/** A real PlayerView (districts and rules), and the card definitions from content/durham.json. */
const content = (() => {
  const c = parseContent(durham);
  if (!c.ok) throw new Error(c.error);
  return c.value;
})();
const makeView = (): View => {
  const rules = loadRuleset("base", [base]);
  if (!rules.ok) throw new Error(rules.error);
  const game = createGame(rules.value, content, ["p1", "p2"], "card-faces");
  if (!game.ok) throw new Error(game.error);
  return structuredClone(viewFor(game.value, "p1"));
};
const view = makeView();
const card = (id: string): Card => {
  const c = content.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const html = (
  c: Card,
  props: { compact?: boolean; selected?: boolean; complete?: boolean } = {},
  v: View = view,
) => renderToStaticMarkup(createElement(CardFace, { card: c, view: v, ...props }));
/** The words on a card, tags stripped. */
const words = (markup: string) =>
  markup
    .replace(/<path[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

describe("CardFace (#57)", () => {
  it.each([
    ["ninth-st", "Old West Durham $1 Ninth St 1: $1 · Full: $2"],
    ["west-point-on-the-eno", "The Eno $2 West Point on the Eno 1: $1 · 2: $2 · Full: $4"],
    [
      "wild-old-west-durham-walltown",
      "Old West Durham Walltown $1 Old West Durham / Walltown Wild Counts toward Old West Durham or Walltown.",
    ],
    ["bull-city-wild", "Any district $0 Bull City Wild Counts as any district. Can't pay a debt."],
    ["carolina-theatre", "Landmark $3 Carolina Theatre +$3 rent on a complete district."],
    ["dpac", "Icon $4 DPAC +$4 rent on a complete district with a Landmark."],
    ["cash-5", "Cash $5 $5"],
    ["walk-off-win", "Action $1 Walk-Off Win Draw 2 cards."],
    [
      "hostile-takeover",
      "Action $5 Hostile Takeover Take a complete district and its upgrades from one player. Costs 2 plays.",
    ],
    ["appeal", "Action $4 Appeal Cancel an action aimed at you. It can be Appealed back."],
    [
      "rent-old-west-durham-walltown",
      "Old West Durham Walltown $1 Old West Durham / Walltown Rent Every other player pays rent on one of your Old West Durham or Walltown districts.",
    ],
    [
      "wild-rent",
      "Any district $3 Wild Rent One player of your choice pays rent on any one of your districts.",
    ],
  ])("%s shows its name, value, kind and text", (id, expected) => {
    expect(words(html(card(id)))).toBe(expected);
  });

  it("a long name shows in full, and wraps rather than being cut", () => {
    const m = html(card("rent-trinity-park-forest-hills"));
    expect(words(m)).toContain("Trinity Park / Forest Hills Rent");
    expect(m).toContain("card-face__name"); // the CSS wraps it (overflow-wrap, text-wrap: balance)
  });

  it("a property's band is its district's colour, and a pair's two halves are both districts' colours", () => {
    expect(html(card("ninth-st"))).toContain("background:#D97706");
    const wild = html(card("wild-old-west-durham-walltown"));
    expect(wild).toContain("background:#D97706"); // Old West Durham
    expect(wild).toContain("background:#3B82F6"); // Walltown
  });

  it("rent ladders come from the view, not from constants", () => {
    const v = structuredClone(view);
    (v.districts["old-west-durham"] as { rent: number[] }).rent = [4, 9];
    expect(words(html(card("ninth-st"), {}, v))).toContain("1: $4 · Full: $9");
  });

  it("upgrade bonuses come from the room's rules", () => {
    const v = structuredClone(view);
    v.rules.upgrades.landmarkBonus = 5;
    v.rules.upgrades.iconBonus = 7;
    expect(words(html(card("carolina-theatre"), {}, v))).toContain("+$5 rent");
    expect(words(html(card("dpac"), {}, v))).toContain("+$7 rent");
  });

  it("has an accessible label for every kind: the name, the value and the text", () => {
    for (const id of [
      "ninth-st",
      "bull-city-wild",
      "carolina-theatre",
      "dpac",
      "cash-5",
      "appeal",
      "wild-rent",
    ]) {
      const label = /aria-label="([^"]*)"/.exec(html(card(id)))?.[1] ?? "";
      expect(label, id).toContain(card(id).name.replace(/'/g, "&#x27;"));
      expect(label, id).toContain(`$${card(id).value}`);
    }
    expect(html(card("appeal"))).toContain('role="img"');
  });

  it("a compact card drops the effect text but keeps the name, kind and value", () => {
    const m = words(html(card("hostile-takeover"), { compact: true }));
    expect(m).toBe("Action $5 Hostile Takeover");
    expect(html(card("ninth-st"), { compact: true })).toContain("card-face--compact");
  });

  it("marks a selected card and a card in a complete set", () => {
    expect(html(card("ninth-st"), { selected: true })).toContain("is-selected");
    expect(html(card("ninth-st"), { complete: true })).toContain("is-complete");
    expect(html(card("ninth-st"))).not.toMatch(/is-selected|is-complete/);
  });

  it("every card in the deck renders, with no placeholder text leaking through", () => {
    expect(new Set(content.cards.map((c) => c.kind))).toEqual(
      new Set(["property", "wild", "landmark", "icon", "cash", "action", "rent"]),
    );
    for (const c of content.cards) {
      const m = html(c);
      expect(m, c.id).not.toMatch(/undefined|NaN|\[object|null/);
      expect(words(m).length, c.id).toBeGreaterThan(c.name.length);
      expect(html(c, { compact: true }), c.id).toContain(`card-face--${c.kind}`);
    }
  });

  it("shows bank cards face-up: there's no face-down card face (banks are public, SPEC §3.4)", () => {
    for (const c of content.cards) expect(html(c)).not.toMatch(/face-down|card-back/);
  });
});

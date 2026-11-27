import { describe, expect, it } from "vitest";
import { arena, game, giveSet } from "./test-content";
import { viewFor } from "./view";

describe("viewFor (ARCHITECTURE §3, invariant 5)", () => {
  it("shows your own hand, and other players' hands as counts only", () => {
    const s = game(4);
    const me = s.players[0];
    const view = viewFor(s, me?.id as string);
    expect(view.players[0]?.hand).toEqual(me?.hand);
    for (const [i, p] of s.players.entries()) {
      if (i === 0) continue;
      expect(view.players[i]?.handCount).toBe(p.hand.length);
      expect(view.players[i]?.hand).toBeUndefined();
      expect(view.players[i]?.prefs).toBeUndefined();
    }
  });

  it("hides the deck order and the RNG, and never mentions a hidden card id", () => {
    const s = game(4);
    const me = s.players[0]?.id as string;
    const json = JSON.stringify(viewFor(s, me));
    expect(json).not.toContain('"rng"');
    expect(viewFor(s, me).deckCount).toBe(s.deck.length);
    const hidden = [...s.deck, ...s.players.slice(1).flatMap((p) => p.hand)];
    for (const id of hidden) expect(json, id).not.toContain(`"${id}"`);
  });

  it("shows public cards: banks, tableaux with upgrades, and the discard pile, with their definitions", () => {
    const { s, me, them } = arena(3, []);
    giveSet(s, them, "duke", ["west-campus:1:1", "east-campus:1:1", "erwin-rd:1:1"]);
    const duke = them.tableau[0];
    if (duke) duke.landmark = s.deck.splice(s.deck.indexOf("golden-belt:1:1"), 1)[0] as string;
    them.bank.push(...s.deck.splice(s.deck.indexOf("cash-5:1:1"), 1));
    s.discard.push(...s.deck.splice(s.deck.indexOf("cash-1:1:1"), 1));
    const view = viewFor(s, me.id);
    expect(view.players.find((p) => p.id === them.id)).toMatchObject({
      bank: ["cash-5:1:1"],
      tableau: them.tableau,
    });
    expect(view.discard).toEqual(["cash-1:1:1"]);
    expect(Object.keys(view.cards).sort()).toEqual(
      [
        "cash-1:1:1",
        "cash-5:1:1",
        "east-campus:1:1",
        "erwin-rd:1:1",
        "golden-belt:1:1",
        "west-campus:1:1",
      ].sort(),
    );
  });
});

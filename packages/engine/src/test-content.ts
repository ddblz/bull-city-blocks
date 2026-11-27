import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { type Content, parseContent } from "./content";
import { createGame } from "./create-game";
import { loadRuleset, type RuleSet } from "./ruleset";
import { applyMove } from "./turn";
import type { CardInstanceId, GameState, Move, PlayerState } from "./types";
import { setCards } from "./util";

/** The validated Durham content. */
export function durhamContent(): Content {
  const parsed = parseContent(durham);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.value;
}

/** The loaded base ruleset, for tests. */
export function baseRules(): RuleSet {
  const loaded = loadRuleset("base", [base]);
  if (!loaded.ok) throw new Error(loaded.error);
  return loaded.value;
}

export { base as baseJson, durham as durhamJson };

/** Game-state helpers shared by the turn, payment and rent tests. */

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
export function rules(overrides: Record<string, unknown> = {}): RuleSet {
  const r = loadRuleset("v", [base, { id: "v", extends: "base", description: "", overrides }]);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
export function game(n = 3, r: RuleSet = baseRules(), seed = "turn"): GameState {
  const g = createGame(r, durhamContent(), ids(n), seed);
  if (!g.ok) throw new Error(g.error);
  return JSON.parse(JSON.stringify(g.value)); // a private copy tests may edit
}
export function apply(s: GameState, move: Move) {
  const r = applyMove(s, move);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}
export const current = (s: GameState) =>
  s.players.find((p) => p.id === s.currentPlayer) as PlayerState;
export const next = (s: GameState) =>
  s.players[(s.players.indexOf(current(s)) + 1) % s.players.length] as PlayerState;
export const cardsIn = (s: GameState) => [
  ...s.deck,
  ...s.discard,
  ...s.players.flatMap((p) => [...p.hand, ...p.bank, ...p.tableau.flatMap(setCards)]),
];
/** Moves `cards` out of wherever they are and into `to` (keeps the card count conserved). */
export function place(s: GameState, cards: CardInstanceId[], to: CardInstanceId[]) {
  const lists = [
    s.deck,
    s.discard,
    ...s.players.flatMap((p) => [p.hand, p.bank, ...p.tableau.map((t) => t.cards)]),
  ];
  for (const card of cards)
    for (const list of lists) if (list.includes(card)) list.splice(list.indexOf(card), 1);
  to.push(...cards);
}
export const ofCard = (s: GameState, cardId: string) =>
  Object.keys(s.cards).filter((k) => s.cards[k]?.id === cardId);
export function deepFreeze<T>(o: T): T {
  if (typeof o === "object" && o !== null)
    for (const v of Object.values(Object.freeze(o))) deepFreeze(v);
  return o;
}

/**
 * A clean table: every hand, bank and tableau emptied into the deck, then the current player
 * ("me") and the next player ("them") are given `mine` and `theirs` in hand.
 */
export function arena(n: number, mine: string[], theirs: string[] = [], s: GameState = game(n)) {
  for (const p of s.players)
    place(s, [...p.hand, ...p.bank, ...p.tableau.flatMap(setCards)], s.deck);
  for (const p of s.players) p.tableau = [];
  const me = current(s);
  const them = next(s);
  place(s, mine, me.hand);
  place(s, theirs, them.hand);
  return { s, me, them };
}

/** Gives a player a tableau set of `district` holding `cards`. */
export function giveSet(s: GameState, p: PlayerState, district: string, cards: string[]) {
  const set = { district, cards: [] as string[] };
  p.tableau.push(set);
  place(s, cards, set.cards);
}

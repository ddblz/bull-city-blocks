import { shuffle } from "./rng";
import type {
  CardInstanceId,
  GameEvent,
  GameState,
  PlayerId,
  PlayerState,
  PropertySet,
} from "./types";

/** Shared state helpers. They mutate the draft that applyMove works on, never its input. */

export function playerOf(s: GameState, id: PlayerId): PlayerState {
  const p = s.players.find((x) => x.id === id);
  if (p === undefined) throw new Error(`unknown player ${id}`); // unreachable: moves are validated
  return p;
}

/** The other players in seat order, starting after `id`. */
export function othersAfter(s: GameState, id: PlayerId): PlayerState[] {
  const i = s.players.findIndex((p) => p.id === id);
  return [...s.players.slice(i + 1), ...s.players.slice(0, i)];
}

/** §3.5 / §4.2: a set is complete at its set size, with at least one non-wild property. */
export function isComplete(s: GameState, set: PropertySet): boolean {
  const size = s.districts[set.district]?.setSize ?? Number.POSITIVE_INFINITY;
  return set.cards.length >= size && set.cards.some((c) => s.cards[c]?.kind === "property");
}

/** A set's cards plus its upgrades (§4.3). */
export const setCards = (set: PropertySet): CardInstanceId[] => [
  ...set.cards,
  ...(set.landmark ? [set.landmark] : []),
  ...(set.icon ? [set.icon] : []),
];

/**
 * §3.5: adds a property or wild to the first unfinished set of its district, or starts a new set.
 * A wild goes to `district` if given, else the first district of its pair.
 */
export function addToTableau(
  s: GameState,
  p: PlayerState,
  card: CardInstanceId,
  district?: string,
): void {
  const def = s.cards[card];
  const home =
    def?.kind === "property"
      ? def.district
      : def?.kind === "wild" && def.districts !== "any"
        ? def.districts[0]
        : "";
  const d = def?.kind === "wild" && district !== undefined ? district : (home ?? "");
  const setSize = s.districts[d]?.setSize ?? 0;
  const open = p.tableau.find((set) => set.district === d && set.cards.length < setSize);
  if (open) open.cards.push(card);
  else p.tableau.push({ district: d, cards: [card] });
}

function stripUpgrades(p: PlayerState, set: PropertySet): void {
  for (const upgrade of [set.landmark, set.icon]) if (upgrade) p.bank.push(upgrade);
  delete set.landmark;
  delete set.icon;
}

/**
 * Removes a card from a player's bank or tableau and returns the district it was in, if any.
 * §3.5: a set that stops being complete sends its upgrades to the owner's bank, and so does an
 * Icon whose Landmark is removed. A set left empty is dropped.
 */
export function removeOwned(
  s: GameState,
  p: PlayerState,
  card: CardInstanceId,
): string | undefined {
  const i = p.bank.indexOf(card);
  if (i >= 0) {
    p.bank.splice(i, 1);
    return undefined;
  }
  const set = p.tableau.find((t) => setCards(t).includes(card));
  if (set === undefined) return undefined;
  if (set.landmark === card) {
    delete set.landmark;
    if (set.icon) stripUpgrades(p, set);
  } else if (set.icon === card) delete set.icon;
  else set.cards.splice(set.cards.indexOf(card), 1);
  if (!isComplete(s, set)) stripUpgrades(p, set);
  p.tableau = p.tableau.filter((t) => t.cards.length > 0);
  return set.district;
}

/** §3.3: draws up to `n`, reshuffling the discard pile when the draw pile runs out. */
export function draw(s: GameState, p: PlayerState, n: number, events: GameEvent[]): void {
  let drawn = 0;
  for (; drawn < n; drawn++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      const shuffled = shuffle(s.rng, s.discard);
      events.push({ type: "deckReshuffled", cards: s.discard.length });
      s.deck = shuffled.value;
      s.discard = [];
      s.rng = shuffled.rng;
    }
    p.hand.push(s.deck.shift() as CardInstanceId);
  }
  events.push({ type: "cardsDrawn", player: p.id, count: drawn });
}

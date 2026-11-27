import type { CardInstanceId, GameState, PlayerId, PlayerState } from "./types";

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

/** §3.5: adds a property to the first unfinished set of its district, or starts a new set. */
export function addToTableau(s: GameState, p: PlayerState, card: CardInstanceId): void {
  const def = s.cards[card];
  const district = def?.kind === "property" ? def.district : "";
  const setSize = s.districts[district]?.setSize ?? 0;
  const open = p.tableau.find((set) => set.district === district && set.cards.length < setSize);
  if (open) open.cards.push(card);
  else p.tableau.push({ district, cards: [card] });
}

/** Removes a card from a player's bank or tableau, dropping a tableau set that becomes empty. */
export function removeOwned(p: PlayerState, card: CardInstanceId): void {
  const i = p.bank.indexOf(card);
  if (i >= 0) {
    p.bank.splice(i, 1);
    return;
  }
  for (const set of p.tableau) {
    const j = set.cards.indexOf(card);
    if (j >= 0) set.cards.splice(j, 1);
  }
  p.tableau = p.tableau.filter((set) => set.cards.length > 0);
}

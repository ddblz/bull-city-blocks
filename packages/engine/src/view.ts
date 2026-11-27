import type { Card } from "./content";
import type { CardInstanceId, GameState, PlayerId, PlayerState, PropertySet } from "./types";
import { setCards } from "./util";

/**
 * What one player may see (ARCHITECTURE §3, invariant 5). Other players' hands are counts only,
 * the deck is a count only, and the RNG state (which would reveal the deck order) is left out.
 * `cards` holds definitions for visible cards only, so hidden card ids never appear.
 */
export interface PlayerView {
  viewer: PlayerId;
  phase: GameState["phase"];
  currentPlayer: PlayerId;
  startingPlayer: PlayerId;
  playsRemaining: number;
  turn: number;
  round: number;
  result: GameState["result"];
  pending: GameState["pending"];
  rules: GameState["rules"];
  districts: GameState["districts"];
  deckCount: number;
  discard: CardInstanceId[];
  players: {
    id: PlayerId;
    handCount: number;
    /** Only for the viewer. */
    hand?: CardInstanceId[];
    /** Only for the viewer. */
    prefs?: PlayerState["prefs"];
    bank: CardInstanceId[];
    tableau: PropertySet[];
    delayed: boolean;
  }[];
  cards: Record<CardInstanceId, Card>;
}

export function viewFor(state: GameState, viewer: PlayerId): PlayerView {
  const visible: CardInstanceId[] = [...state.discard];
  const players = state.players.map((p) => {
    const mine = p.id === viewer;
    visible.push(...p.bank, ...p.tableau.flatMap(setCards), ...(mine ? p.hand : []));
    return {
      id: p.id,
      handCount: p.hand.length,
      ...(mine ? { hand: [...p.hand], prefs: { ...p.prefs } } : {}),
      bank: [...p.bank],
      tableau: p.tableau.map((set) => ({ ...set, cards: [...set.cards] })),
      delayed: p.delayed,
    };
  });
  const cards: Record<CardInstanceId, Card> = {};
  for (const id of visible) {
    const card = state.cards[id];
    if (card) cards[id] = card;
  }
  return {
    viewer,
    phase: state.phase,
    currentPlayer: state.currentPlayer,
    startingPlayer: state.startingPlayer,
    playsRemaining: state.playsRemaining,
    turn: state.turn,
    round: state.round,
    result: state.result,
    pending: jsonCopy(state.pending),
    rules: state.rules,
    districts: state.districts,
    deckCount: state.deck.length,
    discard: [...state.discard],
    players,
    cards,
  };
}

const jsonCopy = <T>(v: T): T => JSON.parse(JSON.stringify(v));

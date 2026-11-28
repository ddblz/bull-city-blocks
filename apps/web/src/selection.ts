import type { MoveGroups } from "./move-groups";
import type { Move } from "./types";

/** The card a player tapped, and the turn they tapped it in. */
export interface Picked {
  card: string;
  turn: number;
}

/** Tapping a card selects it; tapping the selected card again deselects. */
export function pick(current: string | null, card: string, turn: number): Picked | null {
  return current === card ? null : { card, turn };
}

/** The selection holds only while the card is still in the hand and the turn hasn't moved on. */
export function selectedCard(
  picked: Picked | null,
  turn: number,
  hand: readonly string[],
): string | null {
  return picked && picked.turn === turn && hand.includes(picked.card) ? picked.card : null;
}

/** What a selected card offers: exactly its legal moves, nothing added. */
export interface CardActions {
  play?: Move;
  bank?: Move;
  discard?: Move;
  /** Moves that need choices (a wild's district, rent, an action ...). */
  flow: Move[];
}

export function actionsFor(groups: MoveGroups, card: string): CardActions {
  const { play, bank } = groups.hand[card] ?? {};
  const discard = groups.discard[card];
  return {
    ...(play && { play }),
    ...(bank && { bank }),
    ...(discard && { discard }),
    flow: groups.flows[card] ?? [],
  };
}

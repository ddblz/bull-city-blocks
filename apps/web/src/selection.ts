import type { MoveGroups } from "./move-groups";
import type { Move } from "./types";

export interface Picked {
  card: string;
  turn: number;
}

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

export interface CardActions {
  play?: Move;
  bank?: Move;
  discard?: Move;
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

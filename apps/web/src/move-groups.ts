import type { Move } from "./types";

/** The simple moves the table offers, grouped by what the player clicks. */
export interface MoveGroups {
  /** Per hand card: put a property into the tableau, and/or bank it. */
  hand: Record<string, { play?: Move; bank?: Move }>;
  endTurn?: Move;
  /** Per hand card, when over the hand limit. */
  discard: Record<string, Move>;
  /** Per bank or tableau card, when paying a debt one card at a time. */
  pay: Record<string, Move>;
  /** Accept the action awaiting this player. */
  accept?: Move;
}

/**
 * Groups `legalMoves` into UI actions. Only #37's moves are kept: wilds, upgrades, rent,
 * actions, Appeals and multi-card payments arrive in #38, so those cards can only be banked.
 */
export function groupMoves(legal: readonly Move[]): MoveGroups {
  const groups: MoveGroups = { hand: {}, discard: {}, pay: {} };
  for (const move of legal) {
    switch (move.type) {
      case "playProperty":
        if (move.district === undefined)
          groups.hand[move.card] = { ...groups.hand[move.card], play: move };
        break;
      case "bank":
        groups.hand[move.card] = { ...groups.hand[move.card], bank: move };
        break;
      case "endTurn":
        groups.endTurn = move;
        break;
      case "discard":
        groups.discard[move.card] = move;
        break;
      case "pay": {
        const [only] = move.cards;
        if (move.cards.length === 1 && only !== undefined) groups.pay[only] = move;
        break;
      }
      case "respond":
        if (move.appeal === undefined) groups.accept = move;
        break;
    }
  }
  return groups;
}

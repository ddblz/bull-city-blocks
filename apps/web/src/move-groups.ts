import type { Move } from "./types";

/** The table's moves, grouped by what the player clicks. */
export interface MoveGroups {
  /** Per hand card: put a property into the tableau, and/or bank it. */
  hand: Record<string, { play?: Move; bank?: Move }>;
  /**
   * Per card: the moves that need choices (a wild's district, rent, actions, upgrades, moving a
   * wild). Built step by step with `nextStep` (choice-flows.ts).
   */
  flows: Record<string, Move[]>;
  endTurn?: Move;
  /** Per hand card, when over the hand limit. */
  discard: Record<string, Move>;
  /** Bank and tableau cards that can go toward the awaited debt, in any combination (§3.4). */
  payable: string[];
  /** Accept the action awaiting this player, or Appeal it (§3.6). */
  accept?: Move;
  appeal?: Move;
}

/** Groups `legalMoves` into UI actions. */
export function groupMoves(legal: readonly Move[]): MoveGroups {
  const groups: MoveGroups = { hand: {}, flows: {}, discard: {}, payable: [] };
  const flow = (card: string, move: Move) => {
    groups.flows[card] = [...(groups.flows[card] ?? []), move];
  };
  for (const move of legal) {
    switch (move.type) {
      case "playProperty":
        if (move.district === undefined)
          groups.hand[move.card] = { ...groups.hand[move.card], play: move };
        else flow(move.card, move);
        break;
      case "playRent":
      case "playAction":
      case "playUpgrade":
      case "moveWild":
        flow(move.card, move);
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
      case "pay":
        for (const card of move.cards)
          if (!groups.payable.includes(card)) groups.payable.push(card);
        break;
      case "respond":
        if (move.appeal === undefined) groups.accept = move;
        else groups.appeal = move;
        break;
    }
  }
  return groups;
}

/** The button that starts a card's multi-step move. */
export const FLOW_LABEL: Record<string, string> = {
  playProperty: "Play as…",
  playRent: "Charge rent",
  playAction: "Play",
  playUpgrade: "Place",
  moveWild: "Move",
};

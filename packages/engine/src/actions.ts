import type { ActionType } from "./content";
import type { GameEvent, GameState, Move, PlayerId } from "./types";
import { draw, othersAfter, playerOf } from "./util";

/** SPEC §4.5 basic actions. Each costs one play and then goes to the discard pile. */

const WALK_OFF_DRAW = 2;
const RODEO_AMOUNT = 2;
/** Construction Delay: the target's next draw is at most this many cards. */
export const DELAYED_DRAW = 1;

const BASIC: ReadonlySet<ActionType> = new Set([
  "walkOffWin",
  "foodTruckRodeo",
  "assessment",
  "constructionDelay",
]);
const TARGETED: ReadonlySet<ActionType> = new Set(["assessment", "constructionDelay"]);

const actionOf = (s: GameState, card: string): ActionType | null => {
  const def = s.cards[card];
  return def?.kind === "action" ? def.action : null;
};

export function actionMoves(s: GameState, player: PlayerId): Move[] {
  const moves: Move[] = [];
  const others = othersAfter(s, player).map((p) => p.id);
  for (const card of playerOf(s, player).hand) {
    const action = actionOf(s, card);
    if (action === null || !BASIC.has(action)) continue;
    if (TARGETED.has(action))
      for (const target of others) moves.push({ type: "playAction", player, card, target });
    else moves.push({ type: "playAction", player, card });
  }
  return moves;
}

/** Properties a player owns: every card in their tableau sets. */
const propertyCount = (s: GameState, player: PlayerId) =>
  playerOf(s, player).tableau.reduce((n, set) => n + set.cards.length, 0);

export function playAction(
  s: GameState,
  move: Extract<Move, { type: "playAction" }>,
  events: GameEvent[],
): void {
  const p = playerOf(s, move.player);
  p.hand.splice(p.hand.indexOf(move.card), 1);
  s.discard.push(move.card);
  s.playsRemaining -= 1;
  events.push({
    type: "actionPlayed",
    player: p.id,
    card: move.card,
    ...(move.target ? { target: move.target } : {}),
  });
  const charge = (debtor: PlayerId, amount: number) => {
    if (amount <= 0) return;
    s.pending.push({ type: "debt", debtor, creditor: p.id, amount });
    s.phase = "pay";
  };

  switch (actionOf(s, move.card)) {
    case "walkOffWin":
      draw(s, p, WALK_OFF_DRAW, events);
      break;
    case "foodTruckRodeo": {
      const cap = s.rules.actions.foodTruckRodeo.maxTargets;
      for (const o of othersAfter(s, p.id).slice(0, cap ?? undefined)) charge(o.id, RODEO_AMOUNT);
      break;
    }
    case "assessment":
      if (move.target)
        charge(
          move.target,
          Math.min(propertyCount(s, move.target), s.rules.actions.assessment.cap),
        );
      break;
    case "constructionDelay":
      if (move.target) playerOf(s, move.target).delayed = true;
      break;
  }
}

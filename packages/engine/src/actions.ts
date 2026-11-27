import type { ActionType } from "./content";
import { queueResponses } from "./respond";
import type { GameEvent, GameState, Move, PlayerId, PlayerState } from "./types";
import { draw, isComplete, othersAfter, playerOf } from "./util";

/** SPEC §4.5 actions. Each goes to the discard pile; targeted ones wait for a response (§3.6). */

const WALK_OFF_DRAW = 2;
const RODEO_AMOUNT = 2;
/** Construction Delay: the target's next draw is at most this many cards. */
export const DELAYED_DRAW = 1;

const actionOf = (s: GameState, card: string): ActionType | null => {
  const def = s.cards[card];
  return def?.kind === "action" ? def.action : null;
};

const incompleteProps = (s: GameState, p: PlayerState) =>
  p.tableau.filter((set) => !isComplete(s, set)).flatMap((set) => set.cards);
const completeDistricts = (s: GameState, p: PlayerState) => [
  ...new Set(p.tableau.filter((set) => isComplete(s, set)).map((set) => set.district)),
];

/** Plays an action costs: Hostile Takeover costs `playCost`, everything else 1. */
const costOf = (s: GameState, action: ActionType | null) =>
  action === "hostileTakeover" ? s.rules.actions.hostileTakeover.playCost : 1;

export function actionMoves(s: GameState, player: PlayerId): Move[] {
  const me = playerOf(s, player);
  const others = othersAfter(s, player);
  const moves: Move[] = [];
  for (const card of me.hand) {
    const action = actionOf(s, card);
    if (action === null || costOf(s, action) > s.playsRemaining) continue;
    const base = { type: "playAction" as const, player, card };
    for (const o of others) {
      const target = o.id;
      if (action === "assessment" || action === "constructionDelay")
        moves.push({ ...base, target });
      if (action === "buyout")
        for (const take of incompleteProps(s, o)) moves.push({ ...base, target, take });
      if (action === "swapMeet") {
        for (const give of incompleteProps(s, me))
          for (const take of incompleteProps(s, o)) moves.push({ ...base, target, take, give });
      }
      if (action === "hostileTakeover") {
        for (const district of completeDistricts(s, o)) moves.push({ ...base, target, district });
      }
    }
    if (action === "walkOffWin" || action === "foodTruckRodeo") moves.push(base);
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
  const action = actionOf(s, move.card);
  p.hand.splice(p.hand.indexOf(move.card), 1);
  s.discard.push(move.card);
  s.playsRemaining -= costOf(s, action);
  events.push({
    type: "actionPlayed",
    player: p.id,
    card: move.card,
    ...(move.target ? { target: move.target } : {}),
  });
  const one = move.target ? [move.target] : [];
  const queue = (targets: readonly PlayerId[], effect: Parameters<typeof queueResponses>[4]) =>
    queueResponses(s, p.id, move.card, targets, effect);

  switch (action) {
    case "walkOffWin":
      draw(s, p, WALK_OFF_DRAW, events);
      break;
    case "foodTruckRodeo": {
      const cap = s.rules.actions.foodTruckRodeo.maxTargets;
      const targets = othersAfter(s, p.id).slice(0, cap ?? undefined);
      queue(
        targets.map((o) => o.id),
        { kind: "debt", amount: RODEO_AMOUNT },
      );
      break;
    }
    case "assessment": {
      const amount = Math.min(propertyCount(s, move.target ?? ""), s.rules.actions.assessment.cap);
      if (amount > 0) queue(one, { kind: "debt", amount });
      break;
    }
    case "constructionDelay":
      queue(one, { kind: "delay" });
      break;
    case "buyout":
      if (move.take) queue(one, { kind: "buyout", take: move.take });
      break;
    case "swapMeet":
      if (move.take && move.give) queue(one, { kind: "swap", take: move.take, give: move.give });
      break;
    case "hostileTakeover":
      if (move.district) queue(one, { kind: "takeover", district: move.district });
      break;
  }
}

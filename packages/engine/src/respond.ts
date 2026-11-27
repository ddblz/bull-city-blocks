import { autoPayHead } from "./payment";
import type {
  CardInstanceId,
  Effect,
  GameEvent,
  GameState,
  PendingStep,
  PlayerId,
  PlayerState,
} from "./types";
import { addToTableau, playerOf, removeOwned } from "./util";

/** SPEC §3.6 responses and Appeal chains (ARCHITECTURE §4.2). */

type Response = Extract<PendingStep, { type: "response" }>;

/** The first Appeal in a player's hand, if any. */
export function appealIn(s: GameState, p: PlayerState): CardInstanceId | undefined {
  return p.hand.find((c) => {
    const def = s.cards[c];
    return def?.kind === "action" && def.action === "appeal";
  });
}

/** Queues one response per target, in order. Each target answers (and pays) before the next. */
export function queueResponses(
  s: GameState,
  attacker: PlayerId,
  card: CardInstanceId,
  targets: readonly PlayerId[],
  effect: Effect,
): void {
  for (const target of targets) {
    s.pending.push({
      type: "response",
      card,
      attacker,
      target,
      awaiting: target,
      appeals: 0,
      effect,
    });
  }
}

/** The awaited player Appeals (passing the answer to the other side) or accepts. */
export function respond(
  s: GameState,
  appeal: CardInstanceId | undefined,
  events: GameEvent[],
): void {
  const step = s.pending[0];
  if (step?.type !== "response") return;
  events.push({ type: "responded", player: step.awaiting, appeal: appeal !== undefined });
  if (appeal !== undefined) {
    const p = playerOf(s, step.awaiting);
    p.hand.splice(p.hand.indexOf(appeal), 1);
    s.discard.push(appeal);
    const awaiting = step.awaiting === step.target ? step.attacker : step.target;
    s.pending[0] = { ...step, awaiting, appeals: step.appeals + 1 };
    return;
  }
  s.pending.shift();
  // Whoever played the last unanswered Appeal wins: an odd count means the target's stands.
  const cancelled = step.appeals % 2 === 1;
  events.push({
    type: "actionResolved",
    attacker: step.attacker,
    target: step.target,
    card: step.card,
    cancelled,
    effect: step.effect,
  });
  if (!cancelled) applyEffect(s, step);
}

function applyEffect(s: GameState, step: Response): void {
  const attacker = playerOf(s, step.attacker);
  const target = playerOf(s, step.target);
  const { effect } = step;
  switch (effect.kind) {
    case "debt":
      s.pending.unshift({
        type: "debt",
        debtor: target.id,
        creditor: attacker.id,
        amount: effect.amount,
      });
      break;
    case "delay":
      target.delayed = true;
      break;
    case "buyout": {
      addToTableau(s, attacker, effect.take, removeOwned(s, target, effect.take));
      const value = s.cards[effect.take]?.value ?? 0;
      if (s.rules.actions.buyout.payCardValue && value > 0) {
        s.pending.unshift({
          type: "debt",
          debtor: attacker.id,
          creditor: target.id,
          amount: value,
        });
      }
      break;
    }
    case "swap":
      addToTableau(s, attacker, effect.take, removeOwned(s, target, effect.take));
      addToTableau(s, target, effect.give, removeOwned(s, attacker, effect.give));
      break;
    case "takeover": {
      const size = s.districts[effect.district]?.setSize ?? 0;
      const i = target.tableau.findIndex(
        (set) => set.district === effect.district && set.cards.length >= size,
      );
      const [set] = i >= 0 ? target.tableau.splice(i, 1) : [];
      if (set) attacker.tableau.push(set); // the whole set moves, so it stays complete
      break;
    }
  }
}

/**
 * Auto-resolution inside applyMove (ARCHITECTURE §3): while the head of the queue can be settled
 * without a choice, settle it. A response is auto-accepted when the awaited player has auto-pass
 * on and no Appeal in hand (§3.6); a debt is auto-paid per §3.4. Returns to Play when empty.
 */
export function resolvePending(s: GameState, events: GameEvent[]): void {
  while (s.phase !== "gameOver") {
    const step = s.pending[0];
    if (step === undefined) {
      if (s.phase === "respond" || s.phase === "pay") s.phase = "play";
      return;
    }
    if (step.type === "debt") {
      s.phase = "pay";
      if (!autoPayHead(s, events)) return;
      continue;
    }
    s.phase = "respond";
    const p = playerOf(s, step.awaiting);
    if (!p.prefs.autoPass || appealIn(s, p) !== undefined) return;
    events.push({ type: "autoResolved", player: p.id, kind: "respond" });
    respond(s, undefined, events);
  }
}

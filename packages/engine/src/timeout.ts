import { payableCards } from "./payment";
import { awaitedPlayer } from "./turn";
import type { CardInstanceId, GameState, Move, PlayerId } from "./types";
import { playerOf } from "./util";

/** ARCHITECTURE §3: who the game is waiting on, and for what. */
export function awaiting(
  state: GameState,
): { player: PlayerId; kind: "play" | "discard" | "respond" | "pay" } | null {
  const player = awaitedPlayer(state);
  if (player === null || state.phase === "gameOver") return null;
  return { player, kind: state.phase };
}

const cardValue = (s: GameState, card: CardInstanceId) => s.cards[card]?.value ?? 0;
/** Lowest value first; ties broken by card id so the choice depends only on the state. */
const byValue = (s: GameState) => (a: CardInstanceId, b: CardInstanceId) =>
  cardValue(s, a) - cardValue(s, b) || (a < b ? -1 : a > b ? 1 : 0);

/**
 * §3.7 timeout payment: the fewest cards that cover the debt (or everything, if nothing does),
 * preferring bank cards to tableau cards and lower values to higher ones.
 */
export function timeoutPayment(s: GameState, player: PlayerId, amount: number): CardInstanceId[] {
  const p = playerOf(s, player);
  const payable = payableCards(s, p);
  const bank = payable.filter((c) => p.bank.includes(c)).sort(byValue(s));
  const tableau = payable.filter((c) => !p.bank.includes(c)).sort(byValue(s));
  const preferred = [...bank, ...tableau];
  const largest = [...payable].sort(byValue(s)).reverse();
  let k = 0;
  for (let sum = 0; k < largest.length && sum < amount; k++)
    sum += cardValue(s, largest[k] as CardInstanceId);
  // Fill k slots in preference order, taking a card only if the debt can still be covered.
  const chosen: CardInstanceId[] = [];
  let owed = amount;
  for (let slot = k; slot > 0; slot--) {
    const rest = preferred.filter((c) => !chosen.includes(c));
    const pick =
      rest.find((c) => {
        const others = rest
          .filter((o) => o !== c)
          .sort(byValue(s))
          .reverse()
          .slice(0, slot - 1);
        return cardValue(s, c) + others.reduce((n, o) => n + cardValue(s, o), 0) >= owed;
      }) ?? rest[rest.length - 1];
    if (pick === undefined) break;
    chosen.push(pick);
    owed -= cardValue(s, pick);
  }
  return chosen;
}

/** SPEC §3.7: the fixed default move for whoever is awaited. Always legal; depends only on the state. */
export function timeoutMove(state: GameState): Move | null {
  const wait = awaiting(state);
  if (wait === null) return null;
  const { player } = wait;
  const step = state.pending[0];
  switch (wait.kind) {
    case "play":
      return { type: "endTurn", player };
    case "discard":
      return {
        type: "discard",
        player,
        card: [...playerOf(state, player).hand].sort(byValue(state))[0] as CardInstanceId,
      };
    case "respond":
      return { type: "respond", player };
    case "pay":
      return {
        type: "pay",
        player,
        cards: timeoutPayment(state, player, step?.type === "debt" ? step.amount : 0),
      };
  }
}

import type { CardInstanceId, GameEvent, GameState, PlayerId, PlayerState } from "./types";
import { addToTableau, playerOf, removeOwned, setCards } from "./util";

/** SPEC §3.4 paying debts. Debts wait in `state.pending`, in seat order after the creditor. */

/** Bank and tableau cards a player may pay with. Bull City Wilds can't be used (§4.2). */
export function payableCards(s: GameState, p: PlayerState): CardInstanceId[] {
  const owned = [...p.bank, ...p.tableau.flatMap(setCards)];
  return owned.filter((card) => {
    const def = s.cards[card];
    return !(def?.kind === "wild" && def.districts === "any");
  });
}

export const totalValue = (s: GameState, cards: readonly CardInstanceId[]) =>
  cards.reduce((sum, card) => sum + (s.cards[card]?.value ?? 0), 0);

/** Validates a `pay` move: the awaited debtor, one or more distinct payable cards they own. */
export function checkPay(
  s: GameState,
  player: PlayerId,
  cards: readonly CardInstanceId[],
): string | null {
  const debt = s.pending[0];
  if (s.phase !== "pay" || debt?.type !== "debt" || debt.debtor !== player) return "no debt to pay";
  if (cards.length === 0 || new Set(cards).size !== cards.length)
    return "pay one or more distinct cards";
  const payable = payableCards(s, playerOf(s, player));
  const bad = cards.find((c) => !payable.includes(c));
  return bad === undefined ? null : `can't pay with ${bad}`;
}

function settle(s: GameState, forgiven: number, events: GameEvent[]): void {
  const debt = s.pending.shift();
  if (debt?.type === "debt")
    events.push({ type: "debtSettled", debtor: debt.debtor, creditor: debt.creditor, forgiven });
}

/**
 * Moves the cards to the creditor: properties to their tableau, everything else to their bank.
 * No change is given; a debt is settled once covered or once the debtor has nothing left to pay.
 */
export function pay(s: GameState, cards: readonly CardInstanceId[], events: GameEvent[]): void {
  const debt = s.pending[0];
  if (debt?.type !== "debt") return;
  const debtor = playerOf(s, debt.debtor);
  const creditor = playerOf(s, debt.creditor);
  for (const card of cards) {
    const from = removeOwned(s, debtor, card);
    const kind = s.cards[card]?.kind;
    if (kind === "property" || kind === "wild") addToTableau(s, creditor, card, from);
    else creditor.bank.push(card);
  }
  const remaining = debt.amount - totalValue(s, cards);
  events.push({ type: "paid", debtor: debtor.id, creditor: creditor.id, cards: [...cards] });
  if (remaining <= 0) settle(s, 0, events);
  else if (payableCards(s, debtor).length === 0) settle(s, remaining, events);
  else s.pending[0] = { ...debt, amount: remaining };
}

/**
 * §3.4 auto-pay for the debt at the head of the queue: if the debtor owes at least everything
 * payable they own, the engine pays it all (or forgives it if they own nothing). Returns whether
 * the debt was settled.
 */
export function autoPayHead(s: GameState, events: GameEvent[]): boolean {
  const debt = s.pending[0];
  if (debt?.type !== "debt") return false;
  const payable = payableCards(s, playerOf(s, debt.debtor));
  if (payable.length === 0) {
    settle(s, debt.amount, events);
    return true;
  }
  if (!s.rules.payments.autoPay || debt.amount < totalValue(s, payable)) return false;
  events.push({ type: "autoResolved", player: debt.debtor, kind: "pay" });
  pay(s, payable, events);
  return true;
}

import { autoResolvePayments, checkPay, pay, payableCards } from "./payment";
import { playRent, rentMoves } from "./rent";
import type { Result } from "./result";
import { shuffle } from "./rng";
import type { CardInstanceId, GameEvent, GameState, Move, PlayerId, PlayerState } from "./types";
import { addToTableau, playerOf } from "./util";

/**
 * The turn loop (SPEC §3.2–3.3, §3.5 completion, §3.8; ARCHITECTURE §4.1). applyMove copies
 * everything it may change; card, district and rule data are shared because they never change.
 */

function draft(s: GameState): GameState {
  return {
    ...s,
    deck: [...s.deck],
    discard: [...s.discard],
    pending: [...s.pending],
    players: s.players.map((p) => ({
      ...p,
      hand: [...p.hand],
      bank: [...p.bank],
      tableau: p.tableau.map((set) => ({ ...set, cards: [...set.cards] })),
      prefs: { ...p.prefs },
    })),
  };
}

/** §3.3: draws up to `n`, reshuffling the discard pile when the draw pile runs out. */
function draw(s: GameState, p: PlayerState, n: number, events: GameEvent[]): void {
  let drawn = 0;
  for (; drawn < n; drawn++) {
    if (s.deck.length === 0) {
      if (s.discard.length === 0) break;
      const shuffled = shuffle(s.rng, s.discard);
      events.push({ type: "deckReshuffled", cards: s.discard.length });
      s.deck = shuffled.value;
      s.discard = [];
      s.rng = shuffled.rng;
    }
    p.hand.push(s.deck.shift() as CardInstanceId);
  }
  events.push({ type: "cardsDrawn", player: p.id, count: drawn });
}

/** §3.2 step 1: draw 2, or 5 from an empty hand, then start the Play phase. Mutates `s`. */
export function startTurn(s: GameState, events: GameEvent[]): void {
  const p = playerOf(s, s.currentPlayer);
  events.push({ type: "turnStarted", player: p.id, turn: s.turn, round: s.round });
  draw(s, p, p.hand.length === 0 ? s.rules.draw.emptyHand : s.rules.draw.perTurn, events);
  s.phase = "play";
  s.playsRemaining = s.rules.playsPerTurn;
}

/** §3.5: districts where the player holds at least one complete set. */
export function completeDistricts(s: GameState, player: PlayerId): Set<string> {
  const done = new Set<string>();
  for (const set of playerOf(s, player).tableau) {
    const district = s.districts[set.district];
    if (district !== undefined && set.cards.length >= district.setSize) done.add(set.district);
  }
  return done;
}

function endGame(s: GameState, result: PlayerId | "stall", events: GameEvent[]): void {
  s.phase = "gameOver";
  s.result = result;
  s.playsRemaining = 0;
  events.push({ type: "gameOver", result });
}

/** §3.8: passes the turn on, ending the game as a stall after `roundLimit` full rounds. */
function nextTurn(s: GameState, events: GameEvent[]): void {
  const i = s.players.findIndex((p) => p.id === s.currentPlayer);
  const next = s.players[(i + 1) % s.players.length] as PlayerState;
  if (next.id === s.startingPlayer) s.round += 1;
  if (s.round > s.rules.roundLimit) {
    endGame(s, "stall", events);
    return;
  }
  s.turn += 1;
  s.currentPlayer = next.id;
  startTurn(s, events);
}

/** §3.2 step 3: discard down to the hand limit, or pass the turn. */
function endPlay(s: GameState, events: GameEvent[]): void {
  if (playerOf(s, s.currentPlayer).hand.length > s.rules.hand.limit) s.phase = "discard";
  else nextTurn(s, events);
}

/** Who the game is waiting on: the first debtor while debts are pending, else the current player. */
export function awaitedPlayer(state: GameState): PlayerId | null {
  if (state.phase === "gameOver") return null;
  return state.phase === "pay" ? (state.pending[0]?.debtor ?? null) : state.currentPlayer;
}

/**
 * Every legal move for `player`. While paying, it lists one single-card `pay` per payable card;
 * a `pay` with several cards is legal too (checkPay) but not listed, to keep the list small.
 */
export function legalMoves(state: GameState, player: PlayerId): Move[] {
  if (player !== awaitedPlayer(state)) return [];
  const p = playerOf(state, player);
  if (state.phase === "pay")
    return payableCards(state, p).map((card) => ({ type: "pay", player, cards: [card] }));
  if (state.phase === "discard") return p.hand.map((card) => ({ type: "discard", player, card }));
  const moves: Move[] = [];
  if (state.playsRemaining > 0) {
    for (const card of p.hand) {
      const kind = state.cards[card]?.kind;
      if (kind === "property") moves.push({ type: "playProperty", player, card });
      if (kind === "cash" || kind === "action" || kind === "rent")
        moves.push({ type: "bank", player, card });
    }
    moves.push(...rentMoves(state, player));
  }
  moves.push({ type: "endTurn", player });
  return moves;
}

const moveKey = (m: Move) =>
  JSON.stringify(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));

/** Applies a legal move. Illegal moves return an error and leave the input untouched. */
export function applyMove(
  state: GameState,
  move: Move,
): Result<{ state: GameState; events: GameEvent[] }> {
  const problem =
    move.type === "pay"
      ? checkPay(state, move.player, move.cards)
      : legalMoves(state, move.player).some((m) => moveKey(m) === moveKey(move))
        ? null
        : "not a legal move";
  if (problem !== null)
    return { ok: false, error: `illegal move ${JSON.stringify(move)}: ${problem}` };
  const s = draft(state);
  const events: GameEvent[] = [];
  const p = playerOf(s, move.player);
  const take = (card: CardInstanceId) => p.hand.splice(p.hand.indexOf(card), 1);

  switch (move.type) {
    case "playProperty": {
      take(move.card);
      addToTableau(s, p, move.card);
      s.playsRemaining -= 1;
      events.push({ type: "propertyPlayed", player: p.id, card: move.card });
      break;
    }
    case "bank":
      take(move.card);
      p.bank.push(move.card);
      s.playsRemaining -= 1;
      events.push({ type: "banked", player: p.id, card: move.card });
      break;
    case "endTurn":
      endPlay(s, events);
      break;
    case "discard":
      take(move.card);
      s.discard.push(move.card);
      events.push({ type: "discarded", player: p.id, card: move.card });
      if (p.hand.length <= s.rules.hand.limit) nextTurn(s, events);
      break;
    case "playRent":
      playRent(s, move, events);
      break;
    case "pay":
      pay(s, move.cards, events);
      break;
  }
  autoResolvePayments(s, events);

  // §3.2 step 4: the win check runs after every move, for every player.
  if (s.phase !== "gameOver") {
    const winner = s.players.find((x) => completeDistricts(s, x.id).size >= s.rules.districtsToWin);
    if (winner) endGame(s, winner.id, events);
    else if (s.phase === "play" && s.playsRemaining === 0) endPlay(s, events);
  }
  return { ok: true, value: { state: s, events } };
}

/** The winner, "stall" at the round limit, or null while the game is running. */
export function winner(state: GameState): PlayerId | "stall" | null {
  return state.result;
}

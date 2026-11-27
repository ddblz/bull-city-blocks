import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createGame } from "./create-game";
import { payableCards, totalValue } from "./payment";
import { appealIn } from "./respond";
import { nextUint32, seedRng } from "./rng";
import { baseRules, cardsIn, deepFreeze, durhamContent } from "./test-content";
import { timeoutMove } from "./timeout";
import { applyMove, awaitedPlayer, legalMoves } from "./turn";
import type { GameState, Move } from "./types";
import { playerOf } from "./util";
import { viewFor } from "./view";

/**
 * ARCHITECTURE §7 invariants, checked over random games. fast-check picks a seed and a list of
 * choices; each choice picks one of the awaited player's legal moves, or the timeout move.
 * Most games are capped at MAX_MOVES so 200 games per player count stay inside the time budget;
 * a few more per player count are played all the way to a win or the round-limit stall.
 */
const MAX_MOVES = 60;
const RUNS = 200;
const FULL_GAMES = 5;
/** A full game ends by roundLimit (60 rounds); this only guards against a game that never ends. */
const SAFETY_CAP = 100_000;
const content = durhamContent();
const rules = baseRules();

/** Invariant 7: nobody is left waiting on a choice the engine should have made for them. */
function shouldHaveAutoResolved(s: GameState): boolean {
  const step = s.pending[0];
  if (s.phase === "respond" && step?.type === "response") {
    const p = playerOf(s, step.awaiting);
    return p.prefs.autoPass && appealIn(s, p) === undefined;
  }
  if (s.phase === "pay" && step?.type === "debt") {
    const payable = payableCards(s, playerOf(s, step.debtor));
    return (
      payable.length === 0 || (s.rules.payments.autoPay && step.amount >= totalValue(s, payable))
    );
  }
  return false;
}

/** Invariant 5: a view never mentions the deck order or another player's hand. */
function checkView(s: GameState, viewer: string) {
  const json = JSON.stringify(viewFor(s, viewer));
  const hidden = [...s.deck, ...s.players.filter((p) => p.id !== viewer).flatMap((p) => p.hand)];
  for (const id of hidden) expect(json.includes(`"${id}"`), `${viewer} sees ${id}`).toBe(false);
}

/** An endless stream of choices, derived from fast-check's seed through the engine's own RNG. */
function* endlessChoices(seed: number): Generator<number> {
  let rng = seedRng(`choices-${seed}`);
  for (;;) {
    const next = nextUint32(rng);
    rng = next.rng;
    yield next.value;
  }
}

/** Plays until the choices run out or the game ends, checking the invariants; returns the final state. */
function play(n: number, seed: number, choices: Iterable<number>): GameState {
  const ids = Array.from({ length: n }, (_, i) => `p${i + 1}`);
  const created = createGame(rules, content, ids, `prop-${seed}`);
  if (!created.ok) throw new Error(created.error);
  let s = deepFreeze(created.value);
  const total = Object.keys(s.cards).length;
  const log: Move[] = [];
  let step = -1;
  for (const choice of choices) {
    step += 1;
    if (s.phase === "gameOver") break;
    if (step >= SAFETY_CAP) throw new Error(`game ${seed} did not end within ${SAFETY_CAP} moves`);
    const timeout = timeoutMove(s) as Move;
    // 6. timeoutMove is always legal and depends only on the state (checked on a copy, every 15 moves).
    expect(applyMove(s, timeout).ok, JSON.stringify(timeout)).toBe(true);
    if (step % 15 === 0) expect(timeoutMove(JSON.parse(JSON.stringify(s)))).toEqual(timeout);
    const moves = legalMoves(s, awaitedPlayer(s) as string);
    const move =
      choice % (moves.length + 1) === moves.length
        ? timeout
        : (moves[choice % (moves.length + 1)] as Move);
    // 2 & 4. A legal move applies without error, and never writes to its (frozen) input.
    const result = applyMove(s, move);
    if (!result.ok) throw new Error(result.error);
    s = deepFreeze(result.value.state);
    log.push(move);
    // 1. Every card is in exactly one place.
    const cards = cardsIn(s);
    expect(cards.length).toBe(total);
    expect(new Set(cards).size).toBe(total);
    // 7. Auto-resolution left nothing behind.
    expect(shouldHaveAutoResolved(s)).toBe(false);
    if (step % 15 === 0) checkView(s, ids[choice % n] as string);
  }
  for (const id of ids) checkView(s, id);
  // 3. Replaying the same seed and move log gives the same state.
  const replay = createGame(rules, content, ids, `prop-${seed}`);
  if (!replay.ok) throw new Error(replay.error);
  let r = replay.value;
  for (const move of log) {
    const next = applyMove(r, move);
    if (!next.ok) throw new Error(next.error);
    r = next.value.state;
  }
  expect(r).toEqual(s);
  return s;
}

// 8. All of the above, for every player count from 2 to 10.
describe("ARCHITECTURE §7 invariants (property-based)", () => {
  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "hold over %i-player random games",
    (n) => {
      fc.assert(
        fc.property(
          fc.nat(),
          fc.array(fc.nat(), { minLength: MAX_MOVES, maxLength: MAX_MOVES }),
          (seed, choices) => {
            play(n, seed, choices);
          },
        ),
        { numRuns: RUNS },
      );
    },
    30_000,
  );

  it.each([2, 3, 4, 5, 6, 7, 8, 9, 10])(
    "hold over %i-player games played to the end (a win or the round-limit stall)",
    (n) => {
      fc.assert(
        fc.property(fc.nat(), (seed) => {
          const end = play(n, seed, endlessChoices(seed));
          expect(end.phase).toBe("gameOver");
          expect(end.result).not.toBeNull();
        }),
        { numRuns: FULL_GAMES },
      );
    },
    60_000,
  );
});

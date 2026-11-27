import {
  applyMove,
  awaitedPlayer,
  type Content,
  createGame,
  type GameEvent,
  type GameState,
  legalMoves,
  type Move,
  type RuleSet,
  viewFor,
} from "@bull-city-blocks/engine";
import { type Policy, Rng } from "./policy";

export interface GameRecord {
  /** The winner's seat index, or "stall". */
  result: number | "stall";
  rounds: number;
  moves: number;
  state: GameState;
}

/**
 * Plays one seeded game with one policy per seat (seat i is player `p{i+1}`). Each bot sees only
 * its own PlayerView. Throws if the engine rejects a move a bot picked from legalMoves.
 * `onMove` sees every applied move with its events and the resulting state (for the simulator).
 */
export function playGame(
  rules: RuleSet,
  content: Content,
  seats: readonly Policy[],
  seed: string,
  onMove?: (move: Move, events: readonly GameEvent[], state: GameState) => void,
): GameRecord {
  const ids = seats.map((_, i) => `p${i + 1}`);
  const created = createGame(rules, content, ids, seed);
  if (!created.ok) throw new Error(created.error);
  let state = created.value;
  const rng = new Rng(`bots:${seed}`);
  let moves = 0;
  for (let player = awaitedPlayer(state); player !== null; player = awaitedPlayer(state)) {
    const policy = seats[ids.indexOf(player)] as Policy;
    const move = policy(viewFor(state, player), legalMoves(state, player), rng);
    const next = applyMove(state, move);
    if (!next.ok) throw new Error(`seed ${seed}, move ${moves}: ${next.error}`);
    state = next.value.state;
    onMove?.(move, next.value.events, state);
    moves += 1;
  }
  const result =
    state.result === "stall" || state.result === null ? "stall" : ids.indexOf(state.result);
  return { result, rounds: state.round, moves, state };
}

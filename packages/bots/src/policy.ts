import type { Move, PlayerView } from "@bull-city-blocks/engine";
import { nextUint32, type RngState, seedRng } from "@bull-city-blocks/engine";

/** A seeded random source for bots, built on the engine's PRNG so games replay from their seed. */
export class Rng {
  private state: RngState;
  constructor(seed: string) {
    this.state = seedRng(seed);
  }
  /** The generator's state, so a saved room (#40) can carry on where it left off. */
  save(): RngState {
    return this.state;
  }
  static load(state: RngState): Rng {
    const rng = new Rng("");
    rng.state = state;
    return rng;
  }
  /** Uniform integer in [0, n). */
  int(n: number): number {
    const next = nextUint32(this.state);
    this.state = next.rng;
    return Math.floor((next.value / 2 ** 32) * n);
  }
}

/** A bot: picks one of the legal moves, seeing only its own PlayerView, so it can't cheat. */
export type Policy = (view: PlayerView, legal: readonly Move[], rng: Rng) => Move;

/** Picks a uniformly random legal move. */
export const random: Policy = (_view, legal, rng) => legal[rng.int(legal.length)] as Move;

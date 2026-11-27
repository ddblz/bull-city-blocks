import type { Outgoing } from "./messages";

/**
 * SPEC §3.6: a batch reveals an auto-pass when someone "responded" during a move they didn't
 * make (the engine accepted for them). Delaying such batches by a random, human-looking amount
 * keeps the timing from revealing that they had no Appeal.
 */
export function revealsAutoPass(batch: readonly Outgoing[]): boolean {
  return batch.some(
    ({ message }) =>
      message.type === "state" &&
      message.entries.some(
        (e) => e.event.type === "responded" && e.event.player !== `p${e.seat + 1}`,
      ),
  );
}

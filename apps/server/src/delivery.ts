import type { Outgoing } from "@bull-city-blocks/room";

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

/** Delivers batches strictly in order, holding back any that need a reveal delay. */
export class DeliveryQueue {
  private tail: Promise<void> = Promise.resolve();
  private readonly send: (batch: readonly Outgoing[]) => void;
  private readonly delayFor: (batch: readonly Outgoing[]) => number;

  constructor(
    send: (batch: readonly Outgoing[]) => void,
    delayFor: (batch: readonly Outgoing[]) => number,
  ) {
    this.send = send;
    this.delayFor = delayFor;
  }

  push(batch: readonly Outgoing[]): Promise<void> {
    const delay = batch.length === 0 ? 0 : this.delayFor(batch);
    this.tail = this.tail
      .then(() => (delay > 0 ? new Promise<void>((done) => setTimeout(done, delay)) : undefined))
      .then(() => this.send(batch));
    return this.tail;
  }
}

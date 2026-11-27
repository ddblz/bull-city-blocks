import type { Outgoing } from "@bull-city-blocks/room";

export { revealsAutoPass } from "@bull-city-blocks/room";

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

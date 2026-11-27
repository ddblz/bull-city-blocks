import {
  type ClientMessage,
  type Outgoing,
  Room,
  type RoomSnapshot,
  revealsAutoPass,
} from "@bull-city-blocks/room";

/**
 * One room inside its Durable Object (#40, SPEC §7): the same Room as `pnpm play`, with every
 * timer on the object's single alarm and the whole room saved to storage after every change, so
 * it survives hibernation, eviction and long gaps between turns. Only the parts of the Durable
 * Object API it needs are typed here, so tests can run it against fakes.
 */

export interface HostSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

export interface HostState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put(key: string, value: unknown): Promise<void>;
    deleteAll(): Promise<void>;
    setAlarm(at: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  };
  getWebSockets(): HostSocket[];
}

export interface HostOptions {
  rulesets: readonly unknown[];
  content: unknown;
  now: () => number;
  random: () => number;
  makeId: () => string;
  /** Milliseconds per clock second (tests shrink it). */
  msPerSecond?: number;
  botDelayMs?: [number, number];
  revealDelayMs?: [number, number];
  idleExpiryMs?: number;
}

/** When each timer is due (epoch ms), or null. All of them share the object's one alarm. */
interface Timers {
  bot: number | null;
  clock: number | null;
  /** Who the running clock is for; it restarts only when this changes (as in `pnpm play`). */
  clockKey: string;
  expiry: number;
}

interface Saved {
  room: RoomSnapshot;
  timers: Timers;
  /** Batches held back by a reveal delay (SPEC §3.6), delivered in order. */
  outbox: { at: number; batch: Outgoing[] }[];
}

const KEY = "room";

export class RoomHost {
  private room: Room | null = null;
  private timers: Timers = { bot: null, clock: null, clockKey: "", expiry: 0 };
  private outbox: Saved["outbox"] = [];
  private alarmAt: number | null = null;
  private readonly state: HostState;
  private readonly options: HostOptions;

  constructor(state: HostState, options: HostOptions) {
    this.state = state;
    this.options = options;
  }

  private get roomOptions() {
    const { rulesets, content, makeId } = this.options;
    return { rulesets, content, makeId };
  }

  /** Loads the saved room, if any: on every start, including after hibernation or eviction. */
  async load(): Promise<void> {
    const saved = await this.state.storage.get<Saved>(KEY);
    if (!saved) return;
    this.room = Room.restore(this.roomOptions, saved.room);
    this.timers = saved.timers;
    this.outbox = saved.outbox;
  }

  get exists(): boolean {
    return this.room !== null;
  }

  async create(): Promise<void> {
    if (!this.room) this.room = new Room(this.roomOptions);
    await this.after([]);
  }

  /** A socket opened. It joins with its first message; until then it has no seat. */
  opened(ws: HostSocket): void {
    ws.serializeAttachment({ seat: null });
    if (this.room) return;
    ws.send(JSON.stringify({ type: "error", reason: "no such room" }));
    ws.close(4004, "no such room");
  }

  async message(ws: HostSocket, data: string): Promise<void> {
    const room = this.room;
    const reply = (reason: string) => ws.send(JSON.stringify({ type: "error", reason }));
    if (!room) return reply("no such room");
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data);
    } catch {
      return reply("messages must be JSON");
    }
    const seat = (ws.deserializeAttachment() as { seat: number | null } | null)?.seat ?? null;
    if (seat !== null) return this.after(room.handle(seat, msg));
    if (msg.type !== "join") return reply("join first");
    const joined = room.connect(String(msg.name ?? ""), msg.token);
    if ("error" in joined) return reply(joined.error);
    ws.serializeAttachment({ seat: joined.seat });
    return this.after(joined.out);
  }

  /** The alarm: deliver held batches, then run whichever of expiry, bot or clock is due. */
  async alarm(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const now = this.options.now();
    this.alarmAt = null;
    while (this.outbox[0] && this.outbox[0].at <= now)
      this.deliver((this.outbox.shift() as Saved["outbox"][number]).batch);
    if (this.timers.expiry <= now) return this.expire();
    if (this.timers.bot !== null && this.timers.bot <= now) {
      this.timers.bot = null;
      return this.after(room.stepBot());
    }
    if (this.timers.clock !== null && this.timers.clock <= now) {
      this.timers.clock = null;
      this.timers.clockKey = ""; // let the clock restart even if the same seat is still awaited
      return this.after(room.timeout());
    }
    await this.save();
  }

  /** Sends a batch now or holds it, re-arms the timers for the room's new state, and saves. */
  private async after(out: readonly Outgoing[]): Promise<void> {
    const room = this.room as Room;
    const now = this.options.now();
    const between = ([min, max]: [number, number]) => min + this.options.random() * (max - min);
    if (out.length > 0) {
      const delay = revealsAutoPass(out) ? between(this.options.revealDelayMs ?? [800, 2500]) : 0;
      const at = Math.max(now + delay, this.outbox.at(-1)?.at ?? 0);
      if (at <= now) this.deliver(out);
      else this.outbox.push({ at, batch: [...out] });
    }
    const timers = this.timers;
    timers.expiry = now + (this.options.idleExpiryMs ?? 72 * 60 * 60 * 1000);
    timers.bot = room.botToMove() ? now + between(this.options.botDelayMs ?? [500, 1500]) : null;
    const seconds = room.clockSeconds();
    const turn = out.find((o) => o.message.type === "state");
    const key =
      seconds === null
        ? ""
        : `${JSON.stringify(room.awaitingSeat())}@${turn?.message.type === "state" ? turn.message.view.turn : timers.clockKey}`;
    if (key !== timers.clockKey || seconds === null) {
      timers.clockKey = key;
      timers.clock =
        seconds !== null && !room.botToMove()
          ? now + seconds * (this.options.msPerSecond ?? 1000)
          : null;
    }
    await this.save();
  }

  private deliver(batch: readonly Outgoing[]): void {
    const sockets = this.state.getWebSockets();
    for (const { seat, message } of batch) {
      const data = JSON.stringify(message);
      for (const ws of sockets)
        if ((ws.deserializeAttachment() as { seat: number | null } | null)?.seat === seat)
          ws.send(data);
    }
  }

  /** Saves the room and points the alarm at the next due timer. */
  private async save(): Promise<void> {
    const room = this.room as Room;
    const saved: Saved = { room: room.snapshot(), timers: this.timers, outbox: this.outbox };
    await this.state.storage.put(KEY, saved);
    const { bot, clock, expiry } = this.timers;
    const next = Math.min(
      ...[this.outbox[0]?.at, bot, clock, expiry].filter((t): t is number => typeof t === "number"),
    );
    // Each setAlarm is billed as a row written, so only move it when it changes.
    if (next !== this.alarmAt) {
      this.alarmAt = next;
      await this.state.storage.setAlarm(next);
    }
  }

  /** 72 hours idle: close every socket and forget the room. */
  private async expire(): Promise<void> {
    for (const ws of this.state.getWebSockets()) ws.close(4000, "room expired");
    this.room = null;
    await this.state.storage.deleteAll();
    await this.state.storage.deleteAlarm();
  }
}

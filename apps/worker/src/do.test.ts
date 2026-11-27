import type { ServerMessage } from "@bull-city-blocks/room";
import { describe, expect, it } from "vitest";
import content from "../../../content/durham.json" with { type: "json" };
import { type HostSocket, type HostState, RoomHost } from "./room-host";
import { RULESETS } from "./rulesets";

type Move = Extract<ServerMessage, { type: "state" }>["legal"][number];
declare global {
  interface ImportMeta {
    /** Vite's glob import, which Vitest supports. */
    glob(pattern: string): Record<string, unknown>;
  }
}

/** A fake Durable Object: in-memory storage, one alarm, hibernatable sockets and a fake clock. */
class FakeObject {
  data = new Map<string, string>();
  alarm: number | null = null;
  sockets: FakeSocket[] = [];
  now = 1_000_000;
  writes = 0;
  /** Every setAlarm call: the time it was set to, and the clock when it was set. */
  alarmsSet: { at: number; setAt: number }[] = [];
  readonly state: HostState = {
    storage: {
      get: async <T>(key: string) => {
        const v = this.data.get(key);
        return v === undefined ? undefined : (JSON.parse(v) as T);
      },
      put: async (key, value) => {
        this.writes += 1;
        this.data.set(key, JSON.stringify(value)); // storage keeps a copy, like the real thing
      },
      deleteAll: async () => this.data.clear(),
      setAlarm: async (at) => {
        this.writes += 1;
        this.alarm = at;
        this.alarmsSet.push({ at, setAt: this.now });
      },
      deleteAlarm: async () => {
        this.alarm = null;
      },
    },
    getWebSockets: () => this.sockets.filter((s) => !s.closed),
  };

  /** A fresh host, as after hibernation or eviction: everything it knows comes from storage. */
  async host() {
    let n = 0;
    const host = new RoomHost(this.state, {
      rulesets: RULESETS,
      content,
      now: () => this.now,
      random: () => 0.5,
      makeId: () => `id-${++n}-${this.now}`,
    });
    await host.load();
    return host;
  }

  /** Moves the clock to the alarm (or `early` ms before it) and fires it. */
  async fire(host: RoomHost, early = 0) {
    if (this.alarm === null) throw new Error("no alarm set");
    this.now = Math.max(this.now, this.alarm - early);
    this.alarm = null;
    await host.alarm();
  }
}

class FakeSocket implements HostSocket {
  received: ServerMessage[] = [];
  closed: { code?: number | undefined } | null = null;
  private attachment: unknown = null;
  send(data: string) {
    this.received.push(JSON.parse(data));
  }
  close(code?: number) {
    this.closed = { code };
  }
  serializeAttachment(value: unknown) {
    this.attachment = JSON.parse(JSON.stringify(value)); // survives hibernation as a copy
  }
  deserializeAttachment() {
    return this.attachment;
  }
  last<T extends ServerMessage["type"]>(type: T) {
    return this.received
      .filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type)
      .at(-1);
  }
}

async function open(obj: FakeObject, host: RoomHost, name: string, token?: string) {
  const ws = new FakeSocket();
  obj.sockets.push(ws);
  host.opened(ws);
  await host.message(ws, JSON.stringify({ type: "join", name, ...(token ? { token } : {}) }));
  return ws;
}
const send = (host: RoomHost, ws: FakeSocket, msg: unknown) =>
  host.message(ws, JSON.stringify(msg));

/** Two humans and two bots, clock on: Ana plays her first legal move, Ben never moves. */
async function setUp() {
  const obj = new FakeObject();
  let host = await obj.host();
  await host.create();
  const ana = await open(obj, host, "Ana");
  const ben = await open(obj, host, "Ben");
  await send(host, ana, { type: "addBot", bot: "greedy" });
  await send(host, ana, { type: "addBot", bot: "random" });
  await send(host, ana, { type: "configure", clock: true });
  await send(host, ana, { type: "start" });
  const step = async () => {
    const state = ana.last("state");
    if (state?.awaiting?.seat === 0 && !ana.last("gameOver")) {
      const before = ana.received.length;
      await send(host, ana, { type: "intent", move: state.legal[0] as Move });
      if (ana.received.length > before) return;
    }
    await obj.fire(host); // bots, Ben's clock, held deliveries
  };
  return { obj, ana, ben, step, rehost: async () => (host = await obj.host()) };
}

/** Starts a 1-human + 1-bot game and has Ana play until the bot is the one awaited. */
async function startUntilBotAwaited(obj: FakeObject, host: RoomHost) {
  await host.create();
  const ana = await open(obj, host, "Ana");
  await send(host, ana, { type: "addBot", bot: "greedy" });
  await send(host, ana, { type: "start" });
  for (let i = 0; i < 20 && ana.last("state")?.awaiting?.seat === 0; i++)
    await send(host, ana, { type: "intent", move: ana.last("state")?.legal.at(-1) as Move });
  expect(ana.last("state")?.awaiting?.seat).toBe(1);
  return ana;
}

describe("room Durable Object (#40)", () => {
  it("bundles every committed ruleset", () => {
    const files = Object.keys(import.meta.glob("../../../rulesets/*.json")).map((f) =>
      f.split("/").at(-1),
    );
    expect(RULESETS.map((r) => `${(r as { id: string }).id}.json`).sort()).toEqual(files.sort());
  });

  it("plays 2 humans + 2 bots to game over with the clock on: alarms run the bots and Ben's clock", async () => {
    const { ana, ben, step } = await setUp();
    for (let i = 0; i < 20_000 && !ana.last("gameOver"); i++) await step();
    expect(ana.last("gameOver")).toBeDefined();
    expect(ben.last("gameOver")).toEqual(ana.last("gameOver"));
    // Ben never moved, so every one of his turns ended on the clock
    expect(ben.received.some((m) => m.type === "state" && m.clockSeconds !== null)).toBe(true);
  });

  it("saves after every change, and a host rebuilt from storage (hibernation) carries on", async () => {
    const { obj, ana, step, rehost } = await setUp();
    for (let i = 0; i < 60; i++) await step();
    const saved = obj.data.get("room");
    const host = await rehost(); // the object hibernated; its sockets stayed open
    expect(host.exists).toBe(true);
    expect(obj.data.get("room")).toBe(saved);
    for (let i = 0; i < 20_000 && !ana.last("gameOver"); i++) await step();
    expect(ana.last("gameOver")).toBeDefined();
  });

  it("resumes after eviction: clients reconnect with their tokens and get the history since their move", async () => {
    const { obj, ana, step, rehost } = await setUp();
    for (let i = 0; i < 60; i++) await step();
    const token = ana.last("joined")?.token as string;
    const before = ana.last("state");
    for (const ws of obj.sockets) ws.close(1006); // evicted: the sockets are gone too
    const host = await rehost();
    const back = await open(obj, host, "", token);
    expect(back.last("joined")).toMatchObject({ seat: 0, token });
    expect(back.last("history")).toBeDefined();
    expect(back.last("state")?.view).toEqual(before?.view);
  });

  it("holds a batch that reveals an auto-pass until the alarm, and keeps batches in order", async () => {
    const obj = new FakeObject();
    const host = await obj.host();
    await host.create();
    const ws = await open(obj, host, "Ana");
    const sent = ws.received.length;
    const reveal = {
      type: "state",
      entries: [{ seat: 0, event: { type: "responded", player: "p2" } }],
    };
    // drive the private delivery path the way a move would
    await (host as unknown as { after: (o: unknown[]) => Promise<void> }).after([
      { seat: 0, message: reveal },
    ]);
    await (host as unknown as { after: (o: unknown[]) => Promise<void> }).after([
      { seat: 0, message: { type: "error", reason: "second" } },
    ]);
    expect(ws.received.length).toBe(sent); // both held: the second must not overtake the first
    await obj.fire(host);
    expect(ws.received.slice(sent).map((m) => m.type)).toEqual(["state", "error"]);
  });

  it("a room idle for 72 hours closes its sockets and is forgotten", async () => {
    const obj = new FakeObject();
    const host = await obj.host();
    await host.create();
    const ws = await open(obj, host, "Ana");
    obj.now += 72 * 60 * 60 * 1000;
    await obj.fire(host);
    expect(ws.closed).toEqual({ code: 4000 });
    expect(obj.data.size).toBe(0);
    expect((await obj.host()).exists).toBe(false);
  });

  it("a socket for a room that doesn't exist gets an error and is closed", async () => {
    const obj = new FakeObject();
    const host = await obj.host();
    const ws = new FakeSocket();
    host.opened(ws);
    expect(ws.received).toEqual([{ type: "error", reason: "no such room" }]);
    expect(ws.closed).toEqual({ code: 4004 });
  });

  it("stores only the room, so a move costs about two storage writes (SPEC §7)", async () => {
    const obj = new FakeObject();
    const host = await obj.host();
    await startUntilBotAwaited(obj, host);
    expect([...obj.data.keys()]).toEqual(["room"]);
  });

  it("an alarm that fires a hair before its timer still runs it, and never re-arms right on top of now (#40)", async () => {
    // On the live server `Date.now()` was 0.7 ms short of a fractional bot timer, the handler found
    // nothing due and re-armed 0.7 ms ahead, and that alarm went unanswered for ~37 s.
    const obj = new FakeObject();
    const host = await obj.host();
    const ana = await startUntilBotAwaited(obj, host);
    const before = ana.received.length;
    await obj.fire(host, 1); // 1 ms early
    expect(ana.received.length).toBeGreaterThan(before); // the bot moved
    for (const { at, setAt } of obj.alarmsSet) expect(at - setAt).toBeGreaterThanOrEqual(10);
    const { timers } = JSON.parse(obj.data.get("room") as string);
    for (const t of [timers.bot, timers.clock, timers.expiry])
      if (t !== null) expect(Number.isInteger(t)).toBe(true);
  });
});

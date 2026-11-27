import type { ClientMessage, Outgoing, ServerMessage } from "@bull-city-blocks/room";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import { DeliveryQueue, revealsAutoPass } from "./delivery";
import { type ServerOptions, startServer } from "./server";

type Server = Awaited<ReturnType<typeof startServer>>;
let server: Server | undefined;
afterEach(async () => server?.close());

async function start(options: Partial<ServerOptions> = {}) {
  server = await startServer({
    rulesets: [base],
    content: durham,
    botDelayMs: [0, 0],
    revealDelayMs: [0, 0],
    ...options,
  });
  return server;
}
async function newRoom(s: Server): Promise<string> {
  const res = await fetch(`http://localhost:${s.port}/rooms`, { method: "POST" });
  return ((await res.json()) as { id: string }).id;
}
type Move = Extract<ClientMessage, { type: "intent" }>["move"];
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** A WebSocket test client that records every message. */
class Client {
  readonly messages: ServerMessage[] = [];
  readonly ws: WebSocket;
  seat = -1;
  token = "";
  constructor(port: number, id: string) {
    this.ws = new WebSocket(`ws://localhost:${port}/rooms/${id}`);
    this.ws.on("message", (data) => {
      const msg = JSON.parse(String(data)) as ServerMessage;
      if (msg.type === "joined") [this.seat, this.token] = [msg.seat, msg.token];
      this.messages.push(msg);
      this.onMessage?.(msg);
    });
  }
  onMessage?: (msg: ServerMessage) => void;
  send(msg: unknown) {
    this.ws.send(JSON.stringify(msg));
  }
  static async join(port: number, id: string, name: string, token?: string) {
    const c = new Client(port, id);
    await new Promise((done) => c.ws.once("open", done));
    c.send({ type: "join", name, ...(token ? { token } : {}) });
    await c.next((m) => m.type === "joined" || m.type === "error");
    return c;
  }
  /** Resolves with the first message (from `from` on) matching `test`. */
  async next<T extends ServerMessage>(
    test: (m: ServerMessage) => m is T,
    from?: number,
    ms?: number,
  ): Promise<T>;
  async next(
    test: (m: ServerMessage) => boolean,
    from?: number,
    ms?: number,
  ): Promise<ServerMessage>;
  async next(test: (m: ServerMessage) => boolean, from = 0, ms = 5000): Promise<ServerMessage> {
    for (const end = Date.now() + ms; Date.now() < end; await sleep(5)) {
      const hit = this.messages.slice(from).find(test);
      if (hit) return hit;
    }
    throw new Error("timed out waiting for a message");
  }
  lastState() {
    return this.messages
      .filter((m): m is Extract<ServerMessage, { type: "state" }> => m.type === "state")
      .at(-1);
  }
  close() {
    this.ws.close();
  }
}
/** Plays a random legal move whenever this client is awaited. */
const autoplay = (c: Client) => {
  c.onMessage = (m) => {
    if (m.type === "state" && m.legal.length > 0 && m.awaiting?.seat === c.seat) {
      c.send({ type: "intent", move: m.legal[Math.floor(Math.random() * m.legal.length)] as Move });
    }
  };
};

describe("local game server (#35)", () => {
  it("two humans and two bots create, join, start and finish a game", async () => {
    const s = await start();
    const id = await newRoom(s);
    const ana = await Client.join(s.port, id, "Ana");
    const ben = await Client.join(s.port, id, "Ben");
    expect([ana.seat, ben.seat]).toEqual([0, 1]);
    ana.send({ type: "addBot", bot: "greedy" });
    ana.send({ type: "addBot", bot: "random" });
    await ana.next((m) => m.type === "lobby" && m.lobby.seats.length === 4);
    autoplay(ana);
    autoplay(ben);
    ana.send({ type: "start" });
    const [overA, overB] = await Promise.all(
      [ana, ben].map((c) => c.next((m) => m.type === "gameOver", 0, 30_000)),
    );
    expect(overA).toEqual(overB);
  }, 40_000);

  it("§3.7 with the clock on, an idle player's turn is ended by the timeout move", async () => {
    const s = await start({ msPerSecond: 20 });
    const id = await newRoom(s);
    const ana = await Client.join(s.port, id, "Ana");
    const ben = await Client.join(s.port, id, "Ben");
    ana.send({ type: "configure", clock: true, overrides: { "clock.turnSeconds": 2 } });
    ana.send({ type: "start" });
    const first = await ana.next((m) => m.type === "state");
    const waiting = first.type === "state" ? first.awaiting : null;
    expect(first.type === "state" && first.clockSeconds).toBe(2);
    // Nobody acts: after the clock runs out (40 ms, plus a possible discard), the turn passes.
    const moved = await ben.next(
      (m) => m.type === "state" && m.awaiting?.seat !== waiting?.seat,
      0,
      2000,
    );
    expect(
      moved.type === "state" && moved.entries.some((e) => e.event.type === "turnStarted"),
    ).toBe(true);
  });

  it("a dropped player reconnects with their token and gets their seat, view and history back", async () => {
    const s = await start();
    const id = await newRoom(s);
    const ana = await Client.join(s.port, id, "Ana");
    const ben = await Client.join(s.port, id, "Ben");
    ana.send({ type: "start" });
    await ben.next((m) => m.type === "state");
    ben.close();
    const back = await Client.join(s.port, id, "Ben", ben.token);
    expect(back.seat).toBe(1);
    await back.next((m) => m.type === "history");
    const state = await back.next((m) => m.type === "state");
    expect(state.type === "state" && state.view.viewer).toBe("p2");
    ana.close();
  });

  it("when everyone disconnects, the room waits and the game continues on reconnect", async () => {
    const s = await start();
    const id = await newRoom(s);
    const ana = await Client.join(s.port, id, "Ana");
    const ben = await Client.join(s.port, id, "Ben");
    ana.send({ type: "start" });
    const before = await ana.next((m) => m.type === "state");
    ana.close();
    ben.close();
    await sleep(100);
    const tokens = [ana.token, ben.token];
    const [a2, b2] = await Promise.all(
      ["Ana", "Ben"].map((n, i) => Client.join(s.port, id, n, tokens[i])),
    );
    const resumed = await (a2 as Client).next((m) => m.type === "state");
    expect(resumed.type === "state" && resumed.awaiting).toEqual(
      before.type === "state" ? before.awaiting : null,
    );
    const mover =
      resumed.type === "state" && resumed.awaiting?.seat === 0 ? (a2 as Client) : (b2 as Client);
    const from = mover.messages.length;
    mover.send({ type: "intent", move: { type: "endTurn", player: `p${mover.seat + 1}` } });
    await mover.next((m) => m.type === "state", from);
  });

  it("a room with no activity past the expiry is removed", async () => {
    const s = await start({ idleExpiryMs: 60 });
    const id = await newRoom(s);
    expect(s.rooms.has(id)).toBe(true);
    await sleep(150);
    expect(s.rooms.has(id)).toBe(false);
    const late = new Client(s.port, id);
    const err = await late.next((m) => m.type === "error");
    expect(err).toEqual({ type: "error", reason: "no such room" });
  });
});

describe("auto-pass reveal delay (SPEC §3.6)", () => {
  const state = (seat: number, responder: string): Outgoing => ({
    seat,
    message: {
      type: "state",
      view: {} as never,
      legal: [],
      awaiting: null,
      clockSeconds: null,
      entries: [
        {
          seq: 0,
          turn: 1,
          round: 1,
          seat,
          event: { type: "responded", player: responder, appeal: false },
        },
      ],
    },
  });

  it("flags a batch only when someone responded during a move they didn't make", () => {
    expect(revealsAutoPass([state(0, "p2")])).toBe(true); // the engine accepted for p2 during seat 0's move
    expect(revealsAutoPass([state(1, "p2")])).toBe(false); // p2 accepted themselves
    expect(revealsAutoPass([])).toBe(false);
  });

  it("holds back a revealing batch within the configured range, and keeps the order", async () => {
    const delivered: [string, number][] = [];
    const t0 = Date.now();
    const queue = new DeliveryQueue(
      (batch) => delivered.push([batch.length === 1 ? "auto" : "plain", Date.now() - t0]),
      (batch) => (revealsAutoPass(batch) ? 40 + Math.random() * 40 : 0),
    );
    void queue.push([state(0, "p2")]);
    await queue.push([state(1, "p2"), state(1, "p2")]);
    expect(delivered.map(([k]) => k)).toEqual(["auto", "plain"]);
    const [, at] = delivered[0] as [string, number];
    expect(at).toBeGreaterThanOrEqual(39);
    expect(at).toBeLessThan(200);
  });
});

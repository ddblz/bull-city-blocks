import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { type ClientMessage, type Outgoing, Room } from "@bull-city-blocks/room";
import { type WebSocket, WebSocketServer } from "ws";
import { DeliveryQueue, revealsAutoPass } from "./delivery";

/** The local game server (#35): rooms over WebSockets, turn clock, bot pacing, resumable rooms. */

export interface ServerOptions {
  rulesets: readonly unknown[];
  content: unknown;
  /** 0 picks a free port. */
  port?: number;
  /** Milliseconds per clock second (tests shrink it). */
  msPerSecond?: number;
  botDelayMs?: [number, number];
  revealDelayMs?: [number, number];
  /** A room with no activity for this long is removed (default 72 hours). */
  idleExpiryMs?: number;
}

interface LiveRoom {
  room: Room;
  sockets: Map<number, Set<WebSocket>>;
  queue: DeliveryQueue;
  timers: { bot?: NodeJS.Timeout; clock?: NodeJS.Timeout; expiry?: NodeJS.Timeout };
  /** Who the running clock is for; the clock restarts only when this changes. */
  clockKey: string;
}

const between = ([min, max]: [number, number]) => min + Math.random() * (max - min);

export async function startServer(options: ServerOptions) {
  const msPerSecond = options.msPerSecond ?? 1000;
  const botDelay = options.botDelayMs ?? [500, 1500];
  const revealDelay = options.revealDelayMs ?? [800, 2500];
  const idleExpiryMs = options.idleExpiryMs ?? 72 * 60 * 60 * 1000;
  const rooms = new Map<string, LiveRoom>();

  const drop = (id: string) => {
    const live = rooms.get(id);
    if (!live) return;
    for (const timer of Object.values(live.timers)) clearTimeout(timer);
    for (const set of live.sockets.values()) for (const ws of set) ws.close(4000, "room expired");
    rooms.delete(id);
  };

  /** Delivers a batch, then re-arms the bot, clock and expiry timers for the room's new state. */
  const after = (id: string, out: readonly Outgoing[]) => {
    const live = rooms.get(id);
    if (!live) return;
    void live.queue.push(out);
    const { room, timers } = live;
    clearTimeout(timers.expiry);
    timers.expiry = setTimeout(() => drop(id), idleExpiryMs);
    clearTimeout(timers.bot);
    if (room.botToMove())
      timers.bot = setTimeout(() => after(id, room.stepBot()), between(botDelay));
    const seconds = room.clockSeconds();
    const turn = out.find((o) => o.message.type === "state");
    const key =
      seconds === null
        ? ""
        : `${JSON.stringify(room.awaitingSeat())}@${turn?.message.type === "state" ? turn.message.view.turn : live.clockKey}`;
    if (key !== live.clockKey || seconds === null) {
      clearTimeout(timers.clock);
      live.clockKey = key;
      if (seconds !== null && !room.botToMove())
        timers.clock = setTimeout(() => after(id, room.timeout()), seconds * msPerSecond);
    }
  };

  const http = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    if (req.method === "OPTIONS") return void res.writeHead(204).end();
    if (req.method === "POST" && req.url === "/rooms") {
      const id = randomUUID().slice(0, 8);
      const live: LiveRoom = {
        room: new Room({
          rulesets: options.rulesets,
          content: options.content,
          makeId: () => randomUUID(),
        }),
        sockets: new Map(),
        queue: new DeliveryQueue(
          (batch) => {
            for (const { seat, message } of batch) {
              for (const ws of live.sockets.get(seat) ?? [])
                if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
            }
          },
          (batch) => (revealsAutoPass(batch) ? between(revealDelay) : 0),
        ),
        timers: {},
        clockKey: "",
      };
      rooms.set(id, live);
      after(id, []);
      return void res
        .writeHead(201, { "Content-Type": "application/json" })
        .end(JSON.stringify({ id }));
    }
    res.writeHead(404).end();
  });

  const wss = new WebSocketServer({ server: http });
  wss.on("connection", (ws, req) => {
    const id = /^\/rooms\/([\w-]+)$/.exec(req.url ?? "")?.[1] ?? "";
    const live = rooms.get(id);
    const send = (message: unknown) => ws.send(JSON.stringify(message));
    if (!live) {
      send({ type: "error", reason: "no such room" });
      return void ws.close(4004, "no such room");
    }
    let seat: number | null = null;
    ws.on("message", (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return send({ type: "error", reason: "messages must be JSON" });
      }
      if (seat === null) {
        if (msg.type !== "join") return send({ type: "error", reason: "join first" });
        const joined = live.room.connect(String(msg.name ?? ""), msg.token);
        if ("error" in joined) return send({ type: "error", reason: joined.error });
        seat = joined.seat;
        const set = live.sockets.get(seat) ?? new Set();
        live.sockets.set(seat, set.add(ws));
        return after(id, joined.out);
      }
      after(id, live.room.handle(seat, msg));
    });
    ws.on("close", () => {
      if (seat !== null) live.sockets.get(seat)?.delete(ws);
    });
  });

  await new Promise<void>((done) => http.listen(options.port ?? 0, done));
  return {
    port: (http.address() as AddressInfo).port,
    rooms,
    close: async () => {
      for (const id of [...rooms.keys()]) drop(id);
      wss.close();
      await new Promise<void>((done) => http.close(() => done()));
    },
  };
}

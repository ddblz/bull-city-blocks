import { DurableObject } from "cloudflare:workers";
import content from "../../../content/durham.json" with { type: "json" };
import { RoomHost } from "./room-host";
import { RULESETS } from "./rulesets";

/**
 * The online game server (#40, SPEC §7): the same HTTP and WebSocket API as `pnpm play`, with
 * each room in its own Durable Object. The web client on Cloudflare Pages talks to it.
 */

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "GET" && pathname === "/rulesets") return json(RULESETS);
    if (req.method === "GET" && pathname === "/content") return json(content);
    const room = (id: string) => env.ROOMS.get(env.ROOMS.idFromName(id));
    if (req.method === "POST" && pathname === "/rooms") {
      const id = crypto.randomUUID().slice(0, 8);
      await room(id).fetch("https://room/create", { method: "POST" });
      return json({ id }, 201);
    }
    const id = /^\/rooms\/([\w-]+)$/.exec(pathname)?.[1];
    if (id && req.headers.get("Upgrade") === "websocket") return room(id).fetch(req);
    return new Response("not found", { status: 404, headers: CORS });
  },
} satisfies ExportedHandler<Env>;

/** One room. WebSockets use the hibernation API, so an idle room costs nothing while it waits. */
export class RoomObject extends DurableObject<Env> {
  private readonly host: RoomHost;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.host = new RoomHost(
      { storage: ctx.storage, getWebSockets: () => ctx.getWebSockets() },
      {
        rulesets: RULESETS,
        content,
        now: () => Date.now(),
        random: Math.random,
        makeId: () => crypto.randomUUID(),
      },
    );
    void ctx.blockConcurrencyWhile(() => this.host.load());
  }

  override async fetch(req: Request): Promise<Response> {
    if (req.method === "POST") {
      await this.host.create();
      return new Response(null, { status: 201 });
    }
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    this.host.opened(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return this.host.message(
      ws,
      typeof message === "string" ? message : new TextDecoder().decode(message),
    );
  }

  override webSocketClose(ws: WebSocket, code: number): void {
    ws.close(code === 1005 ? 1000 : code);
  }

  override alarm(): Promise<void> {
    return this.host.alarm();
  }
}

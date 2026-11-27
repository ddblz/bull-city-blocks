import type { ClientMessage, ServerMessage } from "@bull-city-blocks/room";
import type { ClientEvent } from "./lobby-state";

/** The game server from `pnpm play`; VITE_SERVER overrides it (e.g. for the Cloudflare deploy, #40). */
export const serverUrl: string =
  import.meta.env.VITE_SERVER ?? `${location.protocol}//${location.hostname}:8787`;

const tokenKey = (room: string) => `bcb:token:${room}`;
export const savedToken = (room: string): string | null => {
  try {
    return localStorage.getItem(tokenKey(room));
  } catch {
    return null;
  }
};
const saveToken = (room: string, token: string) => {
  try {
    localStorage.setItem(tokenKey(room), token);
  } catch {
    // Private mode etc.: the seat just won't survive a reload.
  }
};

export async function createRoom(): Promise<string> {
  const res = await fetch(`${serverUrl}/rooms`, { method: "POST" });
  if (!res.ok) throw new Error(`couldn't create a room (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

export async function listRulesets(): Promise<{ id: string; description: string }[]> {
  const res = await fetch(`${serverUrl}/rulesets`);
  return res.ok ? res.json() : [];
}

/**
 * Joins a room and keeps the connection alive: after a drop it reconnects with the saved seat
 * token, so a reload or a lost network gets the same seat back.
 */
export function connect(room: string, name: string, onEvent: (e: ClientEvent) => void) {
  let ws: WebSocket;
  let closed = false;
  let retry = 500;
  const open = () => {
    ws = new WebSocket(`${serverUrl.replace(/^http/, "ws")}/rooms/${room}`);
    ws.onopen = () => {
      retry = 500;
      const token = savedToken(room);
      ws.send(JSON.stringify({ type: "join", name, ...(token ? { token } : {}) }));
      onEvent({ type: "socket", status: "open" });
    };
    ws.onmessage = (msg) => {
      const event = JSON.parse(String(msg.data)) as ServerMessage;
      if (event.type === "joined") saveToken(room, event.token);
      onEvent(event);
    };
    ws.onclose = (e) => {
      if (closed || e.code === 4004 || e.code === 4000)
        return onEvent({ type: "socket", status: "closed" });
      onEvent({ type: "socket", status: "reconnecting" });
      retry = Math.min(retry * 2, 10_000);
      setTimeout(open, retry);
    };
  };
  open();
  return {
    send: (msg: ClientMessage) => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify(msg)),
    close: () => {
      closed = true;
      ws.close();
    },
  };
}

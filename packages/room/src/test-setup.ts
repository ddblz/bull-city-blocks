import durham from "../../../content/durham.json" with { type: "json" };
import base from "../../../rulesets/base.json" with { type: "json" };
import rodeo from "../../../rulesets/rodeo-cap-4.json" with { type: "json" };
import type { Outgoing, ServerMessage } from "./messages";
import { Room } from "./room";

export const options = { rulesets: [base, rodeo], content: durham };

/** A room with deterministic ids ("id-1", "id-2", …). */
export function newRoom(): Room {
  let n = 0;
  return new Room({ ...options, makeId: () => `id-${++n}` });
}

/** Joins and returns the seat, failing the test on an error. */
export function join(room: Room, name: string, token?: string) {
  const r = room.connect(name, token);
  if ("error" in r) throw new Error(r.error);
  return r;
}

export const to = (out: Outgoing[], seat: number) =>
  out.filter((o) => o.seat === seat).map((o) => o.message);
export const last = <T extends ServerMessage["type"]>(out: Outgoing[], seat: number, type: T) =>
  to(out, seat)
    .filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type)
    .at(-1);

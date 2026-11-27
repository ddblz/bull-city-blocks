import type { GameEvent, Move, PlayerId, PlayerView } from "@bull-city-blocks/engine";

/** The room protocol (ARCHITECTURE §4.3): plain JSON, shared by the servers and the web client. */

export type BotName = "greedy" | "random";

/** Client → server. `join` is handled by the transport (it calls Room.connect); the rest go to Room.handle. */
export type ClientMessage =
  | { type: "join"; name: string; token?: string }
  | { type: "configure"; ruleset?: string; overrides?: Record<string, unknown>; clock?: boolean }
  | { type: "addBot"; bot: BotName }
  | { type: "removeSeat"; seat: number }
  | { type: "start" }
  | { type: "intent"; move: Move };

export interface SeatInfo {
  seat: number;
  name: string;
  /** Set for a bot seat. */
  bot?: BotName;
  /** Engine player id, once the game has started. */
  player?: PlayerId;
}

export interface LobbyView {
  seats: SeatInfo[];
  host: number;
  ruleset: string;
  overrides: Record<string, unknown>;
  clock: boolean;
  started: boolean;
}

/** One entry of the room's event log: the event, when it happened and whose move caused it. */
export interface HistoryEntry {
  seq: number;
  turn: number;
  round: number;
  /** The seat whose move produced the event. */
  seat: number;
  event: GameEvent;
}

export type ServerMessage =
  | { type: "joined"; seat: number; token: string; host: boolean }
  | { type: "lobby"; lobby: LobbyView }
  | {
      type: "state";
      view: PlayerView;
      legal: Move[];
      /** New log entries since the last state message, filtered for this player. */
      entries: HistoryEntry[];
      awaiting: { seat: number; kind: "play" | "discard" | "respond" | "pay" } | null;
      /** Seconds on the turn clock for the awaited player, or null when the clock is off. */
      clockSeconds: number | null;
    }
  /** On (re)connect: everything since this player's last move. */
  | { type: "history"; entries: HistoryEntry[] }
  | { type: "error"; reason: string }
  | { type: "gameOver"; winner: number | "stall"; seed: string; moves: Move[] };

/** A message for one seat. Transports deliver it to that seat's connections, if any. */
export interface Outgoing {
  seat: number;
  message: ServerMessage;
}

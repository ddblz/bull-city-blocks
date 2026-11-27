import type { HistoryEntry, LobbyView, ServerMessage } from "@bull-city-blocks/room";

type CardDef = Extract<ServerMessage, { type: "state" }>["view"]["cards"][string];

/** What the client knows about its room, built purely from server messages (#36). */
export interface ClientState {
  status: "connecting" | "open" | "reconnecting" | "closed";
  seat: number | null;
  token: string | null;
  host: boolean;
  lobby: LobbyView | null;
  /** Latest game state message once the game has started. */
  game: Extract<ServerMessage, { type: "state" }> | null;
  /** The most recent log entries, oldest first, for the table's event log. */
  log: HistoryEntry[];
  /** Everything since this player's last move, sent on (re)connect: the recap (#41). */
  recap: HistoryEntry[];
  /**
   * Every card definition seen in a view, kept after the card leaves sight (e.g. a reshuffled
   * discard), so old log entries can still name it. Only ever holds cards that were public.
   */
  cards: Record<string, CardDef>;
  /** Set when the game ends. */
  over: Extract<ServerMessage, { type: "gameOver" }> | null;
  /** The latest error from the server, cleared by the next successful update. */
  error: string | null;
}

export type ClientEvent = ServerMessage | { type: "socket"; status: ClientState["status"] };

export const initialState: ClientState = {
  status: "connecting",
  seat: null,
  token: null,
  host: false,
  lobby: null,
  game: null,
  log: [],
  recap: [],
  cards: {},
  over: null,
  error: null,
};

export const LOG_LENGTH = 30;

/** Appends entries, skipping any already held (a reconnect resends history), and keeps the tail. */
const appendLog = (log: HistoryEntry[], entries: HistoryEntry[]) => {
  const last = log.at(-1)?.seq ?? -1;
  return [...log, ...entries.filter((e) => e.seq > last)].slice(-LOG_LENGTH);
};

export function reduce(state: ClientState, event: ClientEvent): ClientState {
  switch (event.type) {
    case "socket":
      return { ...state, status: event.status };
    case "joined":
      return { ...state, seat: event.seat, token: event.token, host: event.host, error: null };
    case "lobby":
      return { ...state, lobby: event.lobby, error: null };
    case "state":
      return {
        ...state,
        game: event,
        log: appendLog(state.log, event.entries),
        cards: { ...state.cards, ...event.view.cards },
        error: null,
      };
    case "error":
      return { ...state, error: event.reason };
    case "history":
      return { ...state, log: appendLog(state.log, event.entries), recap: event.entries };
    case "gameOver":
      return { ...state, over: event };
  }
}

/** True when this client may change the room's settings. */
export const canConfigure = (s: ClientState) => s.host && s.lobby !== null && !s.lobby.started;

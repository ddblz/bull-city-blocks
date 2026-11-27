import type { LobbyView, ServerMessage } from "@bull-city-blocks/room";

/** What the client knows about its room, built purely from server messages (#36). */
export interface ClientState {
  status: "connecting" | "open" | "reconnecting" | "closed";
  seat: number | null;
  token: string | null;
  host: boolean;
  lobby: LobbyView | null;
  /** Latest game state message once the game has started (the table arrives in #37). */
  game: Extract<ServerMessage, { type: "state" }> | null;
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
  error: null,
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
      return { ...state, game: event, error: null };
    case "error":
      return { ...state, error: event.reason };
    case "history":
    case "gameOver":
      return state; // used by the table (#37) and the recap (#41)
  }
}

/** True when this client may change the room's settings. */
export const canConfigure = (s: ClientState) => s.host && s.lobby !== null && !s.lobby.started;

import type { ServerMessage } from "@bull-city-blocks/room";

/** Game types as the client sees them, taken from the room protocol. */
export type StateMessage = Extract<ServerMessage, { type: "state" }>;
export type GameOverMessage = Extract<ServerMessage, { type: "gameOver" }>;
export type HistoryEntry = StateMessage["entries"][number];
export type View = StateMessage["view"];
export type Move = StateMessage["legal"][number];
export type Card = View["cards"][string];
export type PropertySet = View["players"][number]["tableau"][number];

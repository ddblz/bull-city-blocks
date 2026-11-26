import type { Card, District } from "./content";
import type { RngState } from "./rng";
import type { RuleSet } from "./ruleset";

export type PlayerId = string;
/** Unique per physical card in a game: `<card id>:<deck copy>:<n>`, e.g. `cash-1:2:7`. */
export type CardInstanceId = string;

export interface PlayerPrefs {
  /** SPEC §3.6: starts at the ruleset's `autoPassDefault` (on in base). */
  autoPass: boolean;
}

/** One set of a district in a player's tableau (SPEC §3.5). */
export interface PropertySet {
  district: District["id"];
  cards: CardInstanceId[];
}

export interface PlayerState {
  id: PlayerId;
  hand: CardInstanceId[];
  bank: CardInstanceId[];
  tableau: PropertySet[];
  prefs: PlayerPrefs;
}

/** Placeholders: the unions get their members as turns, actions and payments land (#5–#10). */
export type Move = never;
export type GameEvent = never;
export type PendingStep = never;

/** Everything is plain JSON, so a game can be saved, replayed or diffed (ARCHITECTURE §3). */
export interface GameState {
  rules: RuleSet;
  /** Card definitions for every instance in this game. */
  cards: Record<CardInstanceId, Card>;
  districts: Record<District["id"], District>;
  players: PlayerState[];
  /** Draw pile; index 0 is the top. */
  deck: CardInstanceId[];
  discard: CardInstanceId[];
  currentPlayer: PlayerId;
  phase: "draw";
  playsRemaining: number;
  pending: PendingStep[];
  rng: RngState;
  turn: number;
  round: number;
}

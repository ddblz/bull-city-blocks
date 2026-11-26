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

/** Moves a player can make (ARCHITECTURE §3). Actions, payments and wilds arrive in #6–#9. */
export type Move =
  | { type: "playProperty"; player: PlayerId; card: CardInstanceId }
  | { type: "bank"; player: PlayerId; card: CardInstanceId }
  | { type: "endTurn"; player: PlayerId }
  | { type: "discard"; player: PlayerId; card: CardInstanceId };

export type GameEvent =
  | { type: "turnStarted"; player: PlayerId; turn: number; round: number }
  | { type: "cardsDrawn"; player: PlayerId; count: number }
  | { type: "deckReshuffled"; cards: number }
  | { type: "propertyPlayed"; player: PlayerId; card: CardInstanceId }
  | { type: "banked"; player: PlayerId; card: CardInstanceId }
  | { type: "discarded"; player: PlayerId; card: CardInstanceId }
  | { type: "gameOver"; result: PlayerId | "stall" };

/** Placeholder: debts and Appeal chains arrive in #6 and #8. */
export type PendingStep = never;

/** ARCHITECTURE §4.1. Draw is automatic at the start of each turn, so it is never a resting phase. */
export type Phase = "play" | "discard" | "gameOver";

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
  /** The first player; a round ends when the turn comes back to them (SPEC §3.8). */
  startingPlayer: PlayerId;
  phase: Phase;
  /** Set when the game ends: the winner, or "stall" at the round limit. */
  result: PlayerId | "stall" | null;
  playsRemaining: number;
  pending: PendingStep[];
  rng: RngState;
  turn: number;
  round: number;
}

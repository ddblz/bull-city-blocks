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
  /** §4.5 Construction Delay: draw only 1 card next turn. A flag, so delays don't stack. */
  delayed: boolean;
}

/** Moves a player can make (ARCHITECTURE §3). Actions, payments and wilds arrive in #6–#9. */
export type Move =
  | { type: "playProperty"; player: PlayerId; card: CardInstanceId }
  | { type: "bank"; player: PlayerId; card: CardInstanceId }
  | { type: "endTurn"; player: PlayerId }
  | { type: "discard"; player: PlayerId; card: CardInstanceId }
  /** §4.6: `target` only for Wild Rent; `hike` is a Rent Hike played with it (§4.5). */
  | {
      type: "playRent";
      player: PlayerId;
      card: CardInstanceId;
      district: District["id"];
      target?: PlayerId;
      hike?: CardInstanceId;
    }
  /**
   * §4.5 actions. `target` for every action that targets someone; `take` is the target's property
   * (Buyout, Swap Meet), `give` is yours (Swap Meet), `district` is the set taken (Hostile Takeover).
   */
  | {
      type: "playAction";
      player: PlayerId;
      card: CardInstanceId;
      target?: PlayerId;
      take?: CardInstanceId;
      give?: CardInstanceId;
      district?: District["id"];
    }
  /** §3.6: accept the awaited action, or play an Appeal from your hand against it. */
  | { type: "respond"; player: PlayerId; appeal?: CardInstanceId }
  /** §3.6: change your auto-pass preference. Always legal, never a play, not listed by legalMoves. */
  | { type: "setPref"; player: PlayerId; autoPass: boolean }
  /** §3.4: any mix of bank and tableau cards toward the awaited debt. */
  | { type: "pay"; player: PlayerId; cards: CardInstanceId[] };

export type GameEvent =
  | { type: "turnStarted"; player: PlayerId; turn: number; round: number }
  | { type: "cardsDrawn"; player: PlayerId; count: number }
  | { type: "deckReshuffled"; cards: number }
  | { type: "propertyPlayed"; player: PlayerId; card: CardInstanceId }
  | { type: "banked"; player: PlayerId; card: CardInstanceId }
  | { type: "discarded"; player: PlayerId; card: CardInstanceId }
  | {
      type: "rentCharged";
      player: PlayerId;
      card: CardInstanceId;
      district: District["id"];
      amount: number;
      debtors: PlayerId[];
    }
  | { type: "actionPlayed"; player: PlayerId; card: CardInstanceId; target?: PlayerId }
  | { type: "paid"; debtor: PlayerId; creditor: PlayerId; cards: CardInstanceId[] }
  | { type: "debtSettled"; debtor: PlayerId; creditor: PlayerId; forgiven: number }
  | { type: "autoResolved"; player: PlayerId; kind: "pay" | "respond" }
  | { type: "responded"; player: PlayerId; appeal: boolean }
  | {
      type: "actionResolved";
      attacker: PlayerId;
      target: PlayerId;
      card: CardInstanceId;
      cancelled: boolean;
    }
  | { type: "prefSet"; player: PlayerId; autoPass: boolean }
  | { type: "gameOver"; result: PlayerId | "stall" };

/** What a targeted action does to one target if it stands (§4.5–4.6). */
export type Effect =
  | { kind: "debt"; amount: number }
  | { kind: "delay" }
  | { kind: "buyout"; take: CardInstanceId }
  | { kind: "swap"; take: CardInstanceId; give: CardInstanceId }
  | { kind: "takeover"; district: District["id"] };

/**
 * Work waiting on a player, oldest first (ARCHITECTURE §4.1–4.2): a debt to pay (§3.4), or a
 * targeted action to respond to (§3.6). `appeals` counts Appeals played so far; `awaiting` is
 * the target when it's even and the attacker when it's odd.
 */
export type PendingStep =
  | { type: "debt"; debtor: PlayerId; creditor: PlayerId; amount: number }
  | {
      type: "response";
      card: CardInstanceId;
      attacker: PlayerId;
      target: PlayerId;
      awaiting: PlayerId;
      appeals: number;
      effect: Effect;
    };

/** ARCHITECTURE §4.1. Draw is automatic at the start of each turn, so it is never a resting phase. */
export type Phase = "play" | "respond" | "pay" | "discard" | "gameOver";

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

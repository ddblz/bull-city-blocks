import { greedy, type Policy, Rng, random } from "@bull-city-blocks/bots";
import {
  applyMove,
  awaiting,
  type Content,
  createGame,
  type GameState,
  legalMoves,
  loadRuleset,
  type Move,
  parseContent,
  type Result,
  type RuleSet,
  timeoutMove,
  viewFor,
} from "@bull-city-blocks/engine";
import type { BotName, ClientMessage, HistoryEntry, LobbyView, Outgoing } from "./messages";

const BOTS: Record<BotName, Policy> = { greedy, random };
const MIN_SEATS = 2;
const MAX_SEATS = 10;
/** The inline variant that carries a room's overrides on top of its chosen ruleset. */
const ROOM_RULESET = "__room__";

interface Seat {
  name: string;
  /** Reconnect token; null for bots. */
  token: string | null;
  bot?: BotName;
}

export interface RoomOptions {
  /** Every committed ruleset file (parsed JSON), so a room can pick any of them. */
  rulesets: readonly unknown[];
  content: unknown;
  /** Source of unguessable ids for seat tokens and game seeds (the transport supplies it). */
  makeId: () => string;
  ruleset?: string;
}

/**
 * One game room (ARCHITECTURE §4.3): lobby, host settings, the authoritative game and its event
 * log. Pure and synchronous: every input returns the messages to deliver; timers, sockets and bot
 * pacing belong to the transport.
 */
export class Room {
  private readonly content: Content;
  private seats: Seat[] = [];
  private ruleset: string;
  private overrides: Record<string, unknown> = {};
  private clock = false;
  private game: GameState | null = null;
  private seed = "";
  private moves: Move[] = [];
  private botRng: Rng | null = null;
  private log: HistoryEntry[] = [];
  /** Per seat: how much of the log has been sent in state messages. */
  private sent: number[] = [];
  /** Per seat: the log length just after that seat's latest own move. */
  private lastActed: number[] = [];

  constructor(private readonly options: RoomOptions) {
    const content = parseContent(options.content);
    if (!content.ok) throw new Error(content.error);
    this.content = content.value;
    this.ruleset = options.ruleset ?? "base";
    const rules = this.rules();
    if (!rules.ok) throw new Error(rules.error);
    this.clock = rules.value.clock.onByDefault;
  }

  /** The room's ruleset with its overrides applied, validated by the engine's loader. */
  private rules(ruleset = this.ruleset, overrides = this.overrides): Result<RuleSet> {
    const inline = {
      id: ROOM_RULESET,
      extends: ruleset,
      description: `${ruleset} with room overrides`,
      overrides,
    };
    return loadRuleset(ROOM_RULESET, [...this.options.rulesets, inline]);
  }

  /**
   * A player arrives. With a known token they get their seat back, plus everything since their
   * last move. Otherwise they take a new seat (lobby only). The first player to join is the host.
   */
  connect(name: string, token?: string): { seat: number; out: Outgoing[] } | { error: string } {
    const known = token === undefined ? -1 : this.seats.findIndex((s) => s.token === token);
    if (known >= 0) {
      const seatToken = this.seats[known]?.token as string;
      const out: Outgoing[] = [
        {
          seat: known,
          message: { type: "joined", seat: known, token: seatToken, host: known === 0 },
        },
      ];
      out.push({ seat: known, message: { type: "lobby", lobby: this.lobby() } });
      if (this.game) {
        out.push({ seat: known, message: { type: "history", entries: this.historyFor(known) } });
        this.sent[known] = this.log.length;
        out.push(this.stateFor(known, []));
      }
      return { seat: known, out };
    }
    if (this.game) return { error: "the game has already started" };
    if (this.seats.length >= MAX_SEATS) return { error: "the room is full" };
    const seat = this.seats.length;
    const newToken = this.options.makeId();
    this.seats.push({ name: name.trim().slice(0, 24) || `Player ${seat + 1}`, token: newToken });
    return {
      seat,
      out: [
        { seat, message: { type: "joined", seat, token: newToken, host: seat === 0 } },
        ...this.broadcastLobby(),
      ],
    };
  }

  handle(seat: number, msg: ClientMessage): Outgoing[] {
    const error = (reason: string): Outgoing[] => [{ seat, message: { type: "error", reason } }];
    if (msg.type === "intent") {
      if (!this.game) return error("the game hasn't started");
      return this.apply(seat, msg.move, true);
    }
    if (msg.type === "join") return error("already joined");
    if (seat !== 0) return error("only the host can do that");
    if (this.game) return error("the game has already started");
    switch (msg.type) {
      case "configure": {
        const ruleset = msg.ruleset ?? this.ruleset;
        const overrides = msg.overrides ?? this.overrides;
        const rules = this.rules(ruleset, overrides);
        if (!rules.ok) return error(rules.error);
        [this.ruleset, this.overrides] = [ruleset, overrides];
        if (msg.ruleset !== undefined && msg.clock === undefined)
          this.clock = rules.value.clock.onByDefault;
        if (msg.clock !== undefined) this.clock = msg.clock;
        return this.broadcastLobby();
      }
      case "addBot":
        if (!(msg.bot in BOTS)) return error(`unknown bot "${msg.bot}"`);
        if (this.seats.length >= MAX_SEATS) return error("the room is full");
        this.seats.push({
          name: `${msg.bot} bot ${this.seats.length + 1}`,
          token: null,
          bot: msg.bot,
        });
        return this.broadcastLobby();
      case "removeSeat":
        if (this.seats[msg.seat]?.bot === undefined) return error("only bot seats can be removed");
        this.seats.splice(msg.seat, 1);
        return this.broadcastLobby();
      case "start":
        return this.start();
      default:
        return error("unknown message");
    }
  }

  private start(): Outgoing[] {
    if (this.seats.length < MIN_SEATS)
      return [
        { seat: 0, message: { type: "error", reason: `need ${MIN_SEATS}–${MAX_SEATS} seats` } },
      ];
    const rules = this.rules();
    if (!rules.ok) return [{ seat: 0, message: { type: "error", reason: rules.error } }];
    this.seed = this.options.makeId();
    const created = createGame(
      rules.value,
      this.content,
      this.seats.map((_, i) => playerId(i)),
      this.seed,
    );
    if (!created.ok) return [{ seat: 0, message: { type: "error", reason: created.error } }];
    this.game = created.value;
    this.botRng = new Rng(`bots:${this.seed}`);
    this.sent = this.seats.map(() => 0);
    this.lastActed = this.seats.map(() => 0);
    return [...this.broadcastLobby(), ...this.broadcastState()];
  }

  /** Applies a move for a seat. `own` is false for clock timeouts, which don't count as acting. */
  private apply(seat: number, move: Move, own: boolean): Outgoing[] {
    const game = this.game;
    if (!game) return [];
    if (game.phase === "gameOver")
      return [{ seat, message: { type: "error", reason: "the game is over" } }];
    if (move?.player !== playerId(seat))
      return [{ seat, message: { type: "error", reason: "that move isn't yours" } }];
    let result: ReturnType<typeof applyMove>;
    try {
      result = applyMove(game, move);
    } catch {
      result = { ok: false, error: "malformed move" };
    }
    if (!result.ok) return [{ seat, message: { type: "error", reason: result.error } }];
    this.game = result.value.state;
    this.moves.push(move);
    const { turn, round } = this.game;
    for (const event of result.value.events)
      this.log.push({ seq: this.log.length, turn, round, seat, event });
    if (own) this.lastActed[seat] = this.log.length;
    return this.broadcastState();
  }

  /** The awaited seat and what it must do, or null in the lobby or after the game. */
  awaitingSeat(): { seat: number; kind: "play" | "discard" | "respond" | "pay" } | null {
    const wait = this.game ? awaiting(this.game) : null;
    return wait ? { seat: seatOf(wait.player), kind: wait.kind } : null;
  }

  /** Seconds on the turn clock for the awaited player (SPEC §3.7), or null if the clock is off. */
  clockSeconds(): number | null {
    const wait = this.awaitingSeat();
    if (!this.clock || !this.game || !wait) return null;
    const { turnSeconds, responseSeconds } = this.game.rules.clock;
    return wait.kind === "respond" || wait.kind === "pay" ? responseSeconds : turnSeconds;
  }

  /** The clock ran out: make the timeout move for whoever is awaited. */
  timeout(): Outgoing[] {
    const wait = this.awaitingSeat();
    const move = this.game ? timeoutMove(this.game) : null;
    return wait && move ? this.apply(wait.seat, move, false) : [];
  }

  /** Whether a bot is awaited. The transport paces bots by calling stepBot. */
  botToMove(): boolean {
    const wait = this.awaitingSeat();
    return wait !== null && this.seats[wait.seat]?.bot !== undefined;
  }

  /** Lets the awaited bot make one move. */
  stepBot(): Outgoing[] {
    const wait = this.awaitingSeat();
    const bot = wait ? this.seats[wait.seat]?.bot : undefined;
    if (!this.game || !wait || bot === undefined || !this.botRng) return [];
    const player = playerId(wait.seat);
    const move = BOTS[bot](viewFor(this.game, player), legalMoves(this.game, player), this.botRng);
    return this.apply(wait.seat, move, true);
  }

  /** Runs bots until a human is awaited or the game ends (for tests and unpaced transports). */
  runBots(): Outgoing[] {
    const out: Outgoing[] = [];
    while (this.botToMove()) out.push(...this.stepBot());
    return out;
  }

  /**
   * The log since `since` (default: just after this seat's latest own move), filtered so it
   * reveals nothing hidden from this seat.
   */
  historyFor(seat: number, since = this.lastActed[seat] ?? 0): HistoryEntry[] {
    return this.log.slice(since).filter((entry) => visibleTo(entry, seat));
  }

  lobby(): LobbyView {
    return {
      seats: this.seats.map((s, seat) => ({
        seat,
        name: s.name,
        ...(s.bot ? { bot: s.bot } : {}),
        ...(this.game ? { player: playerId(seat) } : {}),
      })),
      host: 0,
      ruleset: this.ruleset,
      overrides: this.overrides,
      clock: this.clock,
      started: this.game !== null,
    };
  }

  private humans(): number[] {
    return this.seats.flatMap((s, seat) => (s.bot ? [] : [seat]));
  }

  private broadcastLobby(): Outgoing[] {
    const lobby = this.lobby();
    return this.humans().map((seat) => ({ seat, message: { type: "lobby", lobby } }));
  }

  private stateFor(seat: number, entries: HistoryEntry[]): Outgoing {
    const game = this.game as GameState;
    const player = playerId(seat);
    return {
      seat,
      message: {
        type: "state",
        view: viewFor(game, player),
        legal: legalMoves(game, player),
        entries,
        awaiting: this.awaitingSeat(),
        clockSeconds: this.clockSeconds(),
      },
    };
  }

  private broadcastState(): Outgoing[] {
    const out = this.humans().map((seat) => {
      const entries = this.log.slice(this.sent[seat] ?? 0).filter((e) => visibleTo(e, seat));
      this.sent[seat] = this.log.length;
      return this.stateFor(seat, entries);
    });
    const game = this.game;
    if (game?.phase === "gameOver") {
      const winner =
        game.result === null || game.result === "stall" ? "stall" : seatOf(game.result);
      for (const seat of this.humans()) {
        out.push({
          seat,
          message: { type: "gameOver", winner, seed: this.seed, moves: [...this.moves] },
        });
      }
    }
    return out;
  }
}

const playerId = (seat: number) => `p${seat + 1}`;
const seatOf = (player: string) => Number(player.slice(1)) - 1;

/**
 * Hidden-information filter for the log. Auto-pass settings are private (SPEC §3.6), and an
 * auto-accepted response must look exactly like a manual accept, which its "responded" event does.
 */
function visibleTo(entry: HistoryEntry, seat: number): boolean {
  const { event } = entry;
  const mine = "player" in event && event.player === playerId(seat);
  if (event.type === "prefSet") return mine;
  if (event.type === "autoResolved" && event.kind === "respond") return mine;
  return true;
}

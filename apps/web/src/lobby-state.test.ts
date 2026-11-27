import type { LobbyView, ServerMessage } from "@bull-city-blocks/room";
import { describe, expect, it } from "vitest";
import { canConfigure, initialState, LOG_LENGTH, reduce } from "./lobby-state";

const lobby = (over: Partial<LobbyView> = {}): LobbyView => ({
  seats: [
    { seat: 0, name: "Ana" },
    { seat: 1, name: "Ben" },
  ],
  host: 0,
  ruleset: "base",
  overrides: {},
  clock: false,
  started: false,
  ...over,
});
const run = (...events: Parameters<typeof reduce>[1][]) => events.reduce(reduce, initialState);

describe("lobby reducer (#36)", () => {
  it("records the seat, token and host flag when joined", () => {
    const s = run({ type: "joined", seat: 1, token: "t-1", host: false });
    expect(s).toMatchObject({ seat: 1, token: "t-1", host: false });
  });

  it("tracks the connection status", () => {
    expect(run({ type: "socket", status: "open" }).status).toBe("open");
    expect(
      run({ type: "socket", status: "open" }, { type: "socket", status: "reconnecting" }).status,
    ).toBe("reconnecting");
  });

  it("keeps the latest lobby, and an error until the next successful update", () => {
    const withError = run(
      { type: "lobby", lobby: lobby() },
      { type: "error", reason: "only the host can do that" },
    );
    expect(withError.error).toBe("only the host can do that");
    expect(withError.lobby?.seats).toHaveLength(2);
    const next = reduce(withError, { type: "lobby", lobby: lobby({ clock: true }) });
    expect(next).toMatchObject({ error: null, lobby: { clock: true } });
  });

  it("only the host may configure, and only before the game starts", () => {
    const host = run(
      { type: "joined", seat: 0, token: "t", host: true },
      { type: "lobby", lobby: lobby() },
    );
    const guest = run(
      { type: "joined", seat: 1, token: "t", host: false },
      { type: "lobby", lobby: lobby() },
    );
    expect(canConfigure(host)).toBe(true);
    expect(canConfigure(guest)).toBe(false);
    expect(canConfigure(reduce(host, { type: "lobby", lobby: lobby({ started: true }) }))).toBe(
      false,
    );
  });

  it("keeps the latest game state and the game-over message", () => {
    const state = {
      type: "state",
      view: {},
      legal: [],
      entries: [],
      awaiting: { seat: 0, kind: "play" },
      clockSeconds: null,
    } as unknown as ServerMessage;
    const over: ServerMessage = { type: "gameOver", winner: 0, seed: "s", moves: [] };
    const s = run(state, over);
    expect(s.game).toBe(state);
    expect(s.over).toBe(over);
  });

  it("builds the log from history and state entries, without repeats, keeping the tail", () => {
    const entry = (seq: number) => ({
      seq,
      turn: 1,
      round: 1,
      seat: 0,
      event: { type: "cardsDrawn" as const, player: "p0", count: 2 },
    });
    const state = (entries: ReturnType<typeof entry>[]) =>
      ({
        type: "state",
        view: {},
        legal: [],
        entries,
        awaiting: null,
        clockSeconds: null,
      }) as never;
    const s = run(
      { type: "history", entries: [entry(1), entry(2)] },
      state([entry(3)]),
      // a reconnect resends history the client already holds
      { type: "history", entries: [entry(2), entry(3), entry(4)] },
    );
    expect(s.log.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
    const long = run(state(Array.from({ length: LOG_LENGTH + 5 }, (_, i) => entry(i))));
    expect(long.log).toHaveLength(LOG_LENGTH);
    expect(long.log[0]?.seq).toBe(5);
  });

  it("keeps the reconnect history as the recap, and remembers every card it has seen (#41)", () => {
    const entry = {
      seq: 4,
      turn: 2,
      round: 1,
      seat: 1,
      event: { type: "deckReshuffled", cards: 9 },
    };
    const state = (cards: Record<string, unknown>) =>
      ({
        type: "state",
        view: { cards },
        legal: [],
        entries: [],
        awaiting: null,
        clockSeconds: null,
      }) as never;
    const s = run(
      { type: "history", entries: [entry] } as never,
      state({ a: { name: "A" } }),
      state({ b: { name: "B" } }), // a has left view, e.g. reshuffled into the deck
    );
    expect(s.recap).toEqual([entry]);
    expect(Object.keys(s.cards)).toEqual(["a", "b"]);
    expect(run({ type: "history", entries: [] }).recap).toEqual([]);
  });
});

import type { LobbyView, ServerMessage } from "@bull-city-blocks/room";
import { describe, expect, it } from "vitest";
import { canConfigure, initialState, reduce } from "./lobby-state";

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

  it("keeps the latest game state and ignores history and game-over (later issues)", () => {
    const state = {
      type: "state",
      view: {},
      legal: [],
      entries: [],
      awaiting: { seat: 0, kind: "play" },
      clockSeconds: null,
    } as unknown as ServerMessage;
    const s = run(
      state,
      { type: "history", entries: [] },
      { type: "gameOver", winner: 0, seed: "s", moves: [] },
    );
    expect(s.game).toBe(state);
  });
});

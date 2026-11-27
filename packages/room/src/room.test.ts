import type { Move } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import type { Outgoing } from "./messages";
import { Room } from "./room";
import { join, last, newRoom, options, to } from "./test-setup";

describe("Room lobby", () => {
  it("the first player to join is host, and seats are limited to 10", () => {
    const room = newRoom();
    const host = join(room, "Ana");
    expect(to(host.out, 0)[0]).toEqual({ type: "joined", seat: 0, token: "id-1", host: true });
    for (let i = 1; i < 10; i++) expect(join(room, `P${i}`).seat).toBe(i);
    expect(room.connect("Eleven")).toEqual({ error: "the room is full" });
  });

  it("only the host may configure, add bots or start, and a game needs 2 seats", () => {
    const room = newRoom();
    join(room, "Ana");
    expect(last(room.handle(0, { type: "start" }), 0, "error")?.reason).toMatch(/need 2/);
    join(room, "Ben");
    for (const msg of [
      { type: "start" },
      { type: "addBot", bot: "greedy" },
      { type: "configure", clock: true },
    ] as const) {
      expect(last(room.handle(1, msg), 1, "error")?.reason).toBe("only the host can do that");
    }
    expect(room.lobby().seats).toHaveLength(2);
  });

  it("bot seats can be added and removed; human seats can't be removed", () => {
    const room = newRoom();
    join(room, "Ana");
    room.handle(0, { type: "addBot", bot: "greedy" });
    room.handle(0, { type: "addBot", bot: "random" });
    expect(room.lobby().seats.map((s) => s.bot ?? "human")).toEqual(["human", "greedy", "random"]);
    room.handle(0, { type: "removeSeat", seat: 1 });
    expect(room.lobby().seats.map((s) => s.bot ?? "human")).toEqual(["human", "random"]);
    expect(last(room.handle(0, { type: "removeSeat", seat: 0 }), 0, "error")?.reason).toMatch(
      /only bot seats/,
    );
  });

  it("rejects an invalid override with the loader's error naming the path, and applies a valid one", () => {
    const room = newRoom();
    join(room, "Ana");
    const bad = room.handle(0, { type: "configure", overrides: { "hand.limitt": 5 } });
    expect(last(bad, 0, "error")?.reason).toContain("hand.limitt");
    expect(
      last(room.handle(0, { type: "configure", overrides: { "hand.limit": "five" } }), 0, "error"),
    ).toBeDefined();
    room.handle(0, { type: "configure", ruleset: "rodeo-cap-4", overrides: { "hand.limit": 5 } });
    expect(room.lobby()).toMatchObject({ ruleset: "rodeo-cap-4", overrides: { "hand.limit": 5 } });
    room.handle(0, { type: "addBot", bot: "random" });
    const state = last(room.handle(0, { type: "start" }), 0, "state");
    expect(state?.view.rules.hand.limit).toBe(5);
    expect(state?.view.rules.actions.foodTruckRodeo.maxTargets).toBe(4);
  });

  it("no new players can join once the game has started", () => {
    const room = newRoom();
    join(room, "Ana");
    join(room, "Ben");
    room.handle(0, { type: "start" });
    expect(room.connect("Late")).toEqual({ error: "the game has already started" });
  });
});

/** Plays `seat`'s first legal move from its latest state message. */
function playFirst(room: ReturnType<typeof newRoom>, seat: number, out: Outgoing[]) {
  const move = last(out, seat, "state")?.legal[0] as Move;
  return room.handle(seat, { type: "intent", move });
}

describe("Room game", () => {
  it("1 human + 3 bots play to game over, with bots acting whenever they're awaited", () => {
    const room = newRoom();
    join(room, "Ana");
    for (const bot of ["greedy", "random", "greedy"] as const)
      room.handle(0, { type: "addBot", bot });
    let out = room.handle(0, { type: "start" });
    let moves = 0;
    while (!to(out, 0).some((m) => m.type === "gameOver") && moves < 5000) {
      out = [...out, ...room.runBots()];
      if (to(out, 0).some((m) => m.type === "gameOver")) break;
      expect(room.awaitingSeat()?.seat).toBe(0); // after runBots, only the human can be awaited
      out = playFirst(room, 0, out);
      moves += 1;
    }
    expect(last(out, 0, "gameOver")).toMatchObject({ seed: "id-2" });
  });

  it("an illegal intent errors to that player only and changes nothing", () => {
    const room = newRoom();
    join(room, "Ana");
    join(room, "Ben");
    room.handle(0, { type: "start" });
    const before = room.awaitingSeat();
    const waiting = before?.seat as number;
    const other = 1 - waiting;
    const notYours = room.handle(other, {
      type: "intent",
      move: { type: "endTurn", player: `p${waiting + 1}` },
    });
    expect(notYours).toEqual([
      { seat: other, message: { type: "error", reason: "that move isn't yours" } },
    ]);
    const illegal = room.handle(other, {
      type: "intent",
      move: { type: "endTurn", player: `p${other + 1}` },
    });
    expect(illegal.map((o) => [o.seat, o.message.type])).toEqual([[other, "error"]]);
    const malformed = room.handle(waiting, {
      type: "intent",
      move: { type: "pay", player: `p${waiting + 1}` } as unknown as Move,
    });
    expect(malformed.map((o) => o.message.type)).toEqual(["error"]);
    expect(room.awaitingSeat()).toEqual(before);
  });

  it("each player's state message has only their own view and legal moves", () => {
    const room = newRoom();
    join(room, "Ana");
    join(room, "Ben");
    const out = room.handle(0, { type: "start" });
    for (const seat of [0, 1]) {
      const state = last(out, seat, "state");
      expect(state?.view.viewer).toBe(`p${seat + 1}`);
      expect(state?.view.players.find((p) => p.id !== `p${seat + 1}`)?.hand).toBeUndefined();
      const awaited = room.awaitingSeat()?.seat;
      expect(state?.legal.length === 0).toBe(awaited !== seat);
    }
  });

  it("timeout() makes the timeout move for whoever is awaited, and the clock comes from the ruleset", () => {
    const room = newRoom();
    join(room, "Ana");
    join(room, "Ben");
    room.handle(0, { type: "configure", clock: true });
    room.handle(0, { type: "start" });
    const first = room.awaitingSeat();
    expect(first?.kind).toBe("play");
    expect(room.clockSeconds()).toBe(90);
    room.timeout(); // §3.7: an idle player's turn ends
    const next = room.awaitingSeat();
    expect(next?.seat === first?.seat ? next?.kind : "passed").toMatch(/discard|passed/);
  });

  it("historyFor returns exactly the entries since a player's last move; a reconnect gets it automatically", () => {
    const room = newRoom();
    const ana = join(room, "Ana");
    for (const bot of ["random", "random", "random"] as const)
      room.handle(0, { type: "addBot", bot });
    let out = [...room.handle(0, { type: "start" }), ...room.runBots()];
    expect(room.awaitingSeat()?.seat).toBe(0);
    // Ana ends her turn (discarding down to the hand limit if she has to).
    out = room.handle(0, { type: "intent", move: { type: "endTurn", player: "p1" } });
    while (room.awaitingSeat()?.seat === 0) out = playFirst(room, 0, out);
    expect(room.historyFor(0)).toEqual([]); // nothing has happened since her last move
    room.runBots(); // the three bots take their turns, until Ana is awaited again
    const history = room.historyFor(0);
    expect(history.every((e) => e.seat !== 0)).toBe(true);
    expect(history.map((e) => e.seq)).toEqual(history.map((_, i) => (history[0]?.seq ?? 0) + i));
    // p2's turn began as part of Ana's own move (her end turn), so the recap starts with p3.
    const turns = history.flatMap((e) => (e.event.type === "turnStarted" ? [e.event.player] : []));
    expect(turns).toEqual(["p3", "p4", "p1"]);
    // Reconnecting sends the same recap without being asked.
    const token = ana.out[0]?.message.type === "joined" ? ana.out[0].message.token : "";
    const back = join(room, "Ana", token);
    expect(back.seat).toBe(0);
    expect(last(back.out, 0, "history")?.entries).toEqual(history);
    expect(last(back.out, 0, "state")?.view.viewer).toBe("p1");
  });
});

describe("Room event filter (SPEC §3.6)", () => {
  it("a player's auto-pass setting reaches only that player", () => {
    const room = newRoom();
    join(room, "Ana");
    join(room, "Ben");
    room.handle(0, { type: "start" });
    const out = room.handle(1, {
      type: "intent",
      move: { type: "setPref", player: "p2", autoPass: false },
    });
    const types = (seat: number) => last(out, seat, "state")?.entries.map((e) => e.event.type);
    expect(types(1)).toEqual(["prefSet"]);
    expect(types(0)).toEqual([]);
    expect(room.historyFor(0, 0).some((e) => e.event.type === "prefSet")).toBe(false);
    expect(room.historyFor(1, 0).some((e) => e.event.type === "prefSet")).toBe(true);
  });
});

describe("Room snapshots (#40)", () => {
  /** Ana and three bots play to the end; `cut` is when (if ever) the room is saved and rebuilt. */
  function play(cut: number | null) {
    let room = newRoom();
    join(room, "Ana");
    for (const bot of ["greedy", "random", "greedy"] as const)
      room.handle(0, { type: "addBot", bot });
    let out = room.handle(0, { type: "start" });
    for (let i = 0; i < 5000; i++) {
      if (i === cut) {
        const saved = JSON.parse(JSON.stringify(room.snapshot()));
        let n = 2; // newRoom's ids so far: the token and the seed
        room = Room.restore({ ...options, makeId: () => `id-${++n}` }, saved);
      }
      out = [...out, ...room.runBots()];
      const over = last(out, 0, "gameOver");
      if (over) return { over, history: room.historyFor(0, 0) };
      out = playFirst(room, 0, out);
    }
    throw new Error("no game over");
  }

  it("a room saved and restored mid-game plays on exactly as if it never stopped", () => {
    const straight = play(null);
    for (const cut of [1, 7, 20]) expect(play(cut)).toEqual(straight);
  });
});

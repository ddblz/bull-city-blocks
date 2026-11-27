import { describe, expect, it } from "vitest";
import { apply, arena, game, place } from "./test-content";
import { applyMove, awaitedPlayer, legalMoves } from "./turn";
import type { GameState, Move } from "./types";

const delay = (me: string, them: string): Move => ({
  type: "playAction",
  player: me,
  card: "construction-delay:1:1",
  target: them,
});
const autoPass = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.prefs.autoPass;

describe("auto-pass (§3.6)", () => {
  it("§3.6 auto-pass is on by default (from the ruleset)", () => {
    expect(game(4).players.every((p) => p.prefs.autoPass)).toBe(true);
  });

  it("§3.6 with auto-pass on and no Appeal in hand, the engine accepts and the target is never awaited", () => {
    const { s, me, them } = arena(3, ["construction-delay:1:1"]);
    const { state, events } = apply(s, delay(me.id, them.id));
    expect(events).toContainEqual({ type: "autoResolved", player: them.id, kind: "respond" });
    expect(awaitedPlayer(state)).toBe(me.id);
    expect(state.players.find((p) => p.id === them.id)?.delayed).toBe(true);
  });

  it("§3.6 with auto-pass on and an Appeal in hand, the target is still asked", () => {
    const { s, me, them } = arena(3, ["construction-delay:1:1"], ["appeal:1:1"]);
    const { state } = apply(s, delay(me.id, them.id));
    expect(state.phase).toBe("respond");
    expect(awaitedPlayer(state)).toBe(them.id);
    expect(legalMoves(state, them.id)).toEqual([
      { type: "respond", player: them.id },
      { type: "respond", player: them.id, appeal: "appeal:1:1" },
    ]);
  });

  it("§3.6 with auto-pass off, the target is always asked, even with no Appeal", () => {
    const { s, me, them } = arena(3, ["construction-delay:1:1"]);
    const off = apply(s, { type: "setPref", player: them.id, autoPass: false }).state;
    const { state } = apply(off, delay(me.id, them.id));
    expect(awaitedPlayer(state)).toBe(them.id);
    expect(legalMoves(state, them.id)).toEqual([{ type: "respond", player: them.id }]);
  });

  it("§3.6 setPref costs no play, is legal in every phase, and isn't listed by legalMoves", () => {
    const { s, me, them } = arena(2, ["construction-delay:1:1", "food-truck-rodeo:1:1"]);
    // Play phase, by the current player and by someone else.
    let t = apply(s, { type: "setPref", player: me.id, autoPass: false }).state;
    t = apply(t, { type: "setPref", player: them.id, autoPass: false }).state;
    expect(t.playsRemaining).toBe(3);
    expect(legalMoves(t, me.id).some((m) => m.type === "setPref")).toBe(false);
    // Respond phase.
    t = apply(t, delay(me.id, them.id)).state;
    expect(t.phase).toBe("respond");
    t = apply(t, { type: "setPref", player: me.id, autoPass: true }).state;
    expect(autoPass(t, me.id)).toBe(true);
    // Turning auto-pass back on with no Appeal in hand resolves the response at once.
    t = apply(t, { type: "setPref", player: them.id, autoPass: true }).state;
    expect(t.phase).toBe("play");
    // Pay phase.
    place(t, ["cash-5:1:1"], t.players.find((p) => p.id === them.id)?.bank as string[]);
    t = apply(t, { type: "playAction", player: me.id, card: "food-truck-rodeo:1:1" }).state;
    expect(t.phase).toBe("pay");
    t = apply(t, { type: "setPref", player: them.id, autoPass: false }).state;
    expect(t.phase).toBe("pay");
    // Discard and game-over phases.
    t.phase = "discard";
    expect(applyMove(t, { type: "setPref", player: me.id, autoPass: false }).ok).toBe(true);
    t.phase = "gameOver";
    expect(applyMove(t, { type: "setPref", player: me.id, autoPass: false }).ok).toBe(true);
    expect(applyMove(t, { type: "setPref", player: "nobody", autoPass: false }).ok).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { apply, arena } from "./test-content";
import { applyMove, awaitedPlayer, legalMoves } from "./turn";
import type { GameEvent, GameState } from "./types";

const APPEALS = ["appeal:1:1", "appeal:1:2", "appeal:1:3", "appeal:1:4"];
const delayed = (s: GameState, id: string) => s.players.find((p) => p.id === id)?.delayed;

describe("Appeal (§3.6)", () => {
  it.each([
    [0, false],
    [1, true],
    [2, false],
    [3, true],
  ])("§3.6 a chain of %i Appeals: cancelled = %s", (length, cancelled) => {
    // The target plays Appeals 1 and 3, the attacker plays Appeal 2.
    const targetAppeals = APPEALS.slice(0, Math.ceil(length / 2) || 1);
    const attackerAppeals = APPEALS.slice(2, 2 + Math.floor(length / 2));
    const { s, me, them } = arena(3, ["construction-delay:1:1", ...attackerAppeals], targetAppeals);
    let { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "construction-delay:1:1",
      target: them.id,
    });
    let events: GameEvent[] = [];
    for (let i = 0; i < length; i++) {
      const who = awaitedPlayer(state) as string;
      expect(who).toBe(i % 2 === 0 ? them.id : me.id);
      const appeal = legalMoves(state, who).find((m) => m.type === "respond" && m.appeal);
      ({ state, events } = apply(state, appeal as never));
    }
    if (length === 0) ({ state, events } = apply(state, { type: "respond", player: them.id }));
    // Whoever has no Appeal left is auto-accepted (auto-pass is on by default).
    expect(events).toContainEqual(expect.objectContaining({ type: "actionResolved", cancelled }));
    expect(delayed(state, them.id)).toBe(!cancelled);
    expect(state).toMatchObject({ phase: "play", pending: [], playsRemaining: 2 }); // Appeals use no plays
    expect(state.discard.filter((c) => c.startsWith("appeal"))).toHaveLength(length);
  });

  it("§3.6 only the awaited player may respond", () => {
    const { s, me, them } = arena(3, ["construction-delay:1:1", "appeal:1:2"], ["appeal:1:1"]);
    const { state } = apply(s, {
      type: "playAction",
      player: me.id,
      card: "construction-delay:1:1",
      target: them.id,
    });
    expect(applyMove(state, { type: "respond", player: me.id }).ok).toBe(false);
    expect(applyMove(state, { type: "respond", player: them.id, appeal: "appeal:1:2" }).ok).toBe(
      false,
    ); // not theirs
    expect(legalMoves(state, me.id)).toEqual([]);
  });

  it("§3.6 an Appeal cancels rent for that target only; the others still pay", () => {
    const { s, me, them } = arena(3, ["rent-downtown-duke:1:1"], ["appeal:1:1"]);
    const set = { district: "duke", cards: [] as string[] };
    me.tableau.push(set);
    set.cards.push(...s.deck.splice(s.deck.indexOf("erwin-rd:1:1"), 1));
    const third = s.players.find((p) => p.id !== me.id && p.id !== them.id);
    third?.bank.push(...s.deck.splice(s.deck.indexOf("cash-3:1:1"), 1));
    let { state } = apply(s, {
      type: "playRent",
      player: me.id,
      card: "rent-downtown-duke:1:1",
      district: "duke",
    });
    state = apply(state, { type: "respond", player: them.id, appeal: "appeal:1:1" }).state;
    // The attacker holds no Appeal, so they auto-accept the cancel; the third player auto-pays 3.
    expect(state.players.find((p) => p.id === me.id)?.bank).toEqual(["cash-3:1:1"]);
    expect(state.phase).toBe("play");
  });
});

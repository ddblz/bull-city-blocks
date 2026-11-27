import { type Move, nextUint32, type RngState, seedRng } from "@bull-city-blocks/engine";
import { describe, expect, it } from "vitest";
import type { Outgoing, ServerMessage } from "./messages";
import { join, last, newRoom } from "./test-setup";

type State = Extract<ServerMessage, { type: "state" }>;

describe("Room privacy (ARCHITECTURE §7 invariant 5, SPEC §3.6)", () => {
  it.each([0, 1, 2])(
    "no message or history for one player reveals the other's hand, auto-pass or auto-accepts (game %i)",
    (g) => {
      const room = newRoom();
      join(room, "Ana");
      join(room, "Ben");
      for (const bot of ["greedy", "random"] as const) room.handle(0, { type: "addBot", bot });
      let rng: RngState = seedRng(`privacy-${g}`);
      const pick = (n: number) => {
        const r = nextUint32(rng);
        rng = r.rng;
        return r.value % n;
      };
      const latest: Record<number, State> = {};
      let seen = [0, 0];
      /** Checks one batch: nothing sent to a human mentions a card in the other human's hand right now. */
      const check = (batch: Outgoing[]) => {
        for (const seat of [0, 1]) {
          const state = last(batch, seat, "state");
          if (state) latest[seat] = state;
        }
        for (const [seat, other] of [
          [0, 1],
          [1, 0],
        ] as const) {
          const hidden =
            latest[other]?.view.players.find((p) => p.id === `p${other + 1}`)?.hand ?? [];
          const fresh = room.historyFor(seat, seen[seat]);
          // The game-over message deliberately reveals the seed and move log for replays (ARCHITECTURE
          // §4.3); it's the only message exempt from the hidden-hand check.
          const during = batch.filter((o) => o.seat === seat && o.message.type !== "gameOver");
          const json = JSON.stringify([during, fresh]);
          for (const card of hidden)
            expect(json.includes(`"${card}"`), `${card} leaked to seat ${seat}`).toBe(false);
          expect(json.includes(`"type":"prefSet","player":"p${other + 1}"`)).toBe(false);
          expect(
            json.includes(`"type":"autoResolved","player":"p${other + 1}","kind":"respond"`),
          ).toBe(false);
        }
        seen = [room.historyFor(0, 0).length, room.historyFor(1, 0).length];
      };
      check(room.handle(0, { type: "start" }));
      // Both humans change their auto-pass setting: only they may see their own prefSet event.
      check(
        room.handle(1, {
          type: "intent",
          move: { type: "setPref", player: "p2", autoPass: false },
        }),
      );
      check(
        room.handle(0, { type: "intent", move: { type: "setPref", player: "p1", autoPass: true } }),
      );
      for (let step = 0; step < 20_000; step++) {
        const wait = room.awaitingSeat();
        if (!wait) {
          expect(latest[0]?.view.phase).toBe("gameOver");
          return;
        }
        if (room.botToMove()) {
          check(room.stepBot());
          continue;
        }
        const legal = latest[wait.seat]?.legal ?? [];
        expect(legal.length).toBeGreaterThan(0);
        check(room.handle(wait.seat, { type: "intent", move: legal[pick(legal.length)] as Move }));
      }
      throw new Error("game did not finish");
    },
  );
});

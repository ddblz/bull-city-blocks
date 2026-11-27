import { queueResponses } from "./respond";
import type { CardInstanceId, GameEvent, GameState, Move, PlayerId } from "./types";
import { othersAfter, playerOf } from "./util";

/** SPEC §3.5 rent and §4.6 rent cards, with Rent Hike (§4.5). */

/**
 * Rent for one of a player's districts (§3.5): the ladder step for the number of cards in a set,
 * plus the ruleset's bonuses for its Landmark and Icon. With two sets, the higher rent counts.
 */
export function rentFor(s: GameState, player: PlayerId, district: string): number {
  const ladder = s.districts[district]?.rent ?? [];
  const { landmarkBonus, iconBonus } = s.rules.upgrades;
  let best = 0;
  for (const set of playerOf(s, player).tableau.filter((t) => t.district === district)) {
    const step = ladder[Math.min(set.cards.length, ladder.length) - 1] ?? 0;
    best = Math.max(best, step + (set.landmark ? landmarkBonus : 0) + (set.icon ? iconBonus : 0));
  }
  return best;
}

/** playRent moves: each rent card × each district it can charge × (Wild Rent) each target × with or without a Rent Hike. */
export function rentMoves(s: GameState, player: PlayerId): Move[] {
  const p = playerOf(s, player);
  const hike = p.hand.find((c) => {
    const def = s.cards[c];
    return def?.kind === "action" && def.action === "rentHike";
  });
  const mine = [...new Set(p.tableau.map((set) => set.district))].filter(
    (d) => rentFor(s, player, d) > 0,
  );
  const moves: Move[] = [];
  for (const card of p.hand) {
    const def = s.cards[card];
    if (def?.kind !== "rent") continue;
    const districts =
      def.districts === "any" ? mine : mine.filter((d) => def.districts.includes(d));
    const targets = def.districts === "any" ? othersAfter(s, player).map((o) => o.id) : [undefined];
    for (const district of districts) {
      for (const target of targets) {
        const base = {
          type: "playRent" as const,
          player,
          card,
          district,
          ...(target ? { target } : {}),
        };
        moves.push(base);
        if (hike !== undefined && s.playsRemaining >= 2) moves.push({ ...base, hike });
      }
    }
  }
  return moves;
}

/** Plays a rent card (and Rent Hike): both go to the discard pile and the debts are queued. */
export function playRent(
  s: GameState,
  move: Extract<Move, { type: "playRent" }>,
  events: GameEvent[],
): void {
  const p = playerOf(s, move.player);
  const played: CardInstanceId[] = move.hike === undefined ? [move.card] : [move.card, move.hike];
  for (const card of played) {
    p.hand.splice(p.hand.indexOf(card), 1);
    s.discard.push(card);
  }
  s.playsRemaining -= played.length;
  const amount = rentFor(s, p.id, move.district) * (move.hike === undefined ? 1 : 2);
  const cap = s.rules.rent.pair.maxTargets;
  const debtors =
    move.target === undefined
      ? othersAfter(s, p.id)
          .slice(0, cap ?? undefined)
          .map((o) => o.id)
      : [move.target];
  events.push({
    type: "rentCharged",
    player: p.id,
    card: move.card,
    district: move.district,
    amount,
    debtors,
  });
  queueResponses(s, p.id, move.card, debtors, { kind: "debt", amount });
}

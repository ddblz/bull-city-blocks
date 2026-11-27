import type { CardInstanceId, Move, PlayerView, PropertySet } from "@bull-city-blocks/engine";
import type { Policy } from "./policy";

/**
 * A simple priority bot. In Play: complete a district (by playing a property, a Hostile Takeover,
 * or a Buyout / Swap Meet that completes a set), else draw with Walk-Off Win, else play the rent or
 * Food Truck Rodeo with the highest expected payout, else play a property (joining its biggest
 * set), else bank cash, else end the turn. It pays and discards its lowest-value cards (bank before
 * tableau) and Appeals steals of its best set. Ties go to the first legal move: deterministic.
 */
export const greedy: Policy = (view, legal) => {
  const best = (score: (m: Move) => number) => {
    let pick: Move | undefined;
    let top = Number.NEGATIVE_INFINITY;
    for (const m of legal) {
      const s = score(m);
      if (s > top) [pick, top] = [m, s];
    }
    return { move: pick as Move, score: top };
  };
  const value = (card: CardInstanceId) => view.cards[card]?.value ?? 0;
  const me = view.players.find((p) => p.id === view.viewer);
  const tableau = me?.tableau ?? [];

  switch (view.phase) {
    case "respond":
      return respond(view, legal, tableau);
    case "pay":
      return best((m) =>
        m.type === "pay"
          ? -(
              m.cards.reduce((n, c) => n + value(c), 0) +
              (me?.bank.includes(m.cards[0] ?? "") ? 0 : 0.5)
            )
          : -Infinity,
      ).move;
    case "discard":
      return best((m) => (m.type === "discard" ? -value(m.card) : -Infinity)).move;
  }

  const district = (m: Move) => {
    if (m.type !== "playProperty") return undefined;
    const def = view.cards[m.card];
    return m.district ?? (def?.kind === "property" ? def.district : undefined);
  };
  const openSet = (d: string) => {
    const size = view.districts[d]?.setSize ?? 0;
    return tableau
      .filter((s) => s.district === d && s.cards.length < size)
      .sort((a, b) => b.cards.length - a.cards.length)[0];
  };
  const completes = (m: Move) => {
    const d = district(m);
    const set = d === undefined ? undefined : openSet(d);
    return set !== undefined && set.cards.length + 1 >= (view.districts[d as string]?.setSize ?? 0);
  };

  const action = (m: Move) => {
    if (m.type !== "playAction") return undefined;
    const def = view.cards[m.card];
    return def?.kind === "action" ? def.action : undefined;
  };
  const mineComplete = new Set(
    tableau
      .filter((set) => set.cards.length >= (view.districts[set.district]?.setSize ?? Infinity))
      .map((set) => set.district),
  );
  /** A steal whose card would complete one of our sets. */
  const stealCompletes = (m: Move) => {
    if (m.type !== "playAction" || m.take === undefined) return false;
    const def = view.cards[m.take];
    const d = def?.kind === "property" ? def.district : undefined;
    const set = d === undefined ? undefined : openSet(d);
    return set !== undefined && set.cards.length + 1 >= (view.districts[d as string]?.setSize ?? 0);
  };

  const complete =
    legal.find(completes) ??
    legal.find(
      (m) => m.type === "playAction" && m.district !== undefined && !mineComplete.has(m.district),
    ) ??
    legal.find(stealCompletes) ??
    legal.find((m) => action(m) === "walkOffWin");
  if (complete) return complete;
  const others = view.players.length - 1;
  const rodeoTargets = Math.min(others, view.rules.actions.foodTruckRodeo.maxTargets ?? others);
  const rent = best((m) =>
    m.type === "playRent"
      ? rentPayout(view, tableau, m)
      : action(m) === "foodTruckRodeo"
        ? 2 * rodeoTargets
        : -1,
  );
  if (rent.score > 0) return rent.move;
  const property = best((m) => {
    const d = district(m);
    return d === undefined ? -1 : (openSet(d)?.cards.length ?? 0);
  });
  if (property.score >= 0) return property.move;
  const cash = legal.find((m) => m.type === "bank" && view.cards[m.card]?.kind === "cash");
  return cash ?? (legal.find((m) => m.type === "endTurn") as Move) ?? (legal[0] as Move);
};

/** Expected payout of a rent play: the rent (doubled by a Rent Hike) times the players charged. */
function rentPayout(
  view: PlayerView,
  tableau: readonly PropertySet[],
  m: Extract<Move, { type: "playRent" }>,
): number {
  const ladder = view.districts[m.district]?.rent ?? [];
  const { landmarkBonus, iconBonus } = view.rules.upgrades;
  let rent = 0;
  for (const set of tableau.filter((s) => s.district === m.district)) {
    const step = ladder[Math.min(set.cards.length, ladder.length) - 1] ?? 0;
    rent = Math.max(rent, step + (set.landmark ? landmarkBonus : 0) + (set.icon ? iconBonus : 0));
  }
  const others = view.players.length - 1;
  const targets = m.target ? 1 : Math.min(others, view.rules.rent.pair.maxTargets ?? others);
  return rent * (m.hike ? 2 : 1) * targets;
}

/** Appeal a steal of our biggest set (or, as the attacker, keep our action); otherwise accept. */
function respond(view: PlayerView, legal: readonly Move[], tableau: readonly PropertySet[]): Move {
  const appeal = legal.find((m) => m.type === "respond" && m.appeal !== undefined);
  const accept = legal.find((m) => m.type === "respond" && m.appeal === undefined) as Move;
  const step = view.pending[0];
  if (appeal === undefined || step?.type !== "response") return accept;
  if (step.attacker === view.viewer) return appeal;
  const biggest = [...tableau].sort((a, b) => b.cards.length - a.cards.length)[0];
  const { effect } = step;
  const hitsBest =
    effect.kind === "takeover" ||
    ((effect.kind === "buyout" || effect.kind === "swap") &&
      biggest?.cards.includes(effect.take) === true);
  return hitsBest ? appeal : accept;
}

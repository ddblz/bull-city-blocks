import type {
  CardInstanceId,
  GameEvent,
  GameState,
  Move,
  PlayerId,
  PlayerState,
  PropertySet,
} from "./types";
import { addToTableau, isComplete, playerOf, removeOwned } from "./util";

/** SPEC §4.2 wild properties and §4.3 Landmark / Icon upgrades. */

/** The districts a wild can stand in: its pair, or any district for a Bull City Wild. */
function wildDistricts(s: GameState, card: CardInstanceId): string[] {
  const def = s.cards[card];
  if (def?.kind !== "wild") return [];
  return def.districts === "any" ? Object.keys(s.districts) : [...def.districts];
}

/** §3.5: the set an upgrade of this kind can go on in `district`, if any. */
function upgradeSet(
  s: GameState,
  p: PlayerState,
  kind: "landmark" | "icon",
  district: string,
): PropertySet | undefined {
  if (s.districts[district]?.upgradable === false) return undefined;
  return p.tableau.find(
    (set) =>
      set.district === district &&
      isComplete(s, set) &&
      (kind === "landmark" ? !set.landmark : set.landmark && !set.icon),
  );
}

/** Wild plays and upgrades (each a play), and moveWild (free) for the player whose turn it is. */
export function tableauMoves(s: GameState, player: PlayerId): Move[] {
  const p = playerOf(s, player);
  const moves: Move[] = [];
  if (s.playsRemaining > 0) {
    for (const card of p.hand) {
      const kind = s.cards[card]?.kind;
      for (const district of wildDistricts(s, card))
        moves.push({ type: "playProperty", player, card, district });
      if (kind === "landmark" || kind === "icon") {
        const districts = new Set(p.tableau.map((set) => set.district));
        for (const district of districts) {
          if (upgradeSet(s, p, kind, district))
            moves.push({ type: "playUpgrade", player, card, district });
        }
      }
    }
  }
  for (const set of p.tableau) {
    for (const card of set.cards) {
      if (s.wildsMoved.includes(card)) continue; // each wild moves at most once per turn (§3.2)
      for (const district of wildDistricts(s, card)) {
        if (district !== set.district) moves.push({ type: "moveWild", player, card, district });
      }
    }
  }
  return moves;
}

export function playUpgrade(
  s: GameState,
  move: Extract<Move, { type: "playUpgrade" }>,
  events: GameEvent[],
): void {
  const p = playerOf(s, move.player);
  const kind = s.cards[move.card]?.kind === "icon" ? "icon" : "landmark";
  const set = upgradeSet(s, p, kind, move.district);
  if (set === undefined) return; // unreachable: the move was validated against legalMoves
  p.hand.splice(p.hand.indexOf(move.card), 1);
  set[kind] = move.card;
  s.playsRemaining -= 1;
  events.push({ type: "upgradePlayed", player: p.id, card: move.card, district: move.district });
}

/** Moves a wild to another district. If its old set stops being complete, its upgrades go to the bank. */
export function moveWild(
  s: GameState,
  move: Extract<Move, { type: "moveWild" }>,
  events: GameEvent[],
): void {
  const p = playerOf(s, move.player);
  removeOwned(s, p, move.card);
  addToTableau(s, p, move.card, move.district);
  s.wildsMoved.push(move.card);
  events.push({ type: "wildMoved", player: p.id, card: move.card, district: move.district });
}

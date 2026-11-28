import { isComplete } from "./card";
import type { View } from "./types";

/**
 * The Durham map (#62): a schematic tile map, not geographic data. Rows run north to south and
 * columns west to east, roughly like the city: the Eno and North Durham at the top, Duke and Forest
 * Hills in the west, Downtown and Brightleaf in the middle, East Durham in the east, RTP and Transit
 * toward the south.
 */
const LAYOUT: readonly (readonly [id: string, col: number, row: number])[] = [
  ["north-durham", 1, 0],
  ["the-eno", 2, 0],
  ["duke", 0, 1],
  ["walltown", 1, 1],
  ["trinity-park", 2, 1],
  ["east-durham", 3, 1],
  ["forest-hills", 0, 2],
  ["old-west-durham", 1, 2],
  ["downtown", 2, 2],
  ["brightleaf", 3, 2],
  ["rtp", 0, 3],
  ["transit", 1, 3],
  ["hayti", 2, 3],
  ["american-tobacco", 3, 3],
];

const TILE = { w: 92, h: 78, gap: 8 };
/** The SVG's viewBox. */
export const MAP_SIZE = {
  width: 4 * (TILE.w + TILE.gap) + TILE.gap,
  height: 4 * (TILE.h + TILE.gap) + TILE.gap,
};

export interface Tile {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TILES: readonly Tile[] = LAYOUT.map(([id, col, row]) => ({
  id,
  x: TILE.gap + col * (TILE.w + TILE.gap),
  y: TILE.gap + row * (TILE.h + TILE.gap),
  w: TILE.w,
  h: TILE.h,
}));

export interface Holder {
  player: string;
  have: number;
  size: number;
  /** A complete set by the engine's rule (§3.5): enough cards and at least one property. */
  full: boolean;
}

/**
 * Who has cards in each district, from public tableaux only. A player with several sets of a
 * district is shown by their best: a complete one, else the one with the most cards. Complete
 * holders come first, then the most cards.
 */
export function districtHolders(view: View): Record<string, Holder[]> {
  const out: Record<string, Holder[]> = {};
  for (const p of view.players) {
    const best = new Map<string, Holder>();
    for (const set of p.tableau) {
      const mine: Holder = {
        player: p.id,
        have: set.cards.length,
        size: view.districts[set.district]?.setSize ?? 0,
        full: isComplete(set, view),
      };
      const was = best.get(set.district);
      if (!was || (mine.full && !was.full) || (mine.full === was.full && mine.have > was.have))
        best.set(set.district, mine);
    }
    for (const [district, holder] of best) out[district] = [...(out[district] ?? []), holder];
  }
  for (const list of Object.values(out))
    list.sort((a, b) => Number(b.full) - Number(a.full) || b.have - a.have);
  return out;
}

/** The text for one holder: "Ana 2/3", or "Ana complete". */
export const holderText = (h: Holder, name: string) =>
  `${name} ${h.full ? "complete" : `${h.have}/${h.size}`}`;

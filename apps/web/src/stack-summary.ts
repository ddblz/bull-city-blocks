import { districtName, totalValue } from "./card";
import { districtColor } from "./district-colors";
import { rentNow, setStatus } from "./table-summary";
import type { PropertySet, View } from "./types";

/** The most cards a stack draws; its label still says how many there are. */
export const MAX_TILES = 6;

/** What a set's stack shows without a tap (#79): the district, progress, rent now and upgrades. */
export function setSummary(set: PropertySet, view: View) {
  const { full, label } = setStatus(set, view);
  return {
    name: districtName(set.district, view),
    color: districtColor(set.district),
    label,
    full,
    tiles: Math.min(set.cards.length, MAX_TILES),
    rent: rentNow(set, view),
    landmark: set.landmark !== undefined,
    icon: set.icon !== undefined,
  };
}

/** What a bank's stack shows: the total and how many cards it holds. */
export function bankSummary(bank: readonly string[], view: View) {
  return {
    total: totalValue(bank, view),
    count: bank.length,
    tiles: Math.min(bank.length, MAX_TILES),
  };
}

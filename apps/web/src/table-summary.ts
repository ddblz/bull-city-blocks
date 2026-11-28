import { isComplete } from "./card";
import type { PropertySet, View } from "./types";

/** The table's numbers (#58): set progress, plays, rent and the hand's layout. Pure. */

type Player = View["players"][number];

/** A set's progress (§3.5): "2/3", or "FULL" once it has enough cards and a property. */
export function setStatus(set: PropertySet, view: View) {
  const size = view.districts[set.district]?.setSize ?? 0;
  const full = isComplete(set, view);
  return {
    size,
    have: set.cards.length,
    full,
    label: full ? "FULL" : `${set.cards.length}/${size}`,
  };
}

/** Different districts a player has completed: what counts toward winning (§3.2). */
export const districtsDone = (player: Player, view: View) =>
  new Set(player.tableau.filter((s) => isComplete(s, view)).map((s) => s.district)).size;

/** Plays used and left this turn, or null outside the play phase. */
export function playPips(view: View) {
  if (view.phase !== "play") return null;
  const total = view.rules.playsPerTurn;
  return { total, left: view.playsRemaining, used: Math.max(0, total - view.playsRemaining) };
}

/** What a set would charge now (§3.5): its ladder step, plus a Landmark's and an Icon's bonus. */
export function rentNow(set: PropertySet, view: View): number {
  const ladder = view.districts[set.district]?.rent ?? [];
  const { landmarkBonus, iconBonus } = view.rules.upgrades;
  const step = ladder[Math.min(set.cards.length, ladder.length) - 1] ?? 0;
  return step + (set.landmark ? landmarkBonus : 0) + (set.icon ? iconBonus : 0);
}

/** "Rent $7 · +$3 Landmark", with the full-set rent while the set is unfinished. */
export function rentLine(set: PropertySet, view: View): string {
  const { landmarkBonus, iconBonus } = view.rules.upgrades;
  const parts = [`Rent $${rentNow(set, view)}`];
  if (!isComplete(set, view))
    parts.push(`full set $${view.districts[set.district]?.rent.at(-1) ?? 0}`);
  if (set.landmark) parts.push(`+$${landmarkBonus} Landmark`);
  if (set.icon) parts.push(`+$${iconBonus} Icon`);
  return parts.join(" · ");
}

/** Columns for the overlapping hand: every card but the last shrinks to fit, the last stays whole. */
export const handColumns = (n: number) =>
  n <= 1 ? "10.5rem" : `repeat(${n - 1}, minmax(2.75rem, 10.5rem)) 10.5rem`;

/** The selected hand card after tapping `id`: tapping it again deselects. */
export const toggleSelected = (current: string | null, id: string) => (current === id ? null : id);

/** The selection survives only while the card is still in the hand. */
export const keepSelected = (current: string | null, hand: readonly string[]) =>
  current !== null && hand.includes(current) ? current : null;

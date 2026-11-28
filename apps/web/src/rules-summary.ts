import type { RuleSet } from "@bull-city-blocks/engine";
import { valueAt } from "./config-form";

export interface RuleRow {
  label: string;
  value: string;
  /** Some setting on this row is not what `base` has. */
  differs: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The lobby's "Active match rules" panel (#60): one row per headline rule, from the resolved ruleset. */
export function rulesRows(rules: RuleSet, base: RuleSet): RuleRow[] {
  const row = (label: string, value: string, ...paths: string[]): RuleRow => ({
    label,
    value,
    differs: paths.some(
      (p) => JSON.stringify(valueAt(rules, p)) !== JSON.stringify(valueAt(base, p)),
    ),
  });
  const { draw, hand, clock, payments } = rules;
  const cap = (n: number | null) => (n === null ? "everyone" : plural(n, "player"));
  return [
    row("Victory", `${plural(rules.districtsToWin, "complete district")}`, "districtsToWin"),
    row(
      "Turns",
      `Draw ${draw.perTurn} · up to ${plural(rules.playsPerTurn, "play")}`,
      "draw.perTurn",
      "playsPerTurn",
    ),
    row("Hand limit", plural(hand.limit, "card"), "hand.limit"),
    row(
      "Turn clock",
      `${clock.turnSeconds} s a turn · ${clock.responseSeconds} s to respond`,
      "clock.turnSeconds",
      "clock.responseSeconds",
    ),
    row(
      "Payments",
      `${payments.giveChange ? "Change given" : "No change"} · ${payments.autoPay ? "auto-pay" : "choose cards"}`,
      "payments.giveChange",
      "payments.autoPay",
    ),
    row(
      "Targets",
      `Food Truck Rodeo: ${cap(rules.actions.foodTruckRodeo.maxTargets)} · pair rent: ${cap(rules.rent.pair.maxTargets)}`,
      "actions.foodTruckRodeo.maxTargets",
      "rent.pair.maxTargets",
    ),
  ];
}

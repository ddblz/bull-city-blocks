import {
  type Content,
  loadRuleset,
  type Result,
  type RuleSet,
  RuleSetSchema,
} from "@bull-city-blocks/engine";

/** The rules editor (#39): a form generated from RuleSetSchema, and the overrides it produces. */

export const SECTIONS = [
  "setup",
  "turn",
  "payments",
  "upgrades",
  "actions",
  "rent",
  "clock",
] as const;
export type Section = (typeof SECTIONS)[number];

/** Where each top-level ruleset key goes. Identity, metadata and the deck (its own table) are left out. */
const SECTION_OF: Record<string, Section> = {
  players: "setup",
  deckCopies: "setup",
  hand: "setup",
  draw: "turn",
  playsPerTurn: "turn",
  districtsToWin: "turn",
  roundLimit: "turn",
  autoPassDefault: "turn",
  payments: "payments",
  upgrades: "upgrades",
  actions: "actions",
  rent: "rent",
  clock: "clock",
};

export interface Field {
  /** Dotted override path, e.g. "actions.foodTruckRodeo.maxTargets" or "deckCopies.0.copies". */
  path: string;
  section: Section;
  kind: "number" | "boolean";
  /** For numbers: the smallest whole number the schema accepts. */
  min: number;
  /** `null` is allowed and means unlimited. */
  nullable: boolean;
}

/** A zod schema, seen only through what the walk needs. */
interface Schema {
  def: { type: string; innerType?: Schema; element?: Schema };
  shape?: Record<string, Schema>;
  safeParse: (v: unknown) => { success: boolean };
}

/**
 * Every editable number and boolean in RuleSetSchema, in schema order. Arrays (deck copy tiers)
 * get one set of fields per entry in `rules`.
 */
export function formFields(rules: RuleSet): Field[] {
  const fields: Field[] = [];
  const walk = (
    schema: Schema,
    path: string,
    section: Section,
    value: unknown,
    nullable = false,
  ) => {
    const { type } = schema.def;
    if (type === "object" && schema.shape)
      for (const [key, sub] of Object.entries(schema.shape))
        walk(sub, `${path}.${key}`, section, (value as Record<string, unknown>)?.[key]);
    else if (type === "nullable" && schema.def.innerType)
      walk(schema.def.innerType, path, section, value, true);
    else if (type === "array" && schema.def.element && Array.isArray(value))
      for (const [i, v] of value.entries())
        walk(schema.def.element as Schema, `${path}.${i}`, section, v);
    else if (type === "number" || type === "boolean")
      fields.push({
        path: path.slice(1),
        section,
        kind: type,
        min: schema.safeParse(0).success ? 0 : 1,
        nullable,
      });
  };
  const shape = (RuleSetSchema as unknown as Schema).shape ?? {};
  for (const [key, schema] of Object.entries(shape)) {
    const section = SECTION_OF[key];
    if (section) walk(schema, `.${key}`, section, rules[key as keyof RuleSet]);
  }
  return fields;
}

/** "actions.foodTruckRodeo.maxTargets" → "Food truck rodeo · max targets". */
export function fieldLabel(path: string): string {
  return path
    .split(".")
    .map((part) =>
      /^\d+$/.test(part)
        ? `tier ${Number(part) + 1}`
        : part.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`),
    )
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" · ");
}

/** The value at a dotted path. */
export function valueAt(obj: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], obj);
}

/** Sets an override, or removes it when the value is what the chosen ruleset already has. */
export function setOverride(
  overrides: Record<string, unknown>,
  parent: unknown,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const { [path]: _, ...rest } = overrides;
  return JSON.stringify(valueAt(parent, path)) === JSON.stringify(value)
    ? rest
    : { ...rest, [path]: value };
}

/** The room's rules: the chosen ruleset with its overrides, through the engine's own loader. */
export function resolveRules(
  files: readonly unknown[],
  ruleset: string,
  overrides: Record<string, unknown>,
): Result<RuleSet> {
  const inline = {
    id: "__room__",
    extends: ruleset,
    description: `${ruleset} with room overrides`,
    overrides,
  };
  return loadRuleset("__room__", [...files, inline]);
}

/** A card's or district's effective deck settings under `rules` (§5 deck overrides). */
export const deckRows = (content: Content, rules: RuleSet) => ({
  cards: content.cards.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    count: rules.deck.counts[c.id] ?? c.count,
    value: rules.deck.values[c.id] ?? c.value,
    /** #18: property counts can't change. */
    countEditable: c.kind !== "property",
  })),
  districts: content.districts.map((d) => ({
    id: d.id,
    name: d.name,
    rent: rules.deck.rent[d.id] ?? d.rent,
  })),
});

/** `rules` with its deck maps filled in from the content, so every card and district has a value. */
export function withDeckDefaults(rules: RuleSet, content: Content): RuleSet {
  const rows = deckRows(content, rules);
  return {
    ...rules,
    deck: {
      counts: Object.fromEntries(rows.cards.map((c) => [c.id, c.count])),
      values: Object.fromEntries(rows.cards.map((c) => [c.id, c.value])),
      rent: Object.fromEntries(rows.districts.map((d) => [d.id, d.rent])),
    },
  };
}

/** Every way `rules` differs from `base`, as "label: before → after" lines for all players. */
export function differences(rules: RuleSet, base: RuleSet, content: Content): string[] {
  const show = (v: unknown) =>
    v === null ? "unlimited" : Array.isArray(v) ? v.join("/") : String(v);
  const lines: string[] = [];
  const paths = new Set([...formFields(base), ...formFields(rules)].map((f) => f.path));
  for (const path of paths) {
    const [was, now] = [valueAt(base, path), valueAt(rules, path)];
    if (JSON.stringify(was) !== JSON.stringify(now))
      lines.push(`${fieldLabel(path)}: ${show(was)} → ${show(now)}`);
  }
  const [a, b] = [deckRows(content, base), deckRows(content, rules)];
  b.cards.forEach((card, i) => {
    const old = a.cards[i];
    if (old && old.count !== card.count)
      lines.push(`${card.name} copies: ${old.count} → ${card.count}`);
    if (old && old.value !== card.value)
      lines.push(`${card.name} value: $${old.value} → $${card.value}`);
  });
  b.districts.forEach((d, i) => {
    const old = a.districts[i];
    if (old && show(old.rent) !== show(d.rent))
      lines.push(`${d.name} rent: ${show(old.rent)} → ${show(d.rent)}`);
  });
  return lines;
}

/** `rulesets/<id>.json` text for a variant PR, reproducing the room's rules (CLAUDE.md rule 7). */
export function exportVariant(
  id: string,
  ruleset: string,
  overrides: Record<string, unknown>,
  description: string,
): string {
  return `${JSON.stringify({ id, extends: ruleset, description, overrides }, null, 2)}\n`;
}

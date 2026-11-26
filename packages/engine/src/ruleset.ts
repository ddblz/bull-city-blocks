import { z } from "zod";
import type { Result } from "./result";

/**
 * Ruleset schema (SPEC §5): every bold parameter in SPEC §3–4. Rulesets are JSON in
 * `rulesets/`; a variant `extends` another and applies dotted-path `overrides`.
 */

const count = z.number().int().min(0);
const positive = z.number().int().positive();
/** `null` means unlimited (the SPEC's ∞). */
const maxTargets = positive.nullable();

export const RuleSetSchema = z.strictObject({
  id: z.string().min(1),
  description: z.string(),
  hypothesis: z.string().optional(),
  players: z.strictObject({ min: positive, max: positive }),
  /** §3.1 deck copies by player count: the first tier whose `maxPlayers` covers the count. */
  deckCopies: z.array(z.strictObject({ maxPlayers: positive, copies: positive })).min(1),
  hand: z.strictObject({ starting: count, limit: count }),
  draw: z.strictObject({ perTurn: count, emptyHand: count }),
  playsPerTurn: positive,
  districtsToWin: positive,
  roundLimit: positive,
  payments: z.strictObject({ giveChange: z.boolean(), autoPay: z.boolean() }),
  upgrades: z.strictObject({ landmarkBonus: count, iconBonus: count }),
  autoPassDefault: z.boolean(),
  actions: z.strictObject({
    foodTruckRodeo: z.strictObject({ maxTargets }),
    assessment: z.strictObject({ cap: positive }),
    buyout: z.strictObject({ payCardValue: z.boolean() }),
    hostileTakeover: z.strictObject({ playCost: positive }),
  }),
  rent: z.strictObject({ pair: z.strictObject({ maxTargets }) }),
  clock: z.strictObject({
    onByDefault: z.boolean(),
    turnSeconds: positive,
    responseSeconds: positive,
  }),
});

export type RuleSet = z.infer<typeof RuleSetSchema>;

const VariantSchema = z.strictObject({
  id: z.string().min(1),
  extends: z.string().min(1),
  description: z.string(),
  hypothesis: z.string().optional(),
  overrides: z.record(z.string(), z.unknown()).default({}),
});

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Sets `path` (e.g. "actions.foodTruckRodeo.maxTargets") in a copy of `target`. The path must exist. */
function applyOverride(target: unknown, path: string, value: unknown): Result<unknown> {
  const keys = path.split(".");
  const root: unknown = JSON.parse(JSON.stringify(target));
  let node: unknown = root;
  for (const [i, key] of keys.entries()) {
    if (!isObject(node) || !Object.hasOwn(node, key)) {
      return { ok: false, error: `unknown override path "${path}"` };
    }
    if (i === keys.length - 1) node[key] = value;
    else node = node[key];
  }
  return { ok: true, value: root };
}

/**
 * Resolves ruleset `id` from already-parsed ruleset files (the caller does the I/O), following
 * the `extends` chain and applying each variant's overrides. Never throws.
 */
export function loadRuleset(id: string, files: readonly unknown[]): Result<RuleSet> {
  const byId = new Map<string, unknown>();
  for (const file of files) {
    const fileId = isObject(file) ? file.id : undefined;
    if (typeof fileId !== "string") return { ok: false, error: "every ruleset needs a string id" };
    if (byId.has(fileId)) return { ok: false, error: `duplicate ruleset id "${fileId}"` };
    byId.set(fileId, file);
  }

  const resolve = (current: string, chain: string[]): Result<RuleSet> => {
    if (chain.includes(current)) {
      return { ok: false, error: `extends cycle: ${[...chain, current].join(" → ")}` };
    }
    const file = byId.get(current);
    if (file === undefined) return { ok: false, error: `unknown ruleset "${current}"` };
    if (!isObject(file) || !("extends" in file)) {
      const parsed = RuleSetSchema.safeParse(file);
      if (parsed.success) return { ok: true, value: parsed.data };
      return { ok: false, error: `ruleset "${current}": ${z.prettifyError(parsed.error)}` };
    }

    const variant = VariantSchema.safeParse(file);
    if (!variant.success) {
      return { ok: false, error: `ruleset "${current}": ${z.prettifyError(variant.error)}` };
    }
    const parent = resolve(variant.data.extends, [...chain, current]);
    if (!parent.ok) return parent;
    const { id, description, hypothesis, overrides } = variant.data;
    let merged: unknown = { ...parent.value, id, description, hypothesis };
    for (const [path, value] of Object.entries(overrides)) {
      const next = applyOverride(merged, path, value);
      if (!next.ok) return { ok: false, error: `ruleset "${current}": ${next.error}` };
      merged = next.value;
    }
    const parsed = RuleSetSchema.safeParse(merged);
    if (parsed.success) return { ok: true, value: parsed.data };
    return { ok: false, error: `ruleset "${current}": ${z.prettifyError(parsed.error)}` };
  };

  return resolve(id, []);
}

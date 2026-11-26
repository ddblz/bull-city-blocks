import { z } from "zod";
import type { Result } from "./result";

/** Content schema for `content/*.json` (SPEC §4). Validated once, at load time. */

const id = z.string().regex(/^[a-z0-9-]+$/, "ids are lowercase kebab-case");
const value = z.number().int().min(0);
const count = z.number().int().positive().default(1);
/** A two-district pair, or "any" for Bull City Wild and Wild Rent. */
const districtsRef = z.union([z.tuple([id, id]), z.literal("any")]);

export const ACTIONS = [
  "walkOffWin",
  "foodTruckRodeo",
  "assessment",
  "buyout",
  "swapMeet",
  "hostileTakeover",
  "appeal",
  "constructionDelay",
  "rentHike",
] as const;

const DistrictSchema = z.object({
  id,
  name: z.string().min(1),
  setSize: z.number().int().positive(),
  rent: z.array(value).min(1),
  value,
});

const base = { id, name: z.string().min(1), value, count };
const CardSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("property"), ...base, district: id }),
  z.object({ kind: z.literal("wild"), ...base, districts: districtsRef }),
  z.object({ kind: z.literal("landmark"), ...base }),
  z.object({ kind: z.literal("icon"), ...base }),
  z.object({ kind: z.literal("cash"), ...base }),
  z.object({ kind: z.literal("action"), ...base, action: z.enum(ACTIONS) }),
  z.object({ kind: z.literal("rent"), ...base, districts: districtsRef }),
]);

export const ContentSchema = z
  .object({
    id,
    version: z.number().int().positive(),
    districts: z.array(DistrictSchema).min(1),
    pairs: z.array(z.tuple([id, id])),
    cards: z.array(CardSchema).min(1),
  })
  .superRefine((content, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    const districts = new Set(content.districts.map((d) => d.id));
    const pairs = new Set(content.pairs.map(([a, b]) => `${a}|${b}`));
    const seen = new Set<string>();
    for (const d of content.districts) {
      if (d.rent.length !== d.setSize)
        issue(`district ${d.id}: rent ladder must have setSize steps`);
    }
    for (const [a, b] of content.pairs) {
      if (!districts.has(a) || !districts.has(b)) issue(`pair ${a}/${b}: unknown district`);
    }
    for (const card of content.cards) {
      if (seen.has(card.id)) issue(`duplicate card id ${card.id}`);
      seen.add(card.id);
      if (card.kind === "property" && !districts.has(card.district)) {
        issue(`card ${card.id}: unknown district ${card.district}`);
      }
      if ((card.kind === "wild" || card.kind === "rent") && card.districts !== "any") {
        if (!pairs.has(card.districts.join("|"))) issue(`card ${card.id}: not a declared pair`);
      }
    }
  });

export type Content = z.infer<typeof ContentSchema>;
export type District = Content["districts"][number];
export type Card = Content["cards"][number];
export type CardKind = Card["kind"];
export type ActionType = (typeof ACTIONS)[number];

/** Validates raw JSON (already parsed) as game content. Never throws. */
export function parseContent(json: unknown): Result<Content> {
  const parsed = ContentSchema.safeParse(json);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, error: z.prettifyError(parsed.error) };
}

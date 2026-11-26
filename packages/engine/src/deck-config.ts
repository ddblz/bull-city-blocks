import type { Content } from "./content";
import type { Result } from "./result";
import type { RuleSet } from "./ruleset";

/**
 * SPEC §5 deck overrides: returns the content with the ruleset's card counts, card values and
 * rent ladders applied. Every key must name a real card or district. Never throws.
 */
export function applyDeckConfig(content: Content, rules: RuleSet): Result<Content> {
  const { counts, values, rent } = rules.deck;
  const cards = new Map(content.cards.map((c) => [c.id, c]));
  const districts = new Map(content.districts.map((d) => [d.id, d]));
  const fail = (error: string): Result<Content> => ({ ok: false, error });

  for (const id of Object.keys(counts)) {
    const card = cards.get(id);
    if (card === undefined) return fail(`deck.counts: unknown card "${id}"`);
    if (card.kind === "property")
      return fail(`deck.counts: "${id}" is a property; its count can't change`);
  }
  for (const id of Object.keys(values)) {
    if (!cards.has(id)) return fail(`deck.values: unknown card "${id}"`);
  }
  for (const [id, ladder] of Object.entries(rent)) {
    const district = districts.get(id);
    if (district === undefined) return fail(`deck.rent: unknown district "${id}"`);
    if (ladder.length !== district.setSize) {
      return fail(`deck.rent: "${id}" needs ${district.setSize} rent steps, got ${ladder.length}`);
    }
  }

  return {
    ok: true,
    value: {
      ...content,
      districts: content.districts.map((d) => ({ ...d, rent: rent[d.id] ?? d.rent })),
      cards: content.cards.map((c) => ({
        ...c,
        count: counts[c.id] ?? c.count,
        value: values[c.id] ?? c.value,
      })),
    },
  };
}

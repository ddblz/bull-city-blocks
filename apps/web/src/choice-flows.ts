import type { Move, View } from "./types";

/** The fields a multi-step move is built from, in the order the player is asked for them. */
export const FIELDS = ["target", "district", "take", "give", "hike"] as const;
export type Field = (typeof FIELDS)[number];
/** What the player has chosen so far; `null` means "leave this field out" (e.g. no Rent Hike). */
export type Picked = Partial<Record<Field, string | null>>;

export type Step =
  | { kind: "choose"; field: Field; options: (string | null)[] }
  | { kind: "done"; move: Move }
  | { kind: "none" };

const fieldOf = (move: Move, field: Field): string | null =>
  ((move as Partial<Record<Field, string>>)[field] ?? null) as string | null;

/**
 * The next step in building one of `candidates` (the legal moves for one card). Each step offers
 * only values that some remaining legal move has, so every finished move is in `legalMoves`.
 */
export function nextStep(candidates: readonly Move[], picked: Picked): Step {
  const left = candidates.filter((m) =>
    Object.entries(picked).every(([f, v]) => fieldOf(m, f as Field) === v),
  );
  const [first] = left;
  if (first === undefined) return { kind: "none" };
  for (const field of FIELDS) {
    if (field in picked) continue;
    const options = [...new Set(left.map((m) => fieldOf(m, field)))];
    if (options.length > 1) return { kind: "choose", field, options };
  }
  return { kind: "done", move: first };
}

/** The question asked for each field. */
export const PROMPT: Record<Field, string> = {
  target: "Which player?",
  district: "Which district?",
  take: "Take which card?",
  give: "Give which of yours?",
  hike: "Add a Rent Hike? (uses another play)",
};

/** SPEC §3.4: the cards picked toward a debt, their total, and the payment move to send. */
export function payment(selected: readonly string[], payable: readonly string[], view: View) {
  const cards = selected.filter((c) => payable.includes(c));
  const total = cards.reduce((n, c) => n + (view.cards[c]?.value ?? 0), 0);
  const step = view.pending[0];
  const debt = step?.type === "debt" ? step.amount : 0;
  const move: Move | null =
    cards.length > 0 && step?.type === "debt" ? { type: "pay", player: step.debtor, cards } : null;
  return { cards, total, debt, short: total < debt, move };
}

/** §3.6: where an Appeal chain stands, for the player being asked to respond. */
export function appealChain(view: View) {
  const step = view.pending[0];
  if (step?.type !== "response") return null;
  // Appeals alternate: an even count means the action stands if accepted, odd means it's cancelled.
  return { ...step, cancelsIfAccepted: step.appeals % 2 === 1 };
}

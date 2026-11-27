import type { Card, PropertySet, View } from "./types";

type Districts = Pick<View, "districts">;

const KIND: Record<Card["kind"], string> = {
  property: "Property",
  wild: "Wild",
  landmark: "Landmark",
  icon: "Icon",
  cash: "Cash",
  action: "Action",
  rent: "Rent",
};

export const districtName = (id: string, view: Districts) => view.districts[id]?.name ?? id;

const pairName = (ds: readonly string[] | "any", view: Districts) =>
  ds === "any" ? "any district" : ds.map((d) => districtName(d, view)).join(" / ");

/** One line describing a card: name, kind (with its districts) and value. */
export function cardLabel(card: Card, view: Districts): string {
  const value = `$${card.value}`;
  switch (card.kind) {
    case "property":
      return `${card.name} · ${districtName(card.district, view)} · ${value}`;
    case "wild":
      return `${card.name} · Wild for ${pairName(card.districts, view)} · ${value}`;
    case "rent":
      return `${card.name} · Rent for ${pairName(card.districts, view)} · ${value}`;
    case "cash":
      return `${card.name} · Cash`;
    default:
      return `${card.name} · ${KIND[card.kind]} · ${value}`;
  }
}

/** The label for a card instance, or a placeholder for one this player can't see. */
export const instanceLabel = (id: string, view: View) => {
  const card = view.cards[id];
  return card ? cardLabel(card, view) : "Hidden card";
};

/** SPEC §3.5: a set is complete at its set size with at least one property card. */
export function isComplete(set: PropertySet, view: View): boolean {
  const size = view.districts[set.district]?.setSize ?? Number.POSITIVE_INFINITY;
  return set.cards.length >= size && set.cards.some((c) => view.cards[c]?.kind === "property");
}

/** Total value of visible cards. */
export const totalValue = (cards: readonly string[], view: View) =>
  cards.reduce((n, c) => n + (view.cards[c]?.value ?? 0), 0);

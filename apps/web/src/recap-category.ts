import type { GameEvent } from "./describe-event";

/** What an event did to the viewer, for the recap's tags (#61). */
export type Category = "taken" | "received" | "paid" | "rent" | "delay" | "appeal";

/** The tag for each category: a word and an icon, so colour is never the only signal. */
export const CATEGORY: Record<Category, { label: string; icon: string }> = {
  taken: { label: "Property taken", icon: "−" },
  received: { label: "Payment received", icon: "+" },
  paid: { label: "Payment made", icon: "→" },
  rent: { label: "Rent charged", icon: "$" },
  delay: { label: "Delay", icon: "⏸" },
  appeal: { label: "Appeal", icon: "↩" },
};

/** The category of an event that affected `viewer`, or null when it didn't fit one (see `affects`). */
export function categorize(event: GameEvent, viewer: string): Category | null {
  switch (event.type) {
    case "paid":
      if (event.debtor === viewer) return "paid";
      return event.creditor === viewer ? "received" : null;
    case "rentCharged":
      return event.debtors.includes(viewer) ? "rent" : null;
    case "actionResolved": {
      if (event.cancelled || event.target !== viewer) return null;
      const { kind } = event.effect;
      if (kind === "delay") return "delay";
      return kind === "debt" ? "rent" : "taken";
    }
    case "responded":
      return event.appeal && event.player !== viewer ? "appeal" : null;
    default:
      return null;
  }
}

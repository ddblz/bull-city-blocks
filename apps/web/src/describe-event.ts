import type { Card, HistoryEntry } from "./types";

export type GameEvent = HistoryEntry["event"];

/** What describing an event needs: who is reading, and names for players, cards and districts. */
export interface Context {
  viewer: string;
  playerName: (id: string) => string;
  /** A card definition by instance id, if this player has ever seen it. */
  card: (id: string) => Card | undefined;
  districtName: (id: string) => string;
}

/** The name of a card instance (`<card id>:<copy>:<n>`), falling back to its card id. */
export function cardName(id: string, ctx: Context): string {
  const def = ctx.card(id);
  if (def) return def.name;
  const base = id.split(":")[0] ?? id;
  return base.replace(
    /(^|-)(\w)/g,
    (_, dash: string, c: string) => (dash ? " " : "") + c.toUpperCase(),
  );
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? "nobody")
    : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;

/**
 * One plain sentence for an event, written for `ctx.viewer` (#41). Uses only what the event
 * says publicly: drawn cards are counted, never named.
 */
export function describeEvent(event: GameEvent, ctx: Context): string {
  const who = (p: string) => (p === ctx.viewer ? "you" : ctx.playerName(p));
  const whose = (p: string) => (p === ctx.viewer ? "your" : `${ctx.playerName(p)}'s`);
  const card = (id: string) => cardName(id, ctx);
  const value = (ids: string[]) => ids.reduce((n, c) => n + (ctx.card(c)?.value ?? 0), 0);
  const district = ctx.districtName;
  return capital(sentence());

  function sentence(): string {
    switch (event.type) {
      case "turnStarted":
        return `${whose(event.player)} turn ${event.turn} started (round ${event.round})`;
      case "cardsDrawn":
        return `${who(event.player)} drew ${event.count} card${event.count === 1 ? "" : "s"}`;
      case "deckReshuffled":
        return `the discard pile was reshuffled into the deck (${event.cards} cards)`;
      case "propertyPlayed": {
        const def = ctx.card(event.card);
        const where = def?.kind === "property" ? ` to ${district(def.district)}` : "";
        return `${who(event.player)} played ${card(event.card)}${where}`;
      }
      case "banked":
        return `${who(event.player)} banked ${card(event.card)}`;
      case "upgradePlayed":
        return `${who(event.player)} put ${card(event.card)} on ${district(event.district)}`;
      case "wildMoved":
        return `${who(event.player)} moved ${card(event.card)} to ${district(event.district)}`;
      case "discarded":
        return `${who(event.player)} discarded ${card(event.card)}`;
      case "rentCharged":
        return `${who(event.player)} charged $${event.amount} rent on ${district(event.district)} to ${list(event.debtors.map(who))}`;
      case "actionPlayed":
        return event.target
          ? `${who(event.player)} played ${card(event.card)} on ${who(event.target)}`
          : `${who(event.player)} played ${card(event.card)}`;
      case "paid": {
        const names = event.cards.map(card).join(", ");
        return `${who(event.debtor)} paid ${who(event.creditor)} $${value(event.cards)} (${names})`;
      }
      case "debtSettled":
        return event.forgiven > 0
          ? `${who(event.debtor)} ran out of cards; the last $${event.forgiven} owed to ${who(event.creditor)} is forgiven`
          : `${who(event.debtor)} settled up with ${who(event.creditor)}`;
      case "autoResolved":
        return event.kind === "pay"
          ? `auto-pay paid for ${who(event.player)}: the debt was at least everything on the table`
          : `auto-pass answered for ${who(event.player)} (no Appeal in hand)`;
      case "responded":
        return event.appeal
          ? `${who(event.player)} played an Appeal`
          : `${who(event.player)} accepted`;
      case "actionResolved":
        return resolved(event);
      case "prefSet":
        return `${who(event.player)} turned auto-pass ${event.autoPass ? "on" : "off"}`;
      case "gameOver":
        return event.result === "stall"
          ? "the game stalled at the round limit; nobody won"
          : `${who(event.result)} won the game!`;
    }
  }

  function resolved(e: Extract<GameEvent, { type: "actionResolved" }>): string {
    const action = `${whose(e.attacker)} ${card(e.card)}`;
    if (e.cancelled) return `${action} on ${who(e.target)} was cancelled by Appeal`;
    const { effect } = e;
    switch (effect.kind) {
      case "debt":
        return `${action} stands: ${who(e.target)} owe${e.target === ctx.viewer ? "" : "s"} $${effect.amount}`;
      case "delay":
        return `${action} stands: ${who(e.target)} will draw only 1 card next turn`;
      case "buyout":
        return `${who(e.attacker)} bought ${card(effect.take)} from ${who(e.target)}`;
      case "swap":
        return `${who(e.attacker)} swapped ${card(effect.give)} for ${whose(e.target)} ${card(effect.take)}`;
      case "takeover":
        return `${who(e.attacker)} took ${whose(e.target)} ${district(effect.district)} set`;
    }
  }
}

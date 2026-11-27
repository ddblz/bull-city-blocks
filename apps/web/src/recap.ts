import { isComplete } from "./card";
import { type Context, cardName, describeEvent, type GameEvent } from "./describe-event";
import type { HistoryEntry, View } from "./types";

export interface RecapItem {
  seq: number;
  text: string;
  /** The event touched the viewer: something taken, a payment, rent, a delay or an Appeal. */
  affected: boolean;
}
export interface RecapGroup {
  turn: number;
  /** Whose turn it was, if the entries say. */
  player: string | null;
  items: RecapItem[];
}
export interface Recap {
  summary: string;
  groups: RecapGroup[];
}

/** Whether an event, on its own, affected `viewer` (#41). Appeals need context: see buildRecap. */
export function affects(event: GameEvent, viewer: string): boolean {
  switch (event.type) {
    case "paid":
      return event.debtor === viewer || event.creditor === viewer;
    case "debtSettled":
      return event.forgiven > 0 && (event.debtor === viewer || event.creditor === viewer);
    case "rentCharged":
      return event.debtors.includes(viewer);
    case "actionPlayed":
      return event.target === viewer;
    case "actionResolved":
      return event.target === viewer || event.attacker === viewer;
    case "autoResolved":
      return event.player === viewer;
    case "gameOver":
      return true;
    default:
      return false;
  }
}

/**
 * The recap of everything since the viewer's last move (#41): the entries grouped by player
 * turn (a new group at each turnStarted), the events that touched the viewer marked, and a
 * one-line summary on top.
 */
export function buildRecap(entries: readonly HistoryEntry[], ctx: Context, view: View): Recap {
  const { viewer } = ctx;
  const groups: RecapGroup[] = [];
  // An Appeal by someone else affects you when its chain was about your action or you.
  let chainInvolvesViewer = false;
  const flags = new Map<number, boolean>();
  for (const { seq, event } of [...entries].reverse()) {
    if (event.type === "actionResolved")
      chainInvolvesViewer = event.attacker === viewer || event.target === viewer;
    const appeal = event.type === "responded" && event.appeal && event.player !== viewer;
    flags.set(seq, affects(event, viewer) || (appeal && chainInvolvesViewer));
  }
  const first = openingTurn(entries, view);
  for (const entry of entries) {
    const { event } = entry;
    if (event.type === "turnStarted" || groups.length === 0) {
      groups.push({
        turn: event.type === "turnStarted" ? event.turn : first.turn,
        player: event.type === "turnStarted" ? event.player : first.player,
        items: [],
      });
    }
    const group = groups.at(-1) as RecapGroup;
    group.items.push({
      seq: entry.seq,
      text: describeEvent(event, ctx),
      affected: flags.get(entry.seq) ?? false,
    });
  }
  return { summary: summarize(entries, groups, ctx, view), groups };
}

/**
 * The turn the recap opens in, which started before it: the turn before the first one that
 * starts inside it, played by the player before that turn's player (turns go in seat order).
 */
function openingTurn(entries: readonly HistoryEntry[], view: View) {
  const next = entries.find((e) => e.event.type === "turnStarted")?.event;
  if (next?.type !== "turnStarted") return { turn: view.turn, player: view.currentPlayer };
  const i = view.players.findIndex((p) => p.id === next.player);
  const n = view.players.length;
  return { turn: next.turn - 1, player: view.players[(i - 1 + n) % n]?.id ?? null };
}

/** e.g. "3 turns since you played · you lost Erwin Rd · Alex now has 2 of 3 complete districts". */
export function summarize(
  entries: readonly HistoryEntry[],
  groups: readonly RecapGroup[],
  ctx: Context,
  view: View,
): string {
  const { viewer } = ctx;
  // Other players' turns you sat through, including the one your last move started.
  const turns = groups.filter((g) => g.player !== null && g.player !== viewer).length;
  const lost: string[] = [];
  let received = 0;
  for (const { event: e } of entries) {
    if (e.type === "paid" && e.debtor === viewer)
      lost.push(...e.cards.map((c) => cardName(c, ctx)));
    if (e.type === "paid" && e.creditor === viewer)
      received += e.cards.reduce((n, c) => n + (ctx.card(c)?.value ?? 0), 0);
    if (e.type === "actionResolved" && !e.cancelled && e.target === viewer) {
      const { effect } = e;
      if (effect.kind === "buyout" || effect.kind === "swap") lost.push(cardName(effect.take, ctx));
      if (effect.kind === "takeover") lost.push(`your ${ctx.districtName(effect.district)} set`);
    }
  }
  const parts = [
    turns === 0
      ? "Since your last move"
      : `${turns} turn${turns === 1 ? "" : "s"} since you played`,
  ];
  if (lost.length) parts.push(`you lost ${lost.join(", ")}`);
  if (received) parts.push(`you received $${received}`);
  const toWin = view.rules.districtsToWin;
  const leaders = view.players
    .filter((p) => p.id !== viewer)
    .map((p) => ({
      p,
      n: new Set(p.tableau.filter((s) => isComplete(s, view)).map((s) => s.district)).size,
    }))
    .filter(({ n }) => n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  for (const { p, n } of leaders)
    parts.push(`${ctx.playerName(p.id)} now has ${n} of ${toWin} complete districts`);
  return parts.join(" · ");
}

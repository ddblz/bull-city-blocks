import { districtColor } from "./district-colors";
import { bankSummary, setSummary } from "./stack-summary";
import type { PropertySet, View } from "./types";

/** A fan of overlapped cards in one colour: the picture of a set or a pile of cash (#79). */
export function Fan(props: { tiles: number; color: string }) {
  return (
    <span className="fan" aria-hidden="true">
      {[...Array(props.tiles).keys()].map((i) => (
        <span key={i} className="fan-card" style={{ background: props.color }} />
      ))}
    </span>
  );
}

/** One of your sets, stacked: a tap opens the whole set (every card, with its buttons). */
export function SetStack(props: { set: PropertySet; view: View; onOpen: () => void }) {
  const s = setSummary(props.set, props.view);
  return (
    <li>
      <button
        type="button"
        className={s.full ? "stack is-full" : "stack"}
        aria-label={`${s.name}, ${s.full ? "complete" : s.label}, rent $${s.rent}. Show the cards`}
        onClick={props.onOpen}
      >
        <Fan tiles={s.tiles} color={s.color} />
        <span className="stack-name">{s.name}</span>
        <span className="stack-meta">
          {s.label} · ${s.rent}
          {s.landmark && " ★"}
          {s.icon && " ◆"}
        </span>
      </button>
    </li>
  );
}

/** Your bank, stacked: the total and the count, and every card on a tap. */
export function BankStack(props: { bank: readonly string[]; view: View; onOpen: () => void }) {
  const b = bankSummary(props.bank, props.view);
  return (
    <button
      type="button"
      className="stack"
      aria-label={`Bank, $${b.total}, ${b.count} cards. Show the cards`}
      onClick={props.onOpen}
    >
      <Fan tiles={b.tiles} color="var(--tertiary)" />
      <span className="stack-name">Bank ${b.total}</span>
      <span className="stack-meta">
        {b.count} card{b.count === 1 ? "" : "s"}
      </span>
    </button>
  );
}

/** A small stack of an opponent's set, with its progress. */
export function MiniSet(props: { set: PropertySet; view: View }) {
  const s = setSummary(props.set, props.view);
  return (
    <span className={s.full ? "mini-set is-full" : "mini-set"}>
      <Fan tiles={s.tiles} color={districtColor(props.set.district)} />
      {s.label}
    </span>
  );
}

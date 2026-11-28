import { useState } from "react";
import { Face } from "./Cards";
import { districtName, totalValue } from "./card";
import { districtColor } from "./district-colors";
import { MiniSet } from "./Stacks";
import { districtsDone, setStatus } from "./table-summary";
import type { View } from "./types";

type Seat = View["players"][number];
interface Shared {
  view: View;
  nameOf: (player: string) => string;
  /** The player the game is waiting on. */
  awaited: string | null;
}

/** Opponents (#58): trays of what's public. On a phone (#59) the Table view shows a strip of chips instead. */
export function Opponents(props: Shared) {
  const { view } = props;
  const [peek, setPeek] = useState<string | null>(null);
  const others = view.players.filter((p) => p.id !== view.viewer);
  const peeked = others.find((p) => p.id === peek);
  return (
    <>
      <ul className="strip" aria-label="Opponents">
        {others.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={props.awaited === p.id ? "strip-chip is-awaited" : "strip-chip"}
              aria-expanded={peek === p.id}
              onClick={() => setPeek(peek === p.id ? null : p.id)}
            >
              <strong>{props.nameOf(p.id)}</strong>
              <span>
                {p.handCount} in hand · ${totalValue(p.bank, view)} · {districtsDone(p, view)}/
                {view.rules.districtsToWin} sets
              </span>
              <span className="mini-sets">
                {p.tableau.map((set) => (
                  <MiniSet key={set.cards[0] ?? set.district} set={set} view={view} />
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {peeked && (
        <ul className="peek">
          <Tray p={peeked} {...props} />
        </ul>
      )}
      <ul className="trays" aria-label="Opponents' trays">
        {others.map((p) => (
          <Tray key={p.id} p={p} {...props} />
        ))}
      </ul>
    </>
  );
}

function Tray({ p, view, nameOf, awaited: awaitedId }: Shared & { p: Seat }) {
  const awaited = awaitedId === p.id;
  const cards = [
    ...p.bank,
    ...p.tableau.flatMap((s) => [
      ...s.cards,
      ...(s.landmark ? [s.landmark] : []),
      ...(s.icon ? [s.icon] : []),
    ]),
  ];
  return (
    <li className={awaited ? "tray is-awaited" : "tray"}>
      <div className="tray__head">
        <strong>{nameOf(p.id)}</strong>
        {awaited && <span className="tag">their move</span>}
        {p.delayed && <span className="tag">delayed</span>}
      </div>
      <p className="tray__stats">
        <span>{p.handCount} in hand</span>
        <span>${totalValue(p.bank, view)} bank</span>
        <span>
          {districtsDone(p, view)}/{view.rules.districtsToWin} districts
        </span>
      </p>
      <ul className="chips">
        {p.tableau.map((set) => {
          const { full, label } = setStatus(set, view);
          return (
            <li key={set.cards[0] ?? set.district} className={full ? "chip is-full" : "chip"}>
              <span
                className="dot"
                style={{ background: districtColor(set.district) }}
                aria-hidden="true"
              />
              {districtName(set.district, view)} {label}
            </li>
          );
        })}
      </ul>
      {cards.length > 0 && (
        <details>
          <summary>Their cards</summary>
          <ul className="cards faces">
            {cards.map((id) => (
              <li key={id}>
                <Face id={id} view={view} compact />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

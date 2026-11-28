import { Face } from "./Cards";
import { districtName, totalValue } from "./card";
import { districtColor } from "./district-colors";
import { districtsDone, setStatus } from "./table-summary";
import type { View } from "./types";

/** Opponents as trays (#58): only what's public. Hands are counts; their cards open on request. */
export function Opponents(props: {
  view: View;
  nameOf: (player: string) => string;
  /** The player the game is waiting on. */
  awaited: string | null;
}) {
  const { view } = props;
  return (
    <ul className="trays" aria-label="Opponents">
      {view.players
        .filter((p) => p.id !== view.viewer)
        .map((p) => {
          const awaited = props.awaited === p.id;
          const cards = [
            ...p.bank,
            ...p.tableau.flatMap((s) => [
              ...s.cards,
              ...(s.landmark ? [s.landmark] : []),
              ...(s.icon ? [s.icon] : []),
            ]),
          ];
          return (
            <li key={p.id} className={awaited ? "tray is-awaited" : "tray"}>
              <div className="tray__head">
                <strong>{props.nameOf(p.id)}</strong>
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
                    <li
                      key={set.cards[0] ?? set.district}
                      className={full ? "chip is-full" : "chip"}
                    >
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
        })}
    </ul>
  );
}

import type { ReactNode } from "react";
import { Face, MoveButton } from "./Cards";
import type { MoveGroups } from "./move-groups";
import { handColumns } from "./table-summary";
import type { Move, View } from "./types";

/** Your hand (#58): cards overlap and open on hover or focus. Pick one to see its moves in the bar below. */
export function Hand(props: {
  ids: readonly string[];
  view: View;
  groups: MoveGroups;
  selected: string | null;
  /** The card whose multi-step move is being chosen. */
  open: string | null;
  onSelect: (id: string) => void;
  onPlay: (m: Move) => void;
  /** The "Play as…", "Charge rent" … button for a card, if it has choices to make. */
  flowButton: (id: string) => ReactNode;
  /** End turn sits with the card's moves, so on a phone one bar holds every action. */
  endTurn?: ReactNode;
}) {
  const { groups, selected } = props;
  const moves = selected ? groups.hand[selected] : undefined;
  const discard = selected ? groups.discard[selected] : undefined;
  const flow = selected ? props.flowButton(selected) : null;
  return (
    <section className="hand" aria-labelledby="hand-h">
      <h2 id="hand-h">Your hand ({props.ids.length})</h2>
      <ul className="hand-fan" style={{ gridTemplateColumns: handColumns(props.ids.length) }}>
        {props.ids.map((id) => (
          <li key={id} className={selected === id ? "is-selected" : undefined}>
            <button
              type="button"
              className="card-select"
              aria-pressed={selected === id}
              onClick={() => props.onSelect(id)}
            >
              <Face id={id} view={props.view} selected={selected === id || props.open === id} />
            </button>
          </li>
        ))}
      </ul>
      <section className="hand-actions" aria-label="Moves for the selected card">
        {selected === null && <p className="status">Select a card to play, bank or discard it.</p>}
        {moves?.play && <MoveButton move={moves.play} label="Play" onPlay={props.onPlay} />}
        {flow}
        {moves?.bank && <MoveButton move={moves.bank} label="Bank" onPlay={props.onPlay} />}
        {discard && <MoveButton move={discard} label="Discard" onPlay={props.onPlay} />}
        {selected !== null && !moves && !discard && !flow && (
          <p className="status">No moves for this card right now.</p>
        )}
        {props.endTurn}
      </section>
    </section>
  );
}

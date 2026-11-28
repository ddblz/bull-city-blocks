import { useEffect, useState } from "react";
import { instanceLabel } from "./card";
import { playPips } from "./table-summary";
import type { StateMessage } from "./types";

/** Counts down from the seconds the server sent with this state, as a ring with the seconds in it. */
function Clock({ game }: { game: StateMessage }) {
  const total = game.clockSeconds;
  const [left, setLeft] = useState(total);
  useEffect(() => {
    if (total === null || !game) {
      setLeft(null);
      return;
    }
    const end = Date.now() + total * 1000;
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [total, game]);
  if (left === null || total === null) return null;
  return (
    <span className="clock" role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className="ring-track" cx="18" cy="18" r="15.9" />
        <circle
          className="ring"
          cx="18"
          cy="18"
          r="15.9"
          pathLength="100"
          strokeDasharray={`${(100 * left) / total} 100`}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <span>{left}s</span>
    </span>
  );
}

/** The bar across the top: turn, plays left, the piles, the clock, and the way back to the recap. */
export function TableBar(props: {
  game: StateMessage;
  status: string;
  updates: number;
  onUpdates?: (() => void) | undefined;
  onMap: () => void;
}) {
  const { view } = props.game;
  const pips = playPips(view);
  const top = view.discard.at(-1);
  return (
    <header className="table-bar">
      <span className="chip">
        Turn {view.turn}
        <span className="wide"> · Round {view.round}</span>
      </span>
      {pips && (
        <span className="chip pips">
          {[...Array(pips.total).keys()].map((n) => (
            <span key={n} className={n < pips.used ? "pip used" : "pip"} aria-hidden="true" />
          ))}{" "}
          <span className="wide">
            {pips.left} of {pips.total} plays left
          </span>
          <span className="short">{pips.left} left</span>
        </span>
      )}
      <span className="chip">Deck {view.deckCount}</span>
      <span className="chip">
        <span className="wide">Discard {top ? instanceLabel(top, view) : "empty"}</span>
        <span className="short">Discard {view.discard.length}</span>
      </span>
      <Clock game={props.game} />
      <button type="button" className="map-btn" onClick={props.onMap}>
        Neighborhoods
      </button>
      {props.onUpdates && (
        <button type="button" onClick={props.onUpdates}>
          Updates{props.updates > 0 && <span className="badge">{props.updates}</span>}
        </button>
      )}
      <p className="status-line">{props.status}</p>
    </header>
  );
}

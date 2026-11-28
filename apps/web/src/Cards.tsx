import { CardFace } from "./CardFace";
import { instanceLabel } from "./card";
import type { Move, View } from "./types";

/** A card instance as a face, or its text label for one this player can't see. */
export function Face(props: {
  id: string;
  view: View;
  compact?: boolean;
  selected?: boolean;
  complete?: boolean;
}) {
  const card = props.view.cards[props.id];
  if (!card) return <span className="card">{instanceLabel(props.id, props.view)}</span>;
  return (
    <CardFace
      card={card}
      view={props.view}
      compact={props.compact ?? false}
      selected={props.selected ?? false}
      complete={props.complete ?? false}
    />
  );
}

/** A button that sends one legal move. */
export function MoveButton(props: {
  move: Move;
  label: string;
  onPlay: (m: Move) => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={props.primary ? "primary" : undefined}
      onClick={() => props.onPlay(props.move)}
    >
      {props.label}
    </button>
  );
}

import "./card-face.css";
import { faceModel } from "./card-face";
import { ICON_PATHS } from "./card-icons";
import type { Card, View } from "./types";

interface Props {
  card: Card;
  view: Pick<View, "districts" | "rules">;
  /** A small card for banks, sets and opponents: no effect text. */
  compact?: boolean;
  /** Lifted and tilted: the card whose move is being chosen. */
  selected?: boolean;
  /** In a complete set. */
  complete?: boolean;
}

/** A card's face (#57): a 5:7 card with its district band, value badge, name, rent ladder or effect. */
export function CardFace({
  card,
  view,
  compact = false,
  selected = false,
  complete = false,
}: Props) {
  const m = faceModel(card, view);
  const bandStyle =
    m.band.length > 1
      ? undefined
      : m.band[0] && { background: m.band[0].background, color: m.band[0].color };
  return (
    <div
      className={`card-face card-face--${m.kind}${compact ? " card-face--compact" : ""}${selected ? " is-selected" : ""}${complete ? " is-complete" : ""}`}
      role="img"
      aria-label={m.description}
    >
      <div className="card-face__band" style={bandStyle} aria-hidden="true">
        {m.band.length > 1
          ? m.band.map((b) => (
              <span
                key={b.text}
                className="card-face__half"
                style={{ background: b.background, color: b.color }}
              >
                {b.text}
              </span>
            ))
          : (m.band[0]?.text ?? m.bandText)}
      </div>
      <span className="card-face__value" aria-hidden="true">
        {m.value}
      </span>
      <div className="card-face__body" aria-hidden="true">
        <svg
          className="card-face__icon"
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={ICON_PATHS[m.icon]} />
        </svg>
        <span className="card-face__name">{m.kind === "cash" ? m.value : m.name}</span>
        {!compact &&
          m.lines.map((line) => (
            <span key={line} className="card-face__line">
              {line}
            </span>
          ))}
      </div>
      {m.kind === "action" && <span className="card-face__ribbon" aria-hidden="true" />}
    </div>
  );
}

import type { CSSProperties } from "react";
import { districtName } from "./card";
import { Dialog } from "./Dialog";
import { districtColor, districtText } from "./district-colors";
import { districtHolders, type Holder, holderText, MAP_SIZE, TILES } from "./map-data";
import type { View } from "./types";

const short = (name: string) => (name.length > 10 ? `${name.slice(0, 9)}…` : name);
const MAX_LINES = 3;
/** A long district name goes on two lines, split at its last space. */
const nameLines = (name: string) => {
  const cut = name.length > 12 ? name.lastIndexOf(" ") : -1;
  return cut > 0 ? [name.slice(0, cut), name.slice(cut + 1)] : [name];
};

/** "Neighborhoods" (#62): who is winning which district, from public tableaux only. */
export function MapPanel(props: {
  view: View;
  nameOf: (player: string) => string;
  onClose: () => void;
}) {
  const { view, nameOf } = props;
  const holders = districtHolders(view);
  const line = (h: Holder, name: (p: string) => string) => holderText(h, name(h.player));
  return (
    <Dialog label="Neighborhoods" onClose={props.onClose}>
      <section className="map-panel">
        <h2>Neighborhoods</h2>
        <svg
          className="durham-map"
          viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`}
          role="img"
          aria-label="Schematic map of the 14 districts and who holds each. The text version is below."
        >
          {TILES.map((t) => {
            const list = holders[t.id] ?? [];
            const owner = list.find((h) => h.full);
            const partial = list.filter((h) => !h.full);
            const lines = owner
              ? [
                  line(owner, (p) => short(nameOf(p))),
                  ...(partial.length ? [`${partial.length} partial`] : []),
                ]
              : partial.length > MAX_LINES
                ? [
                    ...partial.slice(0, MAX_LINES - 1).map((h) => line(h, (p) => short(nameOf(p)))),
                    `+${partial.length - MAX_LINES + 1} more`,
                  ]
                : partial.map((h) => line(h, (p) => short(nameOf(p))));
            const title = nameLines(districtName(t.id, view));
            const style = {
              "--d": districtColor(t.id),
              "--on-d": districtText(t.id),
            } as CSSProperties;
            return (
              <g key={t.id} className={owner ? "tile is-filled" : "tile"} style={style}>
                <rect className="tile-bg" x={t.x} y={t.y} width={t.w} height={t.h} rx={6} />
                {title.map((text, i) => (
                  <text key={text} className="tile-name" x={t.x + 7} y={t.y + 15 + i * 12}>
                    {text}
                  </text>
                ))}
                {lines.map((text, i) => (
                  <text
                    key={text}
                    className="tile-line"
                    x={t.x + 7}
                    y={t.y + 32 + (title.length - 1) * 12 + i * 14}
                  >
                    {text}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
        <details>
          <summary>Text version</summary>
          <ul className="map-list">
            {TILES.map((t) => (
              <li key={t.id}>
                <strong>{districtName(t.id, view)}</strong>:{" "}
                {holders[t.id]?.map((h) => line(h, nameOf)).join(", ") ?? "nobody yet"}
              </li>
            ))}
          </ul>
        </details>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </section>
    </Dialog>
  );
}

import type { Context } from "./describe-event";
import { buildRecap } from "./recap";
import type { HistoryEntry, View } from "./types";

/** "Since your last move" (#41): what happened while you were away, grouped by turn. */
export function RecapPanel(props: {
  entries: HistoryEntry[];
  ctx: Context;
  view: View;
  onClose: () => void;
}) {
  const { summary, groups } = buildRecap(props.entries, props.ctx, props.view);
  const whose = (player: string | null) =>
    player === null
      ? ""
      : player === props.ctx.viewer
        ? " · your turn"
        : ` · ${props.ctx.playerName(player)}'s turn`;
  return (
    <section className="recap" aria-label="Since your last move">
      <p className="banner">{summary}</p>
      {groups.map((g) => (
        <div key={g.items[0]?.seq ?? g.turn}>
          <h3>
            Turn {g.turn}
            {whose(g.player)}
          </h3>
          <ul>
            {g.items.map((item) => (
              <li key={item.seq} className={item.affected ? "affected" : undefined}>
                {item.affected && <span className="tag">you</span>} {item.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button type="button" onClick={props.onClose}>
        Close
      </button>
    </section>
  );
}

import { Dialog } from "./Dialog";
import type { Context } from "./describe-event";
import { buildRecap } from "./recap";
import { CATEGORY } from "./recap-category";
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
    <Dialog label="Since your last move" onClose={props.onClose}>
      <section className="recap">
        <p className="banner">{summary}</p>
        {groups.map((g) => (
          <div key={g.items[0]?.seq ?? g.turn}>
            <h3>
              Turn {g.turn}
              {whose(g.player)}
            </h3>
            <ul>
              {g.items.map((item) => (
                <li
                  key={item.seq}
                  className={item.affected ? `affected ${item.category ?? ""}`.trim() : undefined}
                >
                  {item.affected && (
                    <span className="tag">
                      {item.category ? (
                        <>
                          <span aria-hidden="true">{CATEGORY[item.category].icon}</span>{" "}
                          {CATEGORY[item.category].label}
                        </>
                      ) : (
                        "you"
                      )}
                    </span>
                  )}{" "}
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </section>
    </Dialog>
  );
}

import type { RuleRow } from "./rules-summary";

/** The lobby's "Active match rules" (#60): the room's real rules, each row badged if it differs from base. */
export function RulesPanel(props: {
  rows: RuleRow[];
  ruleset: string;
  clock: boolean;
  /** Every difference from base, as lines (#39). */
  changes: string[];
}) {
  return (
    <section className="rules-panel" aria-labelledby="rules-h">
      <header>
        <h2 id="rules-h">Active match rules</h2>
        <span className="tag">{props.ruleset}</span>
      </header>
      <dl>
        {props.rows.map((r) => (
          <div key={r.label} className={r.differs ? "rule differs" : "rule"}>
            <dt>{r.label}</dt>
            <dd>
              {r.value}
              {r.differs && <span className="badge">differs from base</span>}
            </dd>
          </div>
        ))}
        <div className="rule">
          <dt>Clock</dt>
          <dd>{props.clock ? "On" : "Off"}</dd>
        </div>
      </dl>
      {props.changes.length > 0 && (
        <details open>
          <summary>
            {props.changes.length} difference{props.changes.length === 1 ? "" : "s"} from base
          </summary>
          <ul>
            {props.changes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

import { type Content, loadRuleset } from "@bull-city-blocks/engine";
import { useEffect, useState } from "react";
import {
  deckRows,
  exportVariant,
  type Field,
  fieldLabel,
  formFields,
  resolveRules,
  SECTIONS,
  setOverride,
  valueAt,
  withDeckDefaults,
} from "./config-form";

type Overrides = Record<string, unknown>;

/** What differs from base, for everyone, in the lobby and during the game (#39). */
export function RulesSummary({ lines, open }: { lines: string[]; open?: boolean }) {
  return (
    <details className="rules" open={open}>
      <summary>
        {lines.length
          ? `Rules: ${lines.length} difference${lines.length === 1 ? "" : "s"} from base`
          : "Rules: base"}
      </summary>
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </details>
  );
}

/**
 * The host's editor: every ruleset parameter (generated from RuleSetSchema), the deck table and
 * the rent ladders. Each edit is sent as room overrides; the room validates them with the loader
 * and its error is shown by the lobby. The draft keeps an invalid value visible until fixed.
 */
export function RulesEditor(props: {
  files: readonly unknown[];
  content: Content;
  ruleset: string;
  overrides: Overrides;
  onChange: (overrides: Overrides) => void;
}) {
  const [draft, setDraft] = useState(props.overrides);
  const [variant, setVariant] = useState({ id: "my-variant", description: "" });
  useEffect(() => setDraft(props.overrides), [props.overrides]);
  const parent = loadRuleset(props.ruleset, props.files);
  if (!parent.ok) return <p className="error">{parent.error}</p>;
  // The chosen ruleset, with every card's and district's deck settings filled in from the content.
  const defaults = withDeckDefaults(parent.value, props.content);
  const current = (path: string) => (path in draft ? draft[path] : valueAt(defaults, path));
  const edit = (path: string, value: unknown) => {
    const next = setOverride(draft, defaults, path, value);
    setDraft(next);
    props.onChange(next);
  };
  const resolved = resolveRules(props.files, props.ruleset, draft);
  const rows = deckRows(props.content, resolved.ok ? resolved.value : parent.value);
  const num = (path: string, label: string, disabled = false, min = 0) => (
    <input
      type="number"
      aria-label={label}
      min={min}
      disabled={disabled}
      value={String(current(path) ?? "")}
      onChange={(e) => edit(path, e.target.value === "" ? null : Number(e.target.value))}
    />
  );
  const input = (f: Field) => {
    const value = current(f.path);
    if (f.kind === "boolean")
      return (
        <input
          type="checkbox"
          aria-label={fieldLabel(f.path)}
          checked={value === true}
          onChange={(e) => edit(f.path, e.target.checked)}
        />
      );
    return (
      <>
        {num(f.path, fieldLabel(f.path), f.nullable && value === null, f.min)}
        {f.nullable && (
          <label>
            <input
              type="checkbox"
              checked={value === null}
              onChange={(e) => edit(f.path, e.target.checked ? null : 4)}
            />{" "}
            unlimited
          </label>
        )}
      </>
    );
  };
  const fields = formFields(parent.value);
  return (
    <section className="editor">
      {SECTIONS.map((section) => (
        <fieldset key={section}>
          <legend>{section}</legend>
          {fields
            .filter((f) => f.section === section)
            .map((f) => (
              <div key={f.path} className={f.path in draft ? "row changed" : "row"}>
                <span>{fieldLabel(f.path)}</span> {input(f)}
              </div>
            ))}
        </fieldset>
      ))}
      <details>
        <summary>Deck: card copies and values</summary>
        <table>
          <tbody>
            {rows.cards.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{c.kind}</td>
                <td>× {num(`deck.counts.${c.id}`, `${c.name} copies`, !c.countEditable)}</td>
                <td>$ {num(`deck.values.${c.id}`, `${c.name} value`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <details>
        <summary>District rent ladders</summary>
        {rows.districts.map((d) => (
          <div key={d.id} className="row">
            <span>{d.name}</span>{" "}
            {d.rent.map((step, i) => (
              <input
                // biome-ignore lint/suspicious/noArrayIndexKey: a ladder's steps are fixed by its set size
                key={i}
                type="number"
                aria-label={`${d.name} rent with ${i + 1} cards`}
                min={0}
                value={step}
                onChange={(e) => edit(`deck.rent.${d.id}`, d.rent.with(i, Number(e.target.value)))}
              />
            ))}
          </div>
        ))}
      </details>
      <button
        type="button"
        disabled={Object.keys(draft).length === 0}
        onClick={() => {
          setDraft({});
          props.onChange({});
        }}
      >
        Reset to {props.ruleset}
      </button>
      <details>
        <summary>Export as variant</summary>
        <label>
          Id{" "}
          <input
            value={variant.id}
            onChange={(e) => setVariant({ ...variant, id: e.target.value })}
          />
        </label>
        <label>
          Description{" "}
          <input
            value={variant.description}
            onChange={(e) => setVariant({ ...variant, description: e.target.value })}
          />
        </label>
        <textarea
          readOnly
          rows={8}
          value={exportVariant(variant.id, props.ruleset, draft, variant.description)}
        />
        <p className="status">
          Save as <code>rulesets/{variant.id}.json</code> in a variant PR, with a hypothesis and
          predictions. It still needs its sim report (<code>pnpm sim</code>, CLAUDE.md rule 7).
        </p>
      </details>
    </section>
  );
}

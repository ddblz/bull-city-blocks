import { useState } from "react";
import { cardLabel, districtName, instanceLabel } from "./card";
import { appealChain, type Field, nextStep, type Picked, PROMPT, payment } from "./choice-flows";
import type { Move, View } from "./types";

type Play = (move: Move) => void;

/** Builds a multi-step move for one card, offering only choices that lead to a legal move. */
export function Chooser(props: {
  card: string;
  candidates: Move[];
  view: View;
  nameOf: (player: string) => string;
  onPlay: Play;
  onClose: () => void;
}) {
  const { view } = props;
  const [picked, setPicked] = useState<Picked>({});
  const step = nextStep(props.candidates, picked);
  const label = (field: Field, value: string | null) => {
    if (field === "hike") return value === null ? "No" : "Yes, with Rent Hike";
    if (value === null) return "None";
    if (field === "target") return props.nameOf(value);
    if (field === "district") return districtName(value, view);
    return instanceLabel(value, view);
  };
  const choose = (field: Field, value: string | null) => {
    const next = { ...picked, [field]: value };
    const after = nextStep(props.candidates, next);
    if (after.kind === "done") {
      props.onPlay(after.move);
      props.onClose();
    } else setPicked(next);
  };
  return (
    <section className="chooser">
      <p className="banner">{instanceLabel(props.card, view)}</p>
      {step.kind === "choose" && (
        <>
          <p>{PROMPT[step.field]}</p>
          {step.options.map((value) => (
            <button key={value ?? "none"} type="button" onClick={() => choose(step.field, value)}>
              {label(step.field, value)}
            </button>
          ))}
        </>
      )}
      {Object.keys(picked).length > 0 && (
        <button type="button" onClick={() => setPicked({})}>
          Start over
        </button>
      )}
      <button type="button" onClick={props.onClose}>
        Cancel
      </button>
    </section>
  );
}

/** §3.4: pick any mix of bank and tableau cards toward the debt, with a running total. */
export function PaymentPanel(props: {
  payable: string[];
  view: View;
  nameOf: (p: string) => string;
  onPlay: Play;
}) {
  const { view } = props;
  const [selected, setSelected] = useState<string[]>([]);
  const pay = payment(selected, props.payable, view);
  const step = view.pending[0];
  const toggle = (card: string) =>
    setSelected((s) => (s.includes(card) ? s.filter((c) => c !== card) : [...s, card]));
  return (
    <section className="chooser">
      <p className="banner">
        You owe ${pay.debt}
        {step?.type === "debt" && ` to ${props.nameOf(step.creditor)}`}. Selected ${pay.total}
        {pay.short ? ` (short by $${pay.debt - pay.total})` : " (covers it; no change is given)"}
      </p>
      <ul className="cards">
        {props.payable.map((card) => (
          <li key={card} className="card">
            <label>
              <input
                type="checkbox"
                checked={selected.includes(card)}
                onChange={() => toggle(card)}
              />{" "}
              {instanceLabel(card, view)}
            </label>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="primary"
        disabled={pay.move === null}
        onClick={() => pay.move && props.onPlay(pay.move)}
      >
        Pay ${pay.total}
      </button>
    </section>
  );
}

/** §3.6: accept or Appeal, showing where the Appeal chain stands. */
export function ResponsePanel(props: {
  view: View;
  accept: Move;
  appeal?: Move | undefined;
  nameOf: (p: string) => string;
  onPlay: Play;
}) {
  const { view, nameOf } = props;
  const chain = appealChain(view);
  if (!chain) return null;
  const card = view.cards[chain.card];
  return (
    <section className="chooser">
      <p className="banner">
        {nameOf(chain.attacker)} played {card ? cardLabel(card, view) : "an action"} on{" "}
        {nameOf(chain.target)}.
      </p>
      <p>
        Appeals so far: {chain.appeals}. If you accept, the action{" "}
        {chain.cancelsIfAccepted ? "is cancelled" : "goes ahead"}.
      </p>
      <button type="button" className="primary" onClick={() => props.onPlay(props.accept)}>
        Accept
      </button>
      {props.appeal && (
        <button type="button" onClick={() => props.appeal && props.onPlay(props.appeal)}>
          Appeal
        </button>
      )}
    </section>
  );
}

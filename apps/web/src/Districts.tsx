import { type ReactNode, useState } from "react";
import { Face } from "./Cards";
import { districtName, totalValue } from "./card";
import { Dialog } from "./Dialog";
import { districtColor, districtText } from "./district-colors";
import { usePhone } from "./layout-mode";
import { BankStack, SetStack } from "./Stacks";
import { rentLine, setStatus } from "./table-summary";
import type { PropertySet, View } from "./types";

type Player = View["players"][number];

/** An open place for a Landmark or an Icon on a finished set. */
const slot = (label: string) => (
  <li key={label} className="slot">
    {label}
  </li>
);

function SetCard(props: { set: PropertySet; view: View; extra: (id: string) => ReactNode }) {
  const { set, view } = props;
  const { full, size, have, label } = setStatus(set, view);
  const slots = full && view.districts[set.district]?.upgradable !== false;
  const card = (id: string) => (
    <li key={id}>
      <Face id={id} view={view} compact complete={full} />
      <div className="card-actions">{props.extra(id)}</div>
    </li>
  );
  return (
    <li className={full ? "set-card is-full" : "set-card"}>
      <header
        style={{ background: districtColor(set.district), color: districtText(set.district) }}
      >
        <span>{districtName(set.district, view)}</span>
        <span className="progress">{label}</span>
      </header>
      <ul className="cards faces">
        {set.cards.map(card)}
        {slots && (set.landmark ? card(set.landmark) : slot("Landmark slot: open"))}
        {slots &&
          (set.icon
            ? card(set.icon)
            : slot(set.landmark ? "Icon slot: open" : "Icon slot: needs a Landmark"))}
      </ul>
      {!full && (
        <p className="status">
          {have >= size ? "Needs a property card" : `Needs ${size - have} more`}
        </p>
      )}
      <p className="rent">{rentLine(set, view)}</p>
    </li>
  );
}

/** Your districts (a grid of sets, with upgrade slots and rent) and your bank. `extra` adds a card's buttons. */
export function Districts(props: { player: Player; view: View; extra: (id: string) => ReactNode }) {
  const { player, view } = props;
  const phone = usePhone();
  // On a phone (#79) sets and the bank are stacks; a tap opens one in a sheet ("bank", or a set's first card).
  const [open, setOpen] = useState<string | null>(null);
  const openSet = player.tableau.find((s) => s.cards[0] === open);
  const set = (s: PropertySet) => (
    <SetCard key={s.cards[0] ?? s.district} set={s} view={view} extra={props.extra} />
  );
  const bank = (
    <ul className="cards faces">
      {player.bank.map((id) => (
        <li key={id}>
          <Face id={id} view={view} compact />
          <div className="card-actions">{props.extra(id)}</div>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="holdings">
      <section aria-labelledby="districts-h">
        <h3 id="districts-h">Your districts</h3>
        {player.tableau.length === 0 ? (
          <p className="status">Play a property to start a district.</p>
        ) : phone ? (
          <ul className="stacks">
            {player.tableau.map((s) => (
              <SetStack
                key={s.cards[0] ?? s.district}
                set={s}
                view={view}
                onOpen={() => setOpen(s.cards[0] ?? null)}
              />
            ))}
          </ul>
        ) : (
          <ul className="district-grid">{player.tableau.map(set)}</ul>
        )}
      </section>
      <section aria-labelledby="bank-h">
        <h3 id="bank-h">Your bank (${totalValue(player.bank, view)})</h3>
        {phone ? <BankStack bank={player.bank} view={view} onOpen={() => setOpen("bank")} /> : bank}
      </section>
      {phone && (openSet || open === "bank") && (
        <Dialog
          label={openSet ? districtName(openSet.district, view) : "Your bank"}
          onClose={() => setOpen(null)}
        >
          {openSet ? <ul className="district-grid">{set(openSet)}</ul> : bank}
          <button type="button" onClick={() => setOpen(null)}>
            Close
          </button>
        </Dialog>
      )}
    </div>
  );
}

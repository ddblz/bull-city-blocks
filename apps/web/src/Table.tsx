import type { ClientMessage, LobbyView } from "@bull-city-blocks/room";
import { type ReactNode, useEffect, useState } from "react";
import { Chooser, PaymentPanel, ResponsePanel } from "./Choices";
import { cardLabel, districtName, instanceLabel, isComplete, totalValue } from "./card";
import { nextStep } from "./choice-flows";
import type { ClientState } from "./lobby-state";
import { FLOW_LABEL, groupMoves } from "./move-groups";
import type { HistoryEntry, Move, PropertySet, StateMessage, View } from "./types";

interface Props {
  state: ClientState & { game: StateMessage; lobby: LobbyView };
  send: (msg: ClientMessage) => void;
}

/** The game table (#37, #38): the player's view, every move, the clock, the log and game over. */
export function Table({ state, send }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const { game, lobby, over } = state;
  const { view } = game;
  const nameOf = (player: string) => lobby.seats.find((s) => s.player === player)?.name ?? player;
  const seatName = (seat: number) => lobby.seats[seat]?.name ?? `Seat ${seat + 1}`;
  const play = (move: Move) => send({ type: "intent", move });
  const groups = groupMoves(game.legal);
  const me = view.players.find((p) => p.id === view.viewer);
  const others = view.players.filter((p) => p.id !== view.viewer);
  const top = view.discard.at(-1);
  const debt = view.pending[0]?.type === "debt" ? view.pending[0] : null;
  const chooser = open === null ? undefined : groups.flows[open];
  // Close the chooser once its card has no legal moves left (the turn moved on).
  useEffect(() => {
    if (open !== null && !chooser) setOpen(null);
  }, [open, chooser]);
  /** Starts a card's multi-step move; one with nothing to choose is sent straight away. */
  const flowButton = (id: string) => {
    const moves = groups.flows[id];
    const first = moves?.[0];
    if (!moves || !first) return null;
    const start = () => {
      const step = nextStep(moves, {});
      if (step.kind === "done") play(step.move);
      else setOpen(id);
    };
    return (
      <button type="button" onClick={start}>
        {FLOW_LABEL[first.type]}
      </button>
    );
  };

  if (over) {
    const winner = over.winner === "stall" ? null : seatName(over.winner);
    return (
      <section className="table">
        <h2>Game over</h2>
        <p className="banner">
          {winner ? `${winner} wins!` : "Stalled: nobody won before the round limit."}
        </p>
        <p>
          Seed <code>{over.seed}</code> · {over.moves.length} moves
        </p>
        <details>
          <summary>Move log</summary>
          <ol className="moves">
            {over.moves.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the move log never reorders
              <li key={i}>
                {nameOf(m.player)}: {m.type}
                {"card" in m ? ` ${m.card}` : ""}
              </li>
            ))}
          </ol>
        </details>
        <Log entries={state.log} nameOf={nameOf} seatName={seatName} />
      </section>
    );
  }

  return (
    <section className="table">
      <p className="banner">
        Turn {view.turn} · Round {view.round} ·{" "}
        {waitingText(game, view, state.seat, nameOf, seatName)}{" "}
        <Clock seconds={game.clockSeconds} game={game} />
      </p>
      <p className="status">
        Deck {view.deckCount} · Discard {top ? instanceLabel(top, view) : "empty"}
      </p>

      {me && (
        <div className="mine">
          <h2>Your hand ({me.hand?.length ?? 0})</h2>
          <ul className="cards">
            {(me.hand ?? []).map((id) => {
              const moves = groups.hand[id];
              const discard = groups.discard[id];
              return (
                <li key={id} className="card">
                  {instanceLabel(id, view)}
                  {moves?.play && <MoveButton move={moves.play} label="Play" onPlay={play} />}
                  {flowButton(id)}
                  {moves?.bank && <MoveButton move={moves.bank} label="Bank" onPlay={play} />}
                  {discard && <MoveButton move={discard} label="Discard" onPlay={play} />}
                </li>
              );
            })}
          </ul>
          {open && chooser && (
            <Chooser
              key={open}
              card={open}
              candidates={chooser}
              view={view}
              nameOf={nameOf}
              onPlay={play}
              onClose={() => setOpen(null)}
            />
          )}
          {groups.accept && (
            <ResponsePanel
              view={view}
              accept={groups.accept}
              appeal={groups.appeal}
              nameOf={nameOf}
              onPlay={play}
            />
          )}
          {debt && groups.payable.length > 0 && (
            <PaymentPanel
              key={`${debt.creditor}:${debt.amount}`}
              payable={groups.payable}
              view={view}
              nameOf={nameOf}
              onPlay={play}
            />
          )}
          <section className="controls">
            {groups.endTurn && (
              <MoveButton move={groups.endTurn} label="End turn" onPlay={play} primary />
            )}
            <label>
              <input
                type="checkbox"
                checked={me.prefs?.autoPass ?? false}
                onChange={(e) =>
                  play({ type: "setPref", player: me.id, autoPass: e.target.checked })
                }
              />{" "}
              Auto-pass (accept actions automatically when you can't Appeal)
            </label>
          </section>
          <Holdings player={me} view={view} extra={flowButton} title="Your" />
        </div>
      )}

      {others.map((p) => (
        <div key={p.id} className="opponent">
          <h2>
            {nameOf(p.id)} <span className="tag">{p.handCount} cards in hand</span>
            {p.delayed && <span className="tag">delayed</span>}
          </h2>
          <Holdings player={p} view={view} title={`${nameOf(p.id)}'s`} />
        </div>
      ))}

      <Log entries={state.log} nameOf={nameOf} seatName={seatName} />
    </section>
  );
}

function MoveButton(props: {
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

/** A player's bank and tableau; `extra` adds buttons to a card (moving your own wilds). */
function Holdings(props: {
  player: View["players"][number];
  view: View;
  extra?: (card: string) => ReactNode;
  title: string;
}) {
  const { player, view } = props;
  const extraFor = (id: string) => props.extra?.(id);
  return (
    <>
      <h3>
        {props.title} bank (${totalValue(player.bank, view)})
      </h3>
      <ul className="cards">
        {player.bank.map((id) => (
          <li key={id} className="card">
            {instanceLabel(id, view)}
            {extraFor(id)}
          </li>
        ))}
      </ul>
      <h3>{props.title} tableau</h3>
      <ul className="sets">
        {player.tableau.map((set) => (
          <li
            key={set.cards[0] ?? set.district}
            className={isComplete(set, view) ? "set complete" : "set"}
          >
            <strong>{districtName(set.district, view)}</strong> {setProgress(set, view)}
            <ul className="cards">
              {[...set.cards, set.landmark, set.icon].flatMap((id) =>
                id
                  ? [
                      <li key={id} className="card">
                        {instanceLabel(id, view)}
                        {extraFor(id)}
                      </li>,
                    ]
                  : [],
              )}
            </ul>
          </li>
        ))}
      </ul>
    </>
  );
}

function setProgress(set: PropertySet, view: View) {
  const size = view.districts[set.district]?.setSize ?? 0;
  return isComplete(set, view) ? "✓ complete" : `${set.cards.length}/${size}`;
}

/** Who the game is waiting on, and why. */
function waitingText(
  game: StateMessage,
  view: View,
  seat: number | null,
  nameOf: (p: string) => string,
  seatName: (s: number) => string,
) {
  if (!game.awaiting) return "";
  const who = game.awaiting.seat === seat ? "You" : seatName(game.awaiting.seat);
  const step = view.pending[0];
  switch (game.awaiting.kind) {
    case "play":
      return `${who}: playing (${view.playsRemaining} plays left)`;
    case "discard":
      return `${who}: discarding down to the hand limit`;
    case "pay":
      return step?.type === "debt"
        ? `${who}: paying $${step.amount} to ${nameOf(step.creditor)}`
        : `${who}: paying`;
    case "respond": {
      const card = step?.type === "response" ? view.cards[step.card] : undefined;
      return step?.type === "response"
        ? `${who}: responding to ${nameOf(step.attacker)}'s ${card ? cardLabel(card, view) : "action"}`
        : `${who}: responding`;
    }
  }
}

/** Counts down from the seconds the server sent with this state. */
function Clock({ seconds, game }: { seconds: number | null; game: StateMessage }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    if (seconds === null || !game) {
      setLeft(null);
      return;
    }
    const end = Date.now() + seconds * 1000;
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [seconds, game]);
  if (left === null) return null;
  return <span className="clock">⏱ {left}s</span>;
}

/** The player an event is about: its own player, debtor or attacker, else the seat that moved. */
const actor = (e: HistoryEntry, nameOf: (p: string) => string, seatName: (s: number) => string) => {
  const ev = e.event as { player?: string; debtor?: string; attacker?: string };
  const id = ev.player ?? ev.debtor ?? ev.attacker;
  return id === undefined ? seatName(e.seat) : nameOf(id);
};

/** The latest events, newest first. Plain text until #41's descriptions land. */
function Log(props: {
  entries: HistoryEntry[];
  nameOf: (p: string) => string;
  seatName: (s: number) => string;
}) {
  return (
    <section className="log">
      <h2>Log</h2>
      <ol reversed>
        {[...props.entries].reverse().map((e) => (
          <li key={e.seq}>
            T{e.turn} {actor(e, props.nameOf, props.seatName)}: {e.event.type}
          </li>
        ))}
      </ol>
    </section>
  );
}

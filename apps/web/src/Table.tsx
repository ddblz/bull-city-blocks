import type { ClientMessage, LobbyView } from "@bull-city-blocks/room";
import { useEffect, useState } from "react";
import { MoveButton } from "./Cards";
import { Chooser, PaymentPanel, ResponsePanel } from "./Choices";
import { cardLabel, districtName } from "./card";
import { nextStep } from "./choice-flows";
import { Districts } from "./Districts";
import { type Context, describeEvent } from "./describe-event";
import { Hand } from "./Hand";
import type { ClientState } from "./lobby-state";
import { FLOW_LABEL, groupMoves } from "./move-groups";
import { Nav, type Tab } from "./Nav";
import { Opponents } from "./Opponents";
import { RecapPanel } from "./Recap";
import { buildRecap } from "./recap";
import { type Picked, pick, selectedCard } from "./selection";
import { TableBar } from "./TableBar";
import type { HistoryEntry, Move, StateMessage, View } from "./types";
import "./table.css";

interface Props {
  state: ClientState & { game: StateMessage; lobby: LobbyView };
  send: (msg: ClientMessage) => void;
}

/** The game table (#37, #38, #41): the view, every move, the clock, the recap, the log and game over. */
export function Table({ state, send }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [tab, setTab] = useState<Tab>("table");
  const [recapOpen, setRecapOpen] = useState(true);
  // Each (re)connect brings a fresh recap, shown until it's closed.
  useEffect(() => setRecapOpen(state.recap.length > 0), [state.recap]);
  const { game, lobby, over } = state;
  const { view } = game;
  const nameOf = (player: string) => lobby.seats.find((s) => s.player === player)?.name ?? player;
  const seatName = (seat: number) => lobby.seats[seat]?.name ?? `Seat ${seat + 1}`;
  const play = (move: Move) => send({ type: "intent", move });
  const groups = groupMoves(game.legal);
  const me = view.players.find((p) => p.id === view.viewer);
  const selected = selectedCard(picked, view.turn, me?.hand ?? []);
  const myMove = game.awaiting?.seat === state.seat;
  // Something needs you (your move, a payment, a response): bring the table back into view.
  useEffect(() => {
    if (myMove) setTab("table");
  }, [myMove]);
  const awaited = game.awaiting ? (lobby.seats[game.awaiting.seat]?.player ?? null) : null;
  const ctx: Context = {
    viewer: view.viewer,
    playerName: nameOf,
    card: (id) => view.cards[id] ?? state.cards[id],
    districtName: (id) => districtName(id, view),
  };
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
      <section className="table game-over">
        <h2>Game over</h2>
        <p className="banner winner-banner">
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
        <Log entries={state.log} ctx={ctx} />
      </section>
    );
  }

  const updates = state.recap.length
    ? buildRecap(state.recap, ctx, view)
        .groups.flatMap((g) => g.items)
        .filter((x) => x.affected).length
    : 0;
  return (
    <section className="table" data-tab={tab}>
      <TableBar
        game={game}
        status={waitingText(game, view, state.seat, nameOf, seatName)}
        updates={updates}
        onUpdates={state.recap.length > 0 && !recapOpen ? () => setRecapOpen(true) : undefined}
      />
      <div className="recap-slot">
        {state.recap.length > 0 && !recapOpen && (
          <button type="button" className="recap-banner" onClick={() => setRecapOpen(true)}>
            Since last move{updates > 0 && ` · ${updates} for you`}
          </button>
        )}
        {recapOpen && state.recap.length > 0 && (
          <RecapPanel
            entries={state.recap}
            ctx={ctx}
            view={view}
            onClose={() => setRecapOpen(false)}
          />
        )}
      </div>
      <Opponents view={view} nameOf={nameOf} awaited={awaited} />

      {me && (
        <div className="mine">
          <Districts player={me} view={view} extra={flowButton} />
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
          <Hand
            ids={me.hand ?? []}
            view={view}
            groups={groups}
            selected={selected}
            open={open}
            onSelect={(id) => setPicked(pick(selected, id, view.turn))}
            onPlay={play}
            flowButton={flowButton}
            endTurn={
              groups.endTurn && (
                <MoveButton move={groups.endTurn} label="End turn" onPlay={play} primary />
              )
            }
          />
          <section className="controls">
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
        </div>
      )}

      <Log
        entries={state.log}
        ctx={ctx}
        onRecap={state.recap.length > 0 && !recapOpen ? () => setRecapOpen(true) : undefined}
      />
      <Nav tab={tab} onTab={setTab} />
    </section>
  );
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

/** The latest events, newest first, in the recap's words. */
function Log(props: { entries: HistoryEntry[]; ctx: Context; onRecap?: (() => void) | undefined }) {
  return (
    <section className="log">
      <h2>Log</h2>
      {props.onRecap && (
        <button type="button" onClick={props.onRecap}>
          Show what happened since your last move
        </button>
      )}
      <ol reversed>
        {[...props.entries].reverse().map((e) => (
          <li key={e.seq}>
            T{e.turn} · {describeEvent(e.event, props.ctx)}
          </li>
        ))}
      </ol>
    </section>
  );
}

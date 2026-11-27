import type { BotName, ClientMessage } from "@bull-city-blocks/room";
import { useEffect, useReducer, useRef, useState } from "react";
import { connect, listRulesets, savedToken } from "./connection";
import { canConfigure, initialState, reduce } from "./lobby-state";

/** A room: ask for a name (unless we already hold a seat token), then show the lobby. */
export function RoomPage({ room }: { room: string }) {
  const [name, setName] = useState<string | null>(() => (savedToken(room) ? "" : null));
  if (name === null) return <NameForm onJoin={setName} />;
  return <Lobby room={room} name={name} />;
}

function NameForm({ onJoin }: { onJoin: (name: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <main className="page">
      <h1>Join the game</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) onJoin(draft.trim());
        }}
      >
        <label>
          Your name{" "}
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={24} />
        </label>
        <button type="submit">Join</button>
      </form>
    </main>
  );
}

function Lobby({ room, name }: { room: string; name: string }) {
  const [state, dispatch] = useReducer(reduce, initialState);
  const [rulesets, setRulesets] = useState<{ id: string; description: string }[]>([]);
  const conn = useRef<ReturnType<typeof connect> | null>(null);
  useEffect(() => {
    conn.current = connect(room, name, dispatch);
    listRulesets().then(setRulesets, () => setRulesets([]));
    return () => conn.current?.close();
  }, [room, name]);
  const send = (msg: ClientMessage) => conn.current?.send(msg);
  const { lobby } = state;
  const host = canConfigure(state);
  const link = `${location.origin}${location.pathname}#/room/${room}`;

  return (
    <main className="page">
      <h1>Room {room}</h1>
      {state.status !== "open" && (
        <p className="status">{state.status === "closed" ? "This room is gone." : "Connecting…"}</p>
      )}
      {state.error && <p className="error">{state.error}</p>}
      <p className="share">
        Share this link: <code>{link}</code>{" "}
        <button type="button" onClick={() => navigator.clipboard?.writeText(link)}>
          Copy
        </button>
      </p>
      {lobby && (
        <>
          <h2>Seats ({lobby.seats.length}/10)</h2>
          <ul className="seats">
            {lobby.seats.map((s) => (
              <li key={s.seat}>
                {s.name}
                {s.seat === lobby.host && <span className="tag">host</span>}
                {s.bot && <span className="tag">{s.bot} bot</span>}
                {s.seat === state.seat && <span className="tag">you</span>}
                {host && s.bot && (
                  <button type="button" onClick={() => send({ type: "removeSeat", seat: s.seat })}>
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p>
            Rules: <strong>{lobby.ruleset}</strong> · clock {lobby.clock ? "on" : "off"}
          </p>
          {host && (
            <section className="controls">
              <label>
                Ruleset{" "}
                <select
                  value={lobby.ruleset}
                  onChange={(e) => send({ type: "configure", ruleset: e.target.value })}
                >
                  {(rulesets.length ? rulesets : [{ id: lobby.ruleset, description: "" }]).map(
                    (r) => (
                      <option key={r.id} value={r.id} title={r.description}>
                        {r.id}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={lobby.clock}
                  onChange={(e) => send({ type: "configure", clock: e.target.checked })}
                />{" "}
                Turn clock
              </label>
              {(["greedy", "random"] as BotName[]).map((bot) => (
                <button
                  key={bot}
                  type="button"
                  disabled={lobby.seats.length >= 10}
                  onClick={() => send({ type: "addBot", bot })}
                >
                  Add {bot} bot
                </button>
              ))}
              <button
                type="button"
                className="primary"
                disabled={lobby.seats.length < 2}
                onClick={() => send({ type: "start" })}
              >
                Start game
              </button>
            </section>
          )}
          {!host && !lobby.started && <p>Waiting for the host to start the game…</p>}
          {lobby.started && state.game && (
            <p className="status">
              The game has started.{" "}
              {state.game.awaiting?.seat === state.seat
                ? "It's your move."
                : `Waiting for ${lobby.seats[state.game.awaiting?.seat ?? 0]?.name}.`}{" "}
              (The table arrives in #37.)
            </p>
          )}
        </>
      )}
    </main>
  );
}

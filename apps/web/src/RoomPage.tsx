import type { Content } from "@bull-city-blocks/engine";
import { loadRuleset } from "@bull-city-blocks/engine";
import type { BotName, ClientMessage } from "@bull-city-blocks/room";
import { useEffect, useReducer, useRef, useState } from "react";
import { differences, resolveRules } from "./config-form";
import { connect, getContent, listRulesets, savedToken } from "./connection";
import { canConfigure, initialState, reduce } from "./lobby-state";
import { RulesEditor, RulesSummary } from "./RulesEditor";
import { RulesPanel } from "./RulesPanel";
import { rulesRows } from "./rules-summary";
import { Table } from "./Table";
import "./lobby.css";

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
  const [rulesets, setRulesets] = useState<Awaited<ReturnType<typeof listRulesets>>>([]);
  const [content, setContent] = useState<Content | null>(null);
  const conn = useRef<ReturnType<typeof connect> | null>(null);
  useEffect(() => {
    conn.current = connect(room, name, dispatch);
    listRulesets().then(setRulesets, () => setRulesets([]));
    getContent().then(setContent, () => setContent(null));
    return () => conn.current?.close();
  }, [room, name]);
  const send = (msg: ClientMessage) => conn.current?.send(msg);
  const { lobby } = state;
  const host = canConfigure(state);
  const link = `${location.origin}${location.pathname}#/room/${room}`;
  // #39: what this room's rules change from base, for every player.
  const baseRules = loadRuleset("base", rulesets);
  const rules = lobby && resolveRules(rulesets, lobby.ruleset, lobby.overrides);
  const changes =
    content && baseRules.ok && rules?.ok ? differences(rules.value, baseRules.value, content) : [];

  const rows = rules?.ok && baseRules.ok ? rulesRows(rules.value, baseRules.value) : [];
  const started = lobby?.started ?? false;

  return (
    <main className="page">
      <header className="room-head">
        <h1>Room {room}</h1>
        {!started && (
          <p className="share">
            <code>{link}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(link)}>
              Copy
            </button>
          </p>
        )}
      </header>
      {state.status !== "open" && (
        <p className="status">{state.status === "closed" ? "This room is gone." : "Connecting…"}</p>
      )}
      {state.error && <p className="error">{state.error}</p>}
      {lobby && !started && (
        <div className="lobby">
          <section aria-labelledby="seats-h">
            <header className="seats-head">
              <h2 id="seats-h">Seats ({lobby.seats.length}/10)</h2>
              {host &&
                (["greedy", "random"] as BotName[]).map((bot) => (
                  <button
                    key={bot}
                    type="button"
                    disabled={lobby.seats.length >= 10}
                    onClick={() => send({ type: "addBot", bot })}
                  >
                    Add {bot} bot
                  </button>
                ))}
            </header>
            <ul className="seats">
              {lobby.seats.map((s) => (
                <li key={s.seat} className={s.bot ? "seat is-bot" : "seat"}>
                  <strong>{s.name}</strong>
                  {s.seat === lobby.host && <span className="tag">host</span>}
                  {s.bot && <span className="tag">{s.bot} bot</span>}
                  {s.seat === state.seat && <span className="tag">you</span>}
                  {host && s.bot && (
                    <button
                      type="button"
                      onClick={() => send({ type: "removeSeat", seat: s.seat })}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
          <div className="lobby-side">
            <RulesPanel rows={rows} ruleset={lobby.ruleset} clock={lobby.clock} changes={changes} />
            {host ? (
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
                <button
                  type="button"
                  className="primary start"
                  disabled={lobby.seats.length < 2}
                  onClick={() => send({ type: "start" })}
                >
                  Start game
                </button>
              </section>
            ) : (
              <p className="status">Waiting for the host to start the game…</p>
            )}
          </div>
        </div>
      )}
      {host && content && lobby && !started && (
        <RulesEditor
          files={rulesets}
          content={content}
          ruleset={lobby.ruleset}
          overrides={lobby.overrides}
          onChange={(overrides) => send({ type: "configure", overrides })}
        />
      )}
      {lobby && started && state.game && (
        <>
          <RulesSummary lines={changes} />
          <Table state={{ ...state, game: state.game, lobby }} send={send} />
        </>
      )}
    </main>
  );
}

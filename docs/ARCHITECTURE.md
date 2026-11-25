# Architecture

> Status: **DRAFT v0.1, awaiting owner approval.**

## 1. Principles

1. **The engine is pure.** It has no I/O, no clock and no `Math.random`. The same seed and the same moves always produce the same game, which is what makes simulations, replays and bug reports trustworthy.
2. **Rules are data.** Numbers live in a `RuleSet`, and card content lives in `content/`. Code changes are only needed for new *kinds* of rules, and those go through hooks.
3. **The server is authoritative.** Online clients send *intents*. The server validates them with the same engine and broadcasts each player's own view of the game, so hidden hands stay hidden.
4. **Small packages with one-way dependencies.** The engine depends on nothing.

## 2. System overview

```mermaid
flowchart LR
  subgraph Repo["Monorepo (pnpm workspaces, TypeScript)"]
    content[("content/durham.json<br/>cards & districts")]
    rulesets[("rulesets/*.json<br/>base + variants")]
    engine["packages/engine<br/>pure rules engine"]
    bots["packages/bots<br/>random / greedy / heuristic"]
    sim["packages/sim<br/>simulation CLI + stats"]
    server["apps/server<br/>WebSocket game rooms"]
    web["apps/web<br/>React UI"]
  end
  content --> engine
  rulesets --> engine
  engine --> bots
  engine --> sim
  bots --> sim
  engine --> server
  bots --> server
  server <-->|"intents / player views"| web
  sim --> report[["sim report<br/>(Markdown + JSON)"]]
```

| Package | Responsibility | Depends on |
|---|---|---|
| `packages/engine` | Game state, legal moves, applying moves, per-player views, ruleset loading and validation, hooks | nothing at runtime except `zod` |
| `packages/bots` | `Policy` implementations that pick a move from `legalMoves` | engine |
| `packages/sim` | Runs N games across seeds, collects metrics, compares rulesets, writes reports | engine, bots |
| `apps/server` | Rooms, seats, reconnects; runs the engine and broadcasts views (M4) | engine, bots (for filling empty seats) |
| `apps/web` | Renders the player view and sends intents (M4) | engine types only |

## 3. Engine API

```ts
// Everything is serializable JSON, so any game can be saved, replayed or diffed.
createGame(rules: RuleSet, content: Content, players: PlayerId[], seed: string): GameState
legalMoves(state: GameState, player: PlayerId): Move[]
applyMove(state: GameState, move: Move): { state: GameState; events: GameEvent[] }
viewFor(state: GameState, player: PlayerId): PlayerView   // hides other players' hands and the deck order
winner(state: GameState): PlayerId | "stall" | null
```

- `GameState` holds `phase`, `currentPlayer`, `playsRemaining`, a `pending` stack (debts and Appeal chains waiting for a response), `players[]` (hand, bank, tableau), `deck`, `discard`, `rng` (seeded PRNG state) and `turn`.
- `Move` is a discriminated union, for example `{type:"playProperty"}`, `{type:"bank"}`, `{type:"playAction"}`, `{type:"respond"}`, `{type:"pay"}`, `{type:"endTurn"}`, `{type:"discard"}`, `{type:"moveWild"}`.
- A move from a player who is not allowed to act returns an error. It never throws.

## 4. Game flow

### 4.1 Turn state machine

```mermaid
stateDiagram-v2
  direction TB
  [*] --> Draw
  Draw --> Play: T1
  Play --> Play: T2
  Play --> AwaitResponse: T3
  AwaitResponse --> AwaitResponse: T4
  AwaitResponse --> AwaitPayment: T5
  AwaitResponse --> Play: T6
  AwaitPayment --> Play: T7
  Play --> Discard: T8
  Discard --> Draw: T9
  Play --> GameOver: W
  AwaitPayment --> GameOver: W
  Discard --> GameOver: S
  GameOver --> [*]
```

| Edge | Condition |
|---|---|
| T1 | Draw 2 cards, or 5 if your hand is empty |
| T2 | Play a card while plays remain |
| T3 | An action or rent card targets other players |
| T4 | The target plays Appeal, or the attacker re-Appeals |
| T5 | The action stands and requires payment |
| T6 | The action was cancelled, or it resolved without payment |
| T7 | All targets have paid |
| T8 | `endTurn` is played, or no plays remain |
| T9 | Hand is at or under the limit, so the turn passes to the next player |
| W | A player has 3 complete districts: they win, checked after every move |
| S | The turn limit is reached: the game is a stall |

### 4.2 Resolving a targeted action (Appeal chain)

```mermaid
sequenceDiagram
  participant A as Attacker
  participant E as Engine
  participant T as Target
  A->>E: playAction(Buyout, target=T, property=Main St)
  E->>E: validate, push pending{Buyout}
  E-->>T: respond? (Appeal / accept)
  alt T plays Appeal
    T->>E: respond(Appeal)
    E-->>A: respond? (Appeal / accept)
    alt A re-Appeals
      A->>E: respond(Appeal)
      E-->>T: respond? (loop)
    else A accepts
      A->>E: respond(accept)
      E->>E: Buyout cancelled, cards to discard
    end
  else T accepts
    T->>E: respond(accept)
    E->>E: move Main St to A and debt A→T of its value
    E-->>A: pay(value)
    A->>E: pay(cards)
  end
  E->>E: pop pending, check win, resume Play
```

### 4.3 Online play (M4)

```mermaid
sequenceDiagram
  participant B as Browser (player)
  participant S as Server room
  participant E as Engine
  B->>S: join(roomId, name)
  S->>S: seat player, start when host clicks Start
  S->>E: createGame(rules, content, players, seed)
  loop every move
    B->>S: intent(move)
    S->>E: applyMove(state, move)
    alt illegal
      S-->>B: error(reason)
    else ok
      E-->>S: state + events
      S-->>B: viewFor(state, each player) + events
    end
  end
  S-->>B: gameOver(winner, replay seed + move log)
```

## 5. Simulation pipeline

```mermaid
flowchart TD
  A["pnpm sim --base base --variant takeover-costs-3 --games 10000 --bots greedy,greedy,random"] --> B[load + validate both rulesets]
  B --> C["for seed in 1..N (same seeds for both rulesets)"]
  C --> D[createGame → loop: bot picks legal move → applyMove]
  D --> E[record per-game metrics]
  E --> C
  C -->|done| F["aggregate: win rate by seat, turns, stall rate,<br/>comeback rate, card impact (95% CI)"]
  F --> G["compare variant vs base<br/>flag metrics whose CIs don't overlap"]
  G --> H[["reports/<variant>.md + .json"]]
```

- **Paired seeds:** both rulesets are run on the same seeds, which reduces noise in the comparison.
- **Parallelism:** games run in worker threads. A run of 10,000 games should take under 2 minutes on a laptop or in a cloud session.
- **CI budget:** pull requests run a smoke test of 500 games. Full runs of 10,000 games happen in the implementation session, and their report is committed.

## 6. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) everywhere | One language shared by engine, server and UI |
| Packages | pnpm workspaces | Fast and cheap installs in CI and sessions |
| Validation | zod | Validates rulesets and content at load time |
| Tests | Vitest, plus property-based tests with fast-check | Invariants like "card count is conserved" catch whole classes of bugs |
| Lint/format | Biome | One fast tool instead of ESLint plus Prettier |
| Server (M4) | Node + `ws` | Minimal; no framework needed |
| Web (M4) | React + Vite | Standard and well understood |

## 7. Engine invariants (enforced by property tests)

1. The total number of cards across deck, discard, hands, banks and tableaux always equals the deck size.
2. `applyMove` never mutates its input state.
3. Replaying the same seed and move log produces an identical final state.
4. Every move returned by `legalMoves` applies without error.
5. `viewFor(p)` never contains other players' hand contents or the deck order.

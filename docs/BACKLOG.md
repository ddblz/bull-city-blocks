# Proposed backlog: M0–M2

> These are drafts. Once the owner approves the specs, each one becomes a GitHub issue labeled `draft`. The owner then adds `ready` to whichever issue should be worked on next. They're listed in dependency order.

| # | Title | Size | Depends on |
|---|---|---|---|
| 1 | Scaffold the monorepo: pnpm, TypeScript strict, Biome, Vitest, empty packages | S | — |
| 2 | CI: lint, typecheck, test, diff-size gate, dependency-change gate | S | 1 |
| 3 | Engine: types, seeded RNG, `createGame`, deck building from `content/durham.json` | M | 1 |
| 4 | Ruleset loader: zod schema, `extends` and `overrides`, `rulesets/base.json` | S | 3 |
| 5 | Engine: turn loop (draw, play limit, discard, end turn), properties, bank, win check | M | 3, 4 |
| 6 | Engine: payment and debts (§3.3) and rent cards (§4.6), including Rent Hike | M | 5 |
| 7 | Engine: action cards: Walk-Off, Food Truck Rodeo, Assessment, Construction Delay | M | 6 |
| 8 | Engine: targeted actions and the Appeal chain: Buyout, Swap Meet, Hostile Takeover | M | 7 |
| 9 | Engine: wilds, landmarks, `viewFor`, property tests for the invariants in ARCH §7 | M | 8 |
| 10 | Bots: random and greedy policies | S | 9 |
| 11 | Sim CLI: run N paired-seed games in worker threads and print metrics | M | 10 |
| 12 | Sim: compare variant vs. base with 95% CIs, write `reports/*.md`; first variant `takeover-costs-3` | M | 11 |

## Example of a full issue (#5)

**Why:** The engine needs a working turn so that later issues can add card effects.

**What:** Implement SPEC §3.1, §3.2, §3.4 (completion only) and §3.6, following the ARCH §4.1 state machine. Properties go to the tableau, cash and action cards can be banked, and the win check runs after every move.

**Acceptance criteria**
- [ ] `legalMoves` during Play offers playProperty, bank and endTurn, respecting `playsRemaining`
- [ ] A player draws 5 instead of 2 when their hand is empty (§3.2)
- [ ] The Discard phase enforces the hand limit from the ruleset
- [ ] Completing 3 districts ends the game immediately, with `winner()` returning that player
- [ ] Reaching `turnLimit` gives `winner() === "stall"`

**Test plan:** `turn.test.ts`, with one test per bullet, each named with its SPEC section. Add a seeded smoke test where 2 scripted players play 20 turns and the card count is conserved.

**Out of scope:** action cards, rent, payment, wilds.

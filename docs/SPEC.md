# Bull City Blocks — Product & Rules Spec

> Status: **DRAFT v0.1 — awaiting owner approval.** Nothing is implemented until this doc is approved.
> Working title; rename freely.

## 1. What we're building

An original, online, fast set-collection card game themed on Durham, NC: its streets, neighborhoods and landmarks. Players collect **districts** (property sets), charge each other rent, and use action cards. The first player to finish **3 complete districts** wins.

The project has two equally important halves:

1. **A playable game.** It starts as a local CLI or hot-seat game, then becomes online multiplayer in the browser.
2. **A rules lab.** Every rule is data or a pluggable hook, so a pull request can propose a **rule variant** and back it up with a **simulation report** that compares it against the baseline. We should be able to answer questions like "Does making Hostile Takeover cost 2 actions reduce comeback wins?" with numbers.

### Originality guardrail

The game is in the same *genre* as other property-trading card games, and it borrows common genre mechanics: set collection, rent, steal and counter cards. It must **not** use another game's name, trademarks, card list, card text, art or trade dress. All card names, card text and art are our own. Durham places are used as public geographic names. We avoid business names and logos; landmarks are named the way a map would name them.

## 2. Goals and non-goals

| v0 goals | Non-goals for now |
|---|---|
| Deterministic rules engine with complete test coverage of the rules in this doc | Accounts, login, persistence beyond a single game |
| Bots that can play full games | Monetization, ads, app stores |
| Simulation CLI that compares rule variants with statistics | Fancy art or animation: plain readable cards first |
| Online play for 2–5 friends through a shareable room link | Matchmaking, ranking, chat |
| Rule variants defined as JSON files, plus optional code hooks | Mobile-native apps (the web UI should still work on phones) |

## 3. Baseline rules (`rulesets/base.json`)

Every number in **bold** is a ruleset parameter and can be changed by a variant.

### 3.1 Setup
- **2–5** players. Shuffle the deck and deal **5** cards to each player.
- The starting player is chosen at random using the game's seeded RNG.

### 3.2 Turn structure
1. **Draw:** draw **2** cards. If your hand is empty at the start of your turn, draw **5** instead.
2. **Play:** make up to **3** plays. A play is one of:
   - Put a property into your **tableau**.
   - Put a cash card, or an action or rent card face-down as cash at its value, into your **bank**.
   - Play an action or rent card for its effect. It then goes to the discard pile.
   - Play a landmark onto one of your complete districts.
   You may also **rearrange your wild properties** at any time during your turn. This is free and does not count as a play.
3. **Discard:** if you have more than **7** cards in hand, discard down to **7**.
4. **Win check:** if you have **3** complete districts at any moment, you win immediately, even during another player's turn (for example, after receiving a property as payment).

### 3.3 Paying debts
- You pay with any combination of bank cards and tableau properties. **No change is given.**
- If you can't cover a debt, you pay everything you have and the rest is forgiven.
- Cards in your hand can never be used to pay.
- Properties you receive as payment go straight into your tableau. Cash goes to your bank.

### 3.4 Districts and rent
- A district is **complete** when you hold its set size of properties in it.
- **Rent** for a district is set by how many of its properties you hold, using the district's rent ladder. A landmark on a complete district adds **+3**.
- Extra properties beyond the set size start a second, separate set of that district.

### 3.5 Counters (Appeal)
- When an action card targets you, you may play **Appeal** from your hand to cancel it. This does not use one of your plays.
- The attacker may Appeal your Appeal, and so on. Whoever played the last unanswered Appeal wins the exchange.

### 3.6 Turn limit
- A game that reaches **200** total turns ends as a **stall**. For simulations, stalls are a metric, not a winner.

## 4. Deck (`content/durham.json`): draft content, 108 cards

> Street and landmark choices are a first draft for the owner to edit. Counts, values and rent ladders are all tunable.

### 4.1 Districts: 29 property cards

| District | Set size | Properties | Rent ladder | Card value | Landmark |
|---|---|---|---|---|---|
| Old West Durham | 2 | Ninth St, Hillsborough Rd | 1 / 2 | 1 | Erwin Mill |
| East Durham | 3 | Angier Ave, Driver St, Holloway St | 1 / 2 / 3 | 1 | Golden Belt |
| North Durham | 3 | Roxboro St, Club Blvd, Guess Rd | 1 / 2 / 4 | 2 | Museum of Life and Science |
| Hayti | 3 | Fayetteville St, Lawson St, Alston Ave | 1 / 2 / 4 | 2 | Hayti Heritage Center |
| Brightleaf | 3 | Gregson St, Duke St, Morgan St | 2 / 3 / 6 | 3 | Brightleaf Square |
| American Tobacco | 3 | Blackwell St, Pettigrew St, Mangum St | 2 / 4 / 6 | 3 | DBAP |
| Downtown | 3 | Main St, Corcoran St, Chapel Hill St | 2 / 4 / 7 | 4 | Major the Bull |
| Duke | 3 | West Campus, East Campus, Erwin Rd | 3 / 5 / 8 | 4 | Duke Chapel |
| RTP | 2 | Research Triangle Park, Southpoint | 3 / 8 | 4 | — |
| Transit | 4 | Durham Station, Amtrak Station, GoDurham, Durham Freeway | 1 / 2 / 3 / 4 | 2 | — (Transit can't take a landmark) |

### 4.2 Wild properties: 8 cards
- 6 two-district wilds: Old West/East, North/Hayti, Brightleaf/American Tobacco, Downtown/Duke, RTP/Transit, Downtown/American Tobacco. Value 2–4, matching the higher district.
- 2 **Bull City Wild** cards that count as any district. Value 0, and they can't be used to pay a debt.
- A wild card can't complete a district on its own: each complete district needs at least 1 non-wild property.

### 4.3 Landmarks: 8 cards
One named landmark per district, listed in the table above. Each can only be played on its own district once that district is complete. Value 3.

### 4.4 Cash: 20 cards
| Value | 1 | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|
| Count | 6 | 5 | 3 | 3 | 2 | 1 |

### 4.5 Action cards: 30 cards

| Card | Count | Value | Effect | Note |
|---|---|---|---|---|
| Walk-Off Win | 8 | 1 | Draw 2 cards. | |
| Food Truck Rodeo | 3 | 2 | Every other player pays you 2. | |
| Assessment | 3 | 3 | One player pays you 1 per property they own, up to **5**. | Original mechanic |
| Buyout | 3 | 3 | Take one property from a player's *incomplete* set. **You pay them its card value.** | Original twist: theft has a price |
| Swap Meet | 3 | 3 | Swap one of your properties with one from another player's incomplete set. | |
| Hostile Takeover | 2 | 5 | Take a complete district, with its landmark, from one player. **Costs 2 plays.** | Original twist |
| Appeal | 3 | 4 | Cancel an action that targets you. See §3.5. | |
| Construction Delay | 2 | 2 | The target player draws only 1 card on their next turn. | Original mechanic |
| Rent Hike | 3 | 1 | Play together with a rent card to double that rent. Counts as a play. | |

### 4.6 Rent cards: 13 cards
- 10 two-district rent cards, 2 for each pair: Old West/East, North/Hayti, Brightleaf/American Tobacco, Downtown/Duke, RTP/Transit. **Every** other player pays you rent for one of your districts in that pair. Value 1.
- 3 **Wild Rent** cards: **one** player of your choice pays rent for any one of your districts. Value 3.

**Total: 29 + 8 + 8 + 20 + 30 + 13 = 108.**

## 5. Rule variants

A variant is a JSON file in `rulesets/` that `extends` another ruleset and overrides parameters. Example:

```json
{
  "id": "takeover-costs-3",
  "extends": "base",
  "description": "Hostile Takeover costs 3 plays instead of 2",
  "hypothesis": "Fewer late-game swings; slightly longer games",
  "overrides": { "actions.hostileTakeover.playCost": 3 }
}
```

If a variant can't be expressed with parameters, it may add a **rule hook**: a small, pure function registered at a named extension point, such as `onRentCalculated` or `canTarget`. Hooks are allowed only in `packages/engine/src/hooks/`, and each needs its own tests.

Every variant pull request **must include a simulation report** that compares the variant with `base`. See [ARCHITECTURE.md §5](ARCHITECTURE.md#5-simulation-pipeline).

## 6. Simulation metrics

| Metric | Why it matters |
|---|---|
| Win rate by seat (95% confidence interval) | First-player advantage and fairness |
| Turns to win (mean, median, p90) | Pace |
| Stall rate | Whether the game can get stuck |
| Comeback rate: the winner was last in completed districts at turn 10 | Swinginess |
| Card impact: win rate when a card is played vs. not played | Overpowered or useless cards |
| Bot-strength spread: greedy bot vs. random bot win rate | Whether skill matters |

A variant "changes the game" for a metric when the 95% confidence intervals don't overlap. With the default 10,000-game runs, about ±1% on win rates.

## 7. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, guardrails and CI | CI runs lint, typecheck, test and diff size checks, and branch protection is on |
| M1 | Rules engine | Every rule in §3–4 is implemented with tests, and seeded games replay identically |
| M2 | Bots and simulation CLI | `pnpm sim --ruleset base --games 10000` produces the report in §6 |
| M3 | Variant pipeline | A variant pull request automatically gets a short-run simulation comparison posted |
| M4 | Online play | 2–5 players can finish a game in the browser using a room link |
| M5 | Polish | Card art, Durham map view, mobile layout |

The simulation milestones come before online play on purpose. The engine and simulator are cheap to build and test, and the rules lab is the goal.

## 8. Open questions for the owner

1. The name "Bull City Blocks": keep it or change it?
2. The district and landmark list: do any feel wrong to a Durham local? Are any missing, such as Trinity Park, Walltown, Hope Valley or the Eno?
3. Is 3 districts to win right for 2–5 players, or should it be 2 districts in 2-player games?
4. Hosting for M4: something with a free tier, or OK to spend a few dollars a month?

# Bull City Blocks — Product & Rules Spec

> Status: **DRAFT v0.2: owner feedback on v0.1 incorporated, awaiting final approval.**

## 1. What we're building

An original, online, fast set-collection card game themed on Durham, NC: its streets, neighborhoods and landmarks. Players collect **districts** (property sets), charge each other rent, build up districts with **Landmarks** and **Icons**, and use action cards. The first player to finish **3 complete districts** wins. The game supports **2–10 players**.

The project has two equally important halves:

1. **A playable game.** It starts as a local CLI or hot-seat game, then becomes online multiplayer in the browser.
2. **A rules lab.** Every rule is data or a pluggable hook, so a pull request can propose a **rule variant** and back it up with a **simulation report** that compares it against the baseline.

### Originality guardrail

The game is in the same *genre* as other property-trading card games, and it borrows common genre mechanics: set collection, rent, steal and counter cards, building upgrades. It must **not** use another game's name, trademarks, card list, card text, art or trade dress. All card names, card text and art are our own. Durham places are used as public geographic names. We avoid business names and logos; landmarks are named the way a map would name them.

## 2. Goals and non-goals

| v0 goals | Non-goals for now |
|---|---|
| Deterministic rules engine with complete test coverage of the rules in this doc | Accounts, login, persistence beyond a single game |
| Bots that can play full games at every player count from 2 to 10 | Monetization, ads, app stores |
| Simulation CLI that compares rule variants with statistics | Fancy art or animation: plain readable cards first |
| Online play for 2–10 friends through a shareable room link, with an optional turn clock | Matchmaking, ranking, chat |
| Rule variants defined as JSON files, plus optional code hooks | Mobile-native apps (the web UI should still work on phones) |
| **Hosting stays on free tiers** (§7) | Paid infrastructure |

## 3. Baseline rules (`rulesets/base.json`)

Every number in **bold** is a ruleset parameter and can be changed by a variant.

### 3.1 Setup
- **2–10** players.
- **Deck size scales with the number of players:** 2–5 players use **1** copy of the deck (139 cards), and 6–10 players use **2** copies (278 cards).
- Shuffle and deal **5** cards to each player. The starting player is chosen at random using the game's seeded RNG.

### 3.2 Turn structure
1. **Draw:** draw **2** cards. If your hand is empty at the start of your turn, draw **5** instead.
2. **Play:** make up to **3** plays. A play is one of:
   - Put a property into your **tableau**.
   - Put a cash card, or an action or rent card face-down as cash at its value, into your **bank**.
   - Play an action or rent card for its effect. It then goes to the discard pile.
   - Play a Landmark or Icon onto one of your complete districts (§3.5).
   You may also **rearrange your wild properties** at any time during your turn. This is free and does not count as a play.
3. **Discard:** if you have more than **7** cards in hand, discard down to **7**.
4. **Win check:** if you have **3** complete districts at any moment, you win immediately, even during another player's turn. They must be 3 *different* districts: two complete sets of the same district count once.

### 3.3 Running out of cards
When the draw pile is empty, shuffle the discard pile to form a new draw pile. If both are empty, draw as many cards as are available.

### 3.4 Paying debts
- You pay with any combination of bank cards and tableau cards (properties, Landmarks, Icons). **No change is given.**
- If you can't cover a debt, you pay everything you have and the rest is forgiven.
- **When there's no choice to make, payment happens automatically.** If the debt is at least as large as everything you own, the engine pays all of it for you. No information is revealed by this, because banks and tableaux are public.
- Cards in your hand can never be used to pay.
- Properties you receive as payment go into your tableau. Cash and upgrade cards (Landmarks and Icons) go to your bank.

### 3.5 Districts, rent and upgrades
- A district is **complete** when you hold its set size of properties in it.
- **Rent** for a district is set by how many of its properties you hold, using the district's rent ladder. If you hold two sets of the same district, rent uses the larger set.
- **Landmark** (like a house): played on one of your complete districts, it adds **+3** rent. One per district.
- **Icon** (like a hotel): played on a complete district that already has a Landmark, it adds **+4** rent. One per district.
- Transit can't take upgrades.
- If a district stops being complete, for example because you paid a debt with one of its properties, its upgrades go to your bank as cash at their card value.
- Extra properties beyond the set size start a second, separate set of that district.

### 3.6 Responding to actions (Appeal and auto-pass)
- When an action card targets you, you may play **Appeal** from your hand to cancel it. Rent cards count as actions here. This does not use one of your plays.
- The attacker may Appeal your Appeal, and so on. Whoever played the last unanswered Appeal wins the exchange.
- **Auto-pass is a per-player preference, and you can change it at any time.**
  - **On (the default):** if you have no Appeal in hand, the engine accepts the action for you immediately.
  - **Off:** you're always asked, even when you can't Appeal. This keeps other players from learning anything about your hand from how fast you respond.
  - In online play, the server adds a short random delay before showing an auto-pass, so the timing doesn't reveal that you had no Appeal either. Players who want a faster game can still choose Off for full control.
- If you hold an Appeal, you're always asked, whatever your setting.

### 3.7 Turn clock (online, optional)
- The clock is set per room by the host. It is **off by default**.
- When it's on, each turn gets **90 s** and each response or payment gets **20 s**.
- When time runs out, the engine makes the **timeout move**, which is always the same for the same situation:

| Situation | Timeout move |
|---|---|
| Play | End the turn |
| Discard | Discard the lowest-value cards |
| Respond | Accept the action |
| Pay | Pay automatically using the fewest cards, spending bank cash before properties and lowest-value cards first |

- Simulations ignore the clock.

### 3.8 Game length limit
A game that reaches **60** full rounds ends as a **stall**. For simulations, stalls are a metric, not a winner.

## 4. Deck (`content/durham.json`): one copy is 139 cards

> Streets and landmarks are draft content for the owner to edit. Counts, values and rent ladders are tunable.

### 4.1 Districts: 14 districts, 40 property cards

| District | Set size | Properties | Rent ladder | Card value |
|---|---|---|---|---|
| Old West Durham | 2 | Ninth St, Hillsborough Rd | 1 / 2 | 1 |
| Walltown | 2 | Onslow St, Berkeley St | 1 / 2 | 1 |
| East Durham | 3 | Angier Ave, Driver St, Holloway St | 1 / 2 / 3 | 1 |
| Hayti | 3 | Fayetteville St, Lawson St, Alston Ave | 1 / 2 / 4 | 2 |
| North Durham | 3 | Roxboro St, Club Blvd, Guess Rd | 1 / 2 / 4 | 2 |
| The Eno | 3 | West Point on the Eno, Few's Ford, Penny's Bend | 1 / 2 / 4 | 2 |
| Trinity Park | 3 | Watts St, Buchanan Blvd, Trinity Ave | 2 / 3 / 6 | 3 |
| Forest Hills | 3 | University Dr, Beverly Dr, Forest Hills Park | 2 / 3 / 6 | 3 |
| Brightleaf | 3 | Gregson St, Duke St, Morgan St | 2 / 3 / 6 | 3 |
| American Tobacco | 3 | Blackwell St, Pettigrew St, Mangum St | 2 / 4 / 6 | 3 |
| Downtown | 3 | Main St, Corcoran St, Chapel Hill St | 2 / 4 / 7 | 4 |
| Duke | 3 | West Campus, East Campus, Erwin Rd | 3 / 5 / 8 | 4 |
| RTP | 2 | Research Triangle Park, Southpoint | 3 / 8 | 4 |
| Transit | 4 | Durham Station, Amtrak Station, GoDurham, Durham Freeway | 1 / 2 / 3 / 4 | 2 |

The districts are grouped into **7 pairs**, which rent cards and wilds use: Old West Durham/Walltown, East Durham/Hayti, North Durham/The Eno, Trinity Park/Forest Hills, Brightleaf/American Tobacco, Downtown/Duke, and RTP/Transit.

### 4.2 Wild properties: 9 cards
- 7 two-district wilds, one for each pair. Each has the card value of the higher district in its pair.
- 2 **Bull City Wild** cards that count as any district. Value 0, and they can't be used to pay a debt.
- Every complete district needs at least 1 non-wild property.

### 4.3 Upgrades: 14 cards
The names are flavor only. Any Landmark works on any eligible district, and so does any Icon.

| Type | Count | Value | Cards |
|---|---|---|---|
| **Landmark** (+3) | 9 | 3 | Carolina Theatre, Museum of Life and Science, Durham Central Park, Hayti Heritage Center, Golden Belt, Sarah P. Duke Gardens, Durham Farmers' Market, Bennett Place, Erwin Mill |
| **Icon** (+4, needs a Landmark) | 5 | 4 | DPAC, DBAP, Duke Chapel, The Water Tower, Major the Bull |

### 4.4 Cash: 24 cards
| Value | 1 | 2 | 3 | 4 | 5 | 10 |
|---|---|---|---|---|---|---|
| Count | 7 | 6 | 4 | 3 | 3 | 1 |

### 4.5 Action cards: 35 cards

| Card | Count | Value | Effect |
|---|---|---|---|
| Walk-Off Win | 9 | 1 | Draw 2 cards. |
| Food Truck Rodeo | 3 | 2 | Every other player pays you 2. At most **∞** players are charged. |
| Assessment | 3 | 3 | One player pays you 1 per property they own, up to **5**. |
| Buyout | 4 | 3 | Take one property from a player's *incomplete* set. **You pay them its card value.** |
| Swap Meet | 4 | 3 | Swap one of your properties with one from another player's set. Both must come from *incomplete* sets. |
| Hostile Takeover | 2 | 5 | Take a complete district, along with its upgrades, from one player. **Costs 2 plays.** |
| Appeal | 4 | 4 | Cancel an action that targets you (§3.6). |
| Construction Delay | 3 | 2 | The target player draws only 1 card on their next turn. |
| Rent Hike | 3 | 1 | Play together with a rent card to double that rent. Counts as a play. |

### 4.6 Rent cards: 17 cards
- 14 pair rent cards, 2 for each of the 7 pairs. Every other player pays you rent for one of your districts in that pair. At most **∞** players are charged. Value 1.
- 3 **Wild Rent** cards: one player of your choice pays rent for any one of your districts. Value 3.

**One copy: 40 + 9 + 14 + 24 + 35 + 17 = 139 cards.** Games with 6–10 players use 2 copies.

## 5. Rule variants

A variant is a JSON file in `rulesets/` that `extends` another ruleset and overrides parameters. Example:

```json
{
  "id": "rodeo-cap-4",
  "extends": "base",
  "description": "Food Truck Rodeo and pair rent cards charge at most 4 players",
  "hypothesis": "At 8–10 players: fewer single-turn blowouts and lower comeback rate; no change at 2–4 players",
  "overrides": { "actions.foodTruckRodeo.maxTargets": 4, "rent.pair.maxTargets": 4 }
}
```

A variant can also change the deck through the ruleset's `deck` section, without editing `content/`:

- `deck.counts.<card id>`: copies of a card per deck copy (0 removes it). Property cards can't be changed this way.
- `deck.values.<card id>`: a card's value, for any card, including properties.
- `deck.rent.<district id>`: a district's rent ladder. It must have one step per property in the set.

```json
{ "overrides": { "deck.counts.walk-off-win": 6, "deck.values.hostile-takeover": 4, "deck.rent.duke": [3, 5, 9] } }
```

Counts are per deck copy, so a 6–10 player game still doubles them. An unknown card or district id is an error.

If a variant can't be expressed with parameters, it may add a **rule hook**: a small, pure function registered at a named extension point, such as `onRentCalculated` or `canTarget`. Hooks are allowed only in `packages/engine/src/hooks/`, and each needs its own tests.

Every variant pull request **must include a simulation report** that compares the variant with `base`.

### Large-table questions to test first
"Every other player pays" effects get much stronger with 10 players: a Food Truck Rodeo at 10 players collects 18. The first variants should test `maxTargets` caps and the deck-copy thresholds, and possibly a 2-districts-to-win rule for 2 players later.

## 6. Simulation metrics

Every metric is reported **separately for each player count from 2 to 10**.

| Metric | Why it matters |
|---|---|
| Win rate by seat (95% confidence interval) | First-player advantage and fairness |
| Turns and rounds to win (mean, median, p90) | Pace. Matters most at 10 players |
| Stall rate | Whether the game can get stuck |
| Comeback rate: the winner was last in completed districts at round 5 | Swinginess |
| Card impact: win rate when a card is played vs. not played | Overpowered or useless cards |
| Bot-strength spread: greedy bot vs. random bot win rate | Whether skill matters |
| Deck reshuffles per game | Whether the deck is too small for a given player count |

A variant "changes the game" for a metric when the 95% confidence intervals don't overlap.

## 7. Hosting (free tier)

| Part | Plan |
|---|---|
| Web client | Static build on **Cloudflare Pages** (free) |
| Game server | **Cloudflare Workers with one Durable Object per room** (free plan). The Durable Object runs the same engine, holds the room state and WebSockets, and owns the turn-clock timers |
| Fallback | Render free web service. It sleeps when idle, with a cold start of about a minute |
| CI | GitHub Actions: keep the pipeline fast, because private repos have a monthly free-minutes quota |

Free-tier limits change, so they'll be re-checked when M4 starts. The engine is pure, so it can be moved between hosts.

## 8. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Repo, guardrails and CI | CI runs lint, typecheck, test and diff size checks, and branch protection is on |
| M1 | Rules engine | Every rule in §3–4 is implemented with tests, seeded games replay identically, and 2–10 players work |
| M2 | Bots and simulation CLI | `pnpm sim --ruleset base --players 2-10 --games 10000` produces the report in §6 |
| M3 | Variant pipeline | A variant pull request automatically gets a short-run simulation comparison posted |
| M4 | Online play | 2–10 players can finish a game in the browser using a room link, with the turn clock and auto-pass, on the free tier |
| M5 | Polish | Card art, Durham map view, mobile layout |

## 9. Decisions log
| Question | Decision |
|---|---|
| Name | Bull City Blocks |
| Neighborhoods | Added Trinity Park, The Eno, Walltown and Forest Hills, for 14 districts |
| Player count | 2–10. The deck doubles at 6 or more players |
| Upgrades | Generic Landmark (house) and Icon (hotel) cards named after Durham landmarks |
| Win condition | 3 complete districts, for now |
| Hosting | Free tier only |
| Turn clock | Optional per room, off by default |
| Auto-pass | Per-player preference, on by default |

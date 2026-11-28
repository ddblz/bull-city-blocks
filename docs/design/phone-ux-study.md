# Phone UX study (#75)

**Question:** why is the game hard to play on a phone, in portrait and in landscape, and how close can a phone get to the feel of playing with real cards at a table?

**Short answer:** portrait costs 2–3 screens of scrolling mid-game, mostly because your own districts and bank are drawn as full-size cards, and because 30–40% of the screen is pinned chrome. **Landscape is far worse and is a bug, not a design choice:** at 844 px and 740 px wide the page switches to the desktop layout, which is 5–10 screens tall with the Play and End turn buttons at the bottom, so nearly every tap needs a scroll. Both are fixable without hiding any information, because tableaux and banks are public (SPEC §3.4).

## How it was measured

`apps/web/e2e/phone-study.mjs` (not run in CI) plays real games against greedy and random bots in Chromium with touch emulation, with 2, 6 and 10 seats, on four phones:

| Name | Size | Orientation |
|---|---|---|
| 390x844 | 390×844 | portrait (common phone) |
| 360x740 | 360×740 | portrait (small phone) |
| 844x390 | 844×390 | landscape |
| 740x360 | 740×360 | landscape (small phone) |

At the first turn I get, and again around my 11th turn ("mid-game"), it records the page height in screens, which screen each part of the table starts on, and the height of the pinned parts (the header, the action bar and the bottom nav). Across my turns it counts taps and the scrolls needed to reach each tapped control. The player is naive (it plays or banks the first card that can be played, accepts every action, pays with the first cards that cover a debt), so the tap counts are a floor for a human.

Caveats: a game against random bots sometimes ends before turn 12, in which case "mid" is the last measurement taken, so a few cells are lower than they would be. The 740x360 run with 10 seats played 6 turns. Screenshots are full-page, so sticky and fixed parts appear partway down the picture. Numbers vary a little from game to game; the ranking of causes does not.

## Measurements

"Screens" is document height divided by the viewport height. "Pinned" is the share of the viewport taken by the sticky header, the action bar and the nav at the same time. "Scrolls/turn" is the average number of taps per turn that needed a scroll first.

| Phone | Seats | Screens, turn 1 | Screens, mid-game | Pinned | Taps/turn | Scrolls/turn |
|---|---|---|---|---|---|---|
| 390×844 | 2 | 1.3 | 3.2 | 31% | 4.4 | 2.7 |
| 390×844 | 6 | 1.3 | 2.7 | 30% | 5.1 | 2.3 |
| 390×844 | 10 | 1.3 | 2.8 | 34% | 3.7 | 1.9 |
| 360×740 | 2 | 1.5 | 1.5 | 39% | 2.0 | 0.2 |
| 360×740 | 6 | 1.5 | 2.2 | 39% | 4.1 | 2.3 |
| 360×740 | 10 | 1.5 | 1.5 | 41% | 3.0 | 0.8 |
| 844×390 | 2 | 2.8 | 8.6 | 43% | 9.8 | 9.8 |
| 844×390 | 6 | 3.5 | 9.5 | 34% | 7.3 | 7.3 |
| 844×390 | 10 | 5.7 | 9.1 | 34% | 7.7 | 7.7 |
| 740×360 | 2 | 3.7 | 5.5 | 37% | 2.5 | 2.5 |
| 740×360 | 6 | 5.7 | 6.3 | 37% | 2.2 | 2.2 |
| 740×360 | 10 | 6.3 | 6.3 | 46% | 1.2 | 1.2 |

Where the parts sit mid-game (390×844, 6 seats): the opponents' chips and your districts are on screen 1, your bank on screen 2 and your hand on screen 3. In landscape (844×390, 6 seats) your districts start on screen 3, your bank on screen 6, your hand on screen 7 and the Play and End turn buttons on screen 8. The pay dialog fits every screen measured (509 px of 844 portrait, 315 px of 390 landscape) and doesn't scroll, so the dialogs from #61 are not part of the problem.

Screenshots are in `docs/design/phone-study/` (for example `390x844-6p-mid.png` and `844x390-6p-mid.png`).

## What causes the scrolling, ranked

Portrait, by roughly how many screens each would save mid-game:

1. **Your districts are drawn as full cards.** Each set shows its cards at full size plus a status line and a rent line: about 250 px per district, so 3 or 4 districts is more than a screen (`390x844-6p-mid.png`). Cards in a set are public information and need not be shown whole.
2. **Your bank is drawn as full cards in a wrapping grid.** Five cards worth $11 took about 400 px. A pile of cash at a real table is a stack, and the number on it is what matters.
3. **Pinned chrome is 30–40% of the screen.** The sticky header is three rows of chips plus a status line (about 170 px) and the action bar and nav add about 120 px, leaving 60–70% for the game. On 740 px tall phones it is 39–41%.
4. **The hand is at the bottom of a long page.** From mid-game the hand is on screen 2 or 3, so picking a card means scrolling to it, scrolling back to see the effect, and so on: about 2 scrolls per turn on the common phone. The action bar is pinned but the cards it acts on are not.
5. **The room header and rules line above the table.** About 150 px of "Room abc" and "Rules: base" sits above the game (the #60 follow-up). It is out of view once you scroll, but it is the first screen every time.
6. **Smaller items:** the auto-pass checkbox row and the log sit below the hand and are never needed mid-turn; opening an opponent's tray pushes everything down by its height.

Landscape:

1. **The width breakpoint is the bug.** The phone layout applies below 640 px of width. A phone on its side is 844 or 740 px wide, so it gets the desktop layout on a 390 px tall screen. Everything stacks into 5–10 screens, the action bar isn't pinned, and Play and End turn are screens 4–8 down.
2. **Pinned chrome is 34–43% of the height** (the header alone is about 100 px of 390).
3. Everything in the portrait list above applies as well.

## Landscape: what fits

A phone on its side is about 390 px tall: roughly a header of 40 px, one row of opponents of 70–80 px, a row of your stacks of 90 px, a hand of 80–90 px and the actions. That does fit on one screen if districts and bank are stacks, the opponents are mini-tableaux and the hand and actions are along the bottom (`tabletop-landscape.svg`). It does not fit with full-size cards: a single district is already 190 px tall.

A landscape-specific layout is worth it: it is the orientation closest to how a hand of cards is held, and it is the one where the current layout fails worst.

## The physical table

What you see at a real table, and what our phone layout gives:

| At a real table | Our phone layout today | Gap |
|---|---|---|
| Everyone's sets and cash piles are in front of them, visible at one glance | Opponents are chips with counts; you tap each one to see their sets | You can't compare tableaux at a glance, which is most of the game's decisions (who to charge rent, who to take from) |
| Your own sets are laid in front of you, overlapping, so you see all of them at once | Full-size cards, one set per row, 250 px each | Only 3–4 sets fit; the rest need scrolling |
| Cash is a pile; its height tells you roughly what it is worth | Full cards in a grid and a number | The number is right but the grid is big and the glance is lost |
| You hold the hand close and fanned; it is always there | A fan at the bottom of a long page | You scroll to your own hand |
| Draw and discard piles sit in the middle; the top discard is visible | Text chips in the header ("Discard Walk-Off Win · Action · $1") | Fine as information; no sense of "piles" |
| It is obvious whose turn it is (they are acting) | A line of text ("greedy bot 2: playing") and a ringed chip | OK, but easy to miss when scrolled |
| Nothing is hidden except hands | Same: the rules say banks and tableaux are public | None. This is why overlapping is safe |

So the closest feel on a phone is: opponents across the top, each with overlapped set stacks and a cash pile; the piles and the "since last move" banner in the middle; your stacks and bank in front of you; your hand fanned along the bottom edge with the selected card's actions beside it. Wireframes in both orientations: `docs/design/phone-study/tabletop-portrait.svg` and `tabletop-landscape.svg`. They are layout sketches, not designs.

## Overlap options and what each reveals

Everything on a table except a hand is public (SPEC §3.4: banks and tableaux are public and rent is paid from them), so **overlapping played cards and banked cash hides nothing that a player may not see.** Cards in a hand are never overlapped into view: the hand stays private and is only ever shown to its owner. No option below reveals anything new.

| Option | What stays visible | What a tap opens | Saves (portrait mid-game) |
|---|---|---|---|
| **Stacked sets:** each set is a fan of cards offset by about 20 px | District colour and name, `n/size` or FULL, upgrade pips (Landmark, Icon), the top card | The set fanned out in a sheet, with its rent line | About 1 screen |
| **Cash stack:** the bank as an overlapped pile | The total, the number of cards, the top card | A sheet with every banked card, including properties banked as cash | About 0.5 screen |
| **One-line district rows:** a coloured row per set | Name, `n/size`, rent now | The set in a sheet | About 1 screen, but loses the "cards in front of you" feel |
| **Opponent mini-tableaux:** a two-column grid of the same stacks | Each opponent's sets and cash at a glance | Their cards | Replaces the chip strip; costs 0.2–0.4 screen but gives the comparison that chips lack |
| **Collapsed bank total only** | The total | The cash | 0.5 screen, loses the cards |
| **Pinned hand row** | The fan, always on screen; the actions beside it | n/a | About 2 scrolls per turn |
| **Thinner chrome:** one 44 px header row, the dock in one row, no room header in a game | Turn, plays left, the clock, the piles in icons | n/a | 10–20 points of screen |

I recommend stacks (sets and bank) plus a pinned hand over one-line rows, because they keep the table-like glance. Stacks should be legible without a tap: the district's colour and name must stay on the visible edge of every card in a set, and the count and FULL badge sit on top.

## Recommendation and proposed follow-up issues (not created)

Targets, measured with this script: **portrait: a whole turn within 1 screen mid-game and at most 0.5 scrolls per turn; landscape: the same, with every action reachable with no scroll.**

1. **Phone layout in landscape** (size S). Use the phone layout for short screens too, not only narrow ones: `max-width: 639px` or `max-height: 500px` and `orientation: landscape`. The pinned header is one slim row. Target: 844×390 and 740×360 at no more than 2 screens mid-game and the Play and End turn buttons always on screen. Cheapest, biggest win, since landscape is currently unplayable.
2. **Phone chrome diet** (size S). No room header or rules line during a game, a single-row header (turn, plays, clock, piles as icons), and the action bar and nav as one dock. Target: pinned chrome at most 20% of the screen on 390×844 and 25% on 360×740.
3. **Stacked districts and bank** (size M). Sets and the bank as overlapped stacks, with a sheet that fans a stack on tap, reusing the card face from #57. Target: four districts and six bank cards within 0.6 screen on 390×844.
4. **Pinned hand on phones** (size M). The hand as a fixed row of overlapped cards above the dock, with the selected card's moves beside it. Target: at most 0.5 scrolls per turn, so a turn is playable without scrolling.
5. **Opponent mini-tableaux** (size M). Replace the chip strip with a two-column grid of mini stacks, in both orientations. Target: five opponents' sets and cash visible within 0.4 screen.

Order: 1, then 2, then 3 and 4 (they can go in either order; 4 matters most in portrait), then 5. After each, rerun `phone-study.mjs` and put the table in the PR.

## Not covered

Tablets and desktop (other issues); a real-device check (this is emulation in Chromium, with the browser's own scroll behaviour; address-bar resizing on real phones makes the usable height somewhat smaller, so the numbers are optimistic); how humans, not a script, would play (the tap counts are a floor).

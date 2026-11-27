# UI mockups

Mockups made in Google Stitch for the M5 polish work (issues #56–#62). They are in `stitch/`, kept under the folder names Stitch exported them with: each screen has a `screen.png` (the picture) and a `code.html` (Stitch's own markup), and `bull_city_blocks/DESIGN.md` is the design-system document (colours, type, spacing, elevation, components).

**These are layout and style references, not specs.** SPEC.md and the game's content files decide what the game does and what things are called. Where a mockup disagrees, the game wins.

## Which screen each M5 issue should look at

| Issue | Look at |
|---|---|
| #56 Design tokens, fonts and dark mode | `bull_city_blocks/DESIGN.md` (colours, type, radii, elevation) |
| #57 The card face | `card_component_sheet_districts` |
| #58 Table layout, desktop and tablet | `game_table_your_turn_light_mode`, `game_table_dark_mode` |
| #59 Table layout, phones | `6_player_mobile_game_table` |
| #60 Lobby, rules editor, game over | `lobby_game_setup` |
| #61 Recap, payment, response and choice panels | `recap_payment_choice_flows` |
| #62 Durham map view | none: the mockups don't include a map |

## What not to take from them

1. **Another game's wording.** "Just Say No", "Deal Breaker", and a `$3M`-style currency. SPEC §1 forbids this. Use our names (Appeal, Hostile Takeover, plain `$`) and the card names in `content/durham.json`.
2. **Business names and a company line.** "Lucky Strike Tower", "CCB Plaza", and the "© 2025 Bull City Gaming Co." footer. CLAUDE.md rule 9: no business names or logos.
3. **Banks drawn as protected or face-down** ("Safe from rent"). In our rules banks are public, and rent is paid from them (SPEC §3.4).
4. **Placeholder numbers.** Rent ladders, the 110-card print deck, the 45 s clock, the deck count. Real values come from the ruleset and `content/durham.json`.
5. **Things the game doesn't have.** Avatars and photos, ping, QR pass, sound, a trade zone, a "Pass" button, a PDF export, and the Neighborhoods, Rules and Trade tabs.
6. **Their tech.** The `code.html` files use the Tailwind CDN, an icon font and Google-hosted photos. Take colours, type and layout only, in plain CSS with inline SVG icons, and no new dependencies.

## Known inconsistencies in the mockups

- `DESIGN.md` gives two terracotta reds (`#A6331B` in the token list, `#C84B31` in the prose). #56 picks which to use where, by contrast.
- The district colours in `DESIGN.md` claim AA/AAA contrast, but some (for example the golden tobacco with white text) won't reach 4.5:1. #56 tests this and adjusts.

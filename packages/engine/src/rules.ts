/**
 * The ruleset parameters createGame needs (SPEC §3.1). Hard-coded until the ruleset
 * schema and loader land in #4, which will replace BASE_RULES with rulesets/base.json.
 */
export interface RuleSet {
  id: string;
  minPlayers: number;
  maxPlayers: number;
  startingHand: number;
  /** Deck copies by player count: the first entry whose `maxPlayers` covers the count wins. */
  deckCopies: readonly { maxPlayers: number; copies: number }[];
}

export const BASE_RULES: RuleSet = {
  id: "base",
  minPlayers: 2,
  maxPlayers: 10,
  startingHand: 5,
  deckCopies: [
    { maxPlayers: 5, copies: 1 },
    { maxPlayers: 10, copies: 2 },
  ],
};

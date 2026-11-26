import type { Card, Content, District } from "./content";
import type { Result } from "./result";
import { randomInt, seedRng, shuffle } from "./rng";
import type { RuleSet } from "./rules";
import type { CardInstanceId, GameState, PlayerId, PlayerState } from "./types";

/** Number of deck copies for a player count (SPEC §3.1), or null if none covers it. */
export function deckCopies(rules: RuleSet, playerCount: number): number | null {
  return rules.deckCopies.find((tier) => playerCount <= tier.maxPlayers)?.copies ?? null;
}

/** One instance per physical card across all copies, in content order. */
export function buildDeck(content: Content, copies: number): Record<CardInstanceId, Card> {
  const cards: Record<CardInstanceId, Card> = {};
  for (let copy = 1; copy <= copies; copy++) {
    for (const card of content.cards) {
      for (let n = 1; n <= card.count; n++) cards[`${card.id}:${copy}:${n}`] = card;
    }
  }
  return cards;
}

/**
 * SPEC §3.1 setup: builds and shuffles the deck, deals `startingHand` cards to each player
 * one at a time, and picks a random starting player. Returns an error instead of throwing.
 */
export function createGame(
  rules: RuleSet,
  content: Content,
  players: readonly PlayerId[],
  seed: string,
): Result<GameState> {
  const count = players.length;
  if (count < rules.minPlayers || count > rules.maxPlayers) {
    return {
      ok: false,
      error: `need ${rules.minPlayers}–${rules.maxPlayers} players, got ${count}`,
    };
  }
  if (new Set(players).size !== count) return { ok: false, error: "player ids must be unique" };
  const copies = deckCopies(rules, count);
  if (copies === null) return { ok: false, error: `no deck size for ${count} players` };

  const cards = buildDeck(content, copies);
  const shuffled = shuffle(seedRng(seed), Object.keys(cards));
  const deck = shuffled.value;
  const hands: CardInstanceId[][] = players.map(() => []);
  for (let round = 0; round < rules.startingHand; round++) {
    for (const hand of hands) {
      const card = deck.shift();
      if (card === undefined) return { ok: false, error: "deck too small to deal" };
      hand.push(card);
    }
  }
  const start = randomInt(shuffled.rng, count);

  const playerStates: PlayerState[] = players.map((id, i) => ({
    id,
    hand: hands[i] ?? [],
    bank: [],
    tableau: [],
    prefs: { autoPass: true },
  }));
  const districts: Record<District["id"], District> = {};
  for (const d of content.districts) districts[d.id] = d;

  return {
    ok: true,
    value: {
      rules,
      cards,
      districts,
      players: playerStates,
      deck,
      discard: [],
      currentPlayer: players[start.value] as PlayerId,
      phase: "draw",
      playsRemaining: 0,
      pending: [],
      rng: start.rng,
      turn: 1,
      round: 1,
    },
  };
}

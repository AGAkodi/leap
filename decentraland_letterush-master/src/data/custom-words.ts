/**
 * Hand-picked words that must always be valid, regardless of what the
 * compiled dictionary (`dictionary-data.ts`, from the 178k-word source list)
 * happens to contain. Checked in addition to, not instead of, that list —
 * see `isWord()` in `../dictionary.ts`.
 *
 * Kept in its own file (rather than merged into the generated wordlist) so a
 * future `npm run gen:dict` regeneration can never silently drop these.
 *
 * Two groups:
 *  - Requested by name (some are game titles / slang, not standard English,
 *    so they'd never appear in a general dictionary on their own).
 *  - General casino/gambling vocabulary added alongside them.
 */
export const CUSTOM_WORDS: string[] = [
  // Requested by name
  'limbo', 'dice', 'twist', 'blackjack', 'keno', 'crash', 'plinko', 'mines',
  'hilo', 'roulette', 'wanted', 'bandit', 'anubis', 'shogun', 'skylord',
  'cherry', 'pop', 'mental', 'merlin', 'rise', 'cards', 'pho', 'sho',
  'monster', 'pocket',

  // General casino/gambling vocabulary
  'jackpot', 'wager', 'wagers', 'ante', 'fold', 'raise', 'call', 'bluff',
  'dealer', 'chip', 'chips', 'stake', 'stakes', 'odds', 'payout', 'payouts',
  'wheel', 'wheels', 'spin', 'spins', 'reel', 'reels', 'joker', 'ace', 'aces',
  'flush', 'straight', 'pair', 'poker', 'casino', 'vegas', 'baccarat',
  'craps', 'bonus', 'wild', 'scatter', 'vault', 'lucky', 'fortune',
  'treasure', 'gold', 'crown', 'ruby', 'coin', 'coins', 'cash', 'win', 'wins',
  'winner', 'loot', 'prize', 'respin', 'multiplier', 'freespin', 'bet',
  'bets', 'table', 'slots', 'slot', 'high', 'roller'
]

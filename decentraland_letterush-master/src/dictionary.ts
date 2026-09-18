/**
 * Word validation.
 *
 * `src/data/dictionary-data.ts` ships the word list front-coded and
 * alphabetically sorted: each entry is one UPPERCASE marker character
 * ('A' + shared prefix length with the previous word) followed by that word's
 * lowercase suffix. The two alphabets are disjoint, which is what lets the
 * decoder find the end of each entry.
 *
 * Decoding costs real time, so it happens once — lazily on first lookup, or
 * eagerly via preloadDictionary() during scene load. Words are re-packed into
 * one fixed-width concatenated string per length, so lookup is a plain binary
 * search with no Set allocation.
 *
 * Regenerate with: npm run gen:dict
 *
 * Casino words: `./data/custom-words.ts` is checked first, on every lookup,
 * regardless of length. It's a small hand-maintained list layered on top of
 * the compiled dictionary, so it survives a `gen:dict` regeneration untouched.
 */

import { DICT_PACKED, DICT_MAX_LEN, DICT_MIN_LEN } from './data/dictionary-data'
import { CUSTOM_WORDS } from './data/custom-words'

let buckets: string[] | null = null
let customSet: Set<string> | null = null

function customWords(): Set<string> {
  if (!customSet) customSet = new Set(CUSTOM_WORDS.map((w) => w.toLowerCase()))
  return customSet
}

function decode(): string[] {
  const byLength: string[][] = []
  for (let i = 0; i <= DICT_MAX_LEN; i++) byLength.push([])

  let prev = ''
  let i = 0
  const n = DICT_PACKED.length
  while (i < n) {
    // Marker is 'A' + sharedPrefixLength; suffix bytes are lowercase a-z.
    const shared = DICT_PACKED.charCodeAt(i) - 65
    i++
    let j = i
    while (j < n && DICT_PACKED.charCodeAt(j) >= 97 && DICT_PACKED.charCodeAt(j) <= 122) j++
    const word = prev.slice(0, shared) + DICT_PACKED.slice(i, j)
    i = j
    prev = word
    if (word.length <= DICT_MAX_LEN) byLength[word.length].push(word)
  }
  return byLength.map((list) => list.join(''))
}

/** True if `word` (any case) is in the dictionary. */
export function isWord(word: string): boolean {
  const w = word.toLowerCase()
  if (customWords().has(w)) return true
  const len = w.length
  if (len < DICT_MIN_LEN || len > DICT_MAX_LEN) return false
  if (!buckets) buckets = decode()

  const bucket = buckets[len]
  let lo = 0
  let hi = bucket.length / len - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const candidate = bucket.substr(mid * len, len)
    if (candidate === w) return true
    if (candidate < w) lo = mid + 1
    else hi = mid - 1
  }
  return false
}

/** Longest word the dictionary can validate. Runs longer than this never score. */
export const MAX_WORD_LEN = DICT_MAX_LEN

/** Warm the dictionary up during scene load so the first placement is not laggy. */
export function preloadDictionary(): void {
  if (!buckets) buckets = decode()
  customWords()
}

import type { Question } from '../../content/questions.ts'
import { count, csBySlot, numericDraft, texCount } from './build.ts'
import { ordinal } from '../format.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'

/**
 * Linear and binary search (AQA 8525 3.1.3: "understand and explain how the linear search
 * algorithm works", "how the binary search algorithm works", "students should know the mechanics
 * of the algorithm"; 3.1.2, comparing efficiency, time only and with no formal notation). One
 * generator for the five numeric written slots, each kept to its own skill by slot id:
 *
 * - q4 (core), the items linear search examines to find a value in a list;
 * - q7 (higher), the items it examines to report a value absent (all of them: it has no way of
 *   stopping early, even on a sorted list);
 * - q5 (higher), the items binary search examines to find a value;
 * - q10 (higher), the items it examines before the range is empty and the value reported absent;
 * - q14 (advanced), the most items binary search examines on a sorted list of n.
 *
 * The version is the lesson's: positions from 0, midpoint = (low + high) DIV 2, low moves past a
 * midpoint that is too small and high back before one that is too big, an item is examined when
 * it is compared with the target (the match included), and the search fails when low passes high.
 * Every binary-search prompt states the midpoint rule, as the written ones do. The worst case on n
 * items is the number of halvings that leave nothing, ⌊log₂ n⌋ + 1 (10 items 4, 1000 items 10, a
 * million 20, as the lesson's table and q14 say).
 *
 * The three higher-sheet slots take consecutive turns (q5, q7, q10), so q7's turn has the other
 * parity from q5's and q10's. Each takes list lengths of its own turn's parity, and q5's lengths
 * (8, 11, 14) and q10's (6, 9, 10, 12, 13, 16) do not overlap, so the three lists on one sheet
 * always differ in length. q10 has the lengths whose absent searches reach 2 and 5 items; q5 the
 * rest, where every count from 2 to 4 has fair targets.
 */
const TOPIC = 'linear-and-binary-search'

/** The written list, printed by q6 and q9's neighbours on the higher sheet: never drawn for a generated slot. */
const WRITTEN_LIST = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
const say = (list: number[]) => list.join(', ')
/** A position as printed: −1 with a true minus sign. */
const minus = (x: number) => (x < 0 ? `−${-x}` : String(x))
const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** n distinct whole numbers from 1 to 99, none in `avoid`. */
function values(r: Rng, n: number, avoid: number[]): number[] {
  const pool = Array.from({ length: 99 }, (_, i) => i + 1).filter((v) => !avoid.includes(v))
  return shuffle(r, pool).slice(0, n)
}
const ascending = (xs: number[]) => [...xs].sort((a, b) => a - b)

// ---------------------------------------------------------------------------------------------
// Binary search, the lesson's version
// ---------------------------------------------------------------------------------------------

export interface Probe {
  low: number
  high: number
  mid: number
  value: number
  verdict: 'found' | 'too small' | 'too big'
}

/**
 * Binary search on a sorted list with the midpoint (low + high) DIV 2, positions from 0. Every
 * probe is one item examined. `roundUp` takes (low + high + 1) DIV 2 instead: the slip the lesson
 * warns of, kept here so the tests and draws can see where it would examine a different number.
 */
export function binarySearch(list: number[], target: number, roundUp = false): Probe[] {
  const out: Probe[] = []
  let low = 0
  let high = list.length - 1
  while (low <= high) {
    const mid = Math.floor((low + high + (roundUp ? 1 : 0)) / 2)
    const value = list[mid]!
    const verdict = value === target ? 'found' : value < target ? 'too small' : 'too big'
    out.push({ low, high, mid, value, verdict })
    if (verdict === 'found') break
    if (verdict === 'too small') low = mid + 1
    else high = mid - 1
  }
  return out
}

/**
 * Second route: the same search written another way, on slices of the list rather than low and
 * high positions. The middle of a slice of length m is at (m − 1) DIV 2, the same item
 * (low + high) DIV 2 picks; the count is the depth of the recursion.
 */
function sliceSearch(list: number[], target: number): { examined: number; found: boolean } {
  if (list.length === 0) return { examined: 0, found: false }
  const mid = Math.floor((list.length - 1) / 2)
  if (list[mid] === target) return { examined: 1, found: true }
  const rest = list[mid]! < target ? list.slice(mid + 1) : list.slice(0, mid)
  const deeper = sliceSearch(rest, target)
  return { examined: deeper.examined + 1, found: deeper.found }
}

/** The trace a student writes, as a table: low, high, the midpoint worked out, the item there, and what happens. */
function traceTable(probes: Probe[]): string {
  const rows = probes.map((p) => {
    const next =
      p.verdict === 'found'
        ? 'found'
        : p.verdict === 'too small'
          ? `too small, low becomes ${p.mid + 1}`
          : `too big, high becomes ${minus(p.mid - 1)}`
    return `| ${p.low} | ${p.high} | (${p.low} + ${p.high}) DIV 2 = ${p.mid} | ${p.value} | ${next} |`
  })
  return `| low | high | midpoint | item | what happens |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}`
}

/** "16, 56 and 23". */
const and = (xs: (string | number)[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** The lengths of `pool` with the parity of `turn`: consecutive higher-sheet turns alternate. */
const byParity = (pool: number[], turn: number) => pool.filter((n) => n % 2 === ((turn % 2) + 2) % 2)
const ALL_LENGTHS = Array.from({ length: 11 }, (_, i) => i + 6)
export const Q5_LENGTHS = [8, 11, 14]
export const Q10_LENGTHS = [6, 9, 10, 12, 13, 16]

/** Picks a count from those available, by weight. */
function weightedKey(r: Rng, keys: number[], weight: Record<number, number>): number {
  const total = keys.reduce((s, k) => s + (weight[k] ?? 1), 0)
  let x = r() * total
  for (const k of keys) if ((x -= weight[k] ?? 1) < 0) return k
  return keys[keys.length - 1]!
}

/**
 * Where a found search is fair to ask: the count is not what the midpoint rounded up would give
 * (so that slip never scores), not the linear count (position + 1), and never 1 (the first
 * midpoint, which only asks which item binary search starts at).
 */
function fairFound(n: number, pos: number): boolean {
  const list = Array.from({ length: n }, (_, i) => i)
  const c = binarySearch(list, pos).length
  return c >= 2 && c !== binarySearch(list, pos, true).length && c !== pos + 1
}

/** Where an absent search is fair to ask: the target sits in gap g (below item g, above item g − 1), and rounding up would examine a different number. */
function absentCount(n: number, gap: number, roundUp = false): number {
  // Items at 10, 20, …; the target 10·gap + 5 sits between items gap − 1 and gap.
  const list = Array.from({ length: n }, (_, i) => 10 * (i + 1))
  return binarySearch(list, 10 * gap + 5, roundUp).length
}
/**
 * The target sits between two items, as the written 40 does, except on 6 items, where only a
 * target beyond either end separates the two midpoint rules. Rounding up must examine a different
 * number of items. (On 7, 14 and 15 items no gap between items does, so those lengths are not drawn.)
 */
const fairAbsent = (n: number, gap: number) =>
  absentCount(n, gap) !== absentCount(n, gap, true) && (n === 6 || (gap > 0 && gap < n))

// ---------------------------------------------------------------------------------------------
// q4: linear search, found
// ---------------------------------------------------------------------------------------------

const Q4_PROMPTS = [
  (l: string, x: number) => `Using linear search on ${l}, how many items are examined to find ${x}?`,
  (l: string, x: number) => `Linear search is used to find ${x} in the list ${l}. How many items does it examine?`,
  (l: string, x: number) => `A program uses linear search to look for ${x} in the list ${l}. How many items does it examine, counting the one that matches?`,
]

function linearFound(r: Rng, slot: Question): Draft {
  // The answer first (2nd to 15th item), then a list longer than that: never the last item,
  // where the length of the list (the slip the lesson names) would also be the answer.
  const p = int(r, 2, 15)
  const n = int(r, Math.max(6, p + 1), 16)
  const sorted = r() < 0.5
  // No item equals the answer, so the count is never read off the list.
  const list = draw(
    r,
    (r) => (sorted ? ascending(values(r, n, [p])) : values(r, n, [p])),
    (l) => !sameList(l, WRITTEN_LIST),
  )
  const x = list[p - 1]!
  const prompt = pick(r, Q4_PROMPTS)(say(list), x)
  const checked = list.slice(0, p)
  const solution =
    `Linear search checks each item in turn from the start: ${and(checked)}. ` +
    `It finds ${x} at the ${ordinal(p)} item, so **${p}** items are examined.`
  // Second route: walk the list with a counter until the item matches.
  let steps = 0
  for (const v of list) {
    steps++
    if (v === x) break
  }
  return numericDraft(
    slot,
    { prompt, solution, method: [], answer: p },
    { agrees: steps === p && list.indexOf(x) + 1 === p, detail: `walked the list with a counter: ${steps} items to reach ${x}` },
    { list: say(list), target: x, examined: p, sorted: sorted ? 'yes' : 'no' },
  )
}

// ---------------------------------------------------------------------------------------------
// q7: linear search, absent
// ---------------------------------------------------------------------------------------------

const Q7_PROMPTS = [
  (l: string, x: number) => `Using linear search on ${l}, how many items are examined to discover that ${x} is not in the list?`,
  (l: string, x: number) =>
    `Linear search looks for ${x} in the list ${l}, but ${x} is not there. How many items are examined before the search reports that ${x} is absent?`,
  (l: string, x: number) => `How many items does linear search examine in the list ${l} before it can report that ${x} is not in the list?`,
]

function linearAbsent(r: Rng, slot: Question, turn: number): Draft {
  const n = pick(r, byParity(ALL_LENGTHS, turn))
  const sorted = r() < 0.6
  const { list, x } = draw(
    r,
    (r) => {
      // No item equals the length (the answer) or one either side of it.
      const raw = values(r, n, [n - 1, n, n + 1])
      const list = sorted ? ascending(raw) : raw
      // Absent, never the answer, and on a sorted list below the last but one item: beyond it,
      // a student who stops at the first bigger item would also examine the whole list, and score.
      const room = Array.from({ length: 99 }, (_, i) => i + 1).filter(
        (v) => !list.includes(v) && Math.abs(v - n) > 1 && (!sorted || v < list[n - 2]!),
      )
      return { list, x: room.length ? pick(r, room) : 0 }
    },
    ({ list, x }) => x > 0 && !sameList(list, WRITTEN_LIST),
  )
  const prompt = pick(r, Q7_PROMPTS)(say(list), x)
  const solution =
    `Linear search has no way of knowing ${x} is absent until it reaches the end of the list without a match` +
    (sorted ? ', and it does not stop at the first item bigger than the target' : '') +
    `, so it checks all **${n}** items before reporting that ${x} is not there.`
  let steps = 0
  let found = false
  for (const v of list) {
    steps++
    if (v === x) {
      found = true
      break
    }
  }
  return numericDraft(
    slot,
    { prompt, solution, method: ['recognises every item must be checked'], answer: n },
    { agrees: !found && steps === n && list.length === n, detail: `walked all ${steps} items without a match for ${x}` },
    { list: say(list), target: x, examined: n, sorted: sorted ? 'yes' : 'no' },
  )
}

// ---------------------------------------------------------------------------------------------
// q5: binary search, found
// ---------------------------------------------------------------------------------------------

const RULE = 'Take the midpoint as (low + high) DIV 2, counting positions from 0.'

const Q5_PROMPTS = [
  (l: string, x: number) => `Using binary search on ${l}, how many items are examined to find ${x}? ${RULE}`,
  (l: string, x: number) => `Binary search is used to find ${x} in the sorted list ${l}. How many items does it examine? ${RULE}`,
  (l: string, x: number) =>
    `A program uses binary search to look for ${x} in the sorted list ${l}. How many items does it examine, counting the one that matches? ${RULE}`,
]

function binaryFound(r: Rng, slot: Question, turn: number): Draft {
  // Every fair (length, position) for this turn's lengths, grouped by count; the count first.
  const cases = byParity(Q5_LENGTHS, turn)
    .flatMap((n) => Array.from({ length: n }, (_, pos) => ({ n, pos })))
    .filter(({ n, pos }) => fairFound(n, pos))
  const byCount = new Map<number, { n: number; pos: number }[]>()
  for (const c of cases) {
    const k = binarySearch(Array.from({ length: c.n }, (_, i) => i), c.pos).length
    byCount.set(k, [...(byCount.get(k) ?? []), c])
  }
  // 8 and 14 items (even turns) offer 2, 3 and 4; 11 items (odd turns) only 3 and 4. Weighting 2 up
  // on even turns gives about 1/4, 3/8, 3/8 over the slot, and keeps 4 (the worst case, which the
  // shortcut ⌊log₂ n⌋ + 1 gives) under two builds in five.
  const k = weightedKey(r, [...byCount.keys()].sort(), { 2: 2, 3: 1, 4: 1 })
  const { n, pos } = pick(r, byCount.get(k)!)
  const list = draw(
    r,
    (r) => ascending(values(r, n, [k])),
    (l) => !sameList(l, WRITTEN_LIST),
  )
  const x = list[pos]!
  const probes = binarySearch(list, x)
  const prompt = pick(r, Q5_PROMPTS)(say(list), x)
  const before = probes.slice(0, -1).map((p) => p.value)
  const solution =
    `The list has ${n} items, at positions 0 to ${n - 1}.\n\n${traceTable(probes)}\n\n` +
    `The items examined are ${and(probes.map((p) => p.value))}: **${probes.length}** items. Linear search would have taken ${pos + 1}.`
  const second = sliceSearch(list, x)
  return numericDraft(
    slot,
    { prompt, solution, method: [`examines ${and(before)}${before.length > 1 ? ' in that order' : ' first'}`], answer: probes.length },
    {
      agrees: second.found && second.examined === probes.length && probes.length === k,
      detail: `searched slices of the list recursively: ${second.examined} items examined, found ${second.found}`,
    },
    { list: say(list), target: x, position: pos, examined: probes.length },
  )
}

// ---------------------------------------------------------------------------------------------
// q10: binary search, absent
// ---------------------------------------------------------------------------------------------

const Q10_PROMPTS = [
  (l: string, x: number) => `Using binary search on ${l}, how many items are examined to discover that ${x} is not in the list? ${RULE}`,
  (l: string, x: number) =>
    `Binary search looks for ${x} in the sorted list ${l}, but ${x} is not there. How many items are examined before the search reports that ${x} is absent? ${RULE}`,
  (l: string, x: number) => `How many items does binary search examine in the sorted list ${l} before it can report that ${x} is not in the list? ${RULE}`,
]

function binaryAbsent(r: Rng, slot: Question, turn: number): Draft {
  const cases = byParity(Q10_LENGTHS, turn)
    .flatMap((n) => Array.from({ length: n + 1 }, (_, gap) => ({ n, gap })))
    .filter(({ n, gap }) => fairAbsent(n, gap))
  const byCount = new Map<number, { n: number; gap: number }[]>()
  for (const c of cases) byCount.set(absentCount(c.n, c.gap), [...(byCount.get(absentCount(c.n, c.gap)) ?? []), c])
  // Even turns (6, 10, 12, 16 items) offer 2 to 5; odd turns (9, 13) only 3 and 4. Weighting 2 and 5
  // up on even turns gives about 1/6, 1/3, 1/3, 1/6 over the slot.
  const k = weightedKey(r, [...byCount.keys()].sort(), { 2: 2, 3: 1, 4: 1, 5: 2 })
  const { n, gap } = pick(r, byCount.get(k)!)
  // A list with room for a whole number in the chosen gap, never holding the count or the length.
  const { list, x } = draw(
    r,
    (r) => {
      const list = ascending(values(r, n, [k, n]))
      const lo = gap === 0 ? 1 : list[gap - 1]! + 1
      const hi = gap === n ? 99 : list[gap]! - 1
      const room = Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i).filter((v) => v !== k && v !== n)
      return { list, x: room.length ? pick(r, room) : 0 }
    },
    ({ list, x }) => x > 0 && !sameList(list, WRITTEN_LIST),
  )
  const probes = binarySearch(list, x)
  const last = probes[probes.length - 1]!
  const [low, high] = last.verdict === 'too small' ? [last.mid + 1, last.high] : [last.low, last.mid - 1]
  const prompt = pick(r, Q10_PROMPTS)(say(list), x)
  const solution =
    `The list has ${n} items, at positions 0 to ${n - 1}.\n\n${traceTable(probes)}\n\n` +
    `Now low is ${low} and high is ${minus(high)}: the low position has passed the high position, the range is empty, and ${x} is reported absent. ` +
    `The items examined are ${and(probes.map((p) => p.value))}: **${probes.length}** items. Linear search would have checked all ${n}.`
  const second = sliceSearch(list, x)
  return numericDraft(
    slot,
    { prompt, solution, method: [`traces ${and(probes.map((p) => p.value))} to an empty range`], answer: probes.length },
    {
      agrees: !second.found && second.examined === probes.length && probes.length === k && low > high,
      detail: `searched slices of the list recursively: ${second.examined} items examined, found ${second.found}`,
    },
    { list: say(list), target: x, gap, examined: probes.length },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: the most items binary search examines on n items
// ---------------------------------------------------------------------------------------------

/**
 * Sorted collections with the sizes each can honestly have, up to about 4 million (22
 * examinations), near the written million. Never a library (q18 on the same sheet weighs 5000
 * titles), never 1000 or 2000 (q12 asks what doubling 1000 to 2000 does).
 */
export const CONTEXTS: { what: (n: string) => string; lo: number; hi: number }[] = [
  { what: (n) => `A sorted list holds ${n} names.`, lo: 40, hi: 4_000_000 },
  { what: (n) => `A sorted list holds ${n} numbers.`, lo: 40, hi: 4_000_000 },
  { what: (n) => `A phone's contacts list holds ${n} names in alphabetical order.`, lo: 40, hi: 1500 },
  { what: (n) => `A school stores the ID numbers of its ${n} students in order.`, lo: 300, hi: 2500 },
  { what: (n) => `A shop's stock list holds ${n} product codes in order.`, lo: 500, hi: 60_000 },
  { what: (n) => `A dictionary app stores ${n} words in alphabetical order.`, lo: 20_000, hi: 500_000 },
  { what: (n) => `A website keeps the usernames of its ${n} members in alphabetical order.`, lo: 10_000, hi: 4_000_000 },
  { what: (n) => `A city council keeps the records of its ${n} residents sorted by ID number.`, lo: 50_000, hi: 1_200_000 },
]

const BANNED_SIZES = new Set([1000, 2000, 5000])

/** Round sizes from 40 to 4 000 000: 40, 75, 120, 250, 3000, 600 000…, none a power of 2 (strictly between two powers). */
export const NICE = [...new Set([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 7.5, 8, 9].flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((e) => Math.round(d * 10 ** e))))]
  .filter((n) => n >= 40 && n <= 4_000_000 && (n & (n - 1)) !== 0 && !BANNED_SIZES.has(n))
  .sort((a, b) => a - b)

const Q14_ASKS = [
  'What is the largest number of items binary search examines? Take the midpoint as (low + high) DIV 2.',
  'What is the largest number of items binary search could examine to find one of them? Take the midpoint as (low + high) DIV 2.',
  'In the worst case, how many items does binary search examine? Take the midpoint as (low + high) DIV 2.',
]

/** The bit length of n: the smallest k with 2^k > n. */
const bits = (n: number) => n.toString(2).length

function worstCase(r: Rng, slot: Question): Draft {
  // The answer first (6 to 22 examinations), then a round size between 2^(k−1) and 2^k, then a context that can hold it.
  const sizes = (k: number) => NICE.filter((n) => bits(n) === k)
  const k = pick(r, Array.from({ length: 17 }, (_, i) => i + 6).filter((k) => sizes(k).length > 0))
  const n = pick(r, sizes(k))
  const ctx = pick(r, CONTEXTS.filter((c) => c.lo <= n && n <= c.hi))
  const prompt = `${ctx.what(count(n))} ${pick(r, Q14_ASKS)}`
  const lower = 2 ** (k - 1)
  const upper = 2 ** k
  // The written q14's form: n between 2^(k−1) and 2^k, so k − 1 halvings leave one item, and examining it makes k.
  const solution =
    `Each item examined halves what is left. There are ${count(n)} items, a number between $2^{${k - 1}} = ${texCount(lower)}$ and $2^{${k}} = ${texCount(upper)}$, ` +
    `so ${k - 1} halvings leave one item, and examining that last item makes $${k - 1} + 1 = $ **${k}**. ` +
    `Linear search could examine all ${count(n)}.`
  // Second route: follow the worst path, keeping the larger part left after each midpoint is examined.
  let left = n
  let steps = 0
  while (left > 0) {
    const mid = Math.floor((left - 1) / 2)
    left = Math.max(mid, left - 1 - mid)
    steps++
  }
  return numericDraft(
    slot,
    {
      prompt,
      solution,
      method: ['halves repeatedly, or uses powers of 2', `$2^{${k - 1}} < ${texCount(n)} < 2^{${k}}$, so ${k - 1} halvings and the last item`],
      answer: k,
    },
    { agrees: steps === k && lower <= n && n < upper, detail: `followed the larger part after each midpoint: ${steps} examinations to empty a list of ${n}` },
    { n, examined: k },
  )
}

export const searchGenerator = csBySlot('cs-searching', TOPIC, {
  q4: linearFound,
  q5: binaryFound,
  q7: linearAbsent,
  q10: binaryAbsent,
  q14: worstCase,
})

export const searchGenerators: Generator[] = [searchGenerator]

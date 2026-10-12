import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { count, csBySlot, numericDraft, texCount } from './build.ts'

/**
 * Bubble sort and merge sort (AQA 8525 3.1.4: "understand and explain how the merge sort
 * algorithm works", "how the bubble sort algorithm works", "students should know the mechanics
 * of the algorithm"; 3.1.2, comparing efficiency, time only and with no formal notation: the
 * counts below are the pack's own, as its lessons and written questions set them).
 *
 * Bubble sort is the lesson's pseudo-code: pass k compares the n − k neighbouring pairs from the
 * start (each pass one shorter, because the largest value left is already at the end), swaps a
 * pair that is the wrong way round, and the sort stops after a pass that makes no swaps (the
 * swapped flag) or after n − 1 passes. So 5, 3, 8, 1, 9, 2 takes 5 + 4 + 3 + 2 + 1 = 15
 * comparisons and 8 swaps, and a sorted list one pass. Slots:
 *
 * - q5 (higher), comparisons in the first, second or third pass on n items: n − k;
 * - q8 (higher), comparisons in total on a list of 4 to 7, the passes traced until the swapped flag stops the sort;
 * - q11 (advanced), comparisons in the worst case from n(n − 1)/2;
 * - q15 (advanced), swaps in total on a list of 4 to 6, traced pass by pass;
 * - q17 (advanced), the length of a list from its worst-case comparisons.
 *
 * Merge sort is the lesson's: split until every list holds one item (one half one longer when the
 * length is odd), no comparisons while splitting, then merge in rounds, comparing only the front
 * items and copying the rest across when one list runs out. Slots:
 *
 * - q6 (higher), rounds of merging for n items: the levels of splitting, the least k with 2^k ≥ n;
 * - q14 (advanced), the comparisons one merge of two short sorted lists makes;
 * - q18 (advanced), the most comparisons a merge of two sorted lists of a and b items can need: a + b − 1.
 *
 * Slots on one sheet take consecutive turns: q5 and q8 take lengths of opposite parity, q11 and
 * q17 lengths in different classes modulo 3, and q14 and q18 merged lengths of opposite parity,
 * so no slot prints the length another works with.
 */

const say = (list: number[]) => list.join(', ')
const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
/** "16, 56 and 23". */
const and = (xs: (string | number)[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** n distinct whole numbers from 1 to `max`, in ascending order, none in `avoid`. */
function sortedValues(r: Rng, n: number, max: number, avoid: number[]): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1).filter((v) => !avoid.includes(v))
  return shuffle(r, pool)
    .slice(0, n)
    .sort((a, b) => a - b)
}

/** Every ordering of 0 … n − 1, for drawing a list by its behaviour (n ≤ 8, 40 320 at most). */
const PERMS = new Map<number, number[][]>()
function permutations(n: number): number[][] {
  const hit = PERMS.get(n)
  if (hit) return hit
  const out: number[][] = []
  const rec = (prefix: number[], left: number[]) => {
    if (!left.length) out.push(prefix)
    for (const [i, v] of left.entries()) rec([...prefix, v], [...left.slice(0, i), ...left.slice(i + 1)])
  }
  rec([], Array.from({ length: n }, (_, i) => i))
  PERMS.set(n, out)
  return out
}

// =============================================================================================
// Bubble sort
// =============================================================================================

export interface Pass {
  compared: number
  /** Each swap as the pair it exchanged, larger first: [3, 1]. */
  swaps: [number, number][]
  after: number[]
}

/** The lesson's bubble sort: pass k compares positions 0–1 … (n − k − 1)–(n − k); stops after a pass with no swaps, or after n − 1 passes. */
export function bubbleSort(list: number[]): Pass[] {
  const a = [...list]
  const passes: Pass[] = []
  for (let end = a.length - 1; end >= 1; end--) {
    const swaps: [number, number][] = []
    let compared = 0
    for (let i = 0; i <= end - 1; i++) {
      compared++
      if (a[i]! > a[i + 1]!) {
        swaps.push([a[i]!, a[i + 1]!])
        ;[a[i], a[i + 1]] = [a[i + 1]!, a[i]!]
      }
    }
    passes.push({ compared, swaps, after: [...a] })
    if (!swaps.length) break
  }
  return passes
}

/**
 * Second route for the passes: a list needs as many swapping passes as the most larger items any
 * one item has to its left (each pass moves every such item past it by one place), then one pass
 * with no swaps to find it sorted, unless the n − 1 passes have run out first.
 */
function passesByCount(list: number[]): number {
  const most = Math.max(...list.map((v, i) => list.slice(0, i).filter((u) => u > v).length))
  return Math.min(list.length - 1, most + 1)
}

/** The swaps by pairs: every pair out of order is swapped exactly once. */
const inversions = (list: number[]) => list.reduce((s, v, i) => s + list.slice(i + 1).filter((u) => u < v).length, 0)

const reversed = (p: number[]) => p.every((v, i) => v === p.length - 1 - i)

/** Lists printed by written questions the generated ones sit beside (q2 core, q10 higher). */
const BUBBLE_WRITTEN = [
  [6, 3, 9, 1],
  [8, 5, 7, 3, 6],
]

/** A list with the given ordering pattern, on values from 1 to `max` that never include `avoid`. */
function withPattern(r: Rng, pattern: number[], max: number, avoid: number[]): number[] {
  const vals = sortedValues(r, pattern.length, max, avoid)
  return pattern.map((rank) => vals[rank]!)
}

// ---------------------------------------------------------------------------------------------
// q5: comparisons in one pass
// ---------------------------------------------------------------------------------------------

const THINGS = ['items', 'numbers', 'names', 'test scores', 'prices', 'high scores']
const PASS_WORD = ['', 'first', 'second', 'third']

function passComparisons(r: Rng, slot: Question, turn: number): Draft {
  // Lengths 6 to 25 of this turn's parity (q8 takes the other), never 5 (q9 prints a 5-item list's 4 comparisons).
  const n = pick(r, Array.from({ length: 20 }, (_, i) => i + 6).filter((n) => n % 2 === ((turn % 2) + 2) % 2))
  const k = weighted(r, [
    [1, 5],
    [2, 3],
    [3, 2],
  ])
  const thing = pick(r, THINGS)
  const list = `a list of ${n} ${thing}`
  const ask = `How many comparisons does the ${PASS_WORD[k]} pass make?`
  const runs =
    k === 1
      ? ''
      : ` The list is still out of order after the ${PASS_WORD[k - 1]} pass, so a ${PASS_WORD[k]} pass runs.`
  const prompt = pick(r, [
    () => `A bubble sort runs on ${list}.${runs} ${ask}`,
    () => `${list[0]!.toUpperCase()}${list.slice(1)} is sorted with a bubble sort.${runs} ${ask}`,
  ])()
  const m = n - k
  const solution =
    k === 1
      ? `The first pass compares each neighbouring pair: with ${n} items there are $${n} - 1 = ${m}$ pairs, so **${m}** comparisons.`
      : `The first pass compares all ${n - 1} neighbouring pairs and carries the largest value to the end, so each pass after it stops one place earlier. ` +
        `The ${PASS_WORD[k]} pass makes $${n} - ${k} = ${m}$ comparisons: **${m}**.`
  // Second route: sort a reversed list of n (which runs every pass) and count the kth pass's comparisons.
  const passes = bubbleSort(Array.from({ length: n }, (_, i) => n - i))
  return numericDraft(
    slot,
    { prompt, solution, method: [`$${n} - ${k}$`], answer: m },
    { agrees: passes[k - 1]?.compared === m, detail: `bubble sort on ${n} items in reverse order: pass ${k} made ${passes[k - 1]?.compared} comparisons` },
    { n, pass: k, comparisons: m },
  )
}

// ---------------------------------------------------------------------------------------------
// q8: comparisons in total, traced
// ---------------------------------------------------------------------------------------------

/** Orderings of n by the passes the sort runs, never sorted (one pass, q9's case) or reversed (every comparison a swap). */
const BY_PASSES = new Map<number, Map<number, number[][]>>()
function byPasses(n: number): Map<number, number[][]> {
  const hit = BY_PASSES.get(n)
  if (hit) return hit
  const m = new Map<number, number[][]>()
  for (const p of permutations(n)) {
    if (reversed(p)) continue
    const runs = bubbleSort(p).length
    if (runs < 2) continue
    m.set(runs, [...(m.get(runs) ?? []), p])
  }
  BY_PASSES.set(n, m)
  return m
}

/** A pass table: comparisons, swaps and the list after each pass. */
function passTable(passes: Pass[]): string {
  const rows = passes.map((p, i) => `| ${i + 1} | ${p.compared} | ${p.swaps.length} | ${say(p.after)} |`)
  return `| Pass | Comparisons | Swaps | List after the pass |\n| --- | --- | --- | --- |\n${rows.join('\n')}`
}

/** Why the sort stopped where it did. */
function stopped(passes: Pass[], n: number): string {
  const last = passes[passes.length - 1]!
  return last.swaps.length === 0
    ? `Pass ${passes.length} makes no swaps, so the swapped flag stays False and the sort stops there.`
    : `Pass ${passes.length} is the last pass the sort allows for ${n} items ($${n} - 1 = ${n - 1}$).`
}

/**
 * Every prompt names the swapped flag, which decides when the sort stops (and so most answers),
 * without saying what it does: q7 on the same sheet asks for its purpose.
 */
const Q8_PROMPTS = [
  (l: string) => `How many comparisons in total does a bubble sort with a swapped flag make on ${l}?`,
  (l: string) => `A bubble sort with a swapped flag is run on ${l}. How many comparisons does it make altogether?`,
  (l: string) => `A bubble sort with a swapped flag puts the list ${l} into ascending order. How many comparisons does it make in total?`,
]

function totalComparisons(r: Rng, slot: Question, turn: number): Draft {
  // 4 to 7 items, so the trace fits a 2-mark question.
  const n = pick(r, [4, 5, 6, 7].filter((n) => n % 2 === ((turn % 2) + 2) % 2))
  const groups = byPasses(n)
  // The passes first, evenly, then an ordering that runs exactly that many.
  const p = pick(r, [...groups.keys()].sort((a, b) => a - b))
  const total = Array.from({ length: p }, (_, i) => n - 1 - i).reduce((s, x) => s + x, 0)
  const list = draw(
    r,
    (r) => withPattern(r, pick(r, groups.get(p)!), 30, [total]),
    (l) => !BUBBLE_WRITTEN.some((w) => sameList(w, l)),
  )
  const passes = bubbleSort(list)
  const terms = passes.map((x) => x.compared)
  const prompt = pick(r, Q8_PROMPTS)(say(list))
  const solution =
    `Each pass compares one pair fewer than the one before, starting with ${n - 1} for ${n} items.\n\n${passTable(passes)}\n\n` +
    `${stopped(passes, n)} Total comparisons: $${terms.join(' + ')} = ${total}$, so **${total}**.`
  const q = passesByCount(list)
  const closed = (q * (2 * n - q - 1)) / 2
  return numericDraft(
    slot,
    { prompt, solution, method: [`$${terms.join(' + ')}$`], answer: total },
    {
      agrees: q === passes.length && closed === total && terms.reduce((s, x) => s + x, 0) === total,
      detail: `passes from the most larger items to the left of any item: ${q}; ${q}(2 × ${n} − ${q} − 1)/2 = ${closed}`,
    },
    { list: say(list), n, passes: passes.length, comparisons: total, swaps: inversions(list) },
  )
}

// ---------------------------------------------------------------------------------------------
// q15: swaps in total, traced
// ---------------------------------------------------------------------------------------------

/** "3 and 1 swap, 4 and 2 swap". */
const swapped = (p: Pass) => p.swaps.map(([a, b]) => `${a} and ${b} swap`).join(', ')

/**
 * Orderings fair for counting swaps: not reversed (where swaps equal comparisons), some swap after
 * the first pass (so pass 1's swaps are not the answer), and a total that differs from the passes run
 * and from the length of the list.
 */
const FAIR_SWAPS = new Map<number, Map<number, number[][]>>()
function fairSwaps(n: number): Map<number, number[][]> {
  const hit = FAIR_SWAPS.get(n)
  if (hit) return hit
  const m = new Map<number, number[][]>()
  for (const p of permutations(n)) {
    const passes = bubbleSort(p)
    const total = passes.reduce((s, x) => s + x.swaps.length, 0)
    if (reversed(p) || passes.length < 2 || passes[1]!.swaps.length === 0 || total === passes.length || total === n) continue
    m.set(total, [...(m.get(total) ?? []), p])
  }
  FAIR_SWAPS.set(n, m)
  return m
}

const Q15_PROMPTS = [
  (l: string) => `Bubble sort is run on ${l}. How many swaps are made in total?`,
  (l: string) => `How many swaps does a bubble sort make altogether when it sorts ${l}?`,
  (l: string) => `A bubble sort puts ${l} into ascending order. How many swaps does it make in total?`,
]

function totalSwaps(r: Rng, slot: Question): Draft {
  // The answer first, 2 to 11 swaps, then a length that can give it, then an ordering.
  const k = int(r, 2, 11)
  const n = pick(r, [4, 5, 6].filter((n) => fairSwaps(n).has(k)))
  const list = withPattern(r, pick(r, fairSwaps(n).get(k)!), 20, [k])
  const passes = bubbleSort(list)
  const lines = passes.map((p, i) =>
    p.swaps.length
      ? `- Pass ${i + 1}: ${swapped(p)}, giving ${say(p.after)}: ${plural(p.swaps.length, 'swap')}.`
      : `- Pass ${i + 1}: no swaps, so the sort stops.`,
  )
  const last = passes[passes.length - 1]!
  if (last.swaps.length) lines.push(`- That was pass ${n - 1}, the last the sort allows for ${n} items.`)
  const counts = passes.filter((p) => p.swaps.length).map((p) => p.swaps.length)
  const prompt = pick(r, Q15_PROMPTS)(say(list))
  const solution = `${lines.join('\n')}\n\nTotal: $${counts.join(' + ')} = ${k}$, so **${k}** swaps.`
  const later = counts.slice(1)
  const method = [
    `pass 1 makes ${plural(counts[0]!, 'swap')}`,
    later.length === 1
      ? `pass 2 makes ${plural(later[0]!, 'swap')}`
      : `passes 2 ${later.length === 2 ? 'and' : 'to'} ${counts.length} make ${later.join(' + ')} swaps`,
  ]
  const byPairs = inversions(list)
  return numericDraft(
    slot,
    { prompt, solution, method, answer: k },
    { agrees: byPairs === k && counts.reduce((s, x) => s + x, 0) === k, detail: `pairs out of order in ${say(list)}: ${byPairs}` },
    { list: say(list), n, swaps: k, passes: passes.length },
  )
}

// ---------------------------------------------------------------------------------------------
// q11: worst-case comparisons from n(n − 1)/2
// ---------------------------------------------------------------------------------------------

const FORMULA = '$\\frac{n(n-1)}{2}$'

function worstComparisons(r: Rng, slot: Question, turn: number): Draft {
  // 8 to 30 items, about the written 20, so n(n − 1) stays a product to do by hand.
  const n = pick(r, Array.from({ length: 23 }, (_, i) => i + 8).filter((n) => n % 3 === ((turn % 3) + 3) % 3))
  const thing = pick(r, THINGS)
  const T = (n * (n - 1)) / 2
  const prompt = pick(r, [
    () => `How many comparisons does a bubble sort make on a list of ${n} ${thing}, using ${FORMULA}?`,
    () => `A bubble sort is run on a list of ${n} ${thing} that is in reverse order, so every pass runs. Using ${FORMULA}, how many comparisons does it make?`,
    () => `In the worst case, how many comparisons does a bubble sort make on a list of ${n} ${thing}? Use ${FORMULA}.`,
  ])()
  const solution = `$\\frac{${n} \\times ${n - 1}}{2} = \\frac{${texCount(n * (n - 1))}}{2} = ${texCount(T)}$ comparisons: $${n - 1} + ${n - 2} + \\ldots + 1$, one pass shorter each time.`
  const passes = bubbleSort(Array.from({ length: n }, (_, i) => n - i))
  const counted = passes.reduce((s, p) => s + p.compared, 0)
  return numericDraft(
    slot,
    { prompt, solution, method: [`$\\frac{${n} \\times ${n - 1}}{2}$`], answer: T },
    { agrees: counted === T, detail: `bubble sort on ${n} items in reverse order: ${passes.length} passes, ${counted} comparisons` },
    { n, comparisons: T },
  )
}

// ---------------------------------------------------------------------------------------------
// q17: the length from the worst-case comparisons
// ---------------------------------------------------------------------------------------------

function lengthFromComparisons(r: Rng, slot: Question, turn: number): Draft {
  const n = pick(r, Array.from({ length: 21 }, (_, i) => i + 5).filter((n) => n % 3 === ((turn % 3) + 3) % 3))
  const T = (n * (n - 1)) / 2
  const thing = pick(r, THINGS)
  const prompt = pick(r, [
    () => `In the worst case, a bubble sort on a list of $n$ ${thing} makes ${T} comparisons in total. How many ${thing} are in the list?`,
    () => `A bubble sort on a list of ${thing} in reverse order runs every pass and makes ${T} comparisons altogether. How many ${thing} are in the list?`,
    () => `When every pass runs, a bubble sort on a list of $n$ ${thing} makes ${T} comparisons in total. How many ${thing} does the list hold?`,
  ])()
  const solution =
    `In the worst case every pass runs, so $\\frac{n(n-1)}{2} = ${T}$, and $n(n-1) = ${2 * T}$. ` +
    `Since $${n} \\times ${n - 1} = ${2 * T}$, the list has **${n}** ${thing}.`
  // Second route: add the passes' comparisons 1 + 2 + 3 + … until they reach T; the list is one longer than the number of passes.
  let sum = 0
  let passes = 0
  while (sum < T) sum += ++passes
  return numericDraft(
    slot,
    { prompt, solution, method: [`$n(n-1) = ${2 * T}$`, `$${n} \\times ${n - 1} = ${2 * T}$`], answer: n },
    { agrees: sum === T && passes + 1 === n, detail: `1 + 2 + … + ${passes} = ${sum}, so ${passes} passes and ${passes + 1} items` },
    { n, comparisons: T },
  )
}

export const bubbleSortGenerator = csBySlot('cs-bubble-sort', 'bubble-sort', {
  q5: passComparisons,
  q8: totalComparisons,
  q11: worstComparisons,
  q15: totalSwaps,
  q17: lengthFromComparisons,
})

// =============================================================================================
// Merge sort
// =============================================================================================

/** Merges two sorted lists as the lesson does, recording each comparison of the fronts. */
export function merge(a: number[], b: number[]): { merged: number[]; steps: { fronts: [number, number]; take: number }[]; rest: number[] } {
  const steps: { fronts: [number, number]; take: number }[] = []
  const merged: number[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    const fronts: [number, number] = [a[i]!, b[j]!]
    const take = a[i]! <= b[j]! ? a[i++]! : b[j++]!
    steps.push({ fronts, take })
    merged.push(take)
  }
  const rest = i < a.length ? a.slice(i) : b.slice(j)
  return { merged: [...merged, ...rest], steps, rest }
}

/** A merge sort that splits as the lesson does (the first half the shorter) and reports how deep the splitting went. */
function mergeSortDepth(list: number[]): { sorted: number[]; depth: number } {
  if (list.length <= 1) return { sorted: list, depth: 0 }
  const half = Math.floor(list.length / 2)
  const left = mergeSortDepth(list.slice(0, half))
  const right = mergeSortDepth(list.slice(half))
  return { sorted: merge(left.sorted, right.sorted).merged, depth: 1 + Math.max(left.depth, right.depth) }
}

// ---------------------------------------------------------------------------------------------
// q6: rounds of merging
// ---------------------------------------------------------------------------------------------

/** Sizes with k rounds (2^(k−1) < n ≤ 2^k): the power itself, or a size between, every one under 100 and round ones above. */
function roundSizes(k: number): { power: number; between: number[] } {
  const lo = 2 ** (k - 1)
  const hi = 2 ** k
  const between = Array.from({ length: hi - lo - 1 }, (_, i) => lo + 1 + i).filter(
    // Never 6: 6 ÷ 2 = 3 rounds, so halving the length would score.
    (n) => n !== 6 && (n < 100 || (n < 1000 ? n % 50 === 0 : n % 100 === 0)),
  )
  return { power: hi, between }
}

const Q6_PROMPTS = [
  (n: string) => `How many rounds of merging does a merge sort need for a list of ${n} items?`,
  (n: string) => `A merge sort is used to put ${n} names into alphabetical order. How many rounds of merging does it need?`,
  (n: string) => `A list of ${n} test scores is sorted with a merge sort. How many rounds of merging are needed?`,
  (n: string) => `A merge sort sorts a list of ${n} prices into order. How many rounds of merging does it need?`,
]

function mergeRounds(r: Rng, slot: Question): Draft {
  // The answer first, 3 to 12 rounds (8 to 4096 items, the lesson's table reaching 1024), then a size.
  const k = int(r, 3, 12)
  const { power, between } = roundSizes(k)
  const n = r() < 0.3 ? power : pick(r, between)
  const sizes = [n]
  while (sizes[sizes.length - 1]! > 1) sizes.push(Math.ceil(sizes[sizes.length - 1]! / 2))
  const prompt = pick(r, Q6_PROMPTS)(count(n))
  const chain = sizes.map(count).join(' → ')
  const solution =
    n === power
      ? `Each round halves the number of lists: ${chain}, so **${k}** rounds, because $2^{${k}} = ${texCount(n)}$.`
      : `Splitting halves the longest list each time, one half taking the extra item when the length is odd: ${chain}. ` +
        `That is ${k} levels of splitting, and each round of merging undoes one level, so **${k}** rounds. ` +
        `Check: $2^{${k - 1}} = ${texCount(2 ** (k - 1))}$ is less than ${count(n)} and $2^{${k}} = ${texCount(power)}$ is not.`
  // Second route: merge sort a shuffled list of n for real and measure how deep the splitting went.
  const run = mergeSortDepth(shuffle(r, Array.from({ length: n }, (_, i) => i)))
  const inOrder = run.sorted.every((v, i) => v === i)
  return numericDraft(
    slot,
    { prompt, solution, method: [`halving ${count(n)} down to 1`], answer: k },
    { agrees: inOrder && run.depth === k && sizes.length - 1 === k, detail: `merge sort on ${n} shuffled items: sorted ${inOrder}, splitting ${run.depth} levels deep` },
    { n, rounds: k, power: n === power ? 'yes' : 'no' },
  )
}

// ---------------------------------------------------------------------------------------------
// q14: comparisons in one merge
// ---------------------------------------------------------------------------------------------

/**
 * Lists the advanced sheet's written questions work with: q12's second-round lists for
 * 8, 3, 5, 1, 7, 2, 6, 4, and q15's halves of 5, 2, 8, 1 once merged.
 */
const MERGE_WRITTEN = [
  [1, 3, 5, 8],
  [2, 4, 6, 7],
  [2, 5],
  [1, 8],
  [1, 2, 5, 8],
]

/** Every order in which the items of a and b can come out of a merge, as 'a'/'b' labels, grouped by comparisons. */
function interleavings(a: number, b: number): Map<number, string[]> {
  const m = new Map<number, string[]>()
  const rec = (s: string, x: number, y: number) => {
    if (x === a && y === b) {
      // The merge stops comparing when one list is empty: the final run of one label is copied.
      const run = s.length - s.replace(/(.)\1*$/, '').length
      const c = a + b - run
      m.set(c, [...(m.get(c) ?? []), s])
      return
    }
    if (x < a) rec(`${s}a`, x + 1, y)
    if (y < b) rec(`${s}b`, x, y + 1)
  }
  rec('', 0, 0)
  return m
}

/** Any two sorted lists. */
const Q14_PROMPTS = [
  (a: string, b: string) => `The sorted lists ${a} and ${b} are merged into one sorted list. How many comparisons does the merge make?`,
  (a: string, b: string) => `How many comparisons are made when the sorted lists ${a} and ${b} are merged?`,
]
/** Only for lengths within one of each other, as a merge sort's halving makes them. */
const Q14_IN_A_SORT = (a: string, b: string) => `A merge sort merges the sorted lists ${a} and ${b}. How many comparisons does that merge make?`

function mergeComparisons(r: Rng, slot: Question, turn: number): Draft {
  // Lengths 2 to 5 whose total has this turn's parity (q18 takes the other); never 2 and 2, whose
  // only fair merge takes 3 comparisons, the most possible.
  const pairs = [2, 3, 4, 5]
    .flatMap((a) => [2, 3, 4, 5].map((b) => [a, b] as const))
    .filter(([a, b]) => (a + b) % 2 === ((turn % 2) + 2) % 2 && a + b > 4)
  const [a, b] = pick(r, pairs)
  const groups = interleavings(a, b)
  // The answer first: never the shorter list's length (every item of it taken first), which a slip
  // also gives; and the most possible, a + b − 1 (q18's rule, on the same sheet), in only a fifth of
  // builds, so quoting it without tracing rarely pays.
  const others = [...groups.keys()].filter((c) => c !== Math.min(a, b) && c !== a + b - 1).sort((x, y) => x - y)
  const c = r() < 0.2 ? a + b - 1 : pick(r, others)
  const { A, B } = draw(
    r,
    (r) => {
      const order = pick(r, groups.get(c)!)
      const vals = sortedValues(r, a + b, 20, [c])
      return { A: vals.filter((_, i) => order[i] === 'a'), B: vals.filter((_, i) => order[i] === 'b') }
    },
    ({ A, B }) => !MERGE_WRITTEN.some((w) => sameList(w, A) || sameList(w, B)),
  )
  const m = merge(A, B)
  const rows = m.steps.map((s, i) => `| ${s.fronts[0]} and ${s.fronts[1]} | ${s.take} | ${say(m.merged.slice(0, i + 1))} |`)
  const emptied = m.rest.length && A.includes(m.rest[0]!) ? 'second' : 'first'
  rows.push(`| the ${emptied} list is empty | the rest | ${say(m.merged)} |`)
  const prompt = (Math.abs(a - b) <= 1 && r() < 0.4 ? Q14_IN_A_SORT : pick(r, Q14_PROMPTS))(say(A), say(B))
  const left = m.rest.length
  const solution =
    `Compare the front items, take the smaller, repeat.\n\n| Fronts | Take | So far |\n| --- | --- | --- |\n${rows.join('\n')}\n\n` +
    `The ${emptied} list is now empty, so ${left === 1 ? `the ${m.rest[0]} is` : `${and(m.rest)} are`} copied across without a comparison: **${m.steps.length}** comparisons.`
  // Second route: the items copied at the end are those of the list with the larger last item that are bigger than the other list's last item.
  const [hi, lo] = A[A.length - 1]! > B[B.length - 1]! ? [A, B] : [B, A]
  const tail = hi.filter((v) => v > lo[lo.length - 1]!).length
  return numericDraft(
    slot,
    {
      prompt,
      solution,
      method: ['compares only the front items', left === 1 ? 'the leftover item needs no comparison' : 'the leftover items need no comparison'],
      answer: m.steps.length,
    },
    { agrees: a + b - tail === m.steps.length && m.steps.length === c, detail: `${a} + ${b} items, ${tail} copied without comparison: ${a + b - tail}` },
    { a: say(A), b: say(B), comparisons: c, leftover: tail },
  )
}

// ---------------------------------------------------------------------------------------------
// q18: the most comparisons a merge can need
// ---------------------------------------------------------------------------------------------

const MERGE_THINGS = ['items', 'names', 'numbers', 'test scores']

function mostComparisons(r: Rng, slot: Question, turn: number): Draft {
  // Merged lengths 6 to 14 of this turn's parity, so never q14's total (the other parity); the two
  // lists within one item of each other, as a merge sort's halving makes them, or two apart.
  const N = pick(r, Array.from({ length: 9 }, (_, i) => i + 6).filter((N) => N % 2 === ((turn % 2) + 2) % 2))
  const half = Math.floor(N / 2)
  const form = pick(r, N % 2 ? (['final', 'near', 'near'] as const) : (['final', 'equal', 'apart', 'apart'] as const))
  const [a, b] = form === 'apart' ? [half - 1, half + 1] : [half, N - half]
  const [x, y] = form !== 'final' && r() < 0.5 ? [b, a] : [a, b]
  const t = pick(r, MERGE_THINGS)
  const ans = N - 1
  const pair = x === y ? `two sorted lists of ${x} ${t} each` : `a sorted list of ${x} ${t} and one of ${y} ${t}`
  const prompt =
    form === 'final'
      ? pick(r, [
          `The final merge of a merge sort on ${N} ${t} combines ${pair}. What is the largest number of comparisons that merge could need?`,
          `In the last round of a merge sort on ${N} ${t}, ${pair} are merged. What is the most comparisons that merge could make?`,
          `A merge sort on ${N} ${t} ends by merging ${pair}. At most, how many comparisons does that last merge need?`,
        ])
      : x === y
        ? pick(r, [
            `Merging two sorted lists of ${x} ${t} each produces a list of ${N}. What is the largest number of comparisons this merge could need?`,
            `Two sorted lists of ${x} ${t} each are merged into one sorted list. What is the largest number of comparisons the merge could make?`,
            `Two sorted lists hold ${x} ${t} each. At most, how many comparisons does it take to merge them into one sorted list?`,
          ])
        : pick(r, [
            `Merging a sorted list of ${x} ${t} with a sorted list of ${y} ${t} produces a list of ${N}. What is the largest number of comparisons this merge could need?`,
            `Two sorted lists, one of ${x} ${t} and one of ${y} ${t}, are merged into one sorted list. What is the largest number of comparisons the merge could make?`,
            `A sorted list of ${x} ${t} is merged with a sorted list of ${y} ${t}. At most, how many comparisons does the merge need?`,
          ])
  const shape = form === 'final' ? 'final' : x === y ? 'equal' : 'unequal'
  const solution =
    `Every comparison places one item in the merged list of ${N}. ` +
    `Once ${ans} items have been placed, one list is empty and the last item is copied across without a comparison, so the most needed is $${N} - 1 = ${ans}$. ` +
    `That happens when the two largest items sit at the ends of different lists.`
  // Second route: build that worst case, the last item of each list the two largest, and merge it for real.
  const A = Array.from({ length: a - 1 }, (_, i) => 2 * i + 1).concat(1000)
  const B = Array.from({ length: b - 1 }, (_, i) => 2 * i + 2).concat(1001)
  const m = merge(A, B)
  return numericDraft(
    slot,
    { prompt, solution, method: ['each comparison places one item', 'the final item needs no comparison'], answer: ans },
    { agrees: m.steps.length === ans && m.rest.length === 1, detail: `merged a worst case of ${a} and ${b} items: ${m.steps.length} comparisons, ${m.rest.length} copied` },
    { a, b, N, comparisons: ans, shape },
  )
}

export const mergeSortGenerator = csBySlot('cs-merge-sort', 'merge-sort', {
  q6: mergeRounds,
  q14: mergeComparisons,
  q18: mostComparisons,
})

export const sortGenerators: Generator[] = [bubbleSortGenerator, mergeSortGenerator]


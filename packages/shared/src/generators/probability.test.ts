import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { mark } from '../marking.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the probability and set generators. The release check proves each
 * answer agrees with the generator's own second method; these work every answer out again
 * here, from the prompt a student reads, by listing the whole sample space (every code, every
 * pair of dice, every ordered pair of counters, every path of the tree) or by building the
 * sets as lists of members and counting them. They also hold the shape of each experiment:
 * probabilities in [0, 1] that sum to 1, a second denominator that falls by one without
 * replacement, Venn regions that are never negative and add up to the universal set, and
 * every accepted fraction or decimal worth exactly the answer, in lowest terms where asked.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const topicFile = (topicId: string) => JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(topicFile(topicId).questions)
const N = 300

function build(id: string, slotId: string, n = N): Generated[] {
  const g = GENERATORS.find((x) => x.id === id)
  if (!g) throw new Error(`no generator ${id}`)
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: n }, (_, i) => generate(g, slot, `structure-${i}`))
}
const num = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question.answer
}
const accepted = (b: Generated) => {
  if (b.question.type !== 'short-text') throw new Error('not short-text')
  return b.question.accepted
}
const v = (b: Generated, key: string) => Number(b.values[key])
const s = (b: Generated, key: string) => String(b.values[key])
const close = (a: number, b: number) => Math.abs(a - b) < 1e-12
const ints = (text: string) => (text.match(/\d+(?:\.\d+)?/g) ?? []).map(Number)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const word = (w: string) => WORDS.indexOf(w)

/** Every sequence with one item from each pool, as arrays: the sample space written out. */
function every<T>(pools: T[][]): T[][] {
  return pools.reduce<T[][]>((out, pool) => out.flatMap((seq) => pool.map((x) => [...seq, x])), [[]])
}
/** Every ordering of k different items. */
function orderings<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]]
  return items.flatMap((x, i) => orderings(items.filter((_, j) => j !== i), k - 1).map((rest) => [x, ...rest]))
}

/** The value of an accepted form: 3/8, 3 over 8, 7 out of 120, three fifths, 0.7. */
const DENOMS = ['', '', 'half', 'third', 'quarter', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
function formValue(form: string): number {
  let m = form.match(/^(\d+)\s*(?:\/|over|out of)\s*(\d+)$/)
  if (m) return Number(m[1]) / Number(m[2])
  m = form.match(/^([a-z]+) ([a-z]+?)(?:s|ves)?$/)
  if (m) {
    const d = DENOMS.indexOf(m[2] === 'hal' ? 'half' : m[2]!)
    if (word(m[1]!) > 0 && d > 1) return word(m[1]!) / d
  }
  if (/^\d*\.\d+$|^\d+$/.test(form)) return Number(form)
  throw new Error(`cannot read the accepted form "${form}"`)
}
const lowest = (form: string) => {
  const m = form.match(/^(\d+)\/(\d+)$/)!
  return gcd(Number(m[1]), Number(m[2])) === 1
}

/** A fraction-or-decimal answer: its mark-scheme line "p/q or d", both forms checked. */
function checkEitherForm(b: Generated, expected: number) {
  const q = b.question
  if (q.type !== 'numeric') throw new Error('not numeric')
  const line = q.markScheme[q.markScheme.length - 1]!.description
  const m = line.match(/^(\d+)\/(\d+) or ([\d.]+)$/)
  expect(m, `${b.seed}: ${line}`).not.toBeNull()
  const [p, d, dec] = [Number(m![1]), Number(m![2]), m![3]!]
  expect(gcd(p, d), `${b.seed}: ${line} is not in lowest terms`).toBe(1)
  expect(close(p / d, expected), b.seed).toBe(true)
  expect(close(Number(dec), expected), b.seed).toBe(true)
  expect(close(q.answer, expected), b.seed).toBe(true)
  expect(mark(q, `${p}/${d}`).correct, b.seed).toBe(true)
  expect(mark(q, dec).correct, b.seed).toBe(true)
  expect(expected).toBeGreaterThanOrEqual(0)
  expect(expected).toBeLessThanOrEqual(1)
}

/** A short-text fraction in its simplest form: one accepted form, lowest terms, the right value. */
function checkSimplest(b: Generated, expected: number) {
  const forms = accepted(b)
  expect(forms).toHaveLength(1)
  expect(lowest(forms[0]!), `${b.seed}: ${forms[0]}`).toBe(true)
  expect(close(formValue(forms[0]!), expected), `${b.seed}: ${forms[0]} for ${expected}`).toBe(true)
  expect(expected).toBeGreaterThan(0)
  expect(expected).toBeLessThan(1)
}

describe('choices and outcomes: every count is a listing', () => {
  it('two choices pair each with each (q1, q2, q9)', () => {
    for (const slot of ['q1', 'q2', 'q9']) for (const b of build('choices-product-rule', slot)) {
      const [a, c] = ints(b.question.prompt)
      expect(num(b), b.seed).toBe(every([range(1, a!), range(1, c!)]).length)
    }
  })

  it('a code with letters and digits counts every code (q13)', () => {
    for (const b of build('choices-product-rule', 'q13', 100)) {
      const pools = [...Array(v(b, 'L')).fill(range(1, v(b, 'letters'))), ...Array(v(b, 'D')).fill(range(1, v(b, 'digits')))]
      expect(num(b), b.seed).toBe(every(pools).length)
      // The pool sizes are the ones the prompt names.
      const p = b.question.prompt
      expect(p).toContain(v(b, 'letters') === 26 ? 'A to Z' : v(b, 'letters') === 10 ? 'A to J' : 'vowels')
      expect(p).toContain(v(b, 'digits') === 10 ? '0 to 9' : '1 to 9')
    }
  })

  it('arrangements list every order of n things (q4, q7)', () => {
    for (const slot of ['q4', 'q7']) for (const b of build('choices-arrangements', slot)) {
      expect(num(b), b.seed).toBe(orderings(range(1, v(b, 'n')), v(b, 'n')).length)
      const word = b.question.prompt.match(/the word ([A-Z]+)/)?.[1]
      if (word) expect(new Set(word).size).toBe(word.length)
    }
  })

  it('codes with repeats keep the whole pool; without, the pool shrinks (q5, q6)', () => {
    for (const [slot, repeats] of [['q5', true], ['q6', false]] as const) for (const b of build('choices-codes', slot)) {
      const pool = range(1, v(b, 'size'))
      const k = v(b, 'k')
      const listed = repeats ? every(Array(k).fill(pool)).length : orderings(pool, k).length
      expect(num(b), b.seed).toBe(listed)
      expect(b.question.prompt).toMatch(repeats ? /may be repeated|padlock/ : /no (digit|letter)/)
    }
  })

  it('numbers from digits are listed and tested as numbers (q11, q12)', () => {
    for (const b of build('choices-codes', 'q11')) {
      const digits = [...s(b, 'digits')].map(Number)
      expect(num(b), b.seed).toBe(orderings(digits, v(b, 'k')).length)
      expect(v(b, 'k')).toBeGreaterThanOrEqual(3)
    }
    const kinds = new Set<string>()
    for (const b of build('choices-codes', 'q12')) {
      const p = b.question.prompt
      const digits = p.match(/digits ([\d, and]+) with/)![1]!.match(/\d/g)!.map(Number)
      const k = word(p.match(/(\w+)-digit numbers/)![1]!)
      const values = orderings(digits, k).map((d) => Number(d.join('')))
      const over = p.match(/greater than (\d+)/)
      const test = /are even/.test(p) ? (x: number) => x % 2 === 0 : /are odd/.test(p) ? (x: number) => x % 2 === 1 : /multiples of 5/.test(p) ? (x: number) => x % 5 === 0 : (x: number) => x > Number(over![1])
      expect(num(b), b.seed).toBe(values.filter(test).length)
      // A restriction that restricts: some numbers fail it.
      expect(num(b)).toBeLessThan(values.length)
      kinds.add(s(b, 'kind'))
    }
    expect(kinds.size).toBe(4)
  })

  it('order not mattering lists each selection once (q14, q15)', () => {
    for (const [slot, k] of [['q14', 2], ['q15', 3]] as const) for (const b of build('choices-order-does-not-matter', slot)) {
      const n = v(b, 'n')
      const selections = orderings(range(1, n), k).filter((x) => x.every((y, i) => i === 0 || y > x[i - 1]!))
      expect(num(b), b.seed).toBe(selections.length)
    }
  })
})

describe('sample spaces: every probability from the listed outcomes', () => {
  const die = (m: number) => range(1, m)

  it('counts of outcomes are the listed sample space (q1, q2, q18)', () => {
    for (const b of build('sample-space-counting', 'q1')) expect(num(b)).toBe(every([die(v(b, 'a')), die(v(b, 'b'))]).length)
    for (const b of build('sample-space-counting', 'q2')) expect(num(b)).toBe(every([die(v(b, 'm')), die(v(b, 'n'))]).length)
    for (const b of build('sample-space-counting', 'q18', 100)) expect(num(b)).toBe(every(Array(v(b, 'k')).fill(die(v(b, 'size')))).length)
  })

  it('exhaustive outcomes sum to exactly 1, each between 0 and 1 (q3, q9, q15)', () => {
    for (const b of build('sample-space-sum-to-one', 'q3')) {
      const parts = [v(b, 'a'), v(b, 'b'), v(b, 'c')]
      expect(parts.reduce((x, y) => x + y, 0)).toBe(100)
      for (const p of parts) expect(p > 0 && p < 100).toBe(true)
      expect(close(num(b), v(b, 'c') / 100)).toBe(true)
    }
    for (const b of build('sample-space-sum-to-one', 'q9')) expect(Math.round(num(b) * 100) + v(b, 'k')).toBe(100)
    for (const b of build('sample-space-sum-to-one', 'q15')) {
      const parts = [...s(b, 'given').split(',').map(Number), Math.round(num(b) * 100)]
      expect(parts).toHaveLength(v(b, 's'))
      expect(parts.reduce((x, y) => x + y, 0)).toBe(100)
      for (const p of parts) expect(p > 0 && p < 100).toBe(true)
      // The prompt gives every probability but the one asked for.
      for (const p of s(b, 'given').split(',')) expect(b.question.prompt).toContain(String(Number(p) / 100))
    }
  })

  it('a die and a coin: the event counted in the listed die × coin space (q5)', () => {
    for (const b of build('sample-space-reading', 'q5')) {
      const p = b.question.prompt
      const m = word(p.match(/fair (\w+)-sided die/)![1]!)
      const face = /a head\?/.test(p) ? 'H' : 'T'
      const n = p.match(/a (\d+) and/)
      const over = p.match(/greater than (\d+)/)
      const test = n ? (x: number) => x === Number(n[1]) : over ? (x: number) => x > Number(over[1]) : /even number/.test(p) ? (x: number) => x % 2 === 0 : (x: number) => x % 2 === 1
      const space = every<number | string>([die(m), ['H', 'T']])
      const fav = space.filter(([x, c]) => test(x as number) && c === face).length
      checkEitherForm(b, fav / space.length)
      // The event and its complement make up the whole space.
      expect(fav + space.filter(([x, c]) => !(test(x as number) && c === face)).length).toBe(space.length)
    }
  })

  it('two dice: parity, doubles and "at least / at most" counted cell by cell (q6, q11, q12)', () => {
    for (const b of build('sample-space-reading', 'q6')) {
      const grid = every([die(v(b, 'm')), die(v(b, 'n'))])
      const op = (x: number[]) => (s(b, 'op') === 'total' ? x[0]! + x[1]! : x[0]! * x[1]!)
      const even = grid.filter((x) => op(x) % 2 === 0).length
      const odd = grid.filter((x) => op(x) % 2 === 1).length
      expect(even + odd).toBe(grid.length)
      checkEitherForm(b, (s(b, 'parity') === 'even' ? even : odd) / grid.length)
      expect(b.question.prompt).toContain(`${s(b, 'op')} is ${s(b, 'parity')}`)
    }
    for (const b of build('sample-space-reading', 'q11')) {
      const grid = every([die(v(b, 'm')), die(v(b, 'm'))])
      const doubles = grid.filter(([x, y]) => x === y).length
      checkEitherForm(b, (/not getting/.test(b.question.prompt) ? grid.length - doubles : doubles) / grid.length)
    }
    for (const b of build('sample-space-reading', 'q12')) {
      const p = b.question.prompt
      const t = Number(p.match(/at (?:least|most) (\d+)/)![1])
      const grid = every([die(v(b, 'm')), die(v(b, 'n'))])
      const fav = grid.filter(([x, y]) => (/at least/.test(p) ? x! + y! >= t : x! + y! <= t)).length
      checkEitherForm(b, fav / grid.length)
      // The boundary total itself is counted, as the mark scheme says.
      expect(grid.some(([x, y]) => x! + y! === t)).toBe(true)
    }
  })

  it('coins: exactly k from every listed sequence, and the k = 0..n cases sum to 1 (q7)', () => {
    for (const b of build('sample-space-reading', 'q7')) {
      const n = v(b, 'n')
      const seqs = every(Array(n).fill(['H', 'T']))
      const count = (k: number) => seqs.filter((q) => q.filter((c) => c === s(b, 'face')).length === k).length
      checkEitherForm(b, count(v(b, 'k')) / seqs.length)
      expect(range(0, n).reduce((t, k) => t + count(k), 0)).toBe(seqs.length)
      for (const seq of seqs) expect(b.question.solution).toContain(seq.join(''))
    }
  })

  it('at least one: 1 − P(none) and the listed trials agree (q14)', () => {
    for (const b of build('sample-space-reading', 'q14')) {
      const m = v(b, 'm')
      const trials = every(Array(v(b, 'k')).fill(range(0, m - 1)))
      const hit = trials.filter((t) => t.includes(0)).length
      const none = trials.length - hit
      expect(close(1 - none / trials.length, hit / trials.length)).toBe(true)
      expect(close(1 - ((m - 1) / m) ** v(b, 'k'), hit / trials.length)).toBe(true)
      checkEitherForm(b, hit / trials.length)
    }
  })
})

describe('combined events and trees', () => {
  it('the same outcome twice is one cell of the listed pairs (q3)', () => {
    for (const b of build('tree-independent', 'q3')) {
      const m = v(b, 'm')
      const pairs = every([range(1, m), range(1, m)])
      checkEitherForm(b, pairs.filter(([x, y]) => x === 1 && y === 1).length / pairs.length)
    }
  })

  it('two days: the four paths sum to 1 and the answer is the right paths (q5, q6, q9)', () => {
    const asks = new Set<string>()
    for (const [slot, which] of [['q5', 'both'], ['q6', 'once'], ['q9', '']] as const) for (const b of build('tree-independent', slot)) {
      const p = Number(b.question.prompt.match(/(0\.\d+)/)![1])
      const q = 1 - p
      const paths = { both: p * p, once: 2 * p * q, neither: q * q }
      expect(close(paths.both + paths.once + paths.neither, 1)).toBe(true)
      const asked = which || s(b, 'which')
      asks.add(`${slot}:${asked}`)
      expect(s(b, 'which')).toBe(asked)
      expect(Math.abs(num(b) - paths[asked as keyof typeof paths]), b.seed).toBeLessThan(1e-12)
      expect(num(b) > 0 && num(b) < 1).toBe(true)
      // A rare event for q5 and q6, a likely one for q9, as written.
      expect(slot === 'q9' ? p > 0.5 : p < 0.5).toBe(true)
    }
    expect(asks).toEqual(new Set(['q5:both', 'q6:once', 'q9:both', 'q9:neither']))
  })

  it('with replacement the second branch is unchanged (q7)', () => {
    for (const b of build('tree-independent', 'q7')) {
      const [a, c] = ints(b.question.prompt)
      const colour = b.question.prompt.match(/both are (\w+)\?/)![1]!
      const first = b.question.prompt.match(/(\d+) (\w+) and (\d+) (\w+) (?:counters|sweets|marbles|socks)/)!
      const items = [...Array(a).fill(first[2]), ...Array(c).fill(first[4])]
      const pairs = every([items, items])
      checkEitherForm(b, pairs.filter(([x, y]) => x === colour && y === colour).length / pairs.length)
      const [d1, d2] = [...b.question.solution.matchAll(/\\dfrac\{\d+\}\{(\d+)\}/g)].map((m) => Number(m[1]))
      expect(d1).toBe(items.length)
      expect(d2).toBe(items.length)
    }
  })

  it('without replacement: ordered pairs of two different items, and the second denominator falls by one (q11, q12, q13, q15)', () => {
    for (const slot of ['q11', 'q12', 'q13', 'q15']) for (const b of build('tree-without-replacement', slot)) {
      const [a, c] = [v(b, 'a'), v(b, 'b')]
      const items = [...Array(a).fill(s(b, 'x')), ...Array(c).fill(s(b, 'y'))] as string[]
      const n = items.length
      const pairs = orderings(items.map((_, i) => i), 2).map(([i, j]) => [items[i!]!, items[j!]!])
      expect(pairs).toHaveLength(n * (n - 1))
      const colour = s(b, 'colour')
      const which = s(b, 'which')
      const fav = pairs.filter(([x, y]) =>
        which === 'both' ? x === colour && y === colour : which === 'mixed' ? x !== y : which === 'same' ? x === y : x === colour || y === colour).length
      checkSimplest(b, fav / pairs.length)
      if (which === 'at least one') {
        const none = pairs.filter(([x, y]) => x !== colour && y !== colour).length
        expect(close(1 - none / pairs.length, fav / pairs.length)).toBe(true)
      }
      // Every product along a branch goes from n to n − 1 in its denominator.
      const products = [...b.question.solution.matchAll(/\\dfrac\{\d+\}\{(\d+)\} \\times \\dfrac\{\d+\}\{(\d+)\}/g)]
      expect(products.length, b.seed).toBeGreaterThan(0)
      for (const m of products) {
        expect(Number(m[1])).toBe(n)
        expect(Number(m[2])).toBe(n - 1)
      }
      expect(b.question.prompt).toContain('without replacement')
    }
  })

  it('the advanced sheet asks both, one of each and at least one, and q15 rotates', () => {
    const t = topicFile('combined-events-and-tree-diagrams')
    const written = bank('combined-events-and-tree-diagrams')
    const q15 = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const sheet = sheetQuestions('maths', 'combined-events-and-tree-diagrams', t.worksheets.advanced.questionIds.map((id: string) => written.find((q) => q.id === id)!), `sheet-${i}`)
      const which = Object.fromEntries(sheet.filter((x) => x.generated?.generatorId === 'tree-without-replacement').map((x) => [x.question.id, String(x.generated!.values.which)]))
      expect([which.q11, which.q12, which.q13]).toEqual(['both', 'mixed', 'at least one'])
      q15.add(which.q15!)
    }
    expect(q15).toEqual(new Set(['mixed', 'same']))
  })
})

describe('relative frequency and expected outcomes', () => {
  it('a relative frequency is hits over trials, and the counts add up (q3, q6, q18)', () => {
    for (const b of build('relative-frequency-estimates', 'q3')) {
      const [n, k] = ints(b.question.prompt.replace(/^.*?(\d+) times.*?(\d+) times.*$/, '$1 $2'))
      expect(close(num(b), k! / n!)).toBe(true)
    }
    for (const b of build('relative-frequency-estimates', 'q6')) {
      const counts = s(b, 'counts').split(',').map(Number)
      expect(counts.reduce((x, y) => x + y, 0)).toBe(v(b, 'N'))
      expect(close(counts.reduce((t, c) => t + c / v(b, 'N'), 0), 1)).toBe(true)
      expect(close(num(b), counts[v(b, 'ask')]! / v(b, 'N'))).toBe(true)
    }
    for (const b of build('relative-frequency-estimates', 'q18')) {
      const pooled = (v(b, 'k1') + v(b, 'k2')) / (v(b, 'n1') + v(b, 'n2'))
      const averaged = (v(b, 'k1') / v(b, 'n1') + v(b, 'k2') / v(b, 'n2')) / 2
      expect(close(num(b), pooled)).toBe(true)
      // The two people threw different numbers of times, so the average of rates is wrong.
      expect(close(pooled, averaged)).toBe(false)
    }
  })

  it('an expected frequency is the listed probability times the trials, in whole numbers (q4, q5, q14)', () => {
    for (const b of build('relative-frequency-expected', 'q4')) {
      const p = b.question.prompt
      const m = word(p.match(/fair (\w+)-sided dice/)![1]!)
      const n = p.match(/land on (\d+)\?/)
      const over = p.match(/greater than (\d+)/)
      const test = n ? (x: number) => x === Number(n[1]) : over ? (x: number) => x > Number(over[1]) : /even/.test(p) ? (x: number) => x % 2 === 0 : (x: number) => x % 3 === 0
      const fav = range(1, m).filter(test).length
      expect(num(b) * m).toBe(fav * v(b, 'N'))
      expect(Number.isInteger(num(b))).toBe(true)
    }
    for (const b of build('relative-frequency-expected', 'q5')) {
      expect(num(b) * 100).toBe(v(b, 'k') * v(b, 'N'))
      expect(v(b, 'k') > 0 && v(b, 'k') < 100).toBe(true)
    }
    for (const b of build('relative-frequency-expected', 'q14')) {
      const m = v(b, 'm')
      const grid = every([range(1, m), range(1, m)])
      const event = s(b, 'event')
      const t = Number(event.match(/\d+/)?.[0])
      const fav = grid.filter(([x, y]) =>
        /double six|double four/.test(event) ? x === m && y === m : event === 'a double' ? x === y : /greater than/.test(event) ? x! + y! > t : x! + y! === t).length
      expect(num(b) * grid.length, b.seed).toBe(fav * v(b, 'N'))
    }
  })

  it('the best estimate uses the most throws (q7), the profit is takings less expected prizes (q15), and P(yellow) completes 1 (q16)', () => {
    for (const b of build('relative-frequency-expected', 'q7')) {
      expect(v(b, 'n3')).toBe(Math.max(v(b, 'n1'), v(b, 'n2'), v(b, 'n3')))
      expect(num(b) * v(b, 'n3')).toBe(v(b, 'k3') * v(b, 'M'))
      // Cumulative counts never fall and never exceed the throws.
      expect(v(b, 'k1') < v(b, 'k2') && v(b, 'k2') < v(b, 'k3') && v(b, 'k3') < v(b, 'n3')).toBe(true)
    }
    for (const b of build('relative-frequency-expected', 'q15')) {
      const outcomes = range(1, v(b, 's'))
      const perGame = outcomes.reduce((t, x) => t + (v(b, 'fee') - (x <= v(b, 'w') ? v(b, 'prize') : 0)) / v(b, 's'), 0)
      expect(Math.abs(num(b) - perGame * v(b, 'N'))).toBeLessThan(1e-9)
      expect(num(b)).toBeGreaterThan(0)
    }
    for (const b of build('relative-frequency-expected', 'q16')) {
      expect(v(b, 'a') + v(b, 'b') + v(b, 'c') + v(b, 'rest')).toBe(100)
      expect(num(b) * 100).toBe(v(b, 'rest') * v(b, 'N'))
    }
  })
})

describe('frequency trees', () => {
  it('the end boxes add to the root, and the root splits into its branches (q1, q9)', () => {
    for (const b of build('frequency-tree-counts', 'q1')) expect(num(b) + v(b, 'A')).toBe(v(b, 'T'))
    for (const b of build('frequency-tree-counts', 'q9')) {
      const ends = ints(b.question.prompt.split(':')[1]!).slice(0, 6)
      const [A, a1, a0, B, b1, b0] = ends as [number, number, number, number, number, number]
      expect(a1 + a0).toBe(A)
      expect(b1 + b0).toBe(B)
      expect(num(b)).toBe(a1 + a0 + b1 + b0)
      for (const e of ends) expect(e).toBeGreaterThan(0)
    }
  })

  it('every accepted form of a tree probability is worth the answer, in lowest terms where asked (q6, q7, q10, q11)', () => {
    for (const b of build('frequency-tree-probabilities', 'q6')) {
      const forms = accepted(b)
      for (const f of forms) expect(close(formValue(f), v(b, 'w') / v(b, 'T')), f).toBe(true)
      expect(gcd(v(b, 'w'), v(b, 'T'))).toBe(1)
    }
    for (const slot of ['q7', 'q10']) for (const b of build('frequency-tree-probabilities', slot)) {
      const forms = accepted(b)
      expect(lowest(forms[0]!)).toBe(true)
      for (const f of forms) expect(close(formValue(f), v(b, 'k') / v(b, 'size')), `${b.seed}: ${f}`).toBe(true)
      // The fraction on the tree does simplify, so lowest terms is something to do.
      expect(gcd(v(b, 'k'), v(b, 'size'))).toBeGreaterThan(1)
      for (const f of forms) expect(mark(b.question, f).correct).toBe(true)
      expect(mark(b.question, `${v(b, 'k')}/${v(b, 'size')}`).correct).toBe(false)
    }
    for (const b of build('frequency-tree-probabilities', 'q11')) {
      const forms = accepted(b)
      expect(lowest(forms[0]!)).toBe(true)
      for (const f of forms) expect(close(formValue(f), v(b, 'b1') / v(b, 'w'))).toBe(true)
      // Conditioned on the doers, not on the branch.
      expect(close(formValue(forms[0]!), v(b, 'b1') / v(b, 'B'))).toBe(false)
    }
  })

  it('a branch-chosen question picks from a different branch on q7 and q10', () => {
    for (const [b7, b10] of build('frequency-tree-probabilities', 'q7', 50).map((b, i) => [b, build('frequency-tree-probabilities', 'q10', 50)[i]!] as const)) {
      expect(b7.question.prompt).not.toBe(b10.question.prompt)
    }
  })

  it('an expected frequency multiplies the tree probability by the new group (q15)', () => {
    for (const b of build('frequency-tree-counts', 'q15')) expect(num(b) * v(b, 'T')).toBe(v(b, 'w') * v(b, 'M'))
  })
})

/** People 1..N in two sets, from the four region counts. */
function crowd(a: number, c: number, b: number, d: number) {
  const people = range(1, a + c + b + d)
  const A = people.filter((p) => p <= a + c)
  const B = people.filter((p) => p > a && p <= a + c + b)
  return { people, A, B }
}

describe('Venn diagrams: regions never negative, adding to the whole, answers counted from members', () => {
  const regions = (b: Generated) => {
    const a = b.values.a !== undefined ? v(b, 'a') : v(b, 'nA') - v(b, 'both')
    const c = b.values.c !== undefined ? v(b, 'c') : v(b, 'both')
    const bb = b.values.b !== undefined ? v(b, 'b') : v(b, 'nB') - v(b, 'both')
    const N = v(b, 'N')
    return { a, c, b: bb, d: N - a - c - bb, N }
  }
  const sane = (r: ReturnType<typeof regions>, seed: string) => {
    for (const x of [r.a, r.c, r.b, r.d]) expect(x, seed).toBeGreaterThanOrEqual(0)
    expect(r.a + r.c + r.b + r.d).toBe(r.N)
  }

  it('only, neither and both from the totals (q1, q2, q10, q15)', () => {
    for (const b of build('venn-filling', 'q1')) {
      const r = regions(b)
      sane(r, b.seed)
      const { A, B } = crowd(r.a, r.c, r.b, r.d)
      expect(num(b)).toBe(s(b, 'ask') === 'B only' ? B.filter((p) => !A.includes(p)).length : A.filter((p) => !B.includes(p)).length)
    }
    for (const slot of ['q2', 'q10']) for (const b of build('venn-filling', slot)) {
      const r = regions(b)
      sane(r, b.seed)
      const { people, A, B } = crowd(r.a, r.c, r.b, r.d)
      expect(num(b)).toBe(people.filter((p) => !A.includes(p) && !B.includes(p)).length)
    }
    for (const b of build('venn-working-backwards', 'q15')) {
      const both = num(b)
      const r = { a: v(b, 'nA') - both, c: both, b: v(b, 'nB') - both, d: v(b, 'neither'), N: v(b, 'N') }
      sane(r, b.seed)
      const { A, B } = crowd(r.a, r.c, r.b, r.d)
      expect(A.filter((p) => B.includes(p)).length).toBe(both)
      expect(A.length).toBe(v(b, 'nA'))
      expect(B.length).toBe(v(b, 'nB'))
    }
  })

  it('probabilities from the regions, every form worth the count over the whole (q5, q6, q11)', () => {
    for (const b of build('venn-probability', 'q5')) {
      const r = regions(b)
      sane(r, b.seed)
      const { people, A, B } = crowd(r.a, r.c, r.b, r.d)
      const which = s(b, 'which')
      const k = people.filter((p) => {
        const [x, y] = [A.includes(p), B.includes(p)]
        return which === 'both' ? x && y : which === 'A only' ? x && !y : which === 'B only' ? y && !x : !x && !y
      }).length
      checkSimplest(b, k / people.length)
    }
    for (const b of build('venn-probability', 'q6')) {
      const r = regions(b)
      sane(r, b.seed)
      const { people, A, B } = crowd(r.a, r.c, r.b, r.d)
      const k = people.filter((p) => (s(b, 'exactly') === 'true' ? A.includes(p) !== B.includes(p) : A.includes(p) || B.includes(p))).length
      checkEitherForm(b, k / people.length)
    }
    for (const b of build('venn-probability', 'q11')) {
      const r = regions(b)
      sane(r, b.seed)
      const { A, B } = crowd(r.a, r.c, r.b, r.d)
      const [given, other] = s(b, 'given') === 'B' ? [B, A] : [A, B]
      checkSimplest(b, given.filter((p) => other.includes(p)).length / given.length)
      // The given circle is the denominator, not everyone.
      expect(close(formValue(accepted(b)[0]!), r.c / r.N)).toBe(false)
    }
  })

  it('three sets: eight regions adding to the whole, answers counted from members (q7, q12, q18)', () => {
    for (const slot of ['q12', 'q18']) for (const b of build('venn-filling', slot)) {
      const keys = ['1', '2', '3', '12', '13', '23', '123', 'none']
      const counts = keys.map((k) => v(b, k))
      for (const c of counts) expect(c).toBeGreaterThanOrEqual(0)
      expect(counts.reduce((x, y) => x + y, 0)).toBe(v(b, 'N'))
      const members = keys.flatMap((k, i) => Array(counts[i]!).fill(k === 'none' ? '' : k)) as string[]
      if (slot === 'q12') {
        const two = s(b, 'two') === 'true'
        expect(num(b)).toBe(members.filter((m) => m.length === (two ? 2 : 1)).length)
      } else expect(num(b)).toBe(members.filter((m) => m.includes(s(b, 'set'))).length)
    }
    for (const b of build('venn-filling', 'q7')) {
      expect(num(b)).toBe(v(b, 'pair') - v(b, 'middle'))
      expect(num(b)).toBeGreaterThan(0)
    }
  })

  it('a region from its probability is the probability times the whole (q14)', () => {
    const whiches = new Set<string>()
    for (const b of build('venn-working-backwards', 'q14')) {
      expect(num(b) * v(b, 'q')).toBe(v(b, 'p') * v(b, 'N'))
      expect(num(b)).toBe(v(b, 'k'))
      expect(gcd(v(b, 'p'), v(b, 'q'))).toBe(1)
      whiches.add(s(b, 'which'))
    }
    expect(whiches.size).toBe(3)
  })

  it('rotates the region asked between attempts (q5 all four, q6 and q11 both kinds, q12 one and two)', () => {
    expect(new Set(build('venn-probability', 'q5').map((b) => s(b, 'which'))).size).toBe(4)
    expect(new Set(build('venn-probability', 'q6').map((b) => s(b, 'exactly'))).size).toBe(2)
    expect(new Set(build('venn-probability', 'q11').map((b) => s(b, 'given'))).size).toBe(2)
    expect(new Set(build('venn-filling', 'q12').map((b) => s(b, 'two'))).size).toBe(2)
  })
})

/** A property as the prompt names it, read back without the generator's own list. */
function property(name: string): (x: number) => boolean {
  if (name === 'the even numbers') return (x) => x % 2 === 0
  if (name === 'the odd numbers') return (x) => x % 2 === 1
  if (name === 'the prime numbers') return (x) => x > 1 && range(2, x - 1).every((d) => x % d)
  if (name === 'the square numbers') return (x) => range(1, x).some((r) => r * r === x)
  let m = name.match(/^the multiples of (\d+)$/)
  if (m) return (x) => x % Number(m![1]) === 0
  m = name.match(/^the factors of (\d+)$/)
  if (m) return (x) => Number(m![1]) % x === 0
  throw new Error(`unknown property ${name}`)
}

describe('sets and set notation: every answer rebuilt from the member lists', () => {
  it('the set of a word or number has each letter or digit once (q1)', () => {
    for (const b of build('set-listing', 'q1')) {
      const source = b.question.prompt.match(/(?:word|number) (\w+)\?/)![1]!
      const members: string[] = []
      for (const ch of source) if (!members.includes(ch)) members.push(ch)
      expect(num(b)).toBe(members.length)
      expect(members.length).toBeLessThan(source.length)
    }
  })

  const universe = (b: Generated) => {
    const [lo, n] = b.question.prompt.match(/numbers (\d+) to (\d+)/)!.slice(1).map(Number) as [number, number]
    return range(lo, n)
  }
  const checkList = (b: Generated, expected: number[]) => {
    const forms = accepted(b)
    expect(forms[0], b.seed).toBe(expected.join(', '))
    expect(forms.at(-1), b.seed).toBe([...expected].reverse().join(', '))
    for (const f of forms) expect(f.split(', ').map(Number).sort((x, y) => x - y)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  }

  it('A ∩ B, A′ and one circle without the other, from explicit lists (q5, q10, q11)', () => {
    for (const b of build('set-listing', 'q5')) {
      const xi = universe(b)
      const A = xi.filter(property(s(b, 'A')))
      const B = xi.filter(property(s(b, 'B')))
      checkList(b, A.filter((x) => B.includes(x)))
    }
    for (const b of build('set-listing', 'q10')) {
      const xi = universe(b)
      const A = xi.filter(property(s(b, 'A')))
      const complement = xi.filter((x) => !A.includes(x))
      checkList(b, complement)
      expect(complement.length + A.length).toBe(xi.length)
    }
    const flips = new Set<string>()
    for (const b of build('set-listing', 'q11')) {
      const xi = universe(b)
      const A = xi.filter(property(s(b, 'A')))
      const B = xi.filter(property(s(b, 'B')))
      const flip = /A′ ∩ B/.test(b.question.prompt)
      expect(s(b, 'flip')).toBe(String(flip))
      flips.add(String(flip))
      const notB = xi.filter((x) => !B.includes(x))
      const notA = xi.filter((x) => !A.includes(x))
      checkList(b, flip ? notA.filter((x) => B.includes(x)) : A.filter((x) => notB.includes(x)))
    }
    expect(flips.size).toBe(2)
  })

  it('n(A ∪ B), n(A′) and the union rule, counted from members (q7, q8, q12, q13)', () => {
    for (const b of build('set-counting', 'q7')) {
      const { A, B } = crowd(v(b, 'a'), v(b, 'c'), v(b, 'b'), 0)
      expect(num(b)).toBe(new Set([...A, ...B]).size)
    }
    for (const b of build('set-counting', 'q8')) {
      for (const k of ['a', 'b', 'c', 'd']) expect(v(b, k)).toBeGreaterThanOrEqual(0)
      const { people, A, B } = crowd(v(b, 'a'), v(b, 'c'), v(b, 'b'), v(b, 'd'))
      const [P, Q] = b.question.prompt.match(/in (\w) only, .*? in (\w) only/)!.slice(1)
      const S = s(b, 'of') === P ? A : B
      expect(s(b, 'of') === P || s(b, 'of') === Q).toBe(true)
      expect(num(b)).toBe(people.filter((p) => !S.includes(p)).length)
    }
    for (const b of build('set-counting', 'q12')) {
      const both = v(b, 'both')
      const { A, B } = crowd(v(b, 'nA') - both, both, v(b, 'nB') - both, 0)
      expect(A.length).toBe(v(b, 'nA'))
      expect(num(b)).toBe(new Set([...A, ...B]).size)
    }
    for (const b of build('set-counting', 'q13')) {
      const both = num(b)
      const { people, A, B } = crowd(v(b, 'nA') - both, both, v(b, 'nB') - both, v(b, 'neither'))
      expect(people.length).toBe(v(b, 'N'))
      expect(v(b, 'nA') - both).toBeGreaterThanOrEqual(0)
      expect(v(b, 'nB') - both).toBeGreaterThanOrEqual(0)
      expect(people.filter((p) => !A.includes(p) && !B.includes(p)).length).toBe(v(b, 'neither'))
    }
  })

  it('set-notation probabilities from members, every form worth the answer (q15, q16)', () => {
    for (const [slot, kind] of [['q15', 'overlap'], ['q16', 'complement']] as const) {
      const variants = new Set<string>()
      for (const b of build('set-probability', slot)) {
        const { people, A, B } = crowd(v(b, 'a'), v(b, 'c'), v(b, 'b'), v(b, 'd'))
        const variant = s(b, 'variant') === 'true'
        variants.add(String(variant))
        const k = kind === 'overlap'
          ? (variant ? people.filter((p) => A.includes(p) || B.includes(p)) : people.filter((p) => A.includes(p) && B.includes(p))).length
          : people.filter((p) => !(variant ? B : A).includes(p)).length
        checkEitherForm(b, k / people.length)
        // No set is called P: P(P ∩ Q) would read as nonsense.
        expect(b.question.prompt).not.toMatch(/P\(P/)
      }
      expect(variants.size).toBe(2)
    }
  })
})

describe('slots sharing a sheet ask different questions', () => {
  const MINE = ['choices-and-outcomes', 'sample-space-diagrams', 'combined-events-and-tree-diagrams', 'relative-frequency-and-expected-outcomes', 'frequency-trees', 'venn-diagrams', 'sets-and-set-notation']

  it('no two generated questions on a sheet print the same prompt or the same answer working', () => {
    for (const topicId of MINE) {
      const t = topicFile(topicId)
      const written = bank(topicId)
      for (const level of ['core', 'higher', 'advanced'] as const) {
        for (let i = 0; i < 60; i++) {
          const sheet = sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => written.find((q) => q.id === id)!), `sheet-${i}`)
          const fresh = sheet.filter((x) => x.generated)
          expect(new Set(fresh.map((x) => x.question.prompt)).size, `${topicId} ${level}`).toBe(fresh.length)
          expect(new Set(fresh.map((x) => x.question.solution)).size, `${topicId} ${level}`).toBe(fresh.length)
        }
      }
    }
  })

  it('every numeric and short-text slot in these topics has a generator but the definition', () => {
    const skipped: string[] = []
    for (const topicId of MINE) for (const q of bank(topicId)) {
      if (q.type !== 'numeric' && q.type !== 'short-text') continue
      if (!GENERATORS.some((g) => g.topicId === topicId && g.replaces.includes(q.id))) skipped.push(`${topicId}/${q.id}`)
    }
    expect(skipped).toEqual(['relative-frequency-and-expected-outcomes/q10'])
  })
})

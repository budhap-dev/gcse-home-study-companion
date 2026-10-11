import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { DISTINCT_WORDS, ONE_REPEAT_WORDS, TWO_REPEAT_WORDS } from './counting.ts'

/**
 * Structural tests for the counting generators (8365 1.2). The generators count by listing;
 * these read the prompt's own numbers, digits or word back and count by formula (factorials,
 * Pascal's triangle, cases written here), so the two routes share no code. They also check the
 * printed steps, the named wrong routes, the spread and the wording.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'the-product-rule-for-counting'
const bank = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)

function build(generatorId: string, slotId: string, count = 300, prefix = 'counting'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank.find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `${prefix}-${i}`))
}

const numeric = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question
}
const answer = (b: Generated) => numeric(b).answer
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1))
/** Ordered selections of k from n: n!/(n − k)!. */
const P = (n: number, k: number) => fact(n) / fact(n - k)
/** Pascal's triangle, row by row. */
const pascal = (n: number, k: number): number => (k === 0 || k === n ? 1 : pascal(n - 1, k - 1) + pascal(n - 1, k))
const NUMBERS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }
/** "1, 3, 4, 6 and 8" or "4 or 7" back to digits. */
const digitsOf = (list: string) => list.split(/, | and | or /).map(Number)

function spread(bs: Generated[], minDistinct: number, most = 0.4) {
  const counts = new Map<number, number>()
  for (const b of bs) counts.set(answer(b), (counts.get(answer(b)) ?? 0) + 1)
  expect(counts.size).toBeGreaterThanOrEqual(minDistinct)
  expect(Math.max(...counts.values()) / bs.length).toBeLessThanOrEqual(most)
}

function common(bs: Generated[]) {
  for (const b of bs) {
    expect(b.question.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(b.question.prompt, b.seed).not.toMatch(/\b1 (choices|ways|digits|letters|cards)\b/)
    expect(numeric(b).tolerance).toBe(0)
    expect(Number.isInteger(answer(b))).toBe(true)
    expect(mark(numeric(b), String(answer(b))).correct, b.seed).toBe(true)
    expect(b.check.agrees, b.seed).toBe(true)
  }
  const wide = build(bs[0]!.generatorId, bs[0]!.question.id, 1000, 'wide')
  const prompts = new Map<string, number>()
  for (const b of wide) prompts.set(b.question.prompt, (prompts.get(b.question.prompt) ?? 0) + 1)
  expect(prompts.size).toBeGreaterThan(150)
  // No one prompt, the written one least of all, takes more than 5% of builds.
  expect(Math.max(...prompts.values()) / wide.length).toBeLessThanOrEqual(0.05)
  const written = bank.find((q) => q.id === bs[0]!.question.id)!.prompt
  expect((prompts.get(written) ?? 0) / wide.length).toBeLessThanOrEqual(0.05)
}

describe('fm-counting-menu (q1): one from each of three lists', () => {
  const built = build('fm-counting-menu', 'q1')
  const read = (b: Generated) => (b.question.prompt.match(/\d+/g) ?? []).map(Number)

  it('multiplies three different counts, none of them 1', () => {
    for (const b of built) {
      const xs = read(b)
      expect(xs, b.seed).toHaveLength(3)
      expect(new Set(xs).size).toBe(3)
      for (const x of xs) expect(x).toBeGreaterThanOrEqual(2)
      expect(answer(b)).toBe(xs[0]! * xs[1]! * xs[2]!)
      expect(b.question.solution, b.seed).toMatch(new RegExp(`, so multiply: \\$${xs[0]} \\\\times ${xs[1]} \\\\times ${xs[2]} = ${answer(b)}\\$\\.$`))
      expect(answer(b)).not.toBe(xs[0]! + xs[1]! + xs[2]!)
    }
    common(built)
  })

  it('spreads its answers and its contexts', () => {
    spread(built, 15, 0.15)
    expect(new Set(built.map((b) => b.question.prompt.split(' ').slice(0, 3).join(' '))).size).toBeGreaterThanOrEqual(6)
  })
})

describe('fm-counting-codes (q2): codes with repeats', () => {
  const built = build('fm-counting-codes', 'q2')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const L = NUMBERS[/(\w+)-digit codes|is (\w+) digits long|has (\w+) digits/.exec(p)!.slice(1).find(Boolean)!]!
    const digits = digitsOf(/(\d(?:, \d)* (?:and|or) \d)/.exec(p)![1]!)
    return { L, digits }
  }

  it('gives n to the power of the length', () => {
    for (const b of built) {
      const { L, digits } = read(b)
      expect(new Set(digits).size).toBe(digits.length)
      expect(answer(b), b.seed).toBe(digits.length ** L)
      expect(b.question.solution).toBe(`With repeats every position has all ${digits.length} choices: $${Array(L).fill(digits.length).join(' \\times ')} = ${answer(b)}$.`)
    }
    common(built)
  })

  it('is not also given by swapping base and power, by no repeats, or by n × L', () => {
    for (const b of built) {
      const { L, digits } = read(b)
      const n = digits.length
      expect(L ** n).not.toBe(answer(b))
      expect(P(n, L)).not.toBe(answer(b))
      expect(n * L).not.toBe(answer(b))
    }
  })

  it('spreads its answers and lengths', () => {
    spread(build('fm-counting-codes', 'q2', 1000, 'wide'), 12, 0.2)
    expect(new Set(built.map((b) => read(b).L))).toEqual(new Set([2, 3, 4]))
  })
})

describe('fm-counting-codes (q10): codes without a digit', () => {
  const built = build('fm-counting-codes', 'q10')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const dice = p.startsWith('An ordinary dice')
    const n = dice ? 6 : Number(/from 1 to (\d)/.exec(p)![1])
    const L = dice ? (/rolled twice/.test(p) ? 2 : NUMBERS[/rolled (\w+) times/.exec(p)![1]!]!) : NUMBERS[/has (\w+) digits|is (\w+) digits long/.exec(p)!.slice(1).find(Boolean)!]!
    const m = /contain no (\d)(?: and no (\d))?\?$/.exec(p)!
    const gone = m[2] ? [Number(m[1]), Number(m[2])] : [Number(m[1])]
    return { n, L, gone }
  }

  it('gives (n − excluded) to the power of the length, and the complement in the solution', () => {
    for (const b of built) {
      const { n, L, gone } = read(b)
      for (const g of gone) expect(g >= 1 && g <= n).toBe(true)
      const left = n - gone.length
      expect(answer(b), b.seed).toBe(left ** L)
      expect(b.question.solution, b.seed).toContain(`${left} digits are available at each position: $${Array(L).fill(left).join(' \\times ')} = ${answer(b)}$`)
      expect(b.question.solution, b.seed).toContain(`$${n ** L} - ${answer(b)} = ${n ** L - left ** L}$`)
      expect(answer(b)).toBeLessThanOrEqual(729)
    }
    common(built)
  })

  it('is not also given by the complement, by excluding from one position only, or by no repeats', () => {
    for (const b of built) {
      const { n, L, gone } = read(b)
      const left = n - gone.length
      expect(n ** L - left ** L, b.seed).not.toBe(answer(b))
      expect(left * n ** (L - 1)).not.toBe(answer(b))
      expect(P(left, L)).not.toBe(answer(b))
      expect(n ** L - 1).not.toBe(answer(b))
    }
  })

  it('spreads its answers, with two digits left out in some builds and the dice in some', () => {
    spread(built, 10, 0.25)
    const two = built.filter((b) => read(b).gone.length === 2).length / built.length
    expect(two).toBeGreaterThan(0.15)
    expect(two).toBeLessThan(0.45)
    expect(built.some((b) => b.question.prompt.startsWith('An ordinary dice'))).toBe(true)
  })
})

const wordOf = (b: Generated) => /word ([A-Z]+)/.exec(b.question.prompt)![1]!
const counts = (w: string) => { const m = new Map<string, number>(); for (const c of w) m.set(c, (m.get(c) ?? 0) + 1); return [...m.values()].filter((n) => n > 1).sort((a, b) => b - a) }
const distinctSpellings = (w: string) => fact(w.length) / counts(w).reduce((a, k) => a * fact(k), 1)

describe('fm-counting-arrangements (q3): all letters different', () => {
  const built = build('fm-counting-arrangements', 'q3')

  it('gives n! for a word with no repeated letter', () => {
    for (const b of built) {
      const w = wordOf(b)
      expect(counts(w), w).toEqual([])
      expect(answer(b)).toBe(fact(w.length))
      expect(b.question.solution).toMatch(new RegExp(`different letters: \\$${Array.from({ length: w.length }, (_, i) => w.length - i).join(' \\\\times ')} = ${w.length}! = ${answer(b)}\\$\\.$`))
    }
    common(built)
  })

  it('uses 4 to 7 letters about evenly: n! has only four values here (24, 120, 720, 5040)', () => {
    spread(build('fm-counting-arrangements', 'q3', 1000, 'wide'), 4, 0.3)
    for (const n of [4, 5, 6, 7]) expect(built.filter((b) => wordOf(b).length === n).length / built.length).toBeGreaterThan(0.18)
  })
})

describe('fm-counting-arrangements (q7): one repeated letter', () => {
  const built = build('fm-counting-arrangements', 'q7')

  it('gives n!/k! for one letter repeated k times', () => {
    for (const b of built) {
      const w = wordOf(b)
      const c = counts(w)
      expect(c.length, w).toBe(1)
      expect(answer(b)).toBe(fact(w.length) / fact(c[0]!))
      expect(b.question.solution).toMatch(new RegExp(`^\\$${w.length}! = ${fact(w.length)}\\$ arrangements if the letters were all different\\.`))
      expect(b.question.solution).toContain(`$${fact(w.length)} \\div ${fact(c[0]!)} = ${answer(b)}$`)
      expect(b.question.markScheme[0]!.description).toBe(c[0] === 2 ? `${w.length}! = ${fact(w.length)}` : `${w.length}! ÷ 3!`)
    }
    common(built)
    const school = build('fm-counting-arrangements', 'q7', 3000, 'find').find((b) => wordOf(b) === 'SCHOOL')!
    expect(school.question.solution).toBe("$6! = 720$ arrangements if the letters were all different. The two O's are identical, so each arrangement has been counted twice: $720 \\div 2 = 360$.")
  })

  it('has a letter three times in about a third, where dividing by 3 instead of 3! shows; never just n!', () => {
    const triple = built.filter((b) => counts(wordOf(b))[0] === 3)
    expect(triple.length / built.length).toBeGreaterThan(0.2)
    expect(triple.length / built.length).toBeLessThan(0.45)
    for (const b of triple) expect(fact(wordOf(b).length) / 3).not.toBe(answer(b))
    for (const b of built) expect(fact(wordOf(b).length)).not.toBe(answer(b))
  })

  it('spreads across lengths 4 to 7: six possible answers, none over 40%', () => {
    spread(built, 6)
  })
})

describe('fm-counting-arrangements (q15): two repeated letters', () => {
  const built = build('fm-counting-arrangements', 'q15')

  it('gives n!/(a! b!) for two repeated letters', () => {
    for (const b of built) {
      const w = wordOf(b)
      const c = counts(w)
      expect(c.length, w).toBe(2)
      expect(answer(b)).toBe(distinctSpellings(w))
      expect(b.question.solution).toContain(`divide by $${c[0]}! \\times ${c[1]}! = ${fact(c[0]!) * fact(c[1]!)}$: $${fact(w.length)} \\div ${fact(c[0]!) * fact(c[1]!)} = ${answer(b)}$.`)
      expect(b.question.markScheme[0]!.description).toBe(`${w.length}! divided by ${c[0]}! × ${c[1]}!`)
    }
    common(built)
    const level = build('fm-counting-arrangements', 'q15', 3000, 'find').find((b) => wordOf(b) === 'LEVEL')!
    expect(level.question.solution).toBe('Five letters give $5! = 120$ if all were different. L appears twice and E appears twice, so divide by $2! \\times 2! = 4$: $120 \\div 4 = 30$.')
  })

  it('is not also given by dividing once, or by adding the factorials when a letter appears three times', () => {
    for (const b of built) {
      const w = wordOf(b)
      const c = counts(w)
      expect(fact(w.length) / 2).not.toBe(answer(b))
      if (c[0] === 3) expect(fact(w.length) / (fact(3) + fact(2))).not.toBe(answer(b))
    }
    // For two pairs 2! × 2! = 2! + 2!, so only the [3, 2] words show that slip: they are about 43%.
    const wide = build('fm-counting-arrangements', 'q15', 1000, 'wide')
    const triple = wide.filter((b) => counts(wordOf(b))[0] === 3).length / wide.length
    expect(triple).toBeGreaterThan(0.35)
    expect(triple).toBeLessThan(0.5)
  })

  it('spreads across five shapes of word, none over 40%', () => {
    spread(built, 5)
  })
})

describe('word lists', () => {
  it('hold the letter patterns they are filed under', () => {
    for (const [n, ws] of Object.entries(DISTINCT_WORDS)) for (const w of ws) expect([w.length, counts(w)], w).toEqual([Number(n), []])
    for (const [key, ws] of Object.entries({ ...ONE_REPEAT_WORDS, ...TWO_REPEAT_WORDS })) for (const w of ws) expect(`${w.length}:${counts(w).join(',')}`, w).toBe(key)
  })
})

/** "How many four-digit … from the digits 1, 3, 4, 6 and 8": k and the digits. */
const readDigits = (p: string) => ({
  k: NUMBERS[/(\w+)-digit/i.exec(p)![1]!.toLowerCase()]!,
  digits: /the digits 0 to 9/.test(p) ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : digitsOf(/the digits (\d(?:, \d)* and \d)/.exec(p)![1]!),
})

describe('fm-counting-digits (q5): a restriction on the last digit', () => {
  const built = build('fm-counting-digits', 'q5')
  const read = (b: Generated) => {
    const { k, digits } = readDigits(b.question.prompt)
    const odd = / odd numbers/.test(b.question.prompt)
    return { k, digits, odd, o: digits.filter((d) => d % 2 === (odd ? 1 : 0)).length }
  }

  it('gives (digits that can end) × the rest filled in order', () => {
    for (const b of built) {
      const { k, digits, o } = read(b)
      const n = digits.length
      expect(digits).not.toContain(0)
      expect(answer(b), b.seed).toBe(o * P(n - 1, k - 1))
      expect(b.question.solution, b.seed).toContain(`fix it first, ${o} choice`)
      expect(b.question.solution, b.seed).toMatch(new RegExp(`\\$${o} \\\\times ${P(n - 1, k - 1)} = ${answer(b)}\\$\\.$`))
      expect(b.question.markScheme[0]!.description).toBe(`last digit first: ${o} choice${o === 1 ? '' : 's'}`)
    }
    common(built)
    const spec = build('fm-counting-digits', 'q5', 20000, 'find').find((b) => b.question.prompt === 'How many five-digit odd numbers can be formed from the digits 1, 3, 4, 6 and 8 if no digit is repeated?')
    expect(spec, 'the written case is drawn').toBeDefined()
    expect(spec!.question.solution).toBe('Odd means the last digit is 1 or 3: fix it first, 2 choices. The other four digits fill the other four positions in $4! = 24$ ways. $2 \\times 24 = 48$.')
  })

  it('is not also given by halving, by ignoring the restriction, or by not using up the last digit', () => {
    for (const b of built) {
      const { k, digits, o } = read(b)
      const n = digits.length
      expect(P(n, k) / 2).not.toBe(answer(b))
      expect(P(n, k)).not.toBe(answer(b))
      expect(o * P(n, k - 1)).not.toBe(answer(b))
      expect(digits).not.toContain(answer(b))
    }
  })

  it('spreads its answers, odd and even, all digits and fewer; never k = n − 1, which repeats k = n', () => {
    spread(build('fm-counting-digits', 'q5', 1000, 'wide'), 10, 0.2)
    for (const b of built) expect(read(b).k, b.seed).not.toBe(read(b).digits.length - 1)
    const odd = built.filter((b) => read(b).odd).length / built.length
    expect(odd).toBeGreaterThan(0.45)
    expect(odd).toBeLessThan(0.75)
    expect(built.some((b) => read(b).k < read(b).digits.length)).toBe(true)
    expect(built.some((b) => read(b).k === read(b).digits.length)).toBe(true)
  })
})

describe('fm-counting-digits (q6): a restriction on the first digit', () => {
  const built = build('fm-counting-digits', 'q6')
  const read = (b: Generated) => ({ ...readDigits(b.question.prompt), starts: digitsOf(/start with ([\d, or]+)\?$/.exec(b.question.prompt)![1]!) })

  it('gives (first digits allowed) × the rest filled in order', () => {
    for (const b of built) {
      const { k, digits, starts } = read(b)
      const n = digits.length
      for (const s of starts) expect(digits).toContain(s)
      expect(answer(b), b.seed).toBe(starts.length * P(n - 1, k - 1))
      expect(b.question.solution, b.seed).toMatch(new RegExp(`So \\$${starts.length} \\\\times ${P(n - 1, k - 1)} = ${answer(b)}\\$\\.$`))
    }
    common(built)
    const nine = build('fm-counting-digits', 'q6', 20000, 'find').find((b) => b.question.prompt === 'How many four-digit numbers, using each of the digits 1, 3, 5, 7 and 9 at most once, start with 9?')
    expect(nine, 'the written case is drawn').toBeDefined()
    expect(nine!.question.solution).toBe('The first digit is fixed as 9: 1 choice. The other three positions take three of the remaining four digits: $4 \\times 3 \\times 2 = 24$. So $1 \\times 24 = 24$.')
  })

  it('is not also given by ignoring the restriction, by not using up the first digit, or by forgetting there are two', () => {
    for (const b of built) {
      const { k, digits, starts } = read(b)
      const n = digits.length
      expect(P(n, k)).not.toBe(answer(b))
      expect(starts.length * P(n, k - 1)).not.toBe(answer(b))
      if (starts.length === 2) expect(P(n - 1, k - 1)).not.toBe(answer(b))
      expect(digits).not.toContain(answer(b))
    }
  })

  it('spreads its answers, with two allowed first digits in some builds', () => {
    spread(built, 10, 0.25)
    const two = built.filter((b) => read(b).starts.length === 2).length / built.length
    expect(two).toBeGreaterThan(0.15)
    expect(two).toBeLessThan(0.45)
  })
})

describe('fm-counting-digits (q11): restrictions that interact', () => {
  const built = build('fm-counting-digits', 'q11')
  const read = (b: Generated) => ({ ...readDigits(b.question.prompt), five: /multiples of 5/.test(b.question.prompt) })
  /** By cases on the last digit: each allowed last digit d leaves (n − 1) first digits if d is 0, (n − 2) if not. */
  const byCases = (digits: number[], k: number, ends: (d: number) => boolean) =>
    digits.filter(ends).reduce((s, d) => s + (d === 0 ? digits.length - 1 : digits.length - 2) * P(digits.length - 2, k - 2), 0)

  it('splits on a last digit of 0 and adds the two cases', () => {
    for (const b of built) {
      const { k, digits, five } = read(b)
      const n = digits.length
      const ends = (d: number) => (five ? d % 5 === 0 : d % 2 === 0)
      expect(digits).toContain(0)
      expect(answer(b), b.seed).toBe(byCases(digits, k, ends))
      const A = P(n - 1, k - 1)
      const B = answer(b) - A
      const others = digits.filter((d) => d !== 0 && ends(d))
      expect(B).toBe(others.length * (n - 2) * P(n - 2, k - 2))
      const s = b.question.solution
      expect(s, b.seed).toContain(`Last digit $0$: first digit any of ${n - 1}, `)
      expect(s, b.seed).toContain(`giving $${Array.from({ length: k - 1 }, (_, i) => n - 1 - i).join(' \\times ')} = ${A}$`)
      expect(s, b.seed).toContain(`first digit ${n - 2} choices (not 0, not the last digit)`)
      expect(s, b.seed).toMatch(new RegExp(`Total \\$${A} \\+ ${B} = ${answer(b)}\\$\\.$`))
      expect(b.question.markScheme).toEqual([
        { code: 'M1', marks: 1, description: 'splits on whether the last digit is 0' },
        { code: 'A1', marks: 1, description: `${A} and ${B}` },
        { code: 'A1', marks: 1, description: String(answer(b)) },
      ])
    }
    common(built)
    const written = build('fm-counting-digits', 'q11', 1000, 'find').find((b) => b.question.prompt.startsWith('How many three-digit even numbers can be made from the digits 0 to 9'))!
    expect(written.question.solution).toBe('The two restrictions interact, because $0$ is even but cannot lead. Split on the last digit. Last digit $0$: first digit any of 9, middle any of 8, giving $9 \\times 8 = 72$. Last digit 2, 4, 6 or 8: first digit 8 choices (not 0, not the last digit), middle 8, giving $4 \\times 8 \\times 8 = 256$. Total $72 + 256 = 328$.')
  })

  it('is not also given by ignoring the leading 0, by first-digit-first without the split, or by halving', () => {
    let halved = 0
    for (const b of built) {
      const { k, digits, five } = read(b)
      const n = digits.length
      const E = digits.filter((d) => (five ? d % 5 === 0 : d % 2 === 0)).length
      expect(E * P(n - 1, k - 1)).not.toBe(answer(b))
      expect((n - 1) * E * P(n - 2, k - 2)).not.toBe(answer(b))
      if (((n - 1) * P(n - 1, k - 1)) / 2 === answer(b)) halved++
    }
    expect(halved / built.length).toBeLessThanOrEqual(0.05)
  })

  it('draws all ten digits about 1 time in 11, with four digits as well as three', () => {
    const wide = build('fm-counting-digits', 'q11', 1000, 'wide')
    const ten = wide.filter((b) => read(b).digits.length === 10)
    expect(ten.length / wide.length).toBeGreaterThan(0.04)
    expect(ten.length / wide.length).toBeLessThan(0.14)
    expect(new Set(ten.map((b) => answer(b)))).toEqual(new Set([328, 136, 2296, 952]))
  })

  it('spreads its answers, with multiples of 5 and four digits in some builds', () => {
    spread(built, 15, 0.25)
    expect(built.filter((b) => read(b).five).length / built.length).toBeGreaterThan(0.2)
    expect(built.filter((b) => read(b).k === 4).length / built.length).toBeGreaterThan(0.1)
  })
})

describe('fm-counting-digits (q12): a restriction, two ways', () => {
  const built = build('fm-counting-digits', 'q12')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const m = /do not (start|end) with (\d)\?$|(start|end) with neither (\d) nor (\d)\?$/.exec(p)!
    const place = m[1] ?? m[3]!
    const banned = m[2] ? [Number(m[2])] : [Number(m[4]), Number(m[5])]
    return { ...readDigits(p), place, banned }
  }

  it('gives (allowed digits for that place) × the rest, equal to all minus the banned', () => {
    for (const b of built) {
      const { k, digits, banned, place } = read(b)
      const n = digits.length
      const f = banned.length
      expect(answer(b), b.seed).toBe((n - f) * P(n - 1, k - 1))
      expect(answer(b)).toBe(P(n, k) - f * P(n - 1, k - 1))
      const s = b.question.solution
      expect(s, b.seed).toContain(`${place === 'end' ? 'Last' : 'First'} digit: ${n - f} choices (`)
      expect(s, b.seed).toContain(`: $${[n - f, ...Array.from({ length: k - 1 }, (_, i) => n - 1 - i)].join(' \\times ')} = ${answer(b)}$.`)
      expect(s, b.seed).toContain(`Alternatively, all $${P(n, k)}$ minus the $${f * P(n - 1, k - 1)}$ that ${place} with`)
    }
    common(built)
    const written = build('fm-counting-digits', 'q12', 20000, 'find').find((b) => b.question.prompt === 'Three-digit numbers are made using each of the digits 1, 2, 3 and 4 at most once. How many of them do not start with 4?')
    expect(written, 'the written case is drawn').toBeDefined()
    expect(written!.question.solution).toBe('First digit: 3 choices (1, 2 or 3). Then 3 choices for the second and 2 for the third: $3 \\times 3 \\times 2 = 18$. Alternatively, all $24$ minus the $6$ that start with 4.')
  })

  it('is not also given by subtracting only one number, or by leaving the digit out altogether', () => {
    for (const b of built) {
      const { k, digits, banned } = read(b)
      const n = digits.length
      expect(P(n, k) - banned.length).not.toBe(answer(b))
      expect(P(n - banned.length, k)).not.toBe(answer(b))
    }
  })

  it('spreads its answers, with "end" and two banned digits in some builds', () => {
    spread(built, 8, 0.25)
    expect(built.filter((b) => read(b).place === 'end').length / built.length).toBeGreaterThan(0.15)
    expect(built.filter((b) => read(b).banned.length === 2).length / built.length).toBeGreaterThan(0.1)
  })
})

describe('fm-counting-committees (q8): order does not count', () => {
  const built = build('fm-counting-committees', 'q8')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const m =
      /committee of (\d+) is chosen from (?:the )?(\d+)/.exec(p) ??
      /picks (\d+) students from a group of (\d+)/.exec(p) ??
      /chooses (\d+) of the (\d+) staff/.exec(p) ??
      /chooses (\d+) books .* shelf of (\d+)/.exec(p) ??
      /with (\d+) different toppings chosen from the (\d+)/.exec(p)
    if (!m) throw new Error(`unexpected prompt ${p}`)
    return { k: Number(m[1]), n: Number(m[2]) }
  }

  it('gives the number from Pascal’s triangle, by ordered ÷ k!', () => {
    for (const b of built) {
      const { n, k } = read(b)
      expect(answer(b), b.seed).toBe(pascal(n, k))
      expect(b.question.solution, b.seed).toMatch(new RegExp(`^Ordered, \\$${Array.from({ length: k }, (_, i) => n - i).join(' \\\\times ')} = ${P(n, k)}\\$\\. .* has no order, and ${k} \\w+ can be ordered in \\$${k}! = ${fact(k)}\\$ ways, so \\$${P(n, k)} \\\\div ${fact(k)} = ${answer(b)}\\$\\.$`))
      expect(b.question.markScheme[0]!.description).toBe(`${Array.from({ length: k }, (_, i) => n - i).join(' × ')} divided by ${k}!`)
      expect(P(n, k)).toBeLessThan(10000)
    }
    common(built)
  })

  it('is not also given by the ordered count, or by dividing by k instead of k!', () => {
    for (const b of built) {
      const { n, k } = read(b)
      expect(P(n, k)).not.toBe(answer(b))
      expect(P(n, k) / k).not.toBe(answer(b))
    }
  })

  it('spreads its answers and contexts', () => {
    spread(built, 10, 0.2)
    expect(new Set(built.map((b) => b.question.prompt.slice(0, 12))).size).toBeGreaterThanOrEqual(5)
  })
})

describe('every draw succeeds', () => {
  it('over 3000 seeds per slot', () => {
    for (const [id, slot] of [
      ['fm-counting-menu', 'q1'],
      ['fm-counting-codes', 'q2'],
      ['fm-counting-codes', 'q10'],
      ['fm-counting-arrangements', 'q3'],
      ['fm-counting-arrangements', 'q7'],
      ['fm-counting-arrangements', 'q15'],
      ['fm-counting-digits', 'q5'],
      ['fm-counting-digits', 'q6'],
      ['fm-counting-digits', 'q11'],
      ['fm-counting-digits', 'q12'],
      ['fm-counting-committees', 'q8'],
    ] as const) {
      const all = build(id, slot, 3000, 'many')
      expect(all.every((b) => b.check.agrees)).toBe(true)
    }
  }, 120000)
})

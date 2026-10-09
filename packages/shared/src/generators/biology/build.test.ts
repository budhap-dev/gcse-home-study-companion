import { describe, expect, it } from 'vitest'
import type { Question } from '../../content/questions.ts'
import { rng } from '../random.ts'
import { balanced, between, cut, ending, fair, figureTolerance, full, gcd, halfLastPlace, layered, lcm, list, memo, onGrid, piRoom, rich, tidy, toThree, trail, unitsOf, whole, WithArticle, withArticle } from './build.ts'

/**
 * The shared Biology helpers, each tested on its own. The draw helpers are checked for what they
 * promise: every level spread evenly, the pool built once per key, the filter applied to every
 * further key, and the same seed drawing the same candidate.
 */

const share = <T>(xs: T[]) => {
  const counts = new Map<T, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return counts
}

describe('slots and figures', () => {
  it('unitsOf keeps a numeric slot’s units and gives nothing for other types', () => {
    expect(unitsOf({ type: 'numeric', units: '%/day' } as Question)).toBe('%/day')
    expect(unitsOf({ type: 'numeric' } as Question)).toBeUndefined()
    expect(unitsOf({ type: 'multiple-choice' } as Question)).toBeUndefined()
  })

  it('between includes both ends and allows for residue', () => {
    expect(between(2, [2, 6])).toBe(true)
    expect(between(6, [2, 6])).toBe(true)
    expect(between(0.1 + 0.2, [0.1, 0.3])).toBe(true)
    expect(between(6.01, [2, 6])).toBe(false)
    expect(between(1.99, [2, 6])).toBe(false)
  })

  it('whole and onGrid ignore binary residue but nothing more', () => {
    expect(whole(0.1 * 30)).toBe(true)
    expect(whole(3)).toBe(true)
    expect(whole(3.01)).toBe(false)
    expect(onGrid(12.5, 0.5)).toBe(true)
    expect(onGrid(0.7 * 3, 0.1)).toBe(true)
    expect(onGrid(12.3, 0.5)).toBe(false)
  })

  it('gcd', () => {
    expect(gcd(12, 18)).toBe(6)
    expect(gcd(18, 12)).toBe(6)
    expect(gcd(7, 5)).toBe(1)
    expect(gcd(9, 0)).toBe(9)
  })
})

describe('words', () => {
  it('list joins with commas and a final "and"', () => {
    expect(list([7, 9, 6, 8, 10])).toBe('7, 9, 6, 8 and 10')
    expect(list(['a', 'b'])).toBe('a and b')
  })

  it('withArticle chooses a or an from the word, past any italics', () => {
    expect(withArticle('cheek cell')).toBe('a cheek cell')
    expect(withArticle('onion epidermis cell')).toBe('an onion epidermis cell')
    expect(withArticle('*Amoeba*')).toBe('an *Amoeba*')
    expect(withArticle('*Paramecium*')).toBe('a *Paramecium*')
    expect(WithArticle('onion epidermis cell')).toBe('An onion epidermis cell')
    expect(WithArticle('*Paramecium*')).toBe('A *Paramecium*')
  })
})

describe('draws', () => {
  it('memo builds once per key and returns the same value', () => {
    let built = 0
    const get = memo('build-test:memo', () => {
      built++
      return [1, 2, 3]
    })
    expect(get()).toBe(get())
    expect(memo('build-test:memo', () => [9])()).toEqual([1, 2, 3])
    expect(built).toBe(1)
  })

  it('layered draws each level evenly, whatever the candidates per value', () => {
    // a = 1 has 90 candidates, a = 2 has 10: drawing a candidate alone would give a = 1 nine times in ten.
    const pool = [...Array.from({ length: 90 }, (_, i) => ({ a: 1, b: i % 3 })), ...Array.from({ length: 10 }, (_, i) => ({ a: 2, b: i % 2 }))]
    let made = 0
    const r = rng('build-test:layered')
    const draws = Array.from({ length: 4000 }, () =>
      layered(r, 'build-test:layered', () => (made++, pool), (x) => x.a, (x) => x.b),
    )
    expect(made).toBe(1)
    const a = share(draws.map((x) => x.a))
    expect(a.get(1)! / draws.length).toBeCloseTo(0.5, 1)
    // Within a = 2, b = 0 and b = 1 each about half.
    const b = share(draws.filter((x) => x.a === 2).map((x) => x.b))
    expect(b.get(0)! / a.get(2)!).toBeCloseTo(0.5, 1)
  })

  it('layered takes different levels on different calls with the same key, and the same seed draws the same', () => {
    const pool = Array.from({ length: 50 }, (_, i) => ({ a: i % 5, b: i % 7 }))
    const one = layered(rng('s'), 'build-test:levels', () => pool, (x) => x.a)
    const two = layered(rng('s'), 'build-test:levels', () => pool, (x) => x.b, (x) => x.a)
    expect(pool).toContain(one)
    expect(pool).toContain(two)
    expect(layered(rng('s'), 'build-test:levels', () => pool, (x) => x.a)).toBe(one)
    expect(() => layered(rng('s'), 'build-test:empty', () => [] as number[])).toThrow(/no candidates for build-test:empty/)
  })

  it('rich keeps only first-key values with n values of the second, then of each further key', () => {
    const pool = [
      { f: 1, s: 1, t: 1 },
      { f: 1, s: 2, t: 1 },
      { f: 1, s: 3, t: 2 },
      { f: 2, s: 1, t: 1 },
      { f: 2, s: 2, t: 2 },
      { f: 3, s: 1, t: 1 },
      { f: 3, s: 2, t: 2 },
      { f: 3, s: 3, t: 3 },
    ]
    expect([...new Set(rich(pool, (x) => x.f, (x) => x.s).map((x) => x.f))]).toEqual([1, 3])
    expect([...new Set(rich(pool, (x) => x.f, (x) => x.s, 2).map((x) => x.f))]).toEqual([1, 2, 3])
    // Three values of s, then three of t: only f = 3 has both.
    expect([...new Set(rich(pool, (x) => x.f, (x) => x.s, 3, (x) => x.t).map((x) => x.f))]).toEqual([3])
  })

  it('balanced spreads every key about evenly where one draw order cannot', () => {
    // The answer 5 comes with every mass; 2.2 only with 250. Drawing the answer evenly would give
    // 250 most draws; drawing the mass evenly would give 5 most draws.
    const pool = [
      ...[110, 120, 130, 250].map((m) => ({ m, ans: 5 })),
      ...[110, 120, 130, 250].map((m) => ({ m, ans: 2.5 })),
      ...[2.2, 2.4, 2.6].map((ans) => ({ m: 250, ans })),
    ]
    const r = rng('build-test:balanced')
    const draws = Array.from({ length: 6000 }, () => balanced(r, 'build-test:balanced', () => pool, (x) => x.ans, (x) => x.m))
    const masses = share(draws.map((x) => x.m))
    const answers = share(draws.map((x) => x.ans))
    // The last key is matched exactly; the first as nearly as the pool allows.
    for (const n of masses.values()) expect(n / draws.length).toBeCloseTo(0.25, 1)
    for (const n of answers.values()) expect(n / draws.length).toBeLessThan(0.4)
    expect(answers.size).toBe(5)
    expect(balanced(rng('x'), 'build-test:balanced', () => pool, (x) => x.ans, (x) => x.m)).toBe(balanced(rng('x'), 'build-test:balanced', () => pool, (x) => x.ans, (x) => x.m))
  })
})

describe('answers exact to three figures, or rounded to three', () => {
  it('lcm is the least common multiple, beside gcd', () => {
    expect(lcm(4, 6)).toBe(12)
    expect(lcm(100, 97)).toBe(9700)
    expect(lcm(100, 8)).toBe(200)
    expect(gcd(84, 96)).toBe(12)
  })

  it('tidy is exact to the places asked, with three figures at most', () => {
    expect(tidy(12.5)).toBe(true)
    expect(tidy(0.1 + 0.2)).toBe(true)
    expect(tidy(12.34)).toBe(false)
    expect(tidy(0.125)).toBe(false)
    expect(tidy(0.125, 3)).toBe(true)
    expect(tidy(1000 / 3, 4)).toBe(false)
  })

  it('halfLastPlace is half a unit in the last place, capped at 1.9%, and none for a whole number', () => {
    expect(halfLastPlace(97.5)).toBe(0.05)
    expect(halfLastPlace(15.36)).toBe(0.005)
    expect(halfLastPlace(25)).toBe(0)
    expect(halfLastPlace(2.5)).toBe(0.0475)
  })

  it('cut keeps the first figures without rounding them; trail and full add an ellipsis only when the value runs on', () => {
    expect(cut(23.4375, 5)).toBe('23.437')
    expect(cut(1000 / 7, 5)).toBe('142.85')
    expect(cut(1 / 900, 4)).toBe('0.001111')
    expect(cut(0.1 + 0.2, 1)).toBe('0.3')
    expect(trail(20.761904, 3)).toBe('20.761\\ldots')
    expect(trail(20.8, 3)).toBe('20.8')
    expect(full(23.4375)).toBe('23.4375')
    expect(full(1 / 3)).toBe('0.333333\\ldots')
  })

  it('toThree keeps an answer of three figures exact and rounds a longer one', () => {
    expect(toThree(25)).toEqual({ exact: 25, answer: 25, rounded: false })
    expect(toThree(0.875)).toEqual({ exact: 0.875, answer: 0.875, rounded: false })
    expect(toThree(21.09375)).toEqual({ exact: 21.09375, answer: 21.1, rounded: true })
    expect(toThree(111 / 3.3124).answer).toBe(33.5)
  })

  it('fair refuses a half-way rounding and an answer whose trailing 0 the box would drop', () => {
    expect(fair(toThree(23.4375))).toBe(true)
    expect(fair(toThree(25))).toBe(true)
    expect(fair(toThree(24.04))).toBe(false)
    expect(fair(toThree(24.9501))).toBe(false)
  })

  it('figureTolerance is half a unit in the last place, exact or rounded', () => {
    expect(figureTolerance(toThree(23.4375))).toBe(0.05)
    expect(figureTolerance(toThree(0.947368))).toBe(0.0005)
    expect(figureTolerance(toThree(22.5))).toBe(0.05)
    expect(figureTolerance(toThree(25))).toBe(0)
  })

  it('ending closes the maths at an exact answer, or prints the full value and its rounding', () => {
    expect(ending(toThree(25))).toBe('= 25$')
    expect(ending(toThree(23.4375), ' kg')).toBe('= 23.4375$ kg, which is 23.4 kg to 3 significant figures')
    expect(ending(toThree(400 / 81), '%')).toBe('= 4.93827\\ldots$%, which is 4.94% to 3 significant figures')
  })

  it('piRoom covers the π = 3.14 answer and its roundings, never under half a unit', () => {
    expect(piRoom(78.5, 78.5, 1)).toBe(0.05)
    expect(piRoom(706.9, 706.5, 1)).toBe(0.45)
    expect(piRoom(285.9, 285.74, 2)).toBe(0.26)
    expect(piRoom(113.1, 113.04, 1)).toBe(0.11)
  })
})

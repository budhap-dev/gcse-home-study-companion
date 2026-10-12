import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate } from '../index.ts'
import type { Generated } from '../types.ts'
import { PROGRAMS, purposeGenerators } from './purpose.ts'

/**
 * Structural tests for determining-the-purpose-of-an-algorithm: q2 (largest or smallest), q5 (running
 * total), q7 and q11 (repeated subtraction), q8 (FOR loop count), q14 (vowels), q16 (reading past
 * the end) and q20 (the input line). Each reads the prompt back with its own parser, works the answer
 * by its own arithmetic, checks the printed working, literal lines from the written questions, the
 * named wrong routes and the spread.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'determining-the-purpose-of-an-algorithm'
const BANK = Question.array().parse(JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8')).questions)
const slotOf = (id: string) => BANK.find((q) => q.id === id)!

const SLOTS: Record<string, string> = {
  q2: 'cs-purpose-largest',
  q5: 'cs-purpose-total',
  q7: 'cs-purpose-division',
  q11: 'cs-purpose-division',
  q8: 'cs-purpose-loop-count',
  q14: 'cs-purpose-vowels',
  q16: 'cs-purpose-overrun',
  q20: 'cs-purpose-input-line',
}
const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
const build = (slotId: string, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), slotOf(slotId), `${prefix}-${i}`))
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const numbers = (s: string) => s.split(', ').map(Number)

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    expect(w, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
    expect(mark(b.question, String(w)).correct, `${b.seed}: ${w}`).toBe(false)
  }
}
/** The first build whose drawn values match, from up to `n` seeds. */
function find(slotId: string, ok: (b: Generated) => boolean, n = 6000) {
  for (let i = 0; i < n; i++) {
    const b = generate(gen(SLOTS[slotId]!), slotOf(slotId), `lit-${i}`)
    if (ok(b)) return b
  }
  throw new Error(`no build of ${slotId} matched`)
}

describe('determining-the-purpose-of-an-algorithm builds', () => {
  it('stand in for every numeric slot of the topic', () => {
    expect(purposeGenerators.flatMap((g) => g.replaces).sort()).toEqual(['q11', 'q14', 'q16', 'q2', 'q20', 'q5', 'q7', 'q8'])
    expect(BANK.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(['q11', 'q14', 'q16', 'q2', 'q20', 'q5', 'q7', 'q8'])
    for (const g of purposeGenerators) expect(g.topicId).toBe(TOPIC)
  })

  for (const slotId of Object.keys(SLOTS)) {
    const slot = slotOf(slotId)
    it(`${slotId}: keeps the written codes, no units and exact tolerance, is marked right typed plain or spaced, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[slotId]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(q.marks).toBe(slot.marks)
        expect(Number.isInteger(q.answer)).toBe(true)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        expect(q.solution).toContain(`**${q.answer}**`)
        for (const t of [String(q.answer), ` ${q.answer} `, `${q.answer}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')]) expect(mark(q, t).correct, `${b.seed}: ${t}`).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
      }
    })

    it(`${slotId}: repeats no prompt in a twentieth of 1000 builds, and the written one in at most a fiftieth`, () => {
      const counts = new Map<string, number>()
      for (const b of build(slotId, 1000, 'release')) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(counts.size).toBeGreaterThan(100)
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(50)
      expect(counts.get(slot.prompt) ?? 0).toBeLessThanOrEqual(20)
    })
  }

  it('routes q7 to the remainder and q11 to the count', () => {
    for (const b of build('q7', 50)) expect(b.question.prompt).toMatch(/what value does x hold/i)
    for (const b of build('q11', 50)) expect(b.question.prompt).toMatch(/what does count hold/i)
  })
})

describe('q2: the largest or smallest value', () => {
  const built = build('q2')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const list = numbers(/list (\d+(?:, \d+)+)/.exec(p)![1]!)
    const v = /\b(max|min) ← a\[0\]/.exec(p)![1]!
    return { list, v, kind: v === 'max' ? 'largest' : 'smallest' }
  }

  it('answers the largest (max) or smallest (min) item, never the first or last item', () => {
    for (const b of built) {
      const { list, v } = read(b)
      const want = v === 'max' ? Math.max(...list) : Math.min(...list)
      expect(answer(b), b.seed).toBe(want)
      expect(new Set(list).size).toBe(list.length)
      expect(list.length).toBeGreaterThanOrEqual(4)
      expect(list.length).toBeLessThanOrEqual(6)
      for (const x of list) expect(x >= 1 && x <= 30, b.seed).toBe(true)
      expect(b.question.prompt).toContain(v === 'max' ? 'bigger' : 'smaller')
    }
  })

  it('prints a step for every later item, in order', () => {
    for (const b of built) {
      const { list, v, kind } = read(b)
      const cmp = v === 'max' ? 'bigger' : 'smaller'
      let best = list[0]!
      const steps: string[] = []
      for (const x of list.slice(1)) {
        if (v === 'max' ? x > best : x < best) {
          best = x
          steps.push(`${x} is ${cmp}, so ${v} becomes ${x}`)
        } else steps.push(`${x} is not ${cmp}, so ${v} stays ${best}`)
      }
      expect(b.question.solution, b.seed).toBe(`${v} starts at ${list[0]}. Then ${steps.join('; ')}. The output is **${best}**, the ${kind} value in the list.`)
      expect(lines(b)).toEqual([`B1 ${best}`])
    }
  })

  it('prints literal working', () => {
    const at = (seed: string) => generate(gen('cs-purpose-largest'), slotOf('q2'), seed).question
    expect(at('lit-a').prompt).toBe('An algorithm sets min ← a[0], then goes through the rest of the list and replaces min whenever an item is smaller. It then outputs min. What does it output for the list 24, 19, 1, 3?')
    expect(at('lit-a').solution).toBe('min starts at 24. Then 19 is smaller, so min becomes 19; 1 is smaller, so min becomes 1; 3 is not smaller, so min stays 1. The output is **1**, the smallest value in the list.')
    expect(at('lit-b').prompt).toBe('Trace this algorithm on the list 5, 11, 13, 2, 10: max ← a[0], then each later item replaces max if it is bigger, and finally max is output. What is output?')
    expect(at('lit-b').solution).toBe('max starts at 5. Then 11 is bigger, so max becomes 11; 13 is bigger, so max becomes 13; 2 is not bigger, so max stays 13; 10 is not bigger, so max stays 13. The output is **13**, the largest value in the list.')
  })

  it('refuses the first item, the last item and the other extreme', () => {
    for (const b of built) {
      const { list, v } = read(b)
      refuses(b, [list[0]!, list.at(-1)!, v === 'max' ? Math.min(...list) : Math.max(...list)])
    }
  })

  it('replaces the extreme at least twice in most builds, so the first item that beats a[0] is rarely the answer', () => {
    const many = build('q2', 1000, 'beats')
    const first = (b: Generated) => {
      const { list, v } = read(b)
      return list.slice(1).find((x) => (v === 'max' ? x > list[0]! : x < list[0]!))!
    }
    const pays = many.filter((b) => first(b) === answer(b)).length / many.length
    expect(pays).toBeLessThan(0.25)
    for (const b of many.filter((b) => first(b) !== answer(b))) expect(mark(b.question, String(first(b))).correct, b.seed).toBe(false)
  })

  it('spreads answers, lengths, positions and both kinds', () => {
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(20)
    expect(share(built, (b) => read(b).list.length).distinct).toBe(3)
    expect(share(built, (b) => read(b).list.indexOf(answer(b))).distinct).toBe(4)
    const min = built.filter((b) => read(b).v === 'min').length / built.length
    expect(min).toBeGreaterThan(0.2)
    expect(min).toBeLessThan(0.4)
  })
})

describe('q5: a running total', () => {
  const built = build('q5')
  const read = (b: Generated) => numbers(/list (\d+(?:, \d+)+)/.exec(b.question.prompt)![1]!)

  it('answers the sum of three to five distinct items from 5 to 30', () => {
    for (const b of built) {
      const list = read(b)
      expect(answer(b), b.seed).toBe(list.reduce((s, x) => s + x, 0))
      expect(new Set(list).size).toBe(list.length)
      expect(list.length >= 3 && list.length <= 5).toBe(true)
      for (const x of list) expect(x >= 5 && x <= 30).toBe(true)
    }
  })

  it('prints each running total, as the written solution does', () => {
    for (const b of built) {
      const list = read(b)
      let t = list[0]! + list[1]!
      const parts = [`${list[0]} + ${list[1]} = ${t}`]
      for (const x of list.slice(2)) {
        t += x
        parts.push(`+ ${x} = ${t}`)
      }
      parts[parts.length - 1] = parts.at(-1)!.replace(/= (\d+)$/, '= **$1**')
      expect(b.question.solution, b.seed).toBe(`${parts.join(', ')}.`)
    }
  })

  it('prints literal working', () => {
    const b = generate(gen('cs-purpose-total'), slotOf('q5'), 'lit-a').question
    expect(b.prompt).toBe('Trace an algorithm that sets total to 0 and adds every item of the list 6, 28, 24, 23, 16 to it in turn. What does total hold after the loop?')
    expect(b.solution).toBe('6 + 28 = 34, + 24 = 58, + 23 = 81, + 16 = **97**.')
  })

  it('refuses the total missing the first or last item, or counting the last twice', () => {
    for (const b of built) {
      const list = read(b)
      const sum = answer(b)
      refuses(b, [sum - list[0]!, sum - list.at(-1)!, sum + list.at(-1)!, list.length])
    }
  })

  it('spreads answers and lengths', () => {
    expect(share(built, answer).worst).toBeLessThan(0.05)
    expect(share(built, answer).distinct).toBeGreaterThan(50)
    const four = built.filter((b) => read(b).length === 4).length / built.length
    expect(four).toBeGreaterThan(0.35)
    expect(four).toBeLessThan(0.65)
  })
})

describe('q7 and q11: repeated subtraction', () => {
  const rem = build('q7')
  const cnt = build('q11')
  const read = (b: Generated) => {
    const m = /x = (\d+),? (?:and )?y = (\d+)/.exec(b.question.prompt)!
    return { x: Number(m[1]), y: Number(m[2]) }
  }
  /** The subtractions by hand: x − y, repeated, as a student writes them. */
  const working = (x: number, y: number) => {
    const out: string[] = []
    while (x >= y) {
      out.push(`${x} − ${y} = ${x - y}`)
      x -= y
    }
    return out
  }
  const say = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

  it('q7 answers what is left over, q11 how many subtractions, the loop running 2 to 8 times with x at most 60', () => {
    for (const [b, asks] of [...rem.map((b) => [b, 'rem'] as const), ...cnt.map((b) => [b, 'count'] as const)]) {
      const { x, y } = read(b)
      const q = Math.floor(x / y)
      const r = x - q * y
      expect(answer(b), b.seed).toBe(asks === 'rem' ? r : q)
      expect(q >= 2 && q <= 8, b.seed).toBe(true)
      expect(x).toBeLessThanOrEqual(60)
      expect(y >= 3 && y <= 12).toBe(true)
      expect(r, `${b.seed}: remainder equal to quotient`).not.toBe(q)
      if (asks === 'rem') expect(r).toBeGreaterThan(0)
      else expect(q, `${b.seed}: count equal to y`).not.toBe(y)
    }
  })

  it('prints every subtraction and the reason the loop stops', () => {
    for (const b of rem) {
      const { x, y } = read(b)
      expect(b.question.solution, b.seed).toBe(`${working(x, y).join(', ')}. Now ${answer(b)} is less than ${y}, so the loop stops with x holding **${answer(b)}**, the remainder of ${x} ÷ ${y}.`)
      expect(lines(b)).toEqual([`M1 subtracts ${y} repeatedly while x is at least ${y}`, `A1 ${answer(b)}`])
    }
    for (const b of cnt) {
      const { x, y } = read(b)
      const left = x % y
      const exact = left === 0 ? ` (${y} is still at least ${y}, so the last subtraction runs)` : ''
      expect(b.question.solution, b.seed).toBe(`${working(x, y).join(', ')}${exact}, and ${left} is less than ${y}. count holds **${answer(b)}**, because ${y} fits into ${x} ${say[answer(b)]} times.`)
      expect(lines(b)).toEqual([`M1 subtracts ${y} while x is at least ${y}`, `A1 ${answer(b)}`])
    }
  })

  it('prints the written working for the written numbers', () => {
    const q7 = find('q7', (b) => b.values.x === 20 && b.values.y === 6)
    expect(q7.question.solution).toBe(slotOf('q7').solution)
    expect(lines(q7)).toEqual(['M1 subtracts 6 repeatedly while x is at least 6', 'A1 2'])
    const q11 = find('q11', (b) => b.values.x === 17 && b.values.y === 5)
    expect(q11.question.solution).toBe(slotOf('q11').solution)
    const exact = find('q11', (b) => b.values.x === 18 && b.values.y === 6)
    expect(exact.question.solution).toBe('18 − 6 = 12, 12 − 6 = 6, 6 − 6 = 0 (6 is still at least 6, so the last subtraction runs), and 0 is less than 6. count holds **3**, because 6 fits into 18 three times.')
  })

  it('refuses the other output, one subtraction too few or too many, and a single subtraction', () => {
    for (const b of rem) {
      const { x, y } = read(b)
      refuses(b, [Math.floor(x / y), answer(b) + y, x - y, 0])
    }
    for (const b of cnt) {
      const { x, y } = read(b)
      refuses(b, [x % y, answer(b) + 1, answer(b) - 1])
    }
  })

  it('divides exactly in about one q11 in five, where stopping at x > y would count one too few', () => {
    const exact = cnt.filter((b) => read(b).x % read(b).y === 0).length / cnt.length
    expect(exact).toBeGreaterThan(0.1)
    expect(exact).toBeLessThan(0.3)
  })

  it('spreads answers and inputs', () => {
    expect(share(rem, answer).worst).toBeLessThan(0.2)
    expect(share(rem, answer).distinct).toBe(9)
    expect(share(cnt, answer).worst).toBeLessThan(0.25)
    expect(share(cnt, answer).distinct).toBe(7)
    for (const set of [rem, cnt]) {
      expect(share(set, (b) => read(b).y).distinct).toBe(10)
      expect(share(set, (b) => read(b).x).distinct).toBeGreaterThan(30)
    }
  })
})

describe('q8: how many times a FOR loop runs', () => {
  const built = build('q8')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const m = /FOR i ← (\d) TO LEN\((\w+)\) − (\d)/.exec(p)!
    const n = Number(/(?:holds|list of) (\d+) items/.exec(p)![1])
    return { start: Number(m[1]), list: m[2]!, less: Number(m[3]), n }
  }

  it('counts both ends, never the list length, the start or the number taken off, at least twice, over 4 to 12 items', () => {
    for (const b of built) {
      const { start, less, n } = read(b)
      let runs = 0
      for (let i = start; i <= n - less; i++) runs++
      expect(answer(b), b.seed).toBe(runs)
      expect(runs).not.toBe(n)
      expect([start, less], b.seed).not.toContain(runs)
      expect(runs).toBeGreaterThanOrEqual(2)
      expect(n >= 4 && n <= 12).toBe(true)
    }
  })

  it('lists every value of i', () => {
    for (const b of built) {
      const { start, list, less, n } = read(b)
      const end = n - less
      const values = Array.from({ length: end - start + 1 }, (_, i) => start + i)
      expect(b.question.solution, b.seed).toBe(`LEN(${list}) − ${less} is ${end}, so i takes the values ${values.join(', ')}. That is **${answer(b)}** times.`)
    }
  })

  it('prints the written working for the written loop', () => {
    const b = find('q8', (x) => x.values.list === 'a' && x.values.n === 6 && x.values.start === 1 && x.values.less === 1)
    expect(b.question.solution).toBe(slotOf('q8').solution)
    const zero = find('q8', (x) => x.values.list === 'scores' && x.values.n === 9 && x.values.start === 0)
    expect(zero.question.solution).toBe('LEN(scores) − 2 is 7, so i takes the values 0, 1, 2, 3, 4, 5, 6, 7. That is **8** times.')
  })

  it('refuses the list length, the end minus the start, and one too many', () => {
    for (const b of built) {
      const { start, less, n } = read(b)
      refuses(b, [n, n - less - start, answer(b) + 1])
    }
  })

  it('makes the inclusive count matter: the end value alone pays only when the loop starts at 1, and no "length minus c" rule pays in much over a quarter', () => {
    const many = build('q8', 1000, 'rules')
    const pays = many.filter((b) => answer(b) === read(b).n - read(b).less)
    for (const b of pays) expect(read(b).start).toBe(1)
    expect(pays.length / many.length).toBeLessThan(0.22)
    for (let c = 1; c <= 5; c++) expect(many.filter((b) => answer(b) === read(b).n - c).length / many.length, `n − ${c}`).toBeLessThan(0.3)
  })

  it('spreads answers, starts, lengths and lists', () => {
    expect(share(built, answer).worst).toBeLessThan(0.2)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(10)
    expect(share(built, (b) => read(b).start).distinct).toBe(4)
    expect(share(built, (b) => read(b).less).distinct).toBe(3)
    expect(share(built, (b) => read(b).n).distinct).toBe(9)
    expect(share(built, (b) => read(b).list).distinct).toBe(6)
  })
})

describe('q14: counting vowels', () => {
  const built = build('q14')
  const read = (b: Generated) => /'([a-z]+)'/.exec(b.question.prompt)![1]!
  const vowelsOf = (s: string) => s.match(/[aeiou]/g) ?? []

  it('counts a, e, i, o and u every time, in a word with a repeated vowel', () => {
    for (const b of built) {
      const s = read(b)
      const v = vowelsOf(s)
      expect(answer(b), b.seed).toBe(v.length)
      expect(new Set(v).size, s).toBeLessThan(v.length)
    }
  })

  it('names the vowels found, the y where there is one, and the repeat', () => {
    for (const b of built) {
      const s = read(b)
      const v = vowelsOf(s)
      const q = v.map((ch) => `'${ch}'`)
      const listed = q.length === 2 ? `${q[0]} and ${q[1]}` : `${q.slice(0, -1).join(', ')} and ${q.at(-1)}`
      expect(b.question.solution, b.seed).toContain(`The characters of **${s}** that are a, e, i, o or u are ${listed}, so the output is **${v.length}**.`)
      expect(b.question.solution.includes("The 'y' is not one of the five letters"), s).toBe(s.includes('y'))
    }
    const d = find('q14', (x) => x.values.word === 'possibility')
    expect(d.question.solution).toBe("The characters of **possibility** that are a, e, i, o or u are 'o', 'i', 'i' and 'i', so the output is **4**. The 'y' is not one of the five letters, and the repeated 'i' counts each time it appears.")
    const t = find('q14', (x) => x.values.word === 'telephone')
    expect(t.question.solution).toBe("The characters of **telephone** that are a, e, i, o or u are 'e', 'e', 'o' and 'e', so the output is **4**. The repeated 'e' counts each time it appears.")
    const f = find('q14', (x) => x.values.word === 'familiarity')
    expect(f.question.solution).toBe("The characters of **familiarity** that are a, e, i, o or u are 'a', 'i', 'i', 'a' and 'i', so the output is **5**. The 'y' is not one of the five letters, and the repeated 'a' and 'i' count each time they appear.")
    expect(lines(d)).toEqual(['M1 counts only a, e, i, o and u, each time one appears', 'A1 4'])
  })

  it('refuses a repeated vowel counted once, y counted where there is one, both slips together, the other letters and the length', () => {
    for (const b of built) {
      const s = read(b)
      const v = vowelsOf(s)
      const ys = s.split('y').length - 1
      const distinct = new Set(v).size
      refuses(b, [distinct, s.length - v.length, s.length, ...(ys ? [v.length + ys, distinct + 1, distinct + ys] : [])])
    }
  })

  it('has a y in about half the words, so a y is not a signal that always comes with the question', () => {
    const withY = built.filter((b) => read(b).includes('y')).length / built.length
    expect(withY).toBeGreaterThan(0.45)
    expect(withY).toBeLessThan(0.7)
  })

  it('spreads answers and words', () => {
    expect(share(built, answer).worst).toBeLessThan(0.4)
    expect(share(built, answer).distinct).toBe(4)
    expect(share(built, read).worst).toBeLessThan(0.05)
    expect(share(built, read).distinct).toBeGreaterThan(60)
  })
})

describe('q16: reading past the end', () => {
  const built = build('q16')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const m = /FOR i ← (\d) TO LEN\((\w+)\) − (\d)/.exec(p)!
    const places = /(two|three) places after/.exec(p)?.[1]
    return { start: Number(m[1]), list: m[2]!, less: Number(m[3]), n: Number(/(\d+) items/.exec(p)![1]), ahead: places === 'three' ? 3 : places === 'two' ? 2 : 1 }
  }

  it('answers the first i at which i + ahead is past the last position, 4 to 12 items', () => {
    for (const b of built) {
      const { start, less, n, ahead } = read(b)
      let first = -1
      for (let i = start; i <= n - less && first < 0; i++) if (i + ahead >= n) first = i
      expect(answer(b), b.seed).toBe(first)
      expect(n >= 4 && n <= 12).toBe(true)
      // "first" is said exactly where more than one i goes wrong.
      expect(/first go wrong/.test(b.question.prompt)).toBe(n - less - first >= 1)
    }
  })

  it('prints the last position, the missing item and the bound it should have had', () => {
    for (const b of built) {
      const { list, n, ahead } = read(b)
      expect(b.question.solution, b.seed).toBe(`The last position is ${n - 1}, so when i is **${answer(b)}** the algorithm looks for ${list}[${n}], which does not exist. The loop should have stopped at LEN(${list}) − ${ahead + 1}.`)
      expect(lines(b)).toEqual([`M1 the last valid position is ${n - 1}`, `M1 ${list}[i + ${ahead}] would then be ${list}[${n}]`, `A1 ${answer(b)}`])
    }
  })

  it('prints the written working for the written loop', () => {
    const b = find('q16', (x) => x.values.list === 'a' && x.values.n === 8 && x.values.start === 0 && x.values.ahead === 1)
    expect(b.question.solution).toBe(slotOf('q16').solution)
    expect(lines(b)).toEqual(slotOf('q16').markScheme.map((l) => `${l.code} ${l.description}`))
  })

  it('refuses the length, the last valid i and, more than one ahead, the last position', () => {
    for (const b of built) {
      const { n, ahead } = read(b)
      refuses(b, [n, answer(b) - 1, ...(ahead > 1 ? [n - 1] : [])])
    }
  })

  it('goes wrong before the loop ends often enough that neither "the last i" nor "LEN − 1" pays in over 60%', () => {
    const many = build('q16', 1000, 'routes')
    const lastI = many.filter((b) => answer(b) === read(b).n - read(b).less).length / many.length
    const lenMinus1 = many.filter((b) => answer(b) === read(b).n - 1).length / many.length
    expect(lastI).toBeLessThan(0.6)
    expect(lenMinus1).toBeLessThan(0.6)
    const three = find('q16', (x) => x.values.ahead === 3 && x.values.less === 1 && x.values.n === 9 && x.values.list === 'a')
    expect(three.question.solution).toBe('The last position is 8, so when i is **6** the algorithm looks for a[9], which does not exist. The loop should have stopped at LEN(a) − 4.')
    expect(three.question.prompt).toMatch(/compared with the item three places after it\. At which value of i does this first go wrong\?|compares a\[i\] with the item three places after it\. At which value of i does this first go wrong\?/)
  })

  it('spreads answers, both look-aheads and both starts', () => {
    expect(share(built, answer).worst).toBeLessThan(0.2)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(9)
    expect(share(built, (b) => read(b).ahead).distinct).toBe(3)
    const one = built.filter((b) => read(b).ahead === 1).length / built.length
    expect(one).toBeGreaterThan(0.3)
    expect(one).toBeLessThan(0.5)
    expect(share(built, (b) => read(b).start).distinct).toBe(2)
  })
})

describe('q20: the input line', () => {
  const built = build('q20')
  const read = (b: Generated) => {
    const code = /```\n([\s\S]*?)\n```/.exec(b.question.prompt)![1]!.split('\n')
    return code.map((l) => {
      const m = /^(\d+) {2}( *)(.*)$/.exec(l)!
      return { n: Number(m[1]), depth: m[2]!.length / 3, text: m[3]! }
    })
  }

  it('answers the one line that reads USERINPUT, in numbered AQA pseudo-code', () => {
    for (const b of built) {
      const code = read(b)
      expect(code.map((l) => l.n)).toEqual(code.map((_, i) => i + 1))
      const inputs = code.filter((l) => /USERINPUT/.test(l.text))
      expect(inputs.length, b.seed).toBe(1)
      expect(answer(b), b.seed).toBe(inputs[0]!.n)
      expect(code.length).toBeLessThanOrEqual(9)
      for (const l of code) {
        expect(Number.isInteger(l.depth)).toBe(true)
        expect(l.text).not.toMatch(/\bRETURN\b|==|!=|<=|>=|"| = .*←|\w\[\w+\]\s*←/)
      }
    }
  })

  it('never puts the input on the line of the message that asks for it', () => {
    for (const b of built) {
      const code = read(b)
      const before = code[answer(b) - 2]
      if (before && /^OUTPUT '/.test(before.text)) {
        const twoBefore = code[answer(b) - 3]
        if (twoBefore && /^OUTPUT '/.test(twoBefore.text)) expect(b.question.solution, b.seed).toMatch(/ Lines [\d ,toand]+ only show messages, which are output, not input\./)
        else expect(b.question.solution, b.seed).toContain(`Line ${before.n} only shows a message asking for it, which is output, not input.`)
        expect(mark(b.question, String(before.n)).correct).toBe(false)
      }
    }
  })

  it('prints the written question and working for the written program', () => {
    const b = find('q20', (x) => x.question.prompt === slotOf('q20').prompt)
    expect(b.question.prompt).toBe(slotOf('q20').prompt)
    expect(b.question.solution).toBe(slotOf('q20').solution)
    expect(PROGRAMS.length).toBeGreaterThan(130)
    const menu = find('q20', (x) => read(x).map((l) => l.text).join('|').startsWith("OUTPUT '1 Play'|OUTPUT '2 Quit'|OUTPUT 'Choose 1 or 2'"))
    expect(menu.question.solution).toBe("Line **4** is the input: `USERINPUT` reads what the user types, and `STRING_TO_INT` turns it into a whole number. Lines 1 to 3 only show messages, which are output, not input. Lines 5, 7 and 9 are the processing, and lines 6 and 8 are the output.")
  })

  it('prints literal working for a program with a message and the input inside a loop', () => {
    const b = find('q20', (x) => read(x).map((l) => l.text).join('|') === "total ← 0|FOR i ← 1 TO 4|OUTPUT 'Enter a mark'|mark ← STRING_TO_INT(USERINPUT)|total ← total + mark|ENDFOR|OUTPUT total")
    expect(b.question.prompt).toContain("```\n1  total ← 0\n2  FOR i ← 1 TO 4\n3     OUTPUT 'Enter a mark'\n4     mark ← STRING_TO_INT(USERINPUT)\n5     total ← total + mark\n6  ENDFOR\n7  OUTPUT total\n```")
    expect(b.question.solution).toBe('Line **4** is the input: `USERINPUT` reads what the user types, and `STRING_TO_INT` turns it into a whole number. Line 3 only shows a message asking for it, which is output, not input. Line 1 only sets a starting value, lines 2, 5 and 6 are the processing, and line 7 is the output.')
    const text = find('q20', (x) => read(x)[0]!.text === "OUTPUT 'What is your name?'")
    expect(text.question.solution).toBe('Line **2** is the input: `USERINPUT` reads what the user types. Line 1 only shows a message asking for it, which is output, not input. Line 3 is the processing, and lines 4 and 5 are the output.')
  })

  it('spreads the input line from 1 to 4, a message above it about half the time, over many programs', () => {
    expect(share(built, answer).worst).toBeLessThan(0.4)
    expect(share(built, answer).distinct).toBe(4)
    const message = built.filter((b) => /^OUTPUT '/.test(read(b)[answer(b) - 2]?.text ?? '')).length / built.length
    expect(message).toBeGreaterThan(0.3)
    expect(message).toBeLessThan(0.7)
    expect(share(built, (b) => b.values.program).distinct).toBeGreaterThan(80)
  })
})

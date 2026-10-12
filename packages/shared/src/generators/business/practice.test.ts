import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { PRACTICE, practiceGenerators } from './practice.ts'

/**
 * Structural tests for the Topic 1.3 generators (Edexcel 1BS0 1.3.2, 1.3.3). Each prompt's
 * figures are read back with this file's own readers and the answer worked again from them
 * alone; every `$…$` chain in the solution and the method lines is evaluated with this file's
 * own arithmetic reader; the named wrong routes (fixed ÷ price for break-even, the margin as
 * break-even − actual or as a percentage, a net cash flow with its sign flipped, a closing
 * balance that adds the outflows or skips a month, interest over the total repaid, a loan left
 * out of the inflows) are marked wrong in every build; and answers and inputs spread, per case
 * as well as per slot.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const TOPIC = 'putting-a-business-idea-into-practice'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const SLOTS: Record<string, string> = {
  q1: 'practice-revenue',
  q3: 'practice-total-costs',
  q5: 'practice-profit',
  q6: 'practice-break-even',
  q7: 'practice-margin-of-safety',
  q8: 'practice-net-cash-flow',
  q9: 'practice-closing-balance',
  q11: 'practice-break-even-price-rise',
  q12: 'practice-loan-interest',
  q13: 'practice-profit-from-sales',
  q14: 'practice-cash-flow-two-months',
  q24: 'practice-net-cash-flow-items',
  q25: 'practice-closing-balance-flows',
  q26: 'practice-loan-instalments',
}

function build(slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === SLOTS[slotId])!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const method = (b: Generated) => b.question.markScheme.slice(0, -1).map((l) => l.description)
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6

// ---------------------------------------------------------------------------------------------
// This file's own readers
// ---------------------------------------------------------------------------------------------

/** A sum of money as prompts print it: £1500, £26 000, £2.70, $-£2000$, $+£500$. */
const MONEY = String.raw`(\$?[-+]?)£(\d{1,3}(?:(?: |\\,)\d{3})+(?!\d)|\d+)(?:\.(\d{2}))?\$?`
const money = (m: RegExpExecArray, at = 1) => {
  const size = Number(m[at + 1]!.replace(/ |\\,/g, '')) + (m[at + 2] ? Number(m[at + 2]) / 100 : 0)
  return m[at]!.includes('-') ? -size : size
}
/** The sum of money straight after `before` (a regex source). */
function after(text: string, before: string): number {
  const m = new RegExp(`(?:${before})${MONEY}`).exec(text)
  if (!m) throw new Error(`no money after /${before}/ in: ${text}`)
  return money(m, m.length - 3)
}
/** The count straight after `before`: 1500, 26 000. */
function countAfter(text: string, before: string): number {
  const m = new RegExp(`(?:${before})(\\d{1,3}(?: \\d{3})+(?!\\d)|\\d+)`).exec(text)
  if (!m) throw new Error(`no count after /${before}/ in: ${text}`)
  return Number(m[m.length - 1]!.replace(/ /g, ''))
}

/** A maths expression evaluated from its TeX: 1500 + (-2000), \dfrac{2100}{15\,000} \times 100, £17\,100, 15\%. */
function ev(tex: string): number {
  let s = tex
  for (;;) {
    const t = s.replace(/\\dfrac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
    if (t === s) break
    s = t
  }
  s = s.replace(/\\times/g, '*').replace(/\\div/g, '/').replace(/\\,|\{,\}/g, '').replace(/\\%/g, '').replace(/£/g, '').replace(/−/g, '-').trim()
  if (!/^[\d.+\-*/() ]+$/.test(s) || !/^[-(\d]/.test(s) || !/\d$|\)$/.test(s)) return NaN
  return Function(`return (${s})`)() as number
}
/** Every `$…$` in a text whose parts either side of "=" are arithmetic: each such chain's parts must agree. */
function chains(text: string): number[][] {
  return [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!.split('=').map(ev).filter((x) => !Number.isNaN(x)))
}
function checkChains(b: Generated) {
  const all = chains(b.question.solution)
  for (const c of all) for (const x of c) expect(close(x, c[0]!), `${b.seed}: ${b.question.solution}`).toBe(true)
  return all
}
/** The value a line's maths evaluates to: "$6000 \div 15$" → 400. */
const valueOf = (line: string) => {
  const c = chains(line).find((x) => x.length)
  if (!c) throw new Error(`no maths in ${line}`)
  return c.at(-1)!
}

/** Thousands grouped by this file, not build.ts: 26 000 from five digits. */
const spaced = (x: number) => (Math.abs(x) >= 10000 ? String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(Math.abs(x)))
const commas = (x: number) => String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function share<T>(xs: T[]): { top: number; distinct: number } {
  const counts = new Map<T, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  return { top: Math.max(...counts.values()) / xs.length, distinct: counts.size }
}
/** No answer over 40%, ten answers or more, and no input over 40%; and the same within each case. */
function spread(built: Generated[], keys: string[], caseKey?: string) {
  const groups = caseKey ? [...new Set(built.map((b) => b.values[caseKey]))].map((k) => built.filter((b) => b.values[caseKey] === k)) : [built]
  for (const g of [built, ...groups]) {
    const a = share(g.map(answer))
    expect(a.top, `answer ${g[0]!.question.id}`).toBeLessThanOrEqual(0.4)
    expect(a.distinct, `answers ${g[0]!.question.id}`).toBeGreaterThanOrEqual(10)
    for (const k of keys) expect(share(g.map((b) => b.values[k])).top, `${g[0]!.question.id} ${k}`).toBeLessThanOrEqual(0.4)
  }
  // No one calculation over a sixth of builds.
  expect(share(built.map((b) => JSON.stringify(b.values))).top).toBeLessThanOrEqual(1 / 6)
}
/** The named wrong routes, each marked wrong in every build. */
function wrong(b: Generated, routes: Record<string, number>) {
  for (const [name, x] of Object.entries(routes)) expect(mark(b.question, String(x)).correct, `${b.seed} ${name}: ${x} for ${answer(b)}`).toBe(false)
}

// ---------------------------------------------------------------------------------------------

describe('every Topic 1.3 build', () => {
  it('has a generator for every numeric written slot in the topic', () => {
    expect(practiceGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(Object.keys(SLOTS).sort())
    for (const [slot, id] of Object.entries(SLOTS)) expect(practiceGenerators.find((g) => g.id === id)!.replaces).toEqual([slot])
  })

  for (const slotId of Object.keys(SLOTS)) {
    it(`${slotId}: keeps the written units, marks and exact tolerance, prints no article before a figure, and is marked as typed`, () => {
      const slot = written(slotId)
      if (slot.type !== 'numeric') throw new Error('not numeric')
      const built = build(slotId)
      for (const b of built) {
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
        expect(q.units).toBe(slot.units)
        expect(q.tolerance).toBe(0)
        expect(slot.tolerance).toBe(0)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(q.markScheme.reduce((s, l) => s + l.marks, 0)).toBe(slot.marks)
        expect(Number.isInteger(q.answer), b.seed).toBe(true)
        expect(q.answer).not.toBe(0)
        // Typed plain, with £, with its thousands separator either way, with a Unicode minus.
        const a = q.answer
        const sign = a < 0 ? '-' : ''
        expect(mark(q, String(a)).correct, b.seed).toBe(true)
        expect(mark(q, `${sign}${spaced(a)}`).correct, b.seed).toBe(true)
        expect(mark(q, `${sign}${commas(a)}`).correct, b.seed).toBe(true)
        if (slot.units === '£') {
          expect(mark(q, `${sign}£${spaced(a)}`).correct, b.seed).toBe(true)
          expect(mark(q, `${sign}£${commas(a)}`).correct, b.seed).toBe(true)
          if (a < 0) expect(mark(q, `−£${Math.abs(a)}`).correct, b.seed).toBe(true)
          expect(q.markScheme.at(-1)!.description).toBe(`${a < 0 ? '−' : ''}£${spaced(a)}`)
        } else if (slot.units === '%') {
          expect(mark(q, `${a}%`).correct).toBe(true)
          expect(q.markScheme.at(-1)!.description).toBe(`${a}%`)
        } else {
          expect(mark(q, `${a} units`).correct).toBe(true)
          expect(q.markScheme.at(-1)!.description).toBe(`${a} units`)
        }
        expect(mark(q, String(a + 1)).correct).toBe(false)
        // Every arithmetic chain in the solution holds, and there are some to read.
        expect(checkChains(b).filter((c) => c.length >= 2).length, b.seed).toBeGreaterThanOrEqual(1)
        for (const l of method(b)) for (const c of chains(l)) for (const x of c) expect(close(x, c[0]!), `${b.seed}: ${l}`).toBe(true)
        expect(b.check.agrees, b.seed).toBe(true)
      }
    })
  }

  it('never fails to draw, over 3000 seeds per slot', () => {
    for (const slotId of Object.keys(SLOTS)) {
      const g = GENERATORS.find((x) => x.id === SLOTS[slotId])!
      expect(() => {
        for (let i = 0; i < 3000; i++) generate(g, written(slotId), `throw-${i}`)
      }, slotId).not.toThrow()
    }
  })

  it('gives back the written question rarely and no one prompt often', () => {
    for (const slotId of Object.keys(SLOTS)) {
      const built = build(slotId, 300, 'repeat')
      const counts = new Map<string, number>()
      for (const b of built) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(Math.max(...counts.values()), slotId).toBeLessThanOrEqual(15)
      expect(counts.get(written(slotId).prompt) ?? 0, slotId).toBeLessThanOrEqual(15)
      expect(counts.size, slotId).toBeGreaterThan(200)
    }
  })

  it('fills every sheet, and the advanced sheet never prints q23 or q28 figures in q11 or q13', () => {
    for (const level of ['core', 'higher', 'advanced']) {
      const ids: string[] = topic.worksheets[level].questionIds
      for (let i = 0; i < 100; i++) {
        const sheet = sheetQuestions('business', TOPIC, ids.map(written), `sheet-${level}-${i}`)
        for (const s of sheet) {
          expect(Boolean(s.generated), `${level} ${s.question.id}`).toBe(s.question.id in SLOTS)
          if (['q11', 'q13'].includes(s.question.id)) {
            const v = s.generated!.values
            expect(v.context).not.toBe('coffee')
            expect(PRACTICE.isQ23(Number(v.fixed), Number(v.price ?? v.oldPrice), Number(v.variable))).toBe(false)
            expect(PRACTICE.isQ23(Number(v.fixed), Number(v.newPrice ?? v.price), Number(v.variable))).toBe(false)
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------------------------
// 1.3.2 revenue, costs and profit
// ---------------------------------------------------------------------------------------------

describe('q1: revenue', () => {
  it('is price times quantity, read back from the prompt', () => {
    const built = build('q1')
    for (const b of built) {
      const p = b.question.prompt
      const price = after(p, 'at ')
      const q = countAfter(p, '(?:sells|gives|washes) ')
      const ctx = PRACTICE.SALES.find((s) => s.seller === b.values.context)!
      expect(answer(b)).toBe(Math.round(price * q * 100) / 100)
      expect(price >= ctx.price[0] && price <= ctx.price[1]).toBe(true)
      expect(q >= ctx.quantity[0] && q <= ctx.quantity[1]).toBe(true)
      expect(valueOf(method(b)[0]!)).toBeCloseTo(answer(b))
      wrong(b, { 'price + quantity': price + q, 'quantity ÷ price': q / price })
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PRACTICE.SALES.length)
    spread(build('q1', 1000, 'spread'), ['price', 'quantity'])
  })

  it('prints a literal solution', () => {
    const b = build('q1').find((x) => Number.isInteger(x.values.price) && Number(x.values.revenue) < 10000)!
    expect(b.question.solution).toBe(`Revenue $=$ price $\\times$ quantity $= ${b.values.price} \\times ${b.values.quantity} = £${b.values.revenue}$.`)
  })
})

describe('q3: total costs', () => {
  it('is fixed plus variable per unit times output, never with fixed equal to variable costs', () => {
    const built = build('q3')
    for (const b of built) {
      const p = b.question.prompt
      const F = after(p, 'fixed costs (?:of|are) ')
      const v = after(p, 'variable costs? (?:of|is) ')
      const q = countAfter(p, 'makes ')
      expect(answer(b)).toBe(Math.round((F + v * q) * 100) / 100)
      expect(Math.abs(F - v * q)).toBeGreaterThan(0.001)
      expect(valueOf(method(b)[0]!)).toBeCloseTo(answer(b))
      wrong(b, { '(F + v) × q': (F + v) * q, 'F + v': F + v, 'v × q': v * q, 'F × q': F * q })
    }
    spread(build('q3', 1000, 'spread'), ['fixed', 'variable', 'output'])
  })
})

describe('q5: profit', () => {
  it('is revenue less fixed and variable costs, and equals no cost', () => {
    const built = build('q5')
    for (const b of built) {
      const p = b.question.prompt
      const R = after(p, 'revenue of |took ')
      const F = after(p, 'fixed costs (?:for (?:the year|\\w+) were )?(?:of )?')
      const V = after(p, 'variable costs (?:were |of )')
      expect(answer(b)).toBe(R - F - V)
      expect(answer(b)).toBeGreaterThan(0)
      // A plausible margin: profit at most 40% of revenue, variable costs at least a quarter.
      expect(answer(b)).toBeLessThanOrEqual(0.4 * R)
      expect(V).toBeGreaterThanOrEqual(0.25 * R)
      expect(new Set([answer(b), F, V, F + V, R]).size).toBe(5)
      expect(valueOf(method(b)[0]!)).toBe(F + V)
      expect(valueOf(method(b)[1]!)).toBe(answer(b))
      expect(method(b)[1]).toBe(`$${spacedTex(R)} - ${spacedTex(F + V)}$`)
      wrong(b, { 'R − F': R - F, 'R − V': R - V, 'R − F + V': R - F + V, 'total costs': F + V, revenue: R })
    }
    spread(build('q5', 1000, 'spread'), ['fixed', 'variable', 'revenue'])
  })
})

/** Thousands inside maths, by this file: 11\,500 from five digits. */
function spacedTex(x: number) {
  const s = Math.abs(x) >= 10000 ? String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : String(Math.abs(x))
  return `${x < 0 ? '-' : ''}${s}`
}

/**
 * Each context's own limits, held in every build: fixed costs a month in its range (a shop at
 * least £1500, the generic business under £30 000), and no count of units past what that kind of
 * business sells in a month (kettles 250, necklaces 120, bicycles 40, the generic 1000).
 */
function inScale(b: Generated, fixed: number, units: number) {
  const c = PRACTICE.PRODUCTS.find((x) => x.name === b.values.context)!
  expect(fixed, `${b.seed} ${c.name} fixed`).toBeGreaterThanOrEqual(c.fixed[0])
  expect(fixed, `${b.seed} ${c.name} fixed`).toBeLessThanOrEqual(c.fixed[1])
  expect(units, `${b.seed} ${c.name} units`).toBeLessThanOrEqual(c.be[1])
}

describe('the break-even contexts', () => {
  it('keep each kind of business in its scale', () => {
    const limits = Object.fromEntries(PRACTICE.PRODUCTS.map((c) => [c.name, c]))
    expect(limits.kettles!.be[1]).toBeLessThanOrEqual(250)
    expect(limits.jeweller!.be[1]).toBeLessThanOrEqual(120)
    expect(limits.bicycles!.be[1]).toBeLessThanOrEqual(40)
    expect(limits.generic!.be[1]).toBeLessThanOrEqual(1000)
    expect(Math.max(...limits.generic!.prices)).toBeLessThanOrEqual(40)
    expect(limits.generic!.fixed[1]).toBeLessThanOrEqual(30000)
    for (const c of PRACTICE.PRODUCTS) expect(c.fixed[0], c.name).toBeGreaterThanOrEqual(c.name === 'coffee' ? 400 : 1000)
    for (const c of PRACTICE.PRODUCTS) if (!['coffee', 'generic'].includes(c.name)) expect(c.fixed[0], c.name).toBeGreaterThanOrEqual(1500)
  })
})

describe('q6: break-even', () => {
  it('divides fixed costs by the contribution, never by the price', () => {
    const built = build('q6')
    for (const b of built) {
      const p = b.question.prompt
      const F = after(p, 'fixed costs (?:of|are) ')
      const price = after(p, 'sells [^£]*?(?:for|at) ')
      const v = after(p, 'variable cost (?:per [\\w-]+ is|of) ')
      expect(answer(b) * (price - v)).toBeCloseTo(F)
      expect(Number.isInteger(answer(b))).toBe(true)
      expect(price).toBeGreaterThan(v)
      expect(valueOf(method(b)[0]!)).toBeCloseTo(price - v)
      expect(valueOf(method(b)[1]!)).toBeCloseTo(answer(b))
      expect(new Set([answer(b), F, price, v, price - v]).size).toBe(5)
      inScale(b, F, answer(b))
      wrong(b, { 'F ÷ price': F / price, 'F ÷ variable cost': F / v, 'F ÷ (price + v)': F / (price + v), contribution: price - v })
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PRACTICE.PRODUCTS.length)
    spread(build('q6', 1000, 'spread'), ['fixed', 'price', 'variable'])
  })
})

describe('q7: margin of safety', () => {
  it('is sales less break-even, in units, with sales 1.15 to 2.8 times break-even', () => {
    const built = build('q7')
    for (const b of built) {
      const p = b.question.prompt
      const B = countAfter(p, '(?:breaks even at|break-even level of output is) ')
      const A = countAfter(p, '(?:actually sells|expects to sell) ')
      expect(answer(b)).toBe(A - B)
      expect(A / B).toBeGreaterThanOrEqual(1.1)
      expect(A / B).toBeLessThanOrEqual(2.85)
      expect(answer(b)).not.toBe(B)
      expect(valueOf(method(b)[0]!)).toBe(answer(b))
      if (b.values.budgeted === 'budgeted') expect(b.question.solution).toContain('budgeted sales')
      wrong(b, { 'B − A': B - A, 'as a percentage of sales': ((A - B) / A) * 100, 'as a percentage of break-even': ((A - B) / B) * 100, sales: A, 'break-even': B })
    }
    spread(build('q7', 1000, 'spread'), ['breakEven', 'sales'], 'budgeted')
  })
})

describe('q11: break-even after a price rise', () => {
  it('uses the new contribution; the old break-even is whole, and the price only rises', () => {
    const built = build('q11')
    for (const b of built) {
      const p = b.question.prompt
      const F = after(p, 'fixed costs (?:of|are) ')
      const v = after(p, 'variable cost (?:per [\\w-]+ is|of) ')
      const p1 = after(p, 'sells [^£]*?at ')
      const p2 = after(p, 'price (?:up )?to ')
      expect(p2).toBeGreaterThan(p1)
      expect((p2 - p1) / p1).toBeLessThanOrEqual(0.4)
      expect(answer(b) * (p2 - v)).toBeCloseTo(F)
      const old = F / (p1 - v)
      expect(Number.isInteger(old)).toBe(true)
      expect(b.question.solution).toContain(`down from ${spaced(old)}`)
      expect(valueOf(method(b)[1]!)).toBeCloseTo(answer(b))
      expect(b.values.context).not.toBe('coffee')
      expect(p).not.toMatch(/costs? (?:rises|goes up)/)
      inScale(b, F, old)
      expect(p2 - v).not.toBe(2 * (p1 - v))
      wrong(b, { fall: old - answer(b), 'old price': old, 'F ÷ new price': F / p2, 'F ÷ price change': F / (p2 - p1), 'F ÷ variable cost': F / v })
    }
    expect(new Set(built.map((b) => b.values.context)).size).toBe(PRACTICE.ADVANCED.length)
    spread(build('q11', 1000, 'spread'), ['fixed', 'newPrice', 'variable'])
  })
})

describe('q13: profit from price, costs and sales', () => {
  it('is revenue less total costs, and the margin above break-even times the contribution', () => {
    const built = build('q13')
    for (const b of built) {
      const p = b.question.prompt
      const price = after(p, 'sells [^£]*?(?:for|at) ')
      const v = after(p, 'variable cost of ')
      const F = after(p, 'fixed costs (?:of|are) ')
      const Q = countAfter(p, 'It sells |it sells ')
      expect(answer(b)).toBe(price * Q - (F + v * Q))
      expect(answer(b)).toBeGreaterThan(0)
      const B = F / (price - v)
      expect(Number.isInteger(B)).toBe(true)
      expect(Q / B).toBeGreaterThanOrEqual(1.1)
      expect(Q / B).toBeLessThanOrEqual(2.55)
      const [rev, vc, tc] = method(b).map(valueOf)
      expect(rev).toBe(price * Q)
      expect(vc).toBe(v * Q)
      expect(tc).toBe(F + v * Q)
      expect(rev! - tc!).toBe(answer(b))
      expect(new Set([answer(b), F, price * Q, v * Q, F + v * Q]).size).toBe(5)
      inScale(b, F, Q)
      wrong(b, { 'variable costs forgotten': price * Q - F, 'fixed costs forgotten': (price - v) * Q, 'v not multiplied': price * Q - F - v, revenue: price * Q })
    }
    spread(build('q13', 1000, 'spread'), ['fixed', 'price', 'sold'])
  })
})

describe('q12 and q26: interest on a loan', () => {
  it('q12: interest over the amount borrowed, 2% to 8% a year', () => {
    const built = build('q12')
    for (const b of built) {
      const p = b.question.prompt
      const B = after(p, '(?:loan of|borrows) ')
      const R = after(p, 'repays ')
      const n = ['two', 'three', 'four', 'five'].indexOf(/over (\w+) years/i.exec(p)![1]!) + 2
      expect(n).toBeGreaterThanOrEqual(2)
      expect(answer(b)).toBeCloseTo(((R - B) / B) * 100, 9)
      expect(answer(b) / n).toBeGreaterThanOrEqual(2)
      expect(answer(b) / n).toBeLessThanOrEqual(8)
      const [i, ratio] = method(b).slice(0, 2).map(valueOf)
      expect(method(b)[2]).toBe('$\\times 100$')
      expect(i).toBe(R - B)
      expect(ratio! * 100).toBeCloseTo(answer(b))
      wrong(b, { 'over the total repaid': ((R - B) / R) * 100, 'repaid over borrowed': (R / B) * 100, 'per year': answer(b) / n, 'the interest itself': R - B, 'not times 100': (R - B) / B })
    }
    spread(build('q12', 1000, 'spread'), ['borrowed', 'years', 'percent'])
  })

  it('q26: instalments times months, then interest over the amount borrowed', () => {
    const built = build('q26')
    for (const b of built) {
      const p = b.question.prompt
      const B = after(p, '(?:loan of|borrows) ')
      const months = countAfter(p, 'in ')
      const m = after(p, 'monthly instalments of ')
      const R = months * m
      expect(PRACTICE.TERMS).toContain(months)
      expect(Number.isInteger(m)).toBe(true)
      expect(answer(b)).toBeCloseTo(((R - B) / B) * 100, 9)
      const y = months / 12
      expect(answer(b)).toBeGreaterThanOrEqual(Math.max(2, 1.1 * y) - 1e-9)
      expect(answer(b)).toBeLessThanOrEqual(6.6 * y + 1e-9)
      expect(valueOf(method(b)[0]!)).toBe(R)
      expect(valueOf(method(b)[1]!)).toBeCloseTo(answer(b))
      wrong(b, { 'over the total repaid': ((R - B) / R) * 100, 'repaid over borrowed': (R / B) * 100, 'the interest itself': R - B, ...(y !== 1 ? { 'per year': answer(b) / y } : {}) })
    }
    spread(build('q26', 1000, 'spread'), ['borrowed', 'months', 'percent'])
  })
})

// ---------------------------------------------------------------------------------------------
// 1.3.3 cash flow
// ---------------------------------------------------------------------------------------------

describe('q8 and q24: net cash flow', () => {
  it('q8: inflows less outflows, negative in about a third of builds', () => {
    const built = build('q8')
    for (const b of built) {
      const p = b.question.prompt
      const I = after(p, '(?:inflows (?:of|for \\w+ are)|receives) ')
      const X = after(p, '(?:outflows (?:of|are)|pays out) ')
      expect(answer(b)).toBe(I - X)
      expect(valueOf(method(b)[0]!)).toBe(answer(b))
      if (answer(b) < 0) expect(b.question.solution).toContain(`= -£${spacedTex(-answer(b))}$`)
      wrong(b, { 'sign flipped': X - I, 'added': I + X })
    }
    const neg = built.filter((b) => answer(b) < 0).length / built.length
    expect(neg).toBeGreaterThan(0.2)
    expect(neg).toBeLessThan(0.45)
    spread(build('q8', 1000, 'spread'), ['inflows', 'outflows'], 'sign')
  })

  it('q24: every inflow, the loan or grant included, less every outflow', () => {
    const built = build('q24')
    for (const b of built) {
      const p = b.question.prompt
      const S = after(p, 'receives ')
      const L = after(p, 'from sales and ')
      const sup = after(p, 'pays ')
      const wag = after(p, ', ')
      const oth = after(p, 'in wages and ')
      expect(answer(b)).toBe(S + L - sup - wag - oth)
      expect(sup > wag && wag > oth).toBe(true)
      expect(L).toBeLessThanOrEqual(0.4 * S)
      if (p.includes('bank loan')) expect(p).not.toContain('loan repayments')
      const line = method(b)[0]!
      const [ins, outs] = [...line.matchAll(/\$([^$]+)\$/g)].map((m) => ev(m[1]!))
      expect(ins! - outs!).toBe(answer(b))
      wrong(b, { 'other inflow left out': S - sup - wag - oth, 'sign flipped': -answer(b), 'outflows added': S + L + sup + wag + oth })
    }
    expect(new Set(built.map((b) => b.values.other)).size).toBe(4)
    // Suppliers are the largest outflow for every firm named, so no service firm whose wages would be.
    expect(new Set(built.map((b) => b.values.who))).toEqual(new Set(PRACTICE.ITEM_FIRMS))
    expect(PRACTICE.ITEM_FIRMS).not.toContain('a hairdresser')
    for (const who of PRACTICE.ITEM_FIRMS) {
      const mine = built.filter((b) => b.values.who === who)
      expect(mine.length, who).toBeGreaterThan(0)
      for (const b of mine) expect(Number(b.values.suppliers) > Number(b.values.wages) && Number(b.values.wages) > Number(b.values.thirdOutflow), `${who} ${b.seed}`).toBe(true)
    }
    expect(new Set(built.map((b) => b.values.third)).size).toBe(5)
    spread(build('q24', 1000, 'spread'), ['sales', 'otherInflow', 'suppliers'], 'sign')
  })
})

/** A balance or flow in a prompt: £1500, $-£800$ (an overdraft), $+£500$. */
const signed = (text: string, before: string) => after(text, before)

describe('q9, q25 and q14: closing balances', () => {
  it('q9: opening plus net cash flow, in each of four cases', () => {
    const built = build('q9')
    for (const b of built) {
      const p = b.question.prompt
      const O = signed(p, 'opening balance of ')
      const N = signed(p, 'net cash flow for (?:the month|\\w+) is ')
      expect(answer(b)).toBe(O + N)
      expect(b.question.markScheme[1]!.description).toBe(`$${spacedTex(O)} ${N < 0 ? '-' : '+'} ${spacedTex(Math.abs(N))}$`)
      expect(valueOf(method(b)[1]!)).toBe(answer(b))
      if (O < 0) expect(p).toContain('(an overdraft)')
      expect(O < 0).toBe(b.values.case === 'out-of-overdraft')
      wrong(b, { 'flow subtracted': O - N, 'flow alone': N, 'opening alone': O, 'sign of the closing balance': -answer(b) })
    }
    expect(new Set(built.map((b) => b.values.case)).size).toBe(4)
    spread(build('q9', 1000, 'spread'), ['opening', 'net'], 'case')
  })

  it('q25: the month before closes into the opening balance, then inflows less outflows', () => {
    const built = build('q25')
    for (const b of built) {
      const p = b.question.prompt
      const O = signed(p, 'closing balance (?:at the end of \\w+ was|of) ')
      const I = after(p, '(?:inflows are|receives) ')
      const X = after(p, '(?:outflows are|pays out) ')
      expect(answer(b)).toBe(O + I - X)
      expect(O < 0).toBe(b.values.case === 'out-of-overdraft')
      const [before, month] = [...p.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)/g)].map((m) => m[1]!)
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
      expect(months[(months.indexOf(before!) + 1) % 12]).toBe(month)
      expect(valueOf(method(b)[0]!) + valueOf(method(b)[1]!)).toBe(answer(b))
      wrong(b, { 'opening left out': I - X, 'outflows added': O + I + X, 'flow subtracted': O - (I - X), 'sign of the closing balance': -answer(b) })
    }
    spread(build('q25', 1000, 'spread'), ['opening', 'inflows', 'net'], 'case')
  })

  it('q14: the first month closes into the second month opening', () => {
    const built = build('q14')
    for (const b of built) {
      const p = b.question.prompt
      const O = after(p, 'opening balance of ')
      const m = new RegExp(`is ${MONEY} in (\\w+) and ${MONEY} in (\\w+)`).exec(p)!
      const N1 = money(m, 1)
      const N2 = money(m, 5)
      expect(p).toMatch(/\$[-+]£/)
      expect(answer(b)).toBe(O + N1 + N2)
      expect(valueOf(method(b)[0]!)).toBe(O + N1)
      expect(method(b)[1]).toBe(`carried forward as ${m[8]}'s opening balance`)
      expect(valueOf(method(b)[2]!)).toBe(answer(b))
      wrong(b, {
        'first month skipped': O + N2,
        'stopped at the first month': O + N1,
        'flows subtracted': O - N1 - N2,
        'sign of the closing balance': -answer(b),
        ...(N1 < 0 || N2 < 0 ? { 'signs ignored': O + Math.abs(N1) + Math.abs(N2) } : {}),
      })
    }
    expect(new Set(built.map((b) => b.values.pair)).size).toBe(4)
    spread(build('q14', 1000, 'spread'), ['opening', 'first', 'second'], 'pair')
  })
})

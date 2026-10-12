import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import {
  ARR_RETURNS,
  ARR_TOTAL,
  ARR_YEARLY,
  FALL,
  FIRMS,
  RETURN_INVESTMENTS,
  RISE,
  SHEET_ACCOUNTS,
  SHEET_COSTS,
  SHEET_RETURN,
  TOTAL_INVESTMENTS,
  YEARLY_INVESTMENTS,
  financeGenerators,
  grossMargins,
  netMargins,
} from './finance.ts'

/**
 * Structural tests for the 2.4 generators. Each reads the prompt's figures back with its own
 * parsing, works the answer again from them alone with its own arithmetic, checks literal lines
 * of the working and the mark scheme, that the named wrong routes (rounded as typed) are marked
 * wrong, that each business stays in its scale, and the spread over builds.
 */
const TOPIC = 'making-financial-decisions'
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/business')
const file = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(file.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const SLOTS: Record<string, string> = {
  q2: 'finance-gross-profit',
  q4: 'finance-gross-profit-margin',
  q5: 'finance-net-profit',
  q6: 'finance-net-profit-margin',
  q7: 'finance-arr-total-profit',
  q11: 'finance-arr-from-returns',
  q24: 'finance-profit-percentage-change',
  q25: 'finance-arr-yearly-profits',
  q26: 'finance-net-margin-from-accounts',
}

function build(slotId: string, count = 300, prefix = 'structure'): Generated[] {
  const g = GENERATORS.find((x) => x.id === SLOTS[slotId])!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
/** Every sum of money in a text, in order, as numbers: £1,378,000 → 1378000. Written here, not imported. */
const amounts = (s: string) => [...s.matchAll(/£([\d,]+)/g)].map((m) => Number(m[1]!.replace(/,/g, '')))
const amountAfter = (s: string, pattern: string) => {
  const m = new RegExp(`${pattern}\\s*£([\\d,]+)`, 'i').exec(s)
  if (!m) throw new Error(`no ${pattern} in ${s}`)
  return Number(m[1]!.replace(/,/g, ''))
}
/** Thousands with commas, in prose and inside maths. */
const comma = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const tex = (x: number) => comma(x).replace(/,/g, '{,}')

function share(built: Generated[], key: (b: Generated) => unknown) {
  const counts = new Map<unknown, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}

/** A money answer typed plain, with £, with commas and with spaces. */
function marksMoney(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), `£${a}`, comma(a), `£${comma(a)}`, comma(a).replace(/,/g, ' ')]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}
/** A percentage typed plain and with its sign. */
function marksPercent(b: Generated) {
  const a = answer(b)
  for (const t of [String(a), `${a}%`, `${a} %`]) expect(mark(b.question, t).correct, `${b.seed}: ${t}`).toBe(true)
}
/** Each wrong route, as a student would type it (whole, or to one place), is marked wrong. */
function refuses(b: Generated, wrong: number[]) {
  for (const w of wrong) {
    for (const t of [Math.round(w), Math.round(w * 10) / 10]) {
      expect(t, `${b.seed}: wrong route ${w}`).not.toBe(answer(b))
      expect(mark(b.question, String(t)).correct, `${b.seed}: ${t}`).toBe(false)
    }
  }
}
const firmOf = (b: Generated) => FIRMS.find((f) => f.name === b.values.context)!

describe('every 2.4 build', () => {
  it('has one generator for each numeric written slot', () => {
    expect(financeGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(bank.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(Object.keys(SLOTS).sort())
    for (const g of financeGenerators) {
      expect(g.subjectId).toBe('business')
      expect(g.topicId).toBe(TOPIC)
      expect(SLOTS[g.replaces[0]!]).toBe(g.id)
    }
  })

  it('keeps each slot\'s units (none on six), exact tolerance and codes, prints no article before a figure, and never fails to draw over 3000 seeds', () => {
    expect(Object.keys(SLOTS).filter((id) => written(id).type === 'numeric' && (written(id) as { units?: string }).units === undefined).sort()).toEqual(['q11', 'q2', 'q4', 'q5', 'q6', 'q7'])
    for (const g of financeGenerators) {
      for (const id of g.replaces) {
        const slot = written(id)
        for (let i = 0; i < 3000; i++) {
          const b = generate(g, slot, `throw-${i}`)
          if (i >= 300) continue
          const q = b.question
          expect(q.type).toBe('numeric')
          if (q.type !== 'numeric' || slot.type !== 'numeric') continue
          expect(q.units).toBe(slot.units)
          expect(q.tolerance).toBe(0)
          expect(Number.isInteger(q.answer), `${b.seed} ${q.answer}`).toBe(true)
          expect(q.answer).toBeGreaterThan(0)
          expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
          expect(q.prompt, b.seed).not.toMatch(/\d \d{3}/)
          // No two printed sums of money equal, and the answer is none of them.
          expect(new Set(amounts(q.prompt)).size, `${b.seed}: ${q.prompt}`).toBe(amounts(q.prompt).length)
          expect(amounts(q.prompt)).not.toContain(q.answer)
          expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
          expect(mark(q, String(q.answer + 1)).correct).toBe(false)
          expect(b.check.agrees, b.seed).toBe(true)
        }
      }
    }
  })

  it('repeats no prompt in a tenth of 1000 builds and the written one in at most a twentieth', () => {
    for (const id of Object.keys(SLOTS)) {
      const built = build(id, 1000, 'release')
      const counts = new Map<string, number>()
      for (const b of built) counts.set(b.question.prompt, (counts.get(b.question.prompt) ?? 0) + 1)
      expect(Math.max(...counts.values()), id).toBeLessThanOrEqual(50)
      expect(counts.get(written(id).prompt) ?? 0, id).toBeLessThanOrEqual(10)
    }
  })

  it('spreads every slot\'s answers and uses every context', () => {
    for (const id of Object.keys(SLOTS)) {
      const many = build(id, 1000, 'spread')
      expect(share(many, answer).worst, id).toBeLessThanOrEqual(id === 'q6' || id === 'q26' ? 0.15 : 0.1)
      expect(share(many, answer).distinct, id).toBeGreaterThanOrEqual(15)
      expect(share(many, (b) => b.values.context).worst, id).toBeLessThanOrEqual(0.2)
      // Every drawn figure spread too: no input in two builds in five (the years in three in five).
      for (const k of new Set(many.flatMap((b) => Object.keys(b.values)))) {
        if (['context', 'separate', 'direction', 'shape'].includes(k)) continue
        expect(share(many.filter((b) => k in b.values), (b) => b.values[k]).worst, `${id} ${k}`).toBeLessThanOrEqual(k === 'years' ? 0.6 : 0.4)
      }
    }
  })
})

describe('spread within each context', () => {
  // Drawing the answer first and an input last from a filtered list let one cost or one round
  // revenue take most of a context's builds: the van at £30,000 in 58%, revenue a whole £100,000
  // in 64% of q4, q6 and q26, last year's profit a whole £10,000 in 61% of q24.
  const many = Object.fromEntries(Object.keys(SLOTS).map((id) => [id, build(id, 3000, 'context')]))

  it('never gives one cost, revenue or profit to a large share of any context\'s builds', () => {
    for (const [id, built] of Object.entries(many)) {
      for (const c of new Set(built.map((b) => b.values.context))) {
        const group = built.filter((b) => b.values.context === c)
        for (const k of ['cost', 'revenue', 'before', 'grossProfit', 'netProfit']) {
          if (!(k in group[0]!.values)) continue
          expect(share(group, (b) => b.values[k]).worst, `${id} ${String(c)} ${k}`).toBeLessThanOrEqual(k === 'cost' ? 0.3 : 0.2)
        }
        expect(share(group, answer).worst, `${id} ${String(c)} answer`).toBeLessThanOrEqual(0.25)
      }
    }
  })

  it('keeps round revenues and profits, and the written figures, rare', () => {
    for (const id of ['q4', 'q6', 'q26']) {
      const round = many[id]!.filter((b) => Number(b.values.revenue) % 100000 === 0).length / many[id]!.length
      expect(round, id).toBeLessThanOrEqual(0.4)
    }
    const q24 = many.q24!
    expect(q24.filter((b) => Number(b.values.before) % 10000 === 0).length / q24.length).toBeLessThanOrEqual(0.2)
    expect(q24.filter((b) => b.values.before === 40000).length / q24.length).toBeLessThanOrEqual(0.05)
    // Totals and yearly returns in whole hundreds wherever three or more costs allow it.
    for (const [id, key] of [['q7', 'totalProfit'], ['q11', 'returns']] as const) {
      const tens = many[id]!.filter((b) => Number(b.values[key]) % 100 !== 0).length / many[id]!.length
      expect(tens, id).toBeLessThanOrEqual(0.15)
    }
  })
})

describe('the businesses and investments', () => {
  it('keep each kind in its scale and its margins', () => {
    for (const f of FIRMS) {
      expect(f.gross[0] - f.net[1], f.name).toBeGreaterThanOrEqual(10)
      expect(f.revenue[1], f.name).toBeLessThanOrEqual(2000000)
      expect(f.profit[1], f.name).toBeLessThanOrEqual((f.revenue[1] * f.net[1]) / 100)
      // Every margin in range can be drawn, but never 50% gross or 10% net.
      expect(grossMargins(f).length, f.name).toBeGreaterThanOrEqual(f.gross[1] - f.gross[0])
      expect(grossMargins(f)).not.toContain(50)
      expect(netMargins(f)).not.toContain(10)
    }
    const by = Object.fromEntries(FIRMS.map((f) => [f.name, f]))
    // Retail of goods keeps less after the cost of sales than a salon or an agency.
    expect(by['electrical retailer']!.gross[1]).toBeLessThanOrEqual(35)
    expect(by['bookshop']!.net[1]).toBeLessThanOrEqual(8)
    expect(by['hair salon']!.gross[0]).toBeGreaterThanOrEqual(70)
    // "A business" near the written questions' £480,000.
    expect(by['business']!.revenue).toEqual([200000, 900000])
    // No café, coffee shop, pet shop, toy shop or laundry: the sheets' other questions name those.
    for (const n of [...FIRMS, ...TOTAL_INVESTMENTS, ...RETURN_INVESTMENTS, ...YEARLY_INVESTMENTS].map((x) => JSON.stringify(x))) expect(n).not.toMatch(/caf|coffee|pet|toy|laund|washing/i)
    expect(Math.max(...TOTAL_INVESTMENTS.find((v) => v.name === 'till system')!.cost)).toBeLessThanOrEqual(10000)
    for (const v of YEARLY_INVESTMENTS) expect(v.cost[0], v.name).toBeGreaterThanOrEqual(15000)
  })
})

describe('q2: gross profit', () => {
  it('reads revenue and cost of sales back and takes one from the other', () => {
    for (const b of build('q2')) {
      const p = b.question.prompt
      const R = amountAfter(p, 'sales revenue (?:of|for the year was)')
      const C = amountAfter(p, 'cost of sales (?:of|was)')
      const GP = R - C
      expect(answer(b), b.seed).toBe(GP)
      const f = firmOf(b)
      expect(p.toLowerCase()).toContain(f.who.toLowerCase().replace(/^an? /, ''))
      expect(R >= f.revenue[0] && R <= f.revenue[1] && R % 1000 === 0 && C % 1000 === 0, b.seed).toBe(true)
      // The kind's gross margin, give or take the rounding of the cost of sales to £1,000.
      expect((GP / R) * 100).toBeGreaterThanOrEqual(f.gross[0] - 0.6)
      expect((GP / R) * 100).toBeLessThanOrEqual(f.gross[1] + 0.6)
      expect(b.question.solution).toBe(`Gross profit $=$ sales revenue $-$ cost of sales $= ${tex(R)} - ${tex(C)} = $ **£${comma(GP)}**. Only the cost of sales is taken away to reach gross profit.`)
      expect(lines(b)).toEqual([`M1 $${tex(R)} - ${tex(C)}$`, `A1 £${comma(GP)}`])
      // The core sheet's q23 asks the name of net profit: this solution never gives it.
      expect(b.question.solution).not.toMatch(/net/i)
      expect([R, C]).not.toContain(GP)
      refuses(b, [R + C, C, R])
      marksMoney(b)
    }
  })
})

describe('q4: gross profit margin', () => {
  it('reads gross profit and revenue back and divides', () => {
    for (const b of build('q4')) {
      const p = b.question.prompt
      const GP = amountAfter(p, 'gross profit (?:of|was)')
      const R = amountAfter(p, 'sales revenue (?:of|last year was)')
      const g = (GP * 100) / R
      expect(answer(b), b.seed).toBe(g)
      const f = firmOf(b)
      expect(g >= f.gross[0] && g <= f.gross[1] && g !== 50).toBe(true)
      expect(R >= f.revenue[0] && R <= f.revenue[1] && R % 5000 === 0 && GP % 500 === 0).toBe(true)
      expect(Math.log10(R) % 1).not.toBe(0)
      expect(b.question.solution).toContain(`= (${tex(GP)} \\div ${tex(R)}) \\times 100 = $ **${g}%**.`)
      expect(b.question.solution).not.toMatch(/net/i)
      expect(lines(b)).toEqual([`M1 $(${tex(GP)} \\div ${tex(R)}) \\times 100$`, `A1 ${g}%`])
      // Wrong routes: revenue ÷ gross profit; the cost of sales' share. Nor is the margin read off the profit.
      refuses(b, [(R / GP) * 100, R / GP, 100 - g])
      for (const k of [1, 2, 3, 4, 5]) expect(GP / 10 ** k, b.seed).not.toBe(g)
      marksPercent(b)
    }
  })
})

describe('q5: net profit', () => {
  it('reads gross profit and every cost back and takes them all off', () => {
    const built = build('q5')
    for (const b of built) {
      const p = b.question.prompt
      const GP = amountAfter(p, '(?:gross profit for the year was|gross profit of|Gross profit is)')
      const E = amountAfter(p, '(?:expenses and interest came to|expenses and interest totalled|expenses and interest are|expenses were|expenses came to)')
      const separate = /in interest|its interest to/.test(p)
      expect(separate).toBe(b.values.separate === 'yes')
      const I = separate ? amountAfter(p, '(?:paid|its interest to)') : 0
      expect(amounts(p)).toHaveLength(separate ? 3 : 2)
      const NP = GP - E - I
      expect(answer(b), b.seed).toBe(NP)
      expect(NP >= 2000 && GP % 1000 === 0 && (E + I) % 1000 === 0).toBe(true)
      // A net profit 2% to 50% of the gross profit, as the margins allow; the interest well under the other expenses.
      expect(NP / GP).toBeLessThan(0.75)
      if (separate) expect(E).toBeGreaterThan(2 * I)
      const line = separate ? `${tex(GP)} - ${tex(E)} - ${tex(I)}` : `${tex(GP)} - ${tex(E)}`
      expect(b.question.solution).toContain(`interest $= ${line} = $ **£${comma(NP)}**.`)
      expect(lines(b)).toEqual([`M1 $${line}$`, `A1 £${comma(NP)}`])
      expect([GP, E, I]).not.toContain(NP)
      // Wrong routes: added; interest forgotten; only the interest taken off.
      refuses(b, separate ? [GP + E + I, GP - E, GP - I] : [GP + E])
      marksMoney(b)
    }
    const sep = built.filter((b) => b.values.separate === 'yes').length / built.length
    expect(sep > 0.3 && sep < 0.5).toBe(true)
  })
})

describe('q6: net profit margin', () => {
  it('reads net profit and revenue back and divides by revenue', () => {
    for (const b of build('q6')) {
      const p = b.question.prompt
      const NP = amountAfter(p, 'net profit (?:of|was|is)')
      const R = amountAfter(p, 'sales revenue (?:of|last year was|is)')
      const n = (NP * 100) / R
      expect(answer(b), b.seed).toBe(n)
      const f = firmOf(b)
      expect(n >= f.net[0] && n <= f.net[1] && n !== 10).toBe(true)
      expect(R >= f.revenue[0] && R <= f.revenue[1] && R % 5000 === 0 && NP % 500 === 0).toBe(true)
      expect(b.question.solution).toContain(`= (${tex(NP)} \\div ${tex(R)}) \\times 100 = $ **${n}%**. It divides by **revenue**, not by gross profit.`)
      expect(lines(b)).toEqual([`M1 $(${tex(NP)} \\div ${tex(R)}) \\times 100$`, `A1 ${n}%`])
      // Wrong routes: revenue ÷ net profit (10 pays at a 10% margin, never drawn). Nor is the margin read off the profit.
      refuses(b, [R / NP, (R / NP) * 100])
      for (const k of [1, 2, 3, 4, 5]) expect(NP / 10 ** k, b.seed).not.toBe(n)
      marksPercent(b)
    }
  })
})

describe('q7: ARR from a total profit', () => {
  it('reads cost, total profit and years back, divides by the years and then by the cost', () => {
    for (const b of build('q7')) {
      const p = b.question.prompt
      const I = amountAfter(p, '(?:costs|costing)')
      const T = amountAfter(p, 'total profit of')
      const Y = Number(/(\d) years/.exec(p)![1])
      const P = T / Y
      const A = Math.round(((P / I) * 100) * 1e9) / 1e9
      expect(answer(b), b.seed).toBe(A)
      expect(Number.isInteger(answer(b))).toBe(true)
      const v = TOTAL_INVESTMENTS.find((x) => x.name === b.values.context)!
      expect(p).toContain(v.name === 'investment' ? 'nvestment' : v.what.slice(2))
      expect(I >= v.cost[0] && I <= v.cost[1] && Y >= v.years[0] && Y <= v.years[1]).toBe(true)
      expect(A >= ARR_TOTAL[0] && A <= ARR_TOTAL[1]).toBe(true)
      expect(T).not.toBe(I)
      expect(A).not.toBe(Y)
      expect(b.question.solution).toContain(`Average annual profit $= ${tex(T)} \\div ${Y} = ${tex(P)}$; then $(${tex(P)} \\div ${tex(I)}) \\times 100 = $ **${A}%**.`)
      expect(lines(b)).toEqual([`M1 $${tex(T)} \\div ${Y} = ${tex(P)}$`, `M1 $(${tex(P)} \\div ${tex(I)}) \\times 100$`, `A1 ${A}%`])
      // Wrong routes: years forgotten; the cost taken off a profit again; cost ÷ average profit.
      refuses(b, [(T / I) * 100, ((T - I) / Y / I) * 100, (I / P) * 100, P / I])
      marksPercent(b)
    }
  })
})

describe('q11: ARR from yearly returns', () => {
  it('reads cost, returns and years back, takes the cost off the total, then divides', () => {
    for (const b of build('q11')) {
      const p = b.question.prompt
      const I = amountAfter(p, '(?:costs|will cost|costing)')
      const R = amountAfter(p, '(?:returns|returns of|return)')
      const Y = Number(/for (\d) years/.exec(p)![1])
      const TP = R * Y - I
      const P = TP / Y
      const A = Math.round(((P / I) * 100) * 1e9) / 1e9
      expect(answer(b), b.seed).toBe(A)
      expect(Number.isInteger(answer(b))).toBe(true)
      const v = RETURN_INVESTMENTS.find((x) => x.name === b.values.context)!
      expect(I >= v.cost[0] && I <= v.cost[1] && Y >= v.years[0] && Y <= v.years[1] && ![I, R].some((x) => [...SHEET_COSTS, SHEET_RETURN].includes(x))).toBe(true)
      expect(A >= ARR_RETURNS[0] && A <= ARR_RETURNS[1]).toBe(true)
      expect(R % 10).toBe(0)
      const s = b.question.solution
      expect(s).toContain(`Total returns $= ${tex(R)} \\times ${Y} = ${tex(R * Y)}$.`)
      expect(s).toContain(`subtract the investment: $${tex(R * Y)} - ${tex(I)} = ${tex(TP)}$ total profit.`)
      expect(s).toContain(`Average annual profit $= ${tex(TP)} \\div ${Y} = ${tex(P)}$, so $(${tex(P)} \\div ${tex(I)}) \\times 100 = $ **${answer(b)}%**.`)
      const forgot = (R / I) * 100
      expect(s).toContain(Number.isInteger(Math.round(forgot * 1e9) / 1e9) ? `Forgetting to subtract gives ${Math.round(forgot)}%.` : `Forgetting to subtract gives about ${Math.round(forgot * 10) / 10}%.`)
      expect(lines(b)).toEqual([`M1 $${tex(R)} \\times ${Y} - ${tex(I)} = ${tex(TP)}$`, `M1 $(${tex(TP)} \\div ${Y} \\div ${tex(I)}) \\times 100$`, `A1 ${answer(b)}%`])
      // Wrong routes: the cost never taken off; the years never divided by; both slips; returns ÷ cost ÷ years.
      refuses(b, [forgot, (TP / I) * 100, ((R * Y) / I) * 100, (R / I / Y) * 100, forgot - 100])
      marksPercent(b)
    }
  })
})

describe('q24: percentage change in net profit', () => {
  it('reads both years back and divides the change by last year\'s', () => {
    const built = build('q24')
    for (const b of built) {
      const p = b.question.prompt
      const [O, N] = amounts(p) as [number, number]
      expect(amounts(p)).toHaveLength(2)
      const fall = /decrease/.test(p)
      expect(fall).toBe(N < O)
      expect(fall).toBe(b.values.direction === 'fall')
      const pc = (Math.abs(N - O) / O) * 100
      expect(answer(b), b.seed).toBeCloseTo(pc, 9)
      expect(Number.isInteger(answer(b))).toBe(true)
      const f = firmOf(b)
      expect(O >= f.profit[0] && O <= f.profit[1] && O % 1000 === 0 && N % 10 === 0).toBe(true)
      const [lo, hi] = fall ? FALL : RISE
      expect(answer(b) >= lo && answer(b) <= hi).toBe(true)
      const work = fall ? `(${tex(O)} - ${tex(N)}) \\div ${tex(O)} \\times 100` : `(${tex(N)} - ${tex(O)}) \\div ${tex(O)} \\times 100`
      expect(b.question.solution).toContain(`= ${work} = ${tex(Math.abs(N - O))} \\div ${tex(O)} \\times 100 = ${answer(b)}\\%$.`)
      expect(lines(b)).toEqual([`M1 $${work}$`, `A1 ${answer(b)}%`])
      // Wrong routes: divided by this year's figure; new ÷ old; old ÷ new. Nor is it the change read off.
      refuses(b, [(Math.abs(N - O) / N) * 100, (N / O) * 100, (O / N) * 100])
      for (const k of [1, 2, 3, 4, 5]) expect(Math.abs(N - O) / 10 ** k, b.seed).not.toBe(answer(b))
      marksPercent(b)
    }
    const falls = built.filter((b) => b.values.direction === 'fall').length / built.length
    expect(falls > 0.3 && falls < 0.5).toBe(true)
  })
})

describe('q25: ARR from yearly profits', () => {
  it('reads cost and each year\'s profit back, averages them and divides by the cost', () => {
    const built = build('q25')
    for (const b of built) {
      const p = b.question.prompt
      const [I, ...xs] = amounts(p) as [number, ...number[]]
      const Y = xs.length
      const S = xs.reduce((a, c) => a + c, 0)
      const A = (S / Y / I) * 100
      expect(answer(b), b.seed).toBeCloseTo(A, 9)
      expect(Number.isInteger(answer(b))).toBe(true)
      const v = YEARLY_INVESTMENTS.find((x) => x.name === b.values.context)!
      expect(I >= v.cost[0] && I <= v.cost[1] && Y >= v.years[0] && Y <= v.years[1]).toBe(true)
      expect(answer(b) >= ARR_YEARLY[0] && answer(b) <= ARR_YEARLY[1]).toBe(true)
      expect(p).toContain(`average rate of return on the ${v.noun}.`)
      // Whole hundreds, distinct, none equal to the average, in the shape drawn.
      for (const x of xs) expect(x % 100 === 0 && x >= 500).toBe(true)
      expect(new Set(xs).size).toBe(Y)
      expect(xs).not.toContain(S / Y)
      const up = xs.every((x, i) => i === 0 || x > xs[i - 1]!)
      const down = xs.every((x, i) => i === 0 || x < xs[i - 1]!)
      expect(up).toBe(b.values.shape === 'rising')
      expect(down).toBe(b.values.shape === 'falling')
      const s = b.question.solution
      expect(s).toContain(`Total profit $= ${xs.map(tex).join(' + ')} = £${tex(S)}$. Average annual profit $= ${tex(S)} \\div ${Y} = £${tex(S / Y)}$.`)
      expect(s).toContain(`= ${tex(S / Y)} \\div ${tex(I)} \\times 100 = ${answer(b)}\\%$.`)
      expect(lines(b)).toEqual([`M1 $${tex(S)} \\div ${Y} = ${tex(S / Y)}$`, `M1 $${tex(S / Y)} \\div ${tex(I)} \\times 100$`, `A1 ${answer(b)}%`])
      // Wrong routes: the cost taken off again; the years never divided by; one year, or the first
      // and last averaged, taken for the average.
      const sorted = [...xs].sort((a, c) => a - c)
      const median = Y % 2 ? sorted[(Y - 1) / 2]! : (sorted[Y / 2 - 1]! + sorted[Y / 2]!) / 2
      refuses(b, [((S - I) / Y / I) * 100, (S / I) * 100, ...[...xs, (xs[0]! + xs[Y - 1]!) / 2, median].map((x) => (x / I) * 100)])
      marksPercent(b)
    }
    const rising = built.filter((b) => b.values.shape === 'rising').length / built.length
    expect(rising > 0.4 && rising < 0.6).toBe(true)
    for (const Y of [3, 4, 5]) expect(built.some((b) => amounts(b.question.prompt).length === Y + 1), `${Y} years`).toBe(true)
  })
})

describe('q26: net profit margin from the accounts', () => {
  it('reads the four figures back, works gross then net, and divides by revenue', () => {
    for (const b of build('q26')) {
      const p = b.question.prompt
      const [R, C, E, I] = amounts(p) as [number, number, number, number]
      expect(amounts(p)).toHaveLength(4)
      const GP = R - C
      const NP = GP - E - I
      const n = (NP * 100) / R
      expect(answer(b), b.seed).toBe(n)
      const f = firmOf(b)
      expect(n >= f.net[0] && n <= f.net[1] && n !== 10).toBe(true)
      expect(R >= f.revenue[0] && R <= f.revenue[1]).toBe(true)
      // Never q30's laundry (£250,000 at 12%) nor q29's toy shop (£500,000 at 6%).
      for (const [r, m] of SHEET_ACCOUNTS) expect(R === r && n === m, b.seed).toBe(false)
      expect((GP / R) * 100).toBeGreaterThanOrEqual(f.gross[0] - 0.6)
      expect((GP / R) * 100).toBeLessThanOrEqual(f.gross[1] + 0.6)
      expect(I / R >= 0.006 && I / R <= 0.031 && E > 2 * I && GP !== C).toBe(true)
      const s = b.question.solution
      expect(s).toContain(`= ${tex(R)} - ${tex(C)} = £${tex(GP)}$.`)
      expect(s).toContain(`= ${tex(GP)} - ${tex(E)} - ${tex(I)} = £${tex(NP)}$.`)
      expect(s).toContain(`= ${tex(NP)} \\div ${tex(R)} \\times 100 = ${n}\\%$.`)
      expect(lines(b)).toEqual([`M1 $${tex(R)} - ${tex(C)} = ${tex(GP)}$`, `M1 $${tex(GP)} - ${tex(E)} - ${tex(I)} = ${tex(NP)}$`, `A1 ${n}%`])
      // Wrong routes: ÷ gross profit; interest left out; the gross margin; the cost of sales' share; the costs' share.
      refuses(b, [(NP / GP) * 100, ((GP - E) / R) * 100, (GP / R) * 100, (C / R) * 100, ((E + I) / R) * 100, ((GP - I) / R) * 100])
      marksPercent(b)
    }
  })
})

describe('the worksheets', () => {
  it('never print a context or cost the sheet\'s other questions use, and the core never names net profit', () => {
    for (const level of ['core', 'higher', 'advanced'] as const) {
      const ids: string[] = file.worksheets[level].questionIds
      for (let i = 0; i < 200; i++) {
        const sheet = sheetQuestions('business', TOPIC, ids.map((id) => written(id)), `sheet-${level}-${i}`)
        for (const item of sheet) {
          if (!item.generated) continue
          const q = item.question
          expect(q.prompt).not.toMatch(/caf|coffee|pet shop|toy|laund/i)
          if (level === 'core') expect(`${q.prompt} ${q.solution}`).not.toMatch(/net profit|\brent\b/i)
          if (level === 'advanced' && q.id === 'q26') for (const [r, m] of SHEET_ACCOUNTS) expect(q.type === 'numeric' && amounts(q.prompt)[0] === r && q.answer === m).toBe(false)
          if (level === 'advanced' && q.id === 'q11') for (const c of [...SHEET_COSTS, SHEET_RETURN]) expect(amounts(q.prompt)).not.toContain(c)
        }
        expect(sheet.filter((x) => x.generated).length).toBe(ids.filter((id) => id in SLOTS).length)
      }
    }
  })
})

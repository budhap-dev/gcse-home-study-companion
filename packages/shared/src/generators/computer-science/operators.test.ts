import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { operatorGenerators } from './operators.ts'

/**
 * Structural tests for data-types-and-operators (AQA 8525 3.2.1 to 3.2.5, 3.2.9). Each reads the
 * printed code or prose back with regular expressions written here, works the answer with
 * JavaScript's own % and Math.floor (no interpreter, no generator helper), checks the printed
 * working, literal builds, the named wrong routes (DIV and MOD swapped, MOD as the decimal part,
 * precedence read left to right, a FOR loop one short, the test read the other way) and the
 * spread of answers and inputs.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/computer-science')
const TOPIC = 'data-types-and-operators'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const BANK = Question.array().parse(topic.questions)
const slotOf = (id: string) => BANK.find((q) => q.id === id)!
const SLOTS: Record<string, string> = {
  q2: 'cs-operators-mod',
  q3: 'cs-operators-div',
  q8: 'cs-operators-digits',
  q11: 'cs-operators-trace',
  q14: 'cs-operators-precedence',
  q18: 'cs-operators-random',
  q20: 'cs-operators-relational',
}
const gen = (id: string) => GENERATORS.find((x) => x.id === id)!
const build = (slotId: string, n = 300, prefix = 'structure') => Array.from({ length: n }, (_, i) => generate(gen(SLOTS[slotId]!), slotOf(slotId), `${prefix}-${i}`))
const at = (slotId: string, seed: string) => generate(gen(SLOTS[slotId]!), slotOf(slotId), seed)
const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const lines = (b: Generated) => b.question.markScheme.map((l) => `${l.code} ${l.description}`)
const code = (b: Generated) => /```\n([\s\S]*?)\n```/.exec(b.question.prompt)?.[1] ?? ''

function share<T>(built: Generated[], key: (b: Generated) => T) {
  const counts = new Map<T, number>()
  for (const b of built) counts.set(key(b), (counts.get(key(b)) ?? 0) + 1)
  return { worst: Math.max(...counts.values()) / built.length, distinct: counts.size }
}
/** The share of builds where a wrong route gives the answer. */
const pays = (built: Generated[], route: (b: Generated) => number | number[]) =>
  built.filter((b) => [route(b)].flat().includes(answer(b))).length / built.length

/**
 * The decimal part of a / b as a student might type it: 3.4 gives 4; 14.2857… gives 2857 and 2;
 * rounded, 3.36… gives 3.4 (4) and 3.36 (36).
 */
function decimals(a: number, b: number): number[] {
  const text = String(a / b)
  const after = text.includes('.') ? text.split('.')[1]!.slice(0, 4) : ''
  const oneDp = (a / b).toFixed(1).split('.')[1]!
  const twoDp = (a / b).toFixed(2).split('.')[1]!
  return after ? [Number(after.replace(/0+$/, '')), Number(after[0]), Number(oneDp), Number(twoDp)] : []
}

describe('data-types-and-operators builds', () => {
  it('stand in for every numeric question in the topic', () => {
    expect(operatorGenerators.flatMap((g) => g.replaces).sort()).toEqual(Object.keys(SLOTS).sort())
    expect(BANK.filter((q) => q.type === 'numeric').map((q) => q.id).sort()).toEqual(Object.keys(SLOTS).sort())
  })

  for (const slotId of Object.keys(SLOTS)) {
    const slot = slotOf(slotId)
    it(`${slotId}: keeps the written codes, no units and exact tolerance, is marked right typed plain or grouped, and never fails to draw over 3000 seeds`, () => {
      for (let i = 0; i < 3000; i++) {
        const b = generate(gen(SLOTS[slotId]!), slot, `throw-${i}`)
        if (i >= 300) continue
        const q = b.question
        if (q.type !== 'numeric') throw new Error('not numeric')
        expect(q.units).toBeUndefined()
        expect(q.tolerance).toBe(0)
        expect(q.markScheme.map((l) => l.code)).toEqual(slot.markScheme.map((l) => l.code))
        expect(b.check.agrees, b.seed).toBe(true)
        for (const t of [String(q.answer), ` ${q.answer} `, q.answer.toLocaleString('en-GB')]) expect(mark(q, t).correct, `${b.seed}: ${t}`).toBe(true)
        expect(mark(q, String(q.answer + 1)).correct).toBe(false)
        expect(mark(q, String(q.answer - 1)).correct).toBe(false)
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

  it('never prints MOD 2 on the higher sheet, whose q10 asks which test means even', () => {
    for (let i = 0; i < 300; i++) {
      const sheet = sheetQuestions('computer-science', TOPIC, topic.worksheets.higher.questionIds.map(slotOf), `sheet-${i}`)
      for (const s of sheet) if (s.generated) expect(s.question.prompt).not.toMatch(/MOD 2\b/)
    }
  })
})

// ---------------------------------------------------------------------------------------------

describe('q2 and q3: one MOD, one DIV', () => {
  const read = (b: Generated) => {
    const m = /`(\d+) (MOD|DIV) (\d+)`/.exec(b.question.prompt)!
    return { a: Number(m[1]), op: m[2]!, b: Number(m[3]) }
  }
  const mods = build('q2')
  const divs = build('q3')

  it('asks MOD on q2 and DIV on q3, a at most 100 and b from 3 to 12', () => {
    for (const x of mods) expect(read(x).op).toBe('MOD')
    for (const x of divs) expect(read(x).op).toBe('DIV')
    for (const x of [...mods, ...divs]) {
      const { a, b } = read(x)
      expect(a).toBeLessThanOrEqual(100)
      expect(b >= 3 && b <= 12).toBe(true)
      expect(Math.floor(a / b)).toBeGreaterThanOrEqual(2)
      expect(a % b).toBeGreaterThan(0)
    }
    for (const x of mods) expect(answer(x), x.seed).toBe(read(x).a % read(x).b)
    for (const x of divs) expect(answer(x), x.seed).toBe(Math.floor(read(x).a / read(x).b))
  })

  it('prints the division as quotient × b + remainder', () => {
    for (const x of mods) {
      const { a, b } = read(x)
      expect(x.question.solution).toBe(`**MOD** gives the remainder: $${a} = ${Math.floor(a / b)} \\times ${b} + ${a % b}$, so \`${a} MOD ${b}\` is **${a % b}**.`)
    }
    for (const x of divs) {
      const { a, b } = read(x)
      const q = Math.floor(a / b)
      expect(x.question.solution).toBe(`**DIV** is integer division, the whole number of times ${b} goes into ${a}: $${q} \\times ${b} = ${q * b}$, so \`${a} DIV ${b}\` is **${q}**. The remainder, ${a % b}, is thrown away.`)
    }
  })

  it('prints literal builds', () => {
    expect(at('q2', 'lit-a').question.prompt).toBe('Work out `93 MOD 4`.')
    expect(at('q2', 'lit-a').question.solution).toBe('**MOD** gives the remainder: $93 = 23 \\times 4 + 1$, so `93 MOD 4` is **1**.')
    expect(lines(at('q2', 'lit-a'))).toEqual(['B1 1'])
    expect(at('q3', 'lit-a').question.prompt).toBe('Work out `50 DIV 4`.')
    expect(at('q3', 'lit-a').question.solution).toBe('**DIV** is integer division, the whole number of times 4 goes into 50: $12 \\times 4 = 48$, so `50 DIV 4` is **12**. The remainder, 2, is thrown away.')
  })

  it('MOD: DIV instead, b minus the remainder, the decimal part and one subtraction never pay; MOD 10 is never asked', () => {
    expect(pays(mods, (x) => Math.floor(read(x).a / read(x).b))).toBe(0)
    expect(pays(mods, (x) => read(x).b - (read(x).a % read(x).b))).toBe(0)
    expect(pays(mods, (x) => decimals(read(x).a, read(x).b))).toBe(0)
    expect(pays(mods, (x) => read(x).a - read(x).b)).toBe(0)
    for (const x of mods) expect(read(x).b).not.toBe(10)
  })

  it('DIV: MOD instead and b never pay, b is never 10, and rounding a / b pays in under a fifth', () => {
    expect(pays(divs, (x) => read(x).a % read(x).b)).toBe(0)
    expect(pays(divs, (x) => read(x).b)).toBe(0)
    for (const x of divs) expect(read(x).b).not.toBe(10)
    expect(pays(divs, (x) => Math.round(read(x).a / read(x).b))).toBeLessThan(0.2)
  })

  it('spreads answers and inputs', () => {
    expect(share(mods, answer).worst).toBeLessThan(0.25)
    expect(share(mods, answer).distinct).toBe(11)
    expect(share(divs, answer).worst).toBeLessThan(0.15)
    expect(share(divs, answer).distinct).toBe(11)
    expect(share(mods, (x) => read(x).b).distinct).toBe(8)
    expect(share(mods, (x) => read(x).b).worst).toBeLessThan(0.2)
    expect(share(divs, (x) => read(x).b).distinct).toBe(9)
    expect(share(mods, (x) => read(x).a).distinct).toBeGreaterThan(60)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q8: DIV 10 and MOD 10 together', () => {
  const built = build('q8')
  const read = (b: Generated) => {
    const c = code(b)
    const x = Number(/^[xn] ← (\d+)$/m.exec(c)![1])
    const form = /\(\w MOD 10\) \* 10 \+/.test(c) ? 'reverse' : /DIV 10\) - \(/.test(c) ? 'difference' : '?'
    return { x, form, tens: Math.floor(x / 10), units: x % 10 }
  }
  /** The output with DIV and MOD swapped. */
  const swapped = (b: Generated) => { const { form, tens, units } = read(b); return form === 'difference' ? units - tens : tens * 10 + units }

  it('outputs the tens digit minus the units digit, or the digits reversed', () => {
    for (const b of built) {
      const { x, form, tens, units } = read(b)
      expect(form).not.toBe('?')
      expect(x >= 12 && x <= 98).toBe(true)
      expect(tens).not.toBe(units)
      if (form === 'difference') expect(tens > units && tens !== 2 * units).toBe(true)
      expect(answer(b), b.seed).toBe(form === 'difference' ? tens - units : units * 10 + tens)
      expect(lines(b)).toEqual([`M1 ${tens} and ${units}`, `A1 ${answer(b)}`])
      expect(b.question.solution).toContain(`\`${x} DIV 10\` is ${tens} (the tens digit) and \`${x} MOD 10\` is ${units} (the units digit).`)
    }
  })

  it('prints literal builds', () => {
    const b = at('q8', 'lit-c')
    expect(b.question.prompt).toBe('What is output?\n\n```\nn ← 74\nOUTPUT (n DIV 10) - (n MOD 10)\n```')
    expect(b.question.solution).toBe('`74 DIV 10` is 7 (the tens digit) and `74 MOD 10` is 4 (the units digit). $7 - 4 = $ **3**. DIV and MOD together pull a number apart into its digits; swapping them would give $4 - 7 = -3$.')
    expect(lines(b)).toEqual(['M1 7 and 4', 'A1 3'])
    expect(at('q8', 'lit-a').question.prompt).toBe('What is output?\n\n```\nx ← 24\nOUTPUT (x MOD 10) * 10 + (x DIV 10)\n```')
    expect(at('q8', 'lit-a').question.solution).toBe('`24 DIV 10` is 2 (the tens digit) and `24 MOD 10` is 4 (the units digit). The units digit is multiplied by 10 first, then the tens digit added: $4 \\times 10 + 2 = $ **42**, the digits of 24 the other way round. Swapping DIV and MOD would give 24 back.')
  })

  it('never pays DIV and MOD swapped (under a tenth, in fact never), the number, or one digit', () => {
    expect(pays(built, swapped)).toBeLessThan(0.1)
    expect(pays(built, swapped)).toBe(0)
    expect(pays(built, (b) => [read(b).x, read(b).tens, read(b).units])).toBe(0)
  })

  it('spreads forms, answers and numbers', () => {
    const difference = built.filter((b) => read(b).form === 'difference').length / built.length
    expect(difference > 0.5 && difference < 0.7).toBe(true)
    expect(share(built, answer).worst).toBeLessThan(0.15)
    expect(share(built, answer).distinct).toBeGreaterThan(30)
    expect(share(built, (b) => read(b).x).distinct).toBeGreaterThan(50)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q11: a five-line trace with DIV and MOD', () => {
  const built = build('q11')
  const read = (b: Generated) => {
    const c = code(b)
    const n = Number(/^[nx] ← (\d+)$/m.exec(c)![1])
    const d = Number(/DIV (\d+)$/m.exec(c)![1])
    const scaled = /^total ← total \* (\d+) \+ \([nx] MOD \d+\)$/m.exec(c)
    const form = /^total ← total - \([nx] MOD \d+\)$/m.test(c) ? 'minus' : scaled ? 'scaled' : /^total ← \([nx] MOD \d+\) \* 10 \+ total$/m.test(c) ? 'tens' : '?'
    return { n, d, form, k: scaled ? Number(scaled[1]) : 0, q: Math.floor(n / d), r: n % d }
  }
  /** The form worked with any quotient and remainder: swapped, or with n / d rounded for the quotient. */
  const work = (b: Generated, q: number, r: number) => { const { form, k } = read(b); return form === 'minus' ? q - r : form === 'scaled' ? q * k + r : r * 10 + q }

  it('outputs n DIV d combined with n MOD d, and prints both and the running total', () => {
    for (const b of built) {
      const { n, d, form, q, r } = read(b)
      expect(form).not.toBe('?')
      expect(answer(b), b.seed).toBe(work(b, q, r))
      expect(n >= 20 && n <= 100 && d >= 3 && d <= 8 && r >= 1).toBe(true)
      expect(lines(b)).toEqual([`M1 ${q} and ${r}`, `A1 ${answer(b)}`])
      expect(b.question.solution).toContain(`\`${n} DIV ${d}\` is ${q} and \`${n} MOD ${d}\` is ${r}. Line by line, total is 0, then ${q}, then $`)
    }
  })

  it('prints a literal build', () => {
    const b = at('q11', 'lit-a')
    expect(b.question.prompt).toBe('What is output?\n\n```\ntotal ← 0\nn ← 82\ntotal ← n DIV 7\ntotal ← total - (n MOD 7)\nOUTPUT total\n```')
    expect(b.question.solution).toBe('`82 DIV 7` is 11 and `82 MOD 7` is 5. Line by line, total is 0, then 11, then $11 - 5 = $ **6**. Write the value of each line in a trace table rather than working in your head.')
    expect(lines(b)).toEqual(['M1 11 and 5', 'A1 6'])
    expect(at('q11', 'lit-b').question.solution).toBe('`82 DIV 7` is 11 and `82 MOD 7` is 5. Line by line, total is 0, then 11, then $5 \\times 10 + 11 = $ **61**. Write the value of each line in a trace table rather than working in your head.')
    expect(at('q11', 'lit-d').question.prompt).toBe('What is output?\n\n```\ntotal ← 0\nx ← 55\ntotal ← x DIV 3\ntotal ← total * 5 + (x MOD 3)\nOUTPUT total\n```')
  })

  it('never pays DIV and MOD swapped (under a twentieth, in fact never), the quotient or remainder alone, 0, n, d, or the decimal part for MOD', () => {
    expect(pays(built, (b) => work(b, read(b).r, read(b).q))).toBeLessThan(0.05)
    expect(pays(built, (b) => work(b, read(b).r, read(b).q))).toBe(0)
    expect(pays(built, (b) => [read(b).q, read(b).r, 0, read(b).n, read(b).d])).toBe(0)
    expect(pays(built, (b) => decimals(read(b).n, read(b).d).map((x) => work(b, read(b).q, x)))).toBe(0)
  })

  it('pays n / d rounded for the quotient in under a fifth', () => {
    expect(pays(built, (b) => work(b, Math.round(read(b).n / read(b).d), read(b).r))).toBeLessThan(0.2)
  })

  it('spreads forms, answers and inputs', () => {
    const minus = built.filter((b) => read(b).form === 'minus').length / built.length
    expect(minus > 0.5 && minus < 0.7).toBe(true)
    expect(share(built, (b) => read(b).form).distinct).toBe(3)
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(20)
    // d = 9 never: its remainder r makes n / 9 recur 0.rrr…, so MOD read as the decimal part would pay.
    expect(share(built, (b) => read(b).d).distinct).toBe(6)
    expect(share(built, (b) => read(b).n).distinct).toBeGreaterThan(50)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q14: precedence with DIV and MOD', () => {
  const built = build('q14')
  const read = (b: Generated) => {
    const c = code(b)
    const a = Number(/^a ← (\d+)$/m.exec(c)![1])
    const bb = Number(/^b ← (\d+)$/m.exec(c)![1])
    const form = /^c ← \(a MOD b\) \* \d+$/m.test(c) ? 'mod-times' : /^c ← \(a DIV b\) \* \d+$/m.test(c) ? 'div-times' : /^c ← a MOD b$/m.test(c) ? 'unbracketed' : '?'
    const k = Number((/\* (\d+)$/m.exec(c) ?? [])[1])
    return { a, b: bb, form, k, q: Math.floor(a / bb), r: a % bb }
  }
  /** Each form worked by hand, and its slips. */
  const work = (b: Generated) => {
    const { form, k, q, r } = read(b)
    if (form === 'mod-times') return { right: r * k + q, swapped: q * k + r, c: r * k, ltr: NaN }
    if (form === 'div-times') return { right: q * k - r, swapped: r * k - q, c: q * k, ltr: NaN }
    return { right: r + q * k, swapped: q + r * k, c: r, ltr: (r + q) * k }
  }

  it('outputs the bracketed working, and prints each value', () => {
    for (const b of built) {
      const { a, b: bb, form, k, q, r } = read(b)
      expect(form).not.toBe('?')
      expect(answer(b), b.seed).toBe(work(b).right)
      expect(a >= 10 && a <= 40 && bb >= 3 && bb <= 9 && k >= 2 && k <= 5 && r >= 1 && q >= 2).toBe(true)
      expect(b.question.solution).toContain(`\`${a} MOD ${bb}\``)
      expect(b.question.solution).toContain(`${a} DIV ${bb}\``)
      expect(lines(b)[0]).toBe(form === 'div-times' ? `M1 ${a} DIV ${bb} = ${q}, so c = ${q * k}` : `M1 ${a} MOD ${bb} = ${r}, so c = ${work(b).c}`)
    }
  })

  it('prints literal builds', () => {
    const b = at('q14', 'lit-g')
    expect(b.question.prompt).toBe('What is output?\n\n```\na ← 31\nb ← 8\nc ← a MOD b\nOUTPUT c + (a DIV b) * 2\n```')
    expect(b.question.solution).toBe('`31 MOD 8` is 7, so `c` is 7. In the output line the brackets come first, `31 DIV 8` = 3, then the multiplication before the addition: $3 \\times 2 = 6$, and $7 + 6 = $ **13**. Working left to right would give $(7 + 3) \\times 2 = 20$, which is wrong.')
    expect(lines(b)).toEqual(['M1 31 MOD 8 = 7, so c = 7', 'M1 31 DIV 8 = 3, times 2 is 6 before the addition', 'A1 13'])
    const d = at('q14', 'lit-a')
    expect(d.question.prompt).toBe('What is output?\n\n```\na ← 37\nb ← 8\nc ← (a DIV b) * 3\nOUTPUT c - (a MOD b)\n```')
    expect(d.question.solution).toBe('The brackets say what to do first: `37 DIV 8` is 4, times 3 is 12, so `c` is 12. Then `a MOD b` is `37 MOD 8` = 5, and $12 - 5 = $ **7**. Bracket a mixed `DIV`/`*` line rather than relying on precedence, because the exam languages do not agree on it.')
    expect(lines(d)).toEqual(['M1 37 DIV 8 = 4, so c = 12', 'M1 37 MOD 8 = 5', 'A1 7'])
  })

  it('never pays DIV and MOD swapped, left to right, c, the quotient, the remainder or a printed figure', () => {
    expect(pays(built, (b) => [work(b).swapped, work(b).ltr, work(b).c, read(b).q, read(b).r, read(b).a, read(b).b, read(b).k])).toBe(0)
  })

  it('spreads forms, answers and inputs', () => {
    const forms = share(built, (b) => read(b).form)
    expect(forms.distinct).toBe(3)
    expect(forms.worst).toBeLessThan(0.45)
    expect(share(built, answer).worst).toBeLessThan(0.1)
    expect(share(built, answer).distinct).toBeGreaterThan(25)
    expect(share(built, (b) => read(b).k).distinct).toBe(4)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q18: a random number, then MOD', () => {
  const built = build('q18')
  const read = (b: Generated) => {
    const p = b.question.prompt
    const range = /RANDOM_INT\((\d+), (\d+)\)/.exec(p)!
    const v = Number((/returns? (\d+)|returned (\d+)|was (\d+)/.exec(p) ?? []).slice(1).find(Boolean))
    const m = /multiplied by (\d+)|\* (\d+)/.exec(p)
    const plus = /increased by (\d+)|\+ (\d+)/.exec(p)
    const d = Number(/MOD (\d+)/.exec(p)![1])
    const by = Number((m ?? plus)!.slice(1).find(Boolean))
    return { lo: Number(range[1]), hi: Number(range[2]), v, times: Boolean(m), by, d, made: m ? v * by : v + by }
  }

  it('outputs the product (or sum) MOD d, for a value inside the range', () => {
    for (const b of built) {
      const { lo, hi, v, by, d, made } = read(b)
      expect(v >= lo && v <= hi && v >= 2).toBe(true)
      expect(answer(b), b.seed).toBe(made % d)
      expect(made > d && made <= 100).toBe(true)
      expect(lines(b)).toEqual([`M1 ${made}`, `A1 ${made % d}`])
      expect(b.question.solution).toContain(`\`${made} MOD ${d}\`: $${Math.floor(made / d)} \\times ${d} = ${Math.floor(made / d) * d}$, remainder **${made % d}**.`)
      expect(by).not.toBe(hi)
    }
  })

  it('prints literal builds', () => {
    expect(at('q18', 'lit-a').question.prompt).toBe('`RANDOM_INT(1, 6)` returns 6 when this program runs. What is output?\n\n```\ndice ← RANDOM_INT(1, 6)\ndice ← dice * 12\nOUTPUT dice MOD 5\n```')
    expect(at('q18', 'lit-a').question.solution).toBe('$6 \\times 12 = 72$, and `72 MOD 5`: $14 \\times 5 = 70$, remainder **2**.')
    expect(lines(at('q18', 'lit-a'))).toEqual(['M1 72', 'A1 2'])
    expect(at('q18', 'lit-c').question.prompt).toBe('A program stores the result of `RANDOM_INT(1, 10)`. The stored number is multiplied by 7, then `MOD 11` is applied and the result is output. If `RANDOM_INT(1, 10)` returned 7, what is output?')
    expect(at('q18', 'lit-c').question.solution).toBe('$7 \\times 7 = 49$, and `49 MOD 11`: $4 \\times 11 = 44$, remainder **5**.')
  })

  it('never pays the value without the multiplication, MOD first, the product, the quotient or a printed figure', () => {
    expect(
      pays(built, (b) => {
        const { v, by, d, made, times, hi } = read(b)
        return [v % d, times ? (v % d) * by : (v % d) + by, made, Math.floor(made / d), v, by, d, hi]
      }),
    ).toBe(0)
  })

  it('spreads answers, divisors, forms and both operations', () => {
    expect(share(built, answer).worst).toBeLessThan(0.16)
    expect(share(built, answer).distinct).toBe(8)
    expect(share(built, (b) => read(b).d).distinct).toBeGreaterThanOrEqual(8)
    expect(share(built, (b) => read(b).d).worst).toBeLessThan(0.25)
    const code = built.filter((b) => b.question.prompt.includes('```')).length / built.length
    expect(code > 0.4 && code < 0.6).toBe(true)
    const added = built.filter((b) => !read(b).times).length / built.length
    expect(added > 0.12 && added < 0.4).toBe(true)
  })
})

// ---------------------------------------------------------------------------------------------

describe('q20: counting with a relational test', () => {
  const built = build('q20')
  const test = (x: number, op: string, k: number) => ({ '≠': x !== k, '=': x === k, '<': x < k, '>': x > k, '≤': x <= k, '≥': x >= k })[op]!
  const read = (b: Generated) => {
    const c = code(b)
    const [, s, e] = /FOR i ← (\d+) TO (\d+)/.exec(c)!.map(Number)
    const m = /IF \(i MOD (\d+)\) (\S) (\d+) THEN/.exec(c)!
    return { s: s!, e: e!, d: Number(m[1]), op: m[2]!, k: Number(m[3]) }
  }
  const countOf = (from: number, to: number, d: number, op: string, k: number) => {
    let c = 0
    for (let i = from; i <= to; i++) if (test(i % d, op, k)) c++
    return c
  }
  const FLIP: Record<string, string> = { '<': '≤', '≤': '<', '>': '≥', '≥': '>', '=': '≠', '≠': '=' }

  it('counts the passes where the test is True, and prints i MOD d for each', () => {
    for (const b of built) {
      const { s, e, d, op, k } = read(b)
      expect(answer(b), b.seed).toBe(countOf(s, e, d, op, k))
      expect(op === '=' ? e - s + 1 >= 9 && e - s + 1 <= 12 : e - s + 1 >= 5 && e - s + 1 <= 8).toBe(true)
      expect(d >= 3 && d <= 5).toBe(true)
      expect(answer(b)).not.toBe(s)
      const mods = Array.from({ length: e - s + 1 }, (_, i) => (s + i) % d)
      expect(b.question.solution).toContain(`For i = ${s} to ${e}, \`i MOD ${d}\` is ${mods.join(', ')}, so the test is True for i = `)
      expect(lines(b)[0]).toMatch(new RegExp(`^M1 i MOD ${d} gives ${mods.join(', ')}, so the test (fails|is True) only at `))
    }
  })

  it('prints literal builds', () => {
    const b = at('q20', 'lit-b')
    expect(b.question.prompt).toBe('What is output?\n\n```\ncount ← 0\nFOR i ← 5 TO 12\n   IF (i MOD 5) ≠ 0 THEN\n      count ← count + 1\n   ENDIF\nENDFOR\nOUTPUT count\n```')
    expect(b.question.solution).toBe('`≠` means *is not equal to*. For i = 5 to 12, `i MOD 5` is 0, 1, 2, 3, 4, 0, 1, 2, so the test is True for i = 6, 7, 8, 9, 11 and 12 and False for 5 and 10: count is **6**.')
    expect(lines(b)).toEqual(['M1 i MOD 5 gives 0, 1, 2, 3, 4, 0, 1, 2, so the test fails only at 5 and 10', 'A1 6'])
    expect(lines(at('q20', 'lit-a'))).toEqual(['M1 i MOD 5 gives 3, 4, 0, 1, 2, 3, 4, 0, 1, so the test is True only at 6 and 11', 'A1 2'])
  })

  it('never pays a FOR loop one short, the test read the other way, every pass, d or a strict test read as non-strict', () => {
    expect(pays(built, (b) => { const { s, e, d, op, k } = read(b); return countOf(s, e - 1, d, op, k) })).toBe(0)
    expect(pays(built, (b) => { const { s, e } = read(b); return [e - s + 1 - answer(b) === answer(b) ? -1 : e - s + 1 - answer(b), e - s + 1, read(b).d] })).toBe(0)
    expect(pays(built.filter((b) => !['=', '≠'].includes(read(b).op)), (b) => { const { s, e, d, op, k } = read(b); return countOf(s, e, d, FLIP[op]!, k) })).toBe(0)
  })

  it('pays counting from 0 in under a quarter of builds', () => {
    expect(pays(built, (b) => { const { e, d, op, k } = read(b); return countOf(0, e, d, op, k) })).toBeLessThan(0.25)
  })

  it('spreads tests, answers and divisors', () => {
    expect(share(built, (b) => read(b).op).distinct).toBe(6)
    expect(share(built, (b) => read(b).op).worst).toBeLessThan(0.4)
    expect(built.filter((b) => read(b).op === '=').length / built.length).toBeLessThan(0.25)
    expect(share(built, answer).worst).toBeLessThan(0.3)
    expect(share(built, answer).distinct).toBeGreaterThanOrEqual(6)
    expect(share(built, (b) => read(b).d).distinct).toBe(3)
  })
})

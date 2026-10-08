import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import type { Generated } from './types.ts'

/**
 * Structural tests for the number generators: fractions and negatives, indices, powers and
 * roots, and standard form. The release check proves the answer agrees with a second route;
 * these read the working printed on the way and check each step is the right one, because a
 * right answer can be reached by a wrong route (generator-helpers-need-structural-tests).
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content/maths')
const topicFile = (topicId: string) => JSON.parse(readFileSync(join(ROOT, `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(topicFile(topicId).questions)

function build(generatorId: string, slotId: string, count = 300): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  const slot = bank(g.topicId).find((q) => q.id === slotId)!
  return Array.from({ length: count }, (_, i) => generate(g, slot, `structure-${i}`))
}

function sheet(topicId: string, level: 'core' | 'higher' | 'advanced', seed: string) {
  const questions = bank(topicId)
  const ids: string[] = topicFile(topicId).worksheets[level].questionIds
  return sheetQuestions('maths', topicId, ids.map((id) => questions.find((q) => q.id === id)!), seed)
}

const gcdBrute = (a: number, b: number) => {
  let g = 1
  for (let k = 1; k <= Math.min(Math.abs(a), Math.abs(b)); k++) if (a % k === 0 && b % k === 0) g = k
  return g
}
const lcmBrute = (a: number, b: number) => {
  let m = Math.max(a, b)
  while (m % a !== 0 || m % b !== 0) m++
  return m
}
const fractions = (tex: string) => [...tex.matchAll(/(-?)\\dfrac\{(\d+)\}\{(\d+)\}/g)].map((m) => [Number(`${m[1]}${m[2]}`), Number(m[3])] as [number, number])
const mixedNumbers = (tex: string) => [...tex.matchAll(/(-?)(\d+)\\dfrac\{(\d+)\}\{(\d+)\}/g)].map((m) => ({ neg: m[1] === '-', w: Number(m[2]), n: Number(m[3]), d: Number(m[4]) }))
const typedFraction = (s: string) => s.replace(/[()]/g, '').split('/').map(Number) as [number, number]
const answerOf = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)

describe('fractions and negatives', () => {
  it('adds and subtracts over the LCM, and prints the answer in lowest terms', () => {
    for (const slotId of ['q4', 'q12']) {
      for (const b of build('adding-and-subtracting-fractions', slotId)) {
        const q = b.question
        if (q.type !== 'short-text') throw new Error('not short-text')
        const [[, d1], [, d2]] = fractions(q.prompt) as [[number, number], [number, number]]
        const L = lcmBrute(d1, d2)
        // The step over the common denominator uses the LCM for both fractions.
        const over = fractions(q.solution).slice(2, 4)
        expect(over.map(([, d]) => d), b.seed).toEqual([L, L])
        expect(q.solution).toContain(`which is ${L}`)
        const [n, d] = typedFraction(q.accepted[0]!)
        expect(gcdBrute(n, d), `${b.seed}: ${q.accepted[0]}`).toBe(1)
        expect(Math.abs(n)).toBeLessThan(d)
        if (slotId === 'q4') expect(n).toBeGreaterThan(0)
        // q12 always has a negative: a negative fraction in the sum, or a difference that comes out negative.
        else expect(q.prompt.startsWith('Work out $-') || n < 0, b.seed).toBe(true)
      }
    }
  })

  it('turns each mixed number into the right improper fraction before subtracting', () => {
    for (const b of build('subtracting-mixed-numbers', 'q9')) {
      const [A, B] = mixedNumbers(b.question.prompt)
      const [first, second] = fractions(b.question.solution)
      expect(first, b.seed).toEqual([A!.w * A!.d + A!.n, A!.d])
      expect(second, b.seed).toEqual([B!.w * B!.d + B!.n, B!.d])
      // The trap the written question sets: the second fraction part is the bigger.
      expect(B!.n / B!.d).toBeGreaterThan(A!.n / A!.d)
      const q = b.question
      if (q.type !== 'short-text') throw new Error('not short-text')
      const [n, d] = typedFraction(q.accepted[0]!)
      expect(gcdBrute(n, d)).toBe(1)
      expect(n / d).toBeCloseTo(A!.w + A!.n / A!.d - (B!.w + B!.n / B!.d), 9)
    }
  })

  it('multiplies in q10 and divides in q11, through improper fractions, to a whole number', () => {
    const quotients: number[] = []
    for (const [slotId, sign] of [['q10', '\\times'], ['q11', '\\div']] as const) {
      for (const b of build('multiplying-and-dividing-mixed-numbers', slotId)) {
        expect(b.question.prompt).toContain(sign)
        const [A, B] = mixedNumbers(b.question.prompt)
        const improper = fractions(b.question.solution)
        expect(improper).toContainEqual([A!.w * A!.d + A!.n, A!.d])
        expect(improper).toContainEqual([B!.w * B!.d + B!.n, B!.d])
        expect(Number.isInteger(answerOf(b))).toBe(true)
        if (slotId === 'q11') quotients.push(answerOf(b))
      }
    }
    // Drawn from the pairs alone, most quotients came out as 2.
    expect(new Set(quotients).size).toBeGreaterThanOrEqual(5)
    expect(quotients.filter((x) => x === 2).length).toBeLessThan(quotients.length * 0.35)
  })

  it('counts decimal places from the printed factors when using a given product', () => {
    for (const b of build('using-a-given-product', 'q7')) {
      const [, x, y] = b.question.prompt.match(/Work out \$([\d.]+) \\times ([\d.]+)\$/)!
      const dp = (s: string) => (s.split('.')[1] ?? '').length
      const k = dp(x!) + dp(y!)
      expect(b.question.solution, b.seed).toContain(`$${dp(x!)} + ${dp(y!)} = ${k}$ decimal places`)
      const [, given] = b.question.prompt.match(/= (\d+)\$/)!
      expect(answerOf(b)).toBeCloseTo(Number(given) / 10 ** k, 12)
    }
    for (const b of build('using-a-given-product', 'q19')) {
      const [, a, c, P] = b.question.prompt.match(/\$(\d+) \\times (\d+) = (\d+)\$/)!.map(Number) as number[]
      const [, D, d] = b.question.prompt.match(/Work out \$([\d.]+) \\div ([\d.]+)\$/)!
      // The method line divides the given product by the factor the divisor came from.
      const divisor = Number(d!.replace('.', '').replace(/^0+/, ''))
      expect([a, c]).toContain(divisor)
      expect(b.question.markScheme[0]!.description).toBe(`uses ${P} ÷ ${divisor} = ${P! / divisor}`)
      expect(answerOf(b)).toBeCloseTo(Number(D) / Number(d), 9)
    }
  })

  it('scales a decimal division until the divisor is whole', () => {
    for (const b of build('dividing-by-a-decimal', 'q8')) {
      const [, D, d] = b.question.prompt.match(/\$([\d.]+) \\div ([\d.]+)\$/)!
      const [, scale] = b.question.solution.match(/by (\d+):/)!
      const scaledDivisor = Math.round(Number(d) * Number(scale))
      expect(Number(d)).toBeLessThan(1)
      expect(b.question.solution).toContain(`= ${Math.round(Number(D) * Number(scale))} \\div ${scaledDivisor} =`)
      // The smallest power of ten that does it: one fewer would leave a decimal.
      expect(Number.isInteger(Number(((Number(d) * Number(scale)) / 10).toFixed(9)))).toBe(false)
    }
  })

  it('states the sign rule that matches the negatives in the question', () => {
    for (const b of build('negative-number-products', 'q3')) {
      const negatives = (b.question.prompt.match(/\(-\d+\)/g) ?? []).length
      const word = ['', 'One negative, so negative', 'Two negatives, so positive', 'Three negatives, so negative'][negatives]!
      expect(negatives).toBeGreaterThan(0)
      expect(b.question.solution, b.seed).toContain(word)
      expect(Math.sign(answerOf(b))).toBe(negatives % 2 === 0 ? 1 : -1)
    }
  })

  it('works the temperature from the figures in the question, in every setting', () => {
    const settings = new Set<string>()
    for (const b of build('temperature-change', 'q5', 400)) {
      const [, start] = b.question.prompt.match(/\$(-?\d+)\$ °C/)!
      const [, change] = b.question.prompt.match(/ (\d+) degrees/)!
      const up = /risen|rises|warmer/.test(b.question.prompt)
      expect(answerOf(b), b.seed).toBe(Number(start) + (up ? 1 : -1) * Number(change))
      settings.add(b.question.prompt.slice(0, 12))
    }
    expect(settings.size).toBe(6)
  })

  it('keeps q15 a bracket then a division and q22 a division then an addition or subtraction', () => {
    for (const b of build('multi-step-fractions', 'q15')) {
      const [A, B, C] = mixedNumbers(b.question.prompt)
      expect(C!.neg).toBe(true)
      const bracket = A!.w + A!.n / A!.d - (B!.w + B!.n / B!.d)
      const [n, d] = typedFraction(b.question.markScheme[0]!.description.replace('bracket = ', '').replace('−', '-'))
      expect(n / d, b.seed).toBeCloseTo(bracket, 9)
      expect(gcdBrute(n, d)).toBe(1)
    }
    const ops = new Set<string>()
    for (const b of build('multi-step-fractions', 'q22')) {
      const [A, C] = mixedNumbers(b.question.prompt)
      // Division first: the first method line holds A ÷ (−C), not anything with the last fraction in it.
      const [n, d] = typedFraction(b.question.markScheme[0]!.description.replace('divides first: ', '').replace('−', '-'))
      expect(n / d, b.seed).toBeCloseTo((A!.w + A!.n / A!.d) / -(C!.w + C!.n / C!.d), 9)
      ops.add(String(b.values.form))
      const q = b.question
      if (q.type !== 'short-text') throw new Error('not short-text')
      const [an, ad] = typedFraction(q.accepted[0]!)
      expect(gcdBrute(an, ad)).toBe(1)
      expect(Math.abs(an)).toBeLessThan(ad)
    }
    expect(ops).toEqual(new Set(['divide then add', 'divide then subtract']))
  })
})

describe('indices, powers and roots', () => {
  it('brackets the root between the consecutive squares it lies between', () => {
    for (const slotId of ['q11', 'q16']) {
      const asked = new Set<string>()
      for (const b of build('root-between-whole-numbers', slotId)) {
        const [, n] = b.question.prompt.match(/(?:\\sqrt\{|area of \$)(\d+)/)!
        const [, low, high] = b.question.solution.match(/\$(\d+)\^2 = \d+\$ and \$(\d+)\^2/)!
        expect(Number(low) ** 2, b.seed).toBeLessThan(Number(n))
        expect(Number(high) ** 2).toBeGreaterThan(Number(n))
        expect(Number(high)).toBe(Number(low) + 1)
        expect(answerOf(b)).toBe(b.values.ask === 'larger' ? Number(high) : Number(low))
        expect(b.question.prompt).toContain(`the ${b.values.ask} one`)
        asked.add(String(b.values.ask))
      }
      expect(asked).toEqual(new Set(['smaller', 'larger']))
    }
  })

  it('asks for opposite ends in q11 and q16 on one sheet', () => {
    for (let i = 0; i < 100; i++) {
      const asks = sheet('powers-and-roots', 'advanced', `ends-${i}`).filter((s) => s.generated?.generatorId === 'root-between-whole-numbers').map((s) => s.generated!.values.ask)
      expect(asks).toHaveLength(2)
      expect(new Set(asks).size).toBe(2)
    }
  })

  it('keeps the bracket in q5 and leaves it out of q6, which sit on one sheet', () => {
    for (const b of build('powers-of-negatives', 'q5')) {
      expect(b.question.prompt).toMatch(/\$\(-[\d.]+\)\^\d\$/)
      const [, n] = b.question.prompt.match(/\^(\d)/)!
      expect(Math.sign(answerOf(b))).toBe(Number(n) % 2 === 0 ? 1 : -1)
    }
    for (const b of build('powers-of-negatives', 'q6')) {
      expect(b.question.prompt).toMatch(/\$-[\d.]+\^\d\$/)
      expect(answerOf(b)).toBeLessThan(0)
    }
    for (let i = 0; i < 50; i++) {
      const kinds = sheet('powers-and-roots', 'higher', `brackets-${i}`).filter((s) => s.generated?.generatorId === 'powers-of-negatives').map((s) => s.generated!.values.kind)
      expect(kinds).toEqual(['bracket', 'no bracket'])
    }
  })

  it('works each power of a negative in q13 with the right sign', () => {
    for (const b of build('powers-of-negatives', 'q13')) {
      const { a, m, b: base, n } = b.values as { a: number; m: number; b: number; n: number }
      const [first, second] = b.question.markScheme.slice(0, 2).map((l) => Number(l.description.match(/= (-?\d+)\$/)![1]))
      expect(first, b.seed).toBe((-a) ** m)
      expect(second).toBe((-base) ** n)
    }
  })

  it('gives each fractional-index slot its own step', () => {
    const exponent = (b: Generated) => b.question.prompt.match(/\^\{(-?)\\frac\{(\d+)\}\{(\d+)\}\}/)!
    for (const b of build('fractional-indices', 'q5')) expect(exponent(b).slice(1)).toEqual(['', '1', String(b.values.n)])
    for (const b of build('fractional-indices', 'q7')) {
      const [, sign, m] = exponent(b)
      expect(sign).toBe('')
      expect(Number(m)).toBeGreaterThan(1)
    }
    for (const b of build('fractional-indices', 'q9')) {
      expect(exponent(b)[1]).toBe('-')
      expect(answerOf(b)).toBeLessThan(1)
    }
    for (const b of build('fractional-indices', 'q15')) {
      expect(b.question.prompt).toMatch(/\\left\(\\dfrac\{\d+\}\{\d+\}\\right\)\^\{-\\frac/)
      expect(b.question.markScheme[0]!.description).toBe('Fraction inverted for the negative index')
    }
  })

  it('roots in the working really are roots', () => {
    for (const slotId of ['q5', 'q7', 'q9']) {
      for (const b of build('fractional-indices', slotId)) {
        // \sqrt[3]{8} = 2 in q5 and q9, (\sqrt{25})^3 = 5^3 in q7.
        const [, x, base, root] = b.question.solution.match(/\\sqrt(?:\[(\d+)\])?\{(\d+)\}\)?(?:\^\d+)? = (\d+)/)!
        const index = x === undefined ? 2 : Number(x)
        expect(Number(root) ** index, `${b.seed}: ${b.question.solution}`).toBe(Number(base))
      }
    }
  })

  it('solves an index equation whose answer makes the two indices equal over the common base', () => {
    for (const b of build('equations-with-indices', 'q10')) {
      const { c, a, b: right, p, q, s, t } = b.values as Record<string, number>
      const x = answerOf(b)
      const u = Math.round(Math.log(a!) / Math.log(c!))
      const w = Math.round(Math.log(right!) / Math.log(c!))
      expect(u * (p! * x + q!), b.seed).toBe(w * (s! * x + t!))
      expect(b.question.solution).toContain(`powers of ${c}`)
    }
  })

  it('reciprocates for a negative index', () => {
    for (const b of build('negative-index', 'q4')) {
      const { b: base, n } = b.values as Record<string, number>
      expect(answerOf(b) * base! ** n!).toBeCloseTo(1, 12)
    }
  })

  it('roots a decimal to a number that squares back, and below 1 names a slip that does not', () => {
    let slips = 0
    for (const b of build('square-root-of-a-decimal', 'q14')) {
      const [, N] = b.question.prompt.match(/\\sqrt\{([\d.]+)\}/)!
      expect(answerOf(b) ** 2).toBeCloseTo(Number(N), 12)
      const m = b.question.solution.match(/wrong answer is \$([\d.]+)\$/)
      // Keeping the decimal places of the number is a slip for √0.81 → 0.09; nobody offers 0.13 for √1.69.
      if (Number(N) >= 1) { expect(m).toBeNull(); continue }
      slips++
      expect(Math.abs(Number(m![1]) ** 2 - Number(N))).toBeGreaterThan(1e-6)
    }
    expect(slips).toBeGreaterThan(50)
  })

  it('chooses the negative root', () => {
    for (const b of build('negative-square-root', 'q15')) {
      const [, P, Q] = b.question.prompt.match(/\\dfrac\{(\d+)\}\{(\d+)\}/)!
      expect(answerOf(b)).toBeLessThan(0)
      expect(answerOf(b) ** 2).toBeCloseTo(Number(P) / Number(Q), 12)
    }
  })
})

describe('standard form', () => {
  const front = (s: string) => Number(s.split(/ ?[x×] ?10/)[0])

  it('writes a large number with its front between 1 and 10 and the power its digit count less one', () => {
    for (const b of build('to-standard-form', 'q1')) {
      const q = b.question
      if (q.type !== 'short-text') throw new Error('not short-text')
      const digits = q.prompt.match(/Write ([\d ]+) in/)![1]!.replace(/ /g, '')
      expect(q.accepted[0]).toBe(`${front(q.accepted[0]!)} x 10^${digits.length - 1}`)
      expect(front(q.accepted[0]!)).toBeGreaterThanOrEqual(1)
      expect(front(q.accepted[0]!)).toBeLessThan(10)
    }
  })

  it('writes a negative power out with one zero fewer after the point than the power', () => {
    for (const b of build('to-ordinary-number', 'q2')) {
      const [, k] = b.question.prompt.match(/10⁻([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/)!
      const power = '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(k!)
      expect(String(answerOf(b))).toMatch(new RegExp(`^0\\.0{${power - 1}}[1-9]`))
    }
  })

  it('keeps each calculation slot to its own operation and question, and puts the front back between 1 and 10', () => {
    const normalised = { q5: 0, q6: 0, q8: 0 }
    for (const slotId of ['q5', 'q6', 'q8'] as const) {
      for (const b of build('standard-form-calculations', slotId)) {
        const q = b.question
        expect(q.prompt).toContain(slotId === 'q6' ? '÷' : '×')
        if (slotId === 'q5') expect(q.prompt).toContain('What is n?')
        if (slotId === 'q6') expect(q.prompt).toContain('What is A?')
        const [, A, n] = q.solution.match(/(?:becomes|So) \$([\d.]+) \\times 10\^\{(-?\d+)\}\$/)!
        expect(Number(A)).toBeGreaterThanOrEqual(1)
        expect(Number(A)).toBeLessThan(10)
        const [, raw, rawPower] = q.solution.match(/= ([\d.]+)\$\. Powers: \$[^=]+= (-?\d+)\$/)!
        if (q.solution.includes('not between 1 and 10')) {
          normalised[slotId]++
          expect(Number(n), b.seed).toBe(Number(rawPower) + (Number(raw) >= 10 ? 1 : -1))
        } else expect(Number(n)).toBe(Number(rawPower))
        if (q.type === 'short-text') expect(q.accepted[0]).toBe(`${A} x 10^${n}`)
        else expect(answerOf(b)).toBe(Number(slotId === 'q5' ? n : A))
      }
    }
    // q8 always needs the step, as written; q5 and q6 sometimes.
    expect(normalised.q8).toBe(300)
    expect(normalised.q5).toBeGreaterThan(30)
    expect(normalised.q6).toBeGreaterThan(30)
  })

  it('multiplies in q5 and divides in q6 on one sheet', () => {
    for (let i = 0; i < 50; i++) {
      const ops = sheet('standard-form', 'higher', `ops-${i}`).filter((s) => s.generated?.generatorId === 'standard-form-calculations').map((s) => `${s.question.id} ${s.generated!.values.op}`)
      expect(ops).toEqual(['q5 multiply', 'q6 divide', 'q8 multiply'])
    }
  })

  it('adds by rewriting the smaller number with the larger power', () => {
    for (const b of build('adding-in-standard-form', 'q13')) {
      const powers = [...b.question.prompt.matchAll(/10([⁰¹²³⁴⁵⁶⁷⁸⁹])\)/g)].map((m) => '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(m[1]!))
      const target = '⁰¹²³⁴⁵⁶⁷⁸⁹'.indexOf(b.question.prompt.match(/A × 10([⁰¹²³⁴⁵⁶⁷⁸⁹])/)![1]!)
      expect(target).toBe(Math.max(...powers))
      expect(b.question.solution).toContain(`\\times 10^{${Math.min(...powers)}} = `)
      expect(answerOf(b)).toBeGreaterThanOrEqual(1)
      expect(answerOf(b)).toBeLessThan(10)
    }
  })
})

describe('every number generator here', () => {
  const topics = new Set(['calculating-with-fractions-and-negatives', 'laws-of-indices', 'powers-and-roots', 'standard-form'])

  // show() prints 1e-8 for a tiny number, and the residue scan does not read that notation:
  // √0.0001 once printed its slip squared as 1e-8.
  it('prints no number in e-notation in a prompt, solution or mark scheme', () => {
    for (const g of GENERATORS.filter((x) => topics.has(x.topicId))) {
      for (const id of g.replaces) {
        for (const b of build(g.id, id, 200)) {
          const shown = JSON.stringify([b.question.prompt, b.question.solution, b.question.markScheme])
          expect(shown, `${g.id} ${id} ${b.seed}`).not.toMatch(/\d[eE][-+]?\d/)
        }
      }
    }
  })
})

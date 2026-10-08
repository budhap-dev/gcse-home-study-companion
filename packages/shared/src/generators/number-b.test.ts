import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { roundTo } from './format.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import { byBruteForce, byPrimes, factorise } from './maths/factors.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the bounds, units, proportion, factors and compound-measure
 * generators. The release check (generators.test.ts) proves each answer agrees with a second
 * method; these prove the working takes the right route. A right answer by a wrong route
 * still teaches the wrong route, and a pattern across a sheet is invisible to any one question.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const bank = (topicId: string) => Question.array().parse(JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8')).questions)
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
const v = (b: Generated, key: string) => Number(b.values[key])
const close = (a: number, b: number) => Math.abs(a - b) < 1e-9

describe('bounds', () => {
  it('an upper bound is the stated value plus half the unit of accuracy', () => {
    for (const b of build('upper-bound', 'q9')) {
      expect(close(num(b), v(b, 'value') + v(b, 'step') / 2), b.seed).toBe(true)
    }
  })

  it('a rectangle pairs upper with upper and lower with lower, half a unit either side', () => {
    for (const [slot, bound] of [['q6', 'upper'], ['q7', 'lower'], ['q14', 'upper']] as const) {
      for (const b of build('rectangle-area-bounds', slot)) {
        expect(b.values.bound).toBe(bound)
        const sign = bound === 'upper' ? 1 : -1
        const expected = (v(b, 'a') + sign * v(b, 'halfA')) * (v(b, 'b') + sign * v(b, 'halfB'))
        expect(close(num(b), expected), b.seed).toBe(true)
        // Not the nominal area, and on the right side of it.
        expect(sign * (num(b) - v(b, 'a') * v(b, 'b'))).toBeGreaterThan(0)
      }
    }
  })

  it('q14 sometimes rounds its two sides to different accuracies', () => {
    expect(build('rectangle-area-bounds', 'q14').some((b) => b.values.halfA !== b.values.halfB)).toBe(true)
  })

  it('an upper-bound speed divides the upper distance by the lower time, and a lower bound the reverse', () => {
    for (const [slot, bound] of [['q11', 'upper'], ['q16', 'lower']] as const) {
      for (const b of build('speed-bounds', slot)) {
        const d = v(b, 'd')
        const t = v(b, 't')
        const half = v(b, 'half')
        expect(b.values.bound).toBe(bound)
        expect(v(b, 'distanceUsed')).toBe(bound === 'upper' ? d + half : d - half)
        expect(v(b, 'timeUsed')).toBe(bound === 'upper' ? t - 0.5 : t + 0.5)
        expect(num(b), b.seed).toBe(roundTo(v(b, 'distanceUsed') / v(b, 'timeUsed'), 2))
        // On the right side of the stated speed, and visibly different from it at 2 d.p.
        const used = v(b, 'distanceUsed') / v(b, 'timeUsed')
        expect(bound === 'upper' ? used > d / t : used < d / t).toBe(true)
        expect(num(b)).not.toBe(roundTo(d / t, 2))
      }
    }
  })
})

describe('units', () => {
  it('q1 goes to a smaller unit (multiply), q2 to a bigger one (divide), q4 is a capacity', () => {
    for (const b of build('metric-conversion', 'q1')) expect(num(b)).toBeGreaterThan(v(b, 'v'))
    for (const b of build('metric-conversion', 'q2')) expect(num(b)).toBeLessThan(v(b, 'v'))
    for (const b of build('metric-conversion', 'q4')) expect(['ml', 'cl', 'litres']).toContain(b.values.to)
  })

  it('hours to minutes multiplies by 60, and the answer is never the decimal digits misread as minutes', () => {
    for (const b of build('hours-to-minutes', 'q6')) {
      const h = v(b, 'hours')
      expect(num(b)).toBe(Math.round(h * 60))
      const digits = Number(String(b.values.hours).split('.')[1]!.padEnd(2, '0'))
      expect(num(b) - Math.floor(h) * 60).not.toBe(digits)
    }
  })

  it('area units use the length factor squared: 10 000 between cm² and m², 100 between mm² and cm²', () => {
    for (const b of build('area-units', 'q7')) {
      const ratio = Math.max(num(b), v(b, 'v')) / Math.min(num(b), v(b, 'v'))
      const metres = b.values.from === 'm²' || b.values.to === 'm²'
      expect(Math.round(ratio), b.seed).toBe(metres ? 10000 : 100)
    }
    for (const b of build('area-units', 'q24')) {
      const ratio = Math.max(num(b), v(b, 'given')) / Math.min(num(b), v(b, 'given'))
      expect(Math.round(ratio), b.seed).toBe(10000)
    }
  })

  it('a speed comparison converts the m/s speed by 3.6 before subtracting', () => {
    for (const b of build('speed-units', 'q17')) expect(close(num(b), Math.abs(3.6 * v(b, 'v') - v(b, 'k'))), b.seed).toBe(true)
  })

  it('a fill time is litres over the rate in minutes, then hours', () => {
    for (const b of build('flow-rates', 'q15')) expect(close(num(b) * 60 * v(b, 'rate'), v(b, 'm3') * 1000), b.seed).toBe(true)
  })

  it('a pipe delivers speed × cross-section each second, sixty times a minute', () => {
    for (const b of build('flow-rates', 'q21')) expect(close(num(b), (v(b, 'v') * 100 * v(b, 'a') * 60) / 1000), b.seed).toBe(true)
  })
})

describe('proportion', () => {
  const RELATION = { q5: ['square', 2, false], q7: ['inverse', 1, true], q11: ['inverse-square', 2, true], q14: ['cube', 3, false] } as const

  it('each slot keeps its written relation, and y scales by the power of x’s scale factor', () => {
    for (const [slot, [relation, n, inverse]] of Object.entries(RELATION)) {
      for (const b of build('proportion-to-a-power', slot)) {
        expect(b.values.relation).toBe(relation)
        const x1 = v(b, 'x1')
        const x2 = v(b, 'x2')
        const y1 = v(b, 'y1')
        // Direct: y / xⁿ is constant. Inverse: y × xⁿ is constant.
        if (inverse) expect(close(num(b) * x2 ** n, y1 * x1 ** n), b.seed).toBe(true)
        else expect(close(num(b) / x2 ** n, y1 / x1 ** n), b.seed).toBe(true)
      }
    }
  })

  it('the square-root slot finds x, so x is the square of y over k', () => {
    for (const b of build('proportion-to-a-power', 'q12')) {
      expect(b.values.relation).toBe('root')
      expect(num(b)).toBe((v(b, 'y2') / v(b, 'k')) ** 2)
      expect(Number.isInteger(Math.sqrt(num(b)))).toBe(true)
    }
  })

  it('q1 shares in two parts and q2 in three', () => {
    for (const b of build('share-of-a-total', 'q1')) expect(String(b.values.ratio).split(':')).toHaveLength(2)
    for (const b of build('share-of-a-total', 'q2')) expect(String(b.values.ratio).split(':')).toHaveLength(3)
  })

  it('a known difference is divided by the difference in parts', () => {
    for (const b of build('total-from-a-share', 'q11')) {
      expect(b.values.task).toBe('difference')
      expect(num(b)).toBe((v(b, 'a') + v(b, 'b')) * v(b, 'part'))
      expect(b.question.markScheme[0]!.description).toBe(`divides by the difference of ${v(b, 'b') - v(b, 'a')}`)
    }
    for (const b of build('total-from-a-share', 'q5')) expect(b.values.task).toBe('one share')
  })

  it('direct proportion finds y in q6 and x in q12; inverse keeps x × y and gives a decimal in q13', () => {
    for (const b of build('direct-proportion', 'q6')) expect(b.values.find).toBe('y')
    for (const b of build('direct-proportion', 'q12')) {
      expect(b.values.find).toBe('x')
      expect(Number.isInteger(num(b))).toBe(true)
    }
    for (const b of build('inverse-proportion', 'q7')) {
      expect(num(b) * v(b, 'x2')).toBe(v(b, 'x1') * v(b, 'y1'))
      expect(Number.isInteger(num(b))).toBe(true)
    }
    for (const b of build('inverse-proportion', 'q13')) {
      expect(close(num(b) * v(b, 'x2'), v(b, 'x1') * v(b, 'y1'))).toBe(true)
      expect(Number.isInteger(num(b))).toBe(false)
    }
  })

  it('machines work out a rate per machine per hour first', () => {
    for (const b of [...build('machines-at-work', 'q9'), ...build('machines-at-work', 'q15')]) {
      // The first method mark is the rate for one machine for one hour.
      expect(b.question.markScheme[0]!.description).toMatch(new RegExp(`^${v(b, 'u')} ${b.values.context} per \\w+ per hour$`))
      expect(b.question.solution).toContain(`\\div ${v(b, 'm1') * v(b, 'h1')} = ${v(b, 'u')}`)
    }
    for (const b of build('machines-at-work', 'q9')) expect(num(b)).toBe(v(b, 'u') * v(b, 'm2') * v(b, 'h2'))
    for (const b of build('machines-at-work', 'q15')) expect(num(b) * v(b, 'u') * v(b, 'm2')).toBe(v(b, 'amount'))
  })
})

describe('factors', () => {
  it('HCF and LCM by prime factors equal brute force for every pair up to 80, and HCF × LCM is the product', () => {
    for (let a = 2; a <= 80; a++) {
      for (let b = 2; b <= 80; b++) {
        const p = byPrimes(a, b)
        const f = byBruteForce(a, b)
        expect([p.hcf, p.lcm], `${a}, ${b}`).toEqual([f.hcf, f.lcm])
        expect(p.hcf * p.lcm).toBe(a * b)
      }
    }
  })

  it('factorises into primes whose powers rebuild the number', () => {
    for (let n = 2; n <= 2000; n++) {
      const f = factorise(n)
      expect(f.reduce((s, [p, e]) => s * p ** e, 1)).toBe(n)
      for (const [p] of f) expect(factorise(p)).toEqual([[p, 1]])
    }
  })

  it('q4 asks for an HCF and q5 for an LCM that is less than the product', () => {
    for (const b of build('hcf-and-lcm', 'q4')) expect(num(b)).toBe(byBruteForce(v(b, 'a'), v(b, 'b')).hcf)
    for (const b of build('hcf-and-lcm', 'q5')) {
      expect(num(b)).toBe(byBruteForce(v(b, 'a'), v(b, 'b')).lcm)
      expect(num(b)).toBeLessThan(v(b, 'a') * v(b, 'b'))
    }
  })

  it('from prime factorisations, q8 and q14 ask for the HCF and q9 for the LCM', () => {
    for (const [slot, task] of [['q8', 'HCF'], ['q9', 'LCM'], ['q14', 'HCF']] as const) {
      for (const b of build('hcf-lcm-from-primes', slot)) {
        expect(b.values.task).toBe(task)
        const f = byBruteForce(v(b, 'a'), v(b, 'b'))
        expect(num(b)).toBe(task === 'HCF' ? f.hcf : f.lcm)
      }
    }
  })

  it('a count of coincidences is the multiples of the LCM inside the time, the end excluded', () => {
    for (const b of build('hcf-lcm-in-context', 'q20')) {
      const l = byBruteForce(v(b, 'a'), v(b, 'b')).lcm
      expect(num(b)).toBe(Math.floor((v(b, 'T') * 60) / l))
      expect((v(b, 'T') * 60) % l).not.toBe(0)
    }
  })

  it('the packs answer is the number of packs, not the number of items', () => {
    for (const b of build('hcf-lcm-in-context', 'q12')) {
      const l = byBruteForce(v(b, 'a'), v(b, 'b')).lcm
      expect([l / v(b, 'a'), l / v(b, 'b')]).toContain(num(b))
      expect(num(b)).not.toBe(l)
    }
  })

  it('the factor count multiplies one more than each power', () => {
    for (const b of build('number-of-factors', 'q19')) {
      expect(num(b)).toBe(factorise(v(b, 'n')).reduce((s, [, e]) => s * (e + 1), 1))
    }
  })

  it('the cube multiplier is the smallest k, and nk is a cube', () => {
    for (const b of build('smallest-cube-multiplier', 'q18')) {
      const n = v(b, 'n')
      const k = num(b)
      const cube = (x: number) => Math.round(Math.cbrt(x)) ** 3 === x
      expect(cube(n * k)).toBe(true)
      for (let j = 1; j < k; j++) expect(cube(n * j)).toBe(false)
      for (const [, e] of factorise(n * k)) expect(e % 3).toBe(0)
    }
  })
})

describe('compound measures', () => {
  it('a two-leg average speed is total distance over total time, not the mean of the speeds', () => {
    for (const [slot, dp] of [['q11', 0], ['q14', 1]] as const) {
      for (const b of build('two-leg-average-speed', slot)) {
        const d1 = v(b, 'd1')
        const d2 = v(b, 'd2')
        const time = d1 / v(b, 'v1') + d2 / v(b, 'v2')
        expect(num(b), b.seed).toBe(roundTo((d1 + d2) / time, dp))
        expect(Math.abs(num(b) - v(b, 'mean')), b.seed).toBeGreaterThan(2.5)
      }
    }
  })

  it('equal legs and unequal legs both turn up', () => {
    expect(new Set(build('two-leg-average-speed', 'q11').map((b) => b.values.equalLegs))).toEqual(new Set(['yes', 'no']))
  })

  it('q5 converts a time over an hour and q9 one under', () => {
    for (const b of build('speed-from-minutes', 'q5')) expect(v(b, 'mins')).toBeGreaterThan(60)
    for (const b of build('speed-from-minutes', 'q9')) expect(v(b, 'mins')).toBeLessThan(60)
    for (const b of [...build('speed-from-minutes', 'q5'), ...build('speed-from-minutes', 'q9')]) expect(close(num(b), (v(b, 'd') * 60) / v(b, 'mins'))).toBe(true)
  })

  it('every rearrangement turns up in q7', () => {
    expect(new Set(build('compound-measure-rearranged', 'q7').map((b) => b.values.kind))).toEqual(new Set(['mass', 'volume', 'distance', 'force']))
  })
})

describe('slots sharing a sheet ask different things, as the written sheet did', () => {
  const sheet = (topicId: string, level: 'core' | 'higher' | 'advanced', seed: string) => {
    const t = JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
    const qs = Question.array().parse(t.questions)
    return sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => qs.find((q) => q.id === id)!), seed)
  }
  const values = (items: ReturnType<typeof sheet>, generatorId: string, key: string) =>
    Object.fromEntries(items.filter((s) => s.generated?.generatorId === generatorId).map((s) => [s.question.id, s.generated!.values[key]]))

  it('on every attempt', () => {
    for (let i = 0; i < 100; i++) {
      const seed = `sheet-${i}`
      // Bounds: upper then lower on the higher sheet; upper and lower speeds on the advanced one.
      expect(values(sheet('limits-of-accuracy-and-bounds', 'higher', seed), 'rectangle-area-bounds', 'bound')).toEqual({ q6: 'upper', q7: 'lower' })
      expect(values(sheet('limits-of-accuracy-and-bounds', 'advanced', seed), 'speed-bounds', 'bound')).toEqual({ q11: 'upper', q16: 'lower' })
      // A speed, a density and a pressure on the core compound-measures sheet.
      expect(values(sheet('compound-measures', 'core', seed), 'compound-measure-basic', 'kind')).toEqual({ q2: 'speed', q3: 'density', q4: 'pressure' })
      // Five different relations across the proportion sheets.
      expect(values(sheet('direct-and-inverse-proportion', 'higher', seed), 'proportion-to-a-power', 'relation')).toEqual({ q5: 'square', q7: 'inverse' })
      expect(values(sheet('direct-and-inverse-proportion', 'advanced', seed), 'proportion-to-a-power', 'relation')).toEqual({ q11: 'inverse-square', q12: 'root', q14: 'cube' })
      // The factors stories: an LCM in time, an HCF in groups, an LCM in packs, an HCF in squares.
      expect(values(sheet('factors-multiples-and-primes', 'higher', seed), 'hcf-lcm-in-context', 'kind')).toEqual({ q10: 'leave', q11: 'group', q12: 'packs', q13: 'squares' })
      expect(values(sheet('factors-multiples-and-primes', 'higher', seed), 'hcf-lcm-from-primes', 'task')).toEqual({ q8: 'HCF', q9: 'LCM' })
      expect(values(sheet('factors-multiples-and-primes', 'core', seed), 'hcf-and-lcm', 'task')).toEqual({ q4: 'HCF', q5: 'LCM' })
      // Ratio: a total from one share, then from the difference; direct find y then find x.
      const ratio = sheet('ratio-and-proportion', 'advanced', seed)
      expect(values(ratio, 'total-from-a-share', 'task')).toEqual({ q11: 'difference' })
      expect(values(ratio, 'direct-proportion', 'find')).toEqual({ q12: 'x' })
      expect(values(sheet('ratio-and-proportion', 'higher', seed), 'machines-at-work', 'ask')).toEqual({ q9: 'amount' })
      expect(values(ratio, 'machines-at-work', 'ask')).toEqual({ q15: 'time' })
      // Units: a smaller unit, a bigger unit and a capacity on the core sheet.
      const units = values(sheet('units-conversion-and-estimation', 'core', seed), 'metric-conversion', 'to')
      expect(['ml', 'cl', 'litres']).toContain(units.q4)
      expect(['m', 'cm', 'mm', 'g', 'kg']).toContain(units.q1)
    }
  })

  it('and the sheet changes between attempts', () => {
    const prompts = (seed: string) => sheet('compound-measures', 'advanced', seed).map((s) => s.question.prompt)
    expect(prompts('a')).not.toEqual(prompts('b'))
  })
})

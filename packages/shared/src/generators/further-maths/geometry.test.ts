import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, generatorFor, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { TANGENT_HALVES } from './geometry.ts'

/**
 * Structural tests for the Further Maths geometrical-proof generators (8365 6.1–6.2 with the
 * 3.7 circle facts). The prompt's figures are read back with this file's own readers and the
 * answer worked again here; each printed step is checked, the named wrong routes (interior for
 * exterior, doubling for halving, the supplement, the minor arc, the angle at the centre, the
 * missing half, πr²h without the third, a closed cylinder's ends miscounted) are shown to
 * differ, and the answers and inputs are shown to spread, per case as well as per slot.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'geometrical-proof'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const POLYGON = 'fm-polygon-angles'
const CIRCLE = 'fm-circle-theorem-angles'
const TANGENTS = 'fm-tangents-from-a-point'
const MEASURE = 'fm-area-and-volume'

function build(generatorId: string, slotId: string, count = 300, prefix = 'geometry'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tolerance = (b: Generated) => (b.question.type === 'numeric' ? b.question.tolerance : NaN)
const tally = <K,>(items: Generated[], key: (b: Generated) => K) => {
  const m = new Map<K, number>()
  for (const b of items) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
  return m
}
const top = (m: Map<unknown, number>, n: number) => Math.max(...m.values()) / n
const share = (items: Generated[], pred: (b: Generated) => boolean) => items.filter(pred).length / items.length

/** Every "= 40°" or "of $64°" in a text, in order. */
const anglesIn = (text: string) => [...text.matchAll(/(?:= |of \$)(\d+)°/g)].map((m) => Number(m[1]))
/** The angles named in a text: \angle ACB → 'ACB'. */
const namesIn = (text: string) => [...text.matchAll(/\\angle ([A-Z]{3})/g)].map((m) => m[1]!)
/** The lengths printed as "$5$ cm" or "$2.5$ m". */
const lengthsIn = (text: string) => [...text.matchAll(/\$(\d+(?:\.\d+)?)\$ (?:cm|m)\b/g)].map((m) => Number(m[1]))

const NAMED: Record<string, number> = { pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8, nonagon: 9, decagon: 10, dodecagon: 12 }
function sidesOf(text: string): number {
  const n = /\$(\d+)\$ (?:straight )?sides/.exec(text)
  if (n) return Number(n[1])
  const word = Object.keys(NAMED).find((w) => new RegExp(`\\b${w}\\b`).test(text))
  if (!word) throw new Error(`no polygon: ${text}`)
  return NAMED[word]!
}

interface Rules {
  tolerance?: number
  /** "Give your answer as a decimal." exactly when the answer is not whole. */
  decimalWording?: boolean
  minDistinct?: number
}

function common(generatorId: string, slotId: string, built: Generated[], { tolerance: tol = 0, decimalWording = false, minDistinct = 10 }: Rules = {}) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an) \$\d/)
    expect(tolerance(b), b.seed).toBe(tol)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(Math.abs(answer(b) * 1000 - Math.round(answer(b) * 1000)), b.seed).toBeLessThan(1e-6)
    if (decimalWording) expect(q.prompt.endsWith(' Give your answer as a decimal.'), b.seed).toBe(!Number.isInteger(answer(b)))
    else if (tol === 0) expect(Number.isInteger(answer(b)), b.seed).toBe(true)
  }
  const answers = tally(built, answer)
  expect(top(answers, built.length)).toBeLessThanOrEqual(0.4)
  expect(answers.size).toBeGreaterThanOrEqual(minDistinct)
  // Variety over 1000 builds, as the release check counts it.
  const many = build(generatorId, slotId, 1000, 'variety')
  const prompts = tally(many, (b) => b.question.prompt)
  expect(prompts.size).toBeGreaterThan(100)
  expect(top(prompts, many.length)).toBeLessThanOrEqual(0.05)
  expect((prompts.get(written(slotId).prompt) ?? 0) / many.length).toBeLessThanOrEqual(0.05)
}

describe('routing', () => {
  it('sends each slot to its own builder', () => {
    const want: Record<string, string> = { q1: POLYGON, q10: POLYGON, q2: CIRCLE, q3: CIRCLE, q6: CIRCLE, q7: CIRCLE, q14: TANGENTS, q15: TANGENTS, q5: MEASURE, q9: MEASURE, q18: MEASURE }
    for (const [id, g] of Object.entries(want)) expect(generatorFor('further-maths', TOPIC, id)?.id, id).toBe(g)
    // The proofs and the multiple-choice questions stay written.
    for (const id of ['q4', 'q8', 'q11', 'q12', 'q13', 'q16', 'q17']) expect(generatorFor('further-maths', TOPIC, id), id).toBeUndefined()
    const keys = (g: string, id: string) => Object.keys(build(g, id, 1)[0]!.values).sort().join()
    expect(keys(POLYGON, 'q1')).toBe('exterior,n')
    expect(keys(POLYGON, 'q10')).toBe('n,sum')
    expect(keys(CIRCLE, 'q2')).toBe('answer,centre,find')
    expect(keys(CIRCLE, 'q3')).toBe('answer,given,quad,x')
    expect(keys(CIRCLE, 'q6')).toBe('answer,at,given')
    expect(keys(CIRCLE, 'q7')).toBe('answer,apex,direction,t')
    expect(keys(TANGENTS, 'q14')).toBe('APB,answer,direction')
    expect(keys(TANGENTS, 'q15')).toBe('AOB,APB,answer,direction')
    expect(keys(MEASURE, 'q5')).toBe('a,area,b,context,h')
    expect(keys(MEASURE, 'q9')).toBe('context,h,r,unit')
    expect(keys(MEASURE, 'q18')).toBe('N,closed,context,k,r')
  })

  it('builds every slot on 3000 seeds, each agreeing with its second route', () => {
    for (const [g, ids] of [[POLYGON, ['q1', 'q10']], [CIRCLE, ['q2', 'q3', 'q6', 'q7']], [TANGENTS, ['q14', 'q15']], [MEASURE, ['q5', 'q9', 'q18']]] as const) {
      for (const id of ids) {
        const built = build(g, id, 3000, 'many')
        expect(built.filter((b) => !b.check.agrees).map((b) => b.seed), id).toEqual([])
      }
    }
  })

  it('keeps each slot worth what it was, with one method line per extra mark', () => {
    for (const [g, id] of [[CIRCLE, 'q6'], [CIRCLE, 'q7'], [TANGENTS, 'q14'], [TANGENTS, 'q15'], [MEASURE, 'q18'], [POLYGON, 'q1']] as const) {
      for (const b of build(g, id, 50)) {
        expect(b.question.marks).toBe(written(id).marks)
        expect(b.question.markScheme.map((l) => l.code).join()).toBe(written(id).markScheme.map((l) => l.code).join())
      }
    }
  })
})

describe('fm-polygon-angles q1: each exterior angle of a regular polygon', () => {
  const built = build(POLYGON, 'q1')
  it('is 360° shared between the sides the prompt names, never the interior angle', () => {
    common(POLYGON, 'q1', built, { decimalWording: true })
    for (const b of built) {
      const n = sidesOf(b.question.prompt)
      expect(answer(b) * n, b.seed).toBeCloseTo(360, 9)
      expect(b.question.prompt, b.seed).toMatch(/regular/)
      // The interior angle, the 360° total, the number of sides: never the answer.
      for (const wrong of [180 - 360 / n, 360, n, ((n - 2) * 180) / n]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(b.question.solution, b.seed).toContain(`$360° \\div ${n} = ${answer(b)}°$`)
      expect(b.question.solution, b.seed).toContain(`Each interior angle is then $${180 - answer(b)}°$.`)
    }
  })
  it('spreads the polygons, a few with a decimal angle', () => {
    const sides = tally(built, (b) => sidesOf(b.question.prompt))
    expect(sides.size).toBeGreaterThanOrEqual(12)
    expect(top(sides, built.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(built, (b) => !Number.isInteger(answer(b)))).toBeGreaterThan(0.04)
    expect(share(built, (b) => !Number.isInteger(answer(b)))).toBeLessThan(0.25)
    expect(built.some((b) => b.question.prompt === 'Work out the size of each exterior angle of a regular hexagon.')).toBe(true)
  })
})

describe('fm-polygon-angles q10: the interior angle sum', () => {
  const built = build(POLYGON, 'q10')
  it('is (n − 2) × 180° for the sides the prompt names, never n × 180° or one angle', () => {
    common(POLYGON, 'q10', built)
    for (const b of built) {
      const n = sidesOf(b.question.prompt)
      // Counted as n triangles from a point inside, less the full turn there.
      expect(answer(b), b.seed).toBe(n * 180 - 360)
      for (const wrong of [n * 180, 360, ((n - 2) * 180) / n, (n - 1) * 180]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(b.question.solution, b.seed).toContain(`$(${n} - 2) \\times 180° = ${n - 2} \\times 180° = ${answer(b)}°$`)
    }
  })
  it('spreads the polygons, named and by side count', () => {
    const sides = tally(built, (b) => sidesOf(b.question.prompt))
    expect(sides.size).toBe(20)
    expect(top(sides, built.length)).toBeLessThanOrEqual(1 / 6)
    expect(share(built, (b) => /straight sides/.test(b.question.prompt))).toBeGreaterThan(0.08)
    expect(share(built, (b) => /\$\d+\$ sides/.test(b.question.prompt))).toBeGreaterThan(0.3)
  })
})

describe('fm-circle-theorem-angles q2: the angle at the centre', () => {
  const built = build(CIRCLE, 'q2')
  it('halves the centre angle or doubles the circumference one, with C on the major arc', () => {
    common(CIRCLE, 'q2', built)
    for (const b of built) {
      const p = b.question.prompt
      const [g] = anglesIn(p) as [number]
      const [givenName, askedName] = namesIn(p).length === 2 ? (namesIn(p) as [string, string]) : [`?O?`, namesIn(p)[0]!]
      expect(p, b.seed).toMatch(/major arc/)
      const toCircumference = /subtends/.test(p) || givenName[1] === 'O'
      if (toCircumference) {
        expect(askedName[1], b.seed).not.toBe('O')
        expect(answer(b), b.seed).toBe(g / 2)
        // Doubling, the supplement, the base angle of triangle OAB, the minor arc.
        for (const wrong of [2 * g, 180 - g, 90 - g / 2, 180 - g / 2, g]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= ${g}° \\div 2 = ${answer(b)}°$`)
      } else {
        expect(askedName[1], b.seed).toBe('O')
        expect(answer(b), b.seed).toBe(2 * g)
        for (const wrong of [g / 2, 180 - 2 * g, 180 - g, g, 360 - 2 * g]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= 2 \\times ${g}° = ${answer(b)}°$`)
      }
      expect(Number.isInteger(g / 2) || !toCircumference, b.seed).toBe(true)
    }
  })
  it('asks both ways round, each spread', () => {
    const back = built.filter((b) => b.values.find === 'centre')
    expect(back.length / built.length).toBeGreaterThan(0.2)
    expect(back.length / built.length).toBeLessThan(0.45)
    for (const part of [back, built.filter((b) => b.values.find === 'circumference')]) {
      const answers = tally(part, answer)
      expect(answers.size).toBeGreaterThanOrEqual(10)
      expect(top(answers, part.length)).toBeLessThanOrEqual(0.15)
    }
  })
})

describe('fm-circle-theorem-angles q3: a cyclic quadrilateral', () => {
  const built = build(CIRCLE, 'q3')
  it('asks the angle at the opposite vertex, between the same two neighbours, as 180° less', () => {
    common(CIRCLE, 'q3', built)
    for (const b of built) {
      const p = b.question.prompt
      const quad = /\$([A-Z]{4})\$/.exec(p)?.[1] ?? [...p.matchAll(/\$([A-Z])\$/g)].map((m) => m[1]).join('')
      expect(quad, b.seed).toHaveLength(4)
      const [given, asked] = namesIn(p) as [string, string]
      const at = (v: string) => quad.indexOf(v)
      // Same outer letters, middles opposite each other, outer letters the middle's neighbours.
      expect(asked[0] + asked[2], b.seed).toBe(given[0] + given[2])
      expect((at(asked[1]!) - at(given[1]!) + 4) % 4, b.seed).toBe(2)
      expect([(at(given[1]!) + 3) % 4, (at(given[1]!) + 1) % 4], b.seed).toEqual([at(given[0]!), at(given[2]!)])
      const [x] = anglesIn(p) as [number]
      expect(answer(b), b.seed).toBe(180 - x)
      expect(x, b.seed).not.toBe(answer(b))
      expect(b.question.solution, b.seed).toContain(`= 180° - ${x}° = ${answer(b)}°$`)
    }
  })
  it('spreads the vertex given and the angle', () => {
    expect(new Set(built.map((b) => b.values.given)).size).toBeGreaterThanOrEqual(15)
    expect(share(built, (b) => answer(b) > 90)).toBeGreaterThan(0.35)
    expect(share(built, (b) => answer(b) < 90)).toBeGreaterThan(0.35)
  })
})

describe('fm-circle-theorem-angles q6: the angle in a semicircle', () => {
  const built = build(CIRCLE, 'q6')
  it('takes the given angle from 90°, the right angle at the third point', () => {
    common(CIRCLE, 'q6', built)
    for (const b of built) {
      const p = b.question.prompt
      const diameter = /diameter (?:of a circle )?\$?([A-Z]{2})\$?|\$([A-Z]{2})\$ is a diameter/.exec(p)!
      const ends = (diameter[1] ?? diameter[2])!
      const [given, asked] = namesIn(p) as [string, string]
      // Both angles sit at the diameter's ends, and share the third point.
      expect(ends, b.seed).toContain(given[1])
      expect(ends, b.seed).toContain(asked[1])
      expect(given[1], b.seed).not.toBe(asked[1])
      expect(given[2], b.seed).toBe(asked[2])
      const [g] = anglesIn(p) as [number]
      expect(answer(b), b.seed).toBe(90 - g)
      for (const wrong of [g, 2 * g, g / 2, 180 - g, 180 - 2 * g]) expect(wrong, b.seed).not.toBe(answer(b))
      const right = `${asked[1]}${given[2]}${given[1]}`
      expect(b.question.solution, b.seed).toContain(`$\\angle ${right} = 90°$`)
      expect(b.question.markScheme[0]!.description, b.seed).toBe(`angle ${right} = 90° with the reason`)
      expect(b.question.solution, b.seed).toContain(`= 180° - 90° - ${g}° = ${answer(b)}°$`)
    }
  })
})

describe('fm-circle-theorem-angles q7: the alternate segment theorem, CA = CB', () => {
  const built = build(CIRCLE, 'q7')
  it('takes twice the tangent angle from 180°, or halves back to it', () => {
    common(CIRCLE, 'q7', built)
    for (const b of built) {
      const p = b.question.prompt
      const [g] = anglesIn(p) as [number]
      const eq = /\$([A-Z])([A-Z]) = ([A-Z])([A-Z])\$/.exec(p)!
      const T = eq[1]!
      expect(eq[3], b.seed).toBe(T)
      if (b.values.direction === 'tangent to apex') {
        expect(p, b.seed).toMatch(/makes an angle of/)
        const [asked] = namesIn(p) as [string]
        expect(asked[1], b.seed).toBe(T)
        expect(answer(b), b.seed).toBe(180 - 2 * g)
        // The theorem read straight off, the angle at the centre, the supplement, the radius' complement, the apex slip.
        for (const wrong of [g, 2 * g, 180 - g, 90 - g, (180 - g) / 2]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= 180° - ${g}° - ${g}° = ${answer(b)}°$`)
      } else {
        expect(p, b.seed).toMatch(/acute/)
        const [given] = namesIn(p) as [string]
        expect(given[1], b.seed).toBe(T)
        expect(answer(b), b.seed).toBe((180 - g) / 2)
        for (const wrong of [g, g / 2, 180 - g, 2 * g, 90 - g]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`\\frac{180° - ${g}°}{2} = ${answer(b)}°$`)
      }
    }
  })
  it('asks both ways round, each spread', () => {
    const back = built.filter((b) => b.values.direction !== 'tangent to apex')
    expect(back.length / built.length).toBeGreaterThan(0.2)
    expect(back.length / built.length).toBeLessThan(0.45)
    for (const part of [back, built.filter((b) => b.values.direction === 'tangent to apex')]) {
      expect(tally(part, answer).size).toBeGreaterThanOrEqual(10)
      expect(top(tally(part, answer), part.length)).toBeLessThanOrEqual(0.15)
    }
  })
})

describe('fm-tangents-from-a-point q14: equal tangents', () => {
  const built = build(TANGENTS, 'q14')
  it('halves what is left of 180°, or takes two base angles from it', () => {
    common(TANGENTS, 'q14', built)
    for (const b of built) {
      const p = b.question.prompt
      const [g] = anglesIn(p) as [number]
      const P = /tangents? from (?:a point )?\$([A-Z])\$|\$([A-Z])[A-Z]\$ and|meet at the point \$([A-Z])\$/.exec(p)!.slice(1).find(Boolean)!
      const [given, asked] = namesIn(p) as [string, string]
      if (b.values.direction === 'APB to PAB') {
        expect(given[1], b.seed).toBe(P)
        expect(asked[0], b.seed).toBe(P)
        expect(answer(b), b.seed).toBe((180 - g) / 2)
        // The given itself, angle OAB (half of it), angle AOB, the reflex slip.
        for (const wrong of [g, g / 2, 180 - g, 90 - g, 180 - g / 2]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`\\frac{180° - ${g}°}{2} = ${answer(b)}°$`)
      } else {
        expect(given[0], b.seed).toBe(P)
        expect(asked[1], b.seed).toBe(P)
        expect(answer(b), b.seed).toBe(180 - 2 * g)
        for (const wrong of [g, 2 * g, 180 - g, 90 - g]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= 180° - ${g}° - ${g}° = ${answer(b)}°$`)
      }
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(/^([A-Z])([A-Z]) = \1([A-Z]), tangents from a point are equal$/)
    }
  })
})

describe('fm-tangents-from-a-point q15: tangents, the centre and the circumference', () => {
  const built = build(TANGENTS, 'q15')
  it('goes through angle AOB both ways round', () => {
    common(TANGENTS, 'q15', built)
    for (const b of built) {
      const p = b.question.prompt
      const [g] = anglesIn(p) as [number]
      expect(p, b.seed).toMatch(/major arc/)
      expect(p, b.seed).toMatch(/centre \$O\$/)
      if (b.values.direction === 'APB to ACB') {
        expect(answer(b), b.seed).toBe((180 - g) / 2)
        // Angle AOB unhalved, half the given, the given, the minor arc.
        for (const wrong of [180 - g, g / 2, g, 90 + g / 2]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= 360° - 90° - 90° - ${g}° = ${180 - g}°$`)
        expect(b.question.solution, b.seed).toContain(`= ${180 - g}° \\div 2 = ${answer(b)}°$`)
        expect(b.question.markScheme[1]!.description, b.seed).toMatch(new RegExp(`O[A-Z] = ${180 - g}°$`))
      } else {
        expect(answer(b), b.seed).toBe(180 - 2 * g)
        for (const wrong of [2 * g, g, 180 - g, 90 - g]) expect(wrong, b.seed).not.toBe(answer(b))
        expect(b.question.solution, b.seed).toContain(`= 2 \\times ${g}° = ${2 * g}°$`)
        expect(b.question.solution, b.seed).toContain(`= 360° - 90° - 90° - ${2 * g}° = ${answer(b)}°$`)
      }
    }
  })
  it('asks both ways round, each spread', () => {
    for (const slot of ['q14', 'q15']) {
      const all = build(TANGENTS, slot)
      const forward = all.filter((b) => String(b.values.direction).startsWith('APB'))
      expect(forward.length / all.length).toBeGreaterThan(0.55)
      expect(forward.length / all.length).toBeLessThan(0.8)
      for (const part of [forward, all.filter((b) => !String(b.values.direction).startsWith('APB'))]) {
        expect(tally(part, answer).size).toBeGreaterThanOrEqual(10)
        expect(top(tally(part, answer), part.length)).toBeLessThanOrEqual(0.15)
      }
    }
  })
  it('never shares a figure with q14 on the same advanced sheet', () => {
    const sheet = topic.worksheets.advanced.questionIds.map(written)
    const figures = (b: Generated) => new Set([Number(b.values.APB), (180 - Number(b.values.APB)) / 2])
    for (let i = 0; i < 300; i++) {
      const s = sheetQuestions('further-maths', TOPIC, sheet, `sheet-${i}`)
      const q14 = s.find((x) => x.question.id === 'q14')!.generated!
      const q15 = s.find((x) => x.question.id === 'q15')!.generated!
      const shared = [...figures(q14)].filter((v) => figures(q15).has(v))
      expect(shared, `sheet-${i}`).toEqual([])
      expect(answer(q14)).not.toBe(answer(q15))
    }
    // The halves cover the list and share nothing.
    const all = [...TANGENT_HALVES[0]!, ...TANGENT_HALVES[1]!]
    expect(new Set(all).size).toBe(all.length)
    expect(Math.abs(TANGENT_HALVES[0]!.length - TANGENT_HALVES[1]!.length)).toBeLessThanOrEqual(2)
  })
})

describe('fm-area-and-volume q5: the area of a trapezium', () => {
  const built = build(MEASURE, 'q5')
  it('is half the sum of the parallel sides times the distance between them', () => {
    common(MEASURE, 'q5', built, { decimalWording: true })
    for (const b of built) {
      const [a, c, h] = lengthsIn(b.question.prompt) as [number, number, number]
      const area = ((a + c) * h) / 2
      expect(answer(b), b.seed).toBe(area)
      expect(new Set([a, c, h]).size, b.seed).toBe(3)
      expect([a, c, h], b.seed).not.toContain(area)
      // The missing half, a rectangle on either side, all three multiplied, the half on the sum alone.
      for (const wrong of [(a + c) * h, a * h, c * h, (a * c * h) / 2, (a + c) / 2 + h]) expect(wrong, b.seed).not.toBe(area)
      expect(b.question.solution, b.seed).toContain(`\\frac{1}{2}(${a} + ${c}) \\times ${h} = \\frac{1}{2} \\times ${a + c} \\times ${h} = ${answer(b)}$`)
      // By hand: lengths at most 120, areas under 10 000.
      for (const v of [a, c, h]) expect(v).toBeLessThanOrEqual(120)
      expect(area).toBeLessThan(10000)
      if (/field/.test(b.question.prompt)) expect(Math.min(a, c)).toBeGreaterThanOrEqual(30)
    }
  })
  it('spreads the contexts, the order of the sides and the halves', () => {
    expect(new Set(built.map((b) => b.values.context)).size).toBe(6)
    expect(share(built, (b) => Number(b.values.a) > Number(b.values.b))).toBeGreaterThan(0.12)
    expect(share(built, (b) => Number(b.values.a) > Number(b.values.b))).toBeLessThan(0.4)
    expect(share(built, (b) => !Number.isInteger(answer(b)))).toBeGreaterThan(0.1)
  })
})

describe('fm-area-and-volume q9: the volume of a cone to 2 d.p.', () => {
  const built = build(MEASURE, 'q9')
  it('is a third of πr²h, clear of a rounding boundary, the unrounded value marked right too', () => {
    common(MEASURE, 'q9', built, { tolerance: 0.005 })
    for (const b of built) {
      const [r, h] = lengthsIn(b.question.prompt) as [number, number]
      const V = (Math.PI * r * r * h) / 3
      expect(answer(b), b.seed).toBe(Math.round(V * 100) / 100)
      expect(Math.abs(V * 100 - Math.round(V * 100)), b.seed).toBeLessThan(0.45)
      expect(mark(b.question, String(V)).correct, b.seed).toBe(true)
      expect(mark(b.question, (Math.round(V * 100) / 100).toFixed(2)).correct, b.seed).toBe(true)
      expect(b.question.prompt, b.seed).toContain('The volume of a cone is $\\frac{1}{3}\\pi r^2 h$.')
      expect(b.question.prompt.endsWith('Give your answer to two decimal places.'), b.seed).toBe(true)
      expect(r, b.seed).not.toBe(h)
      // Without the third, radius and height swapped, the diameter for the radius, no square.
      for (const wrong of [3 * V, (Math.PI * r * h * h) / 3, (Math.PI * 4 * r * r * h) / 3, (Math.PI * r * h) / 3]) expect(Math.abs(wrong - answer(b)), b.seed).toBeGreaterThan(0.5)
      expect(b.question.solution, b.seed).toContain(`\\frac{1}{3} \\times \\pi \\times ${r}^2 \\times ${h} = `)
      expect(b.question.markScheme[0]!.description, b.seed).toMatch(/^\d+π(\/\d+)? or \d+\.\d\d$/)
      if (/sand/.test(b.question.prompt)) expect(h / r).toBeLessThanOrEqual(2 / 3)
      if (/traffic|ice cream|party|cup/.test(b.question.prompt)) expect(h).toBeGreaterThan(r)
    }
  })
  it('spreads the contexts, the radii and the heights, a half radius now and then', () => {
    expect(new Set(built.map((b) => b.values.context)).size).toBe(7)
    expect(new Set(built.map((b) => b.values.r)).size).toBeGreaterThanOrEqual(15)
    expect(new Set(built.map((b) => b.values.h)).size).toBeGreaterThanOrEqual(20)
    expect(share(built, (b) => !Number.isInteger(Number(b.values.r)))).toBeGreaterThan(0.05)
    expect(share(built, (b) => b.question.prompt === written('q9').prompt)).toBeLessThanOrEqual(0.01)
  })
})

describe('fm-area-and-volume q18: a cylinder radius from its surface area', () => {
  const built = build(MEASURE, 'q18')
  it('solves (ends + 2k)πr² = Nπ, the ends counted from the prompt', () => {
    common(MEASURE, 'q18', built)
    for (const b of built) {
      const p = b.question.prompt
      const N = Number(/\$(\d+)\\pi\$/.exec(p)![1])
      const digits = /height \$(\d*)r\$/.exec(p)
      const worded = /height is (equal to|twice|three times|four times) its radius/.exec(p)
      const k = digits ? Number(digits[1] || 1) : { 'equal to': 1, twice: 2, 'three times': 3, 'four times': 4 }[worded![1]!]!
      const open = /open at the top/.test(p)
      const ends = open ? 1 : 2
      const r = answer(b)
      expect((ends + 2 * k) * r * r, b.seed).toBe(N)
      expect(N).toBeLessThanOrEqual(1000)
      expect(r).not.toBe(k)
      // The ends miscounted, no ends, r² left unrooted.
      for (const wrong of [Math.sqrt(N / (3 - ends + 2 * k)), Math.sqrt(N / (2 * k)), N / (ends + 2 * k)]) expect(wrong, b.seed).not.toBe(r)
      expect(b.question.solution, b.seed).toContain(`So $${ends + 2 * k}\\pi r^2 = ${N}\\pi$, $r^2 = ${r * r}$ and $r = ${r}$.`)
      expect(b.question.solution, b.seed).toContain(open ? '\\pi r^2 + 2\\pi r h' : '2\\pi r^2 + 2\\pi r h')
    }
  })
  it('spreads open and closed, the height multiple and the radius within each', () => {
    const closed = built.filter((b) => b.values.closed === 'closed')
    expect(closed.length / built.length).toBeGreaterThan(0.35)
    expect(closed.length / built.length).toBeLessThan(0.65)
    expect(new Set(built.map((b) => b.values.k))).toEqual(new Set([1, 2, 3, 4]))
    for (const part of [closed, built.filter((b) => b.values.closed === 'open')]) {
      expect(tally(part, answer).size).toBeGreaterThanOrEqual(8)
      expect(top(tally(part, answer), part.length)).toBeLessThanOrEqual(0.3)
    }
  })
})

describe('review fixes', () => {
  const SLOTS: [string, string][] = [[POLYGON, 'q1'], [POLYGON, 'q10'], [CIRCLE, 'q2'], [CIRCLE, 'q3'], [CIRCLE, 'q6'], [CIRCLE, 'q7'], [TANGENTS, 'q14'], [TANGENTS, 'q15'], [MEASURE, 'q5'], [MEASURE, 'q9'], [MEASURE, 'q18']]

  it('puts an before a vowel sound and a before anything else, in every prompt and solution', () => {
    for (const [g, id] of SLOTS) {
      for (const b of build(g, id, 300, 'articles')) {
        for (const text of [b.question.prompt, b.question.solution]) {
          expect(text, `${id} ${b.seed}`).not.toMatch(/\b[aA] [aeiou]/)
          expect(text, `${id} ${b.seed}`).not.toMatch(/\b[aA]n [^aeiou$\s]/)
        }
      }
    }
    const prompts = new Set(build(POLYGON, 'q10', 1000, 'articles').map((b) => b.question.prompt))
    expect(prompts.has('Work out the sum of the interior angles of an octagon.')).toBe(true)
    expect(prompts.has('Work out the sum of the interior angles of a hexagon.')).toBe(true)
  })

  it('q1 never asks 32 sides (11.25° is long division by hand), and keeps 16, 25 and 48', () => {
    const built = build(POLYGON, 'q1', 1000, 'sides')
    const sides = new Set(built.map((b) => sidesOf(b.question.prompt)))
    expect(sides.has(32)).toBe(false)
    for (const n of [16, 24, 25, 48]) expect(sides.has(n), String(n)).toBe(true)
    for (const b of built) expect(Math.abs(answer(b) * 10 - Math.round(answer(b) * 10)), b.seed).toBeLessThan(1e-9)
    expect(new Set(built.map((b) => b.question.prompt)).size).toBeGreaterThanOrEqual(100)
  })

  it('q18 spreads the radius within every named context: at least 4 answers, none over 40%', () => {
    const built = build(MEASURE, 'q18', 3000, 'contexts')
    const contexts = new Set(built.map((b) => String(b.values.context)))
    expect(contexts.size).toBe(6)
    for (const c of contexts) {
      const part = built.filter((b) => b.values.context === c)
      const answers = tally(part, answer)
      expect(answers.size, c).toBeGreaterThanOrEqual(4)
      expect(top(answers, part.length), c).toBeLessThanOrEqual(0.4)
      for (const b of part) expect(Number(b.values.N), b.seed).toBeLessThanOrEqual(1000)
    }
  })

  it('q9 draws every cone in its real proportions', () => {
    // Height over radius, lowest and highest, written out here rather than read from the generator.
    const PROPORTION: [RegExp, number, number][] = [
      [/^A traffic cone/, 3.5, 5],
      [/^A party hat/, 1.8, 3],
      [/^An ice cream cone/, 2, 4],
      [/^A paper drinking cup/, 1.8, 3],
      [/^A funnel/, 1, 2],
      [/^A pile of sand/, 0.25, 2 / 3],
      [/^A cone has/, 0.6, 2.5],
    ]
    const built = build(MEASURE, 'q9', 3000, 'cones')
    for (const [lead, lo, hi] of PROPORTION) {
      const part = built.filter((b) => lead.test(b.question.prompt))
      expect(part.length, String(lead)).toBeGreaterThan(100)
      for (const b of part) {
        const [r, h] = lengthsIn(b.question.prompt) as [number, number]
        expect(h / r, `${b.seed}: r ${r}, h ${h}`).toBeGreaterThanOrEqual(lo - 1e-9)
        expect(h / r, `${b.seed}: r ${r}, h ${h}`).toBeLessThanOrEqual(hi + 1e-9)
        const V = (Math.PI * r * r * h) / 3
        expect(Math.abs(V * 100 - Math.round(V * 100)), b.seed).toBeLessThan(0.45)
      }
    }
  })
})

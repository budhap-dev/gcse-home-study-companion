import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { mark } from '../marking.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import { backBearing, backByVectors, threeFigures } from './maths/angles.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the geometry generators: angles, 2D shapes, circle theorems,
 * bearings and scales, Pythagoras, 3D trigonometry, the sine and cosine rules, exact values
 * and trigonometric equations.
 *
 * The release check proves each answer agrees with the generator's own second method. These
 * tests read the numbers back out of the printed prompt, as a student sees them, and test
 * them with formulas written separately here: every triangle is possible and its sides and
 * angles agree by another rule, bearings print three figures and back-bearings are right on
 * both sides of 180° and next to north, polygons have a whole number of sides, circle
 * configurations leave every angle positive, and every accepted exact form is the true value.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const raw = (topicId: string) => JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(raw(topicId).questions)
const N = 300
const RAD = Math.PI / 180

function build(topicId: string, slotId: string, n = N): Generated[] {
  const g = GENERATORS.find((x) => x.topicId === topicId && x.replaces.includes(slotId))
  if (!g) throw new Error(`no generator for ${topicId} ${slotId}`)
  const slot = bank(topicId).find((q) => q.id === slotId)!
  return Array.from({ length: n }, (_, i) => generate(g, slot, `geometry-${i}`))
}
const answer = (b: Generated) => {
  if (b.question.type !== 'numeric') throw new Error('not numeric')
  return b.question.answer
}
const accepted = (b: Generated) => {
  if (b.question.type !== 'short-text') throw new Error('not short-text')
  return b.question.accepted
}
/** Every number printed in the prompt, in order, signs kept. */
const numbers = (b: Generated) => [...b.question.prompt.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
/** The number printed after a phrase, as in "hypotenuse 13". */
const after = (b: Generated, phrase: RegExp) => {
  const m = b.question.prompt.match(new RegExp(`${phrase.source}\\s*\\$?(-?\\d+(?:\\.\\d+)?)`))
  if (!m) throw new Error(`no ${phrase} in ${b.question.prompt}`)
  return Number(m[1])
}
const sin = (d: number) => Math.sin(d * RAD)
const cos = (d: number) => Math.cos(d * RAD)
const tan = (d: number) => Math.tan(d * RAD)
/** The angle opposite side a, from three sides, by the cosine rule. */
const angleFromSides = (a: number, b: number, c: number) => Math.acos((b * b + c * c - a * a) / (2 * b * c)) / RAD
const heron = (a: number, b: number, c: number) => {
  const s = (a + b + c) / 2
  return Math.sqrt(s * (s - a) * (s - b) * (s - c))
}
const possible = (a: number, b: number, c: number) => a + b > c && a + c > b && b + c > a

describe('triangles are possible, and their sides and angles agree by another rule', () => {
  it('Pythagoras: whole-number triangles are exact, and a leg is shorter than the hypotenuse', () => {
    for (const b of build('pythagoras-in-2d', 'q2')) {
      const [x, y] = numbers(b)
      expect(x! ** 2 + y! ** 2).toBe(answer(b) ** 2)
    }
    for (const b of build('pythagoras-in-2d', 'q3')) {
      const c = after(b, /hypotenuse(?: of a right-angled triangle)?(?: is)?/)
      const a = numbers(b).find((n) => n !== c)!
      expect(answer(b)).toBeLessThan(c)
      expect(a ** 2 + answer(b) ** 2).toBe(c ** 2)
    }
    for (const b of build('pythagoras-in-2d', 'q16')) {
      const [x, y] = numbers(b)
      expect(x! ** 2 + y! ** 2).toBe(answer(b) ** 2)
    }
  })

  it('Pythagoras: rounded sides square back to the printed sides', () => {
    for (const b of build('pythagoras-in-2d', 'q5')) {
      const [x, y] = numbers(b)
      expect(Math.abs(answer(b) - Math.hypot(x!, y!))).toBeLessThanOrEqual(0.005 + 1e-9)
    }
    for (const id of ['q6', 'q8']) {
      for (const b of build('pythagoras-in-2d', id)) {
        const [h, k] = numbers(b)
        expect(answer(b)).toBeLessThan(h!)
        expect(Math.abs(answer(b) ** 2 + k! ** 2 - h! ** 2)).toBeLessThan(0.01 * 2 * h!)
      }
    }
    for (const b of build('pythagoras-in-2d', 'q10')) {
      const [x1, y1, x2, y2] = numbers(b)
      expect(Math.abs(answer(b) - Math.hypot(x2! - x1!, y2! - y1!))).toBeLessThanOrEqual(0.005 + 1e-9)
    }
  })

  it('an isosceles triangle with that height has the printed sides', () => {
    for (const b of build('pythagoras-in-2d', 'q12')) {
      const [s, base] = numbers(b)
      expect(possible(s!, s!, base!)).toBe(true)
      // Area two ways: Heron from the three sides, and half base times the height.
      expect(heron(s!, s!, base!)).toBeCloseTo((base! * answer(b)) / 2, 6)
    }
  })

  it('area: ½ab sin C agrees with Heron on the triangle the cosine rule completes', () => {
    for (const id of ['q4', 'q7', 'q9']) {
      for (const b of build('sine-rule-cosine-rule-and-area', id)) {
        const [a, c2, C] = numbers(b)
        const third = Math.sqrt(a! ** 2 + c2! ** 2 - 2 * a! * c2! * cos(C!))
        expect(possible(a!, c2!, third)).toBe(true)
        expect(Math.abs(heron(a!, c2!, third) - answer(b))).toBeLessThanOrEqual(0.005 + 1e-6 + (id === 'q9' ? 0.045 : 0))
      }
    }
  })

  it('sine rule for a side: the projection rule gives the same side', () => {
    for (const b of build('sine-rule-cosine-rule-and-area', 'q5')) {
      const m = b.question.prompt.match(/\$([abc]) = ([\d.]+)\$, \$([ABC]) = (\d+)°\$ and \$([ABC]) = (\d+)°\$/)!
      const [x, X, Y] = [Number(m[2]), Number(m[4]), Number(m[6])]
      expect(m[1]!.toUpperCase()).toBe(m[3])
      const Z = 180 - X - Y
      expect(Z).toBeGreaterThan(0)
      // Projection: x = y cos Z + z cos Y and y = x cos Z + z cos X, solved for y.
      const y = (x * cos(Z) * cos(Y) + x * cos(X)) / (cos(Y) + cos(X) * cos(Z))
      expect(Math.abs(y - answer(b))).toBeLessThanOrEqual(0.005 + 1e-9)
    }
  })

  /** The third side z when x faces X and y is the other side: z² - 2y cos X z + y² - x² = 0. */
  const thirdSides = (x: number, X: number, y: number) => {
    const disc = x * x - y * y * sin(X) ** 2
    return [y * cos(X) - Math.sqrt(disc), y * cos(X) + Math.sqrt(disc)].filter((z) => z > 1e-9)
  }

  it('sine rule for an angle: one triangle, and the cosine rule gives the same angle', () => {
    for (const b of build('sine-rule-cosine-rule-and-area', 'q6')) {
      const [x, X, y] = numbers(b)
      expect(y!).toBeLessThan(x!)
      const zs = thirdSides(x!, X!, y!)
      expect(zs).toHaveLength(1)
      expect(possible(x!, y!, zs[0]!)).toBe(true)
      expect(Math.abs(angleFromSides(y!, x!, zs[0]!) - answer(b))).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })

  it('the obtuse alternative: possible exactly when the solution says so, and both kinds turn up', () => {
    const kinds = new Set<string>()
    for (const b of build('sine-rule-cosine-rule-and-area', 'q14')) {
      const [x, X, y] = numbers(b)
      const obtuse = answer(b)
      expect(obtuse).toBeGreaterThan(90)
      const zs = thirdSides(x!, X!, y!)
      const fits = X! + obtuse < 180
      kinds.add(String(fits))
      expect(b.question.solution).toContain(fits ? 'possible too' : 'impossible')
      // Two triangles exactly when the obtuse angle fits; the shorter third side gives it.
      expect(zs).toHaveLength(fits ? 2 : 1)
      const angles = zs.map((z) => angleFromSides(y!, x!, z))
      if (fits) expect(Math.abs(Math.max(...angles) - obtuse)).toBeLessThanOrEqual(0.05 + 1e-9)
      else expect(Math.abs(180 - angles[0]! - obtuse)).toBeLessThanOrEqual(0.05 + 1e-9)
    }
    expect(kinds).toEqual(new Set(['true', 'false']))
  })

  it('cosine rule: the side found gives the same area as the two sides and their angle', () => {
    for (const b of build('sine-rule-cosine-rule-and-area', 'q11')) {
      const [p, q, A] = numbers(b)
      const a = answer(b)
      expect(possible(p!, q!, a)).toBe(true)
      expect(Math.abs(heron(p!, q!, a) - 0.5 * p! * q! * sin(A!))).toBeLessThan(0.01 * p! * q!)
    }
  })

  it('the largest angle faces the longest side, is obtuse, and matches Heron', () => {
    for (const b of build('sine-rule-cosine-rule-and-area', 'q12')) {
      const sides = numbers(b).sort((x, y) => y - x) as [number, number, number]
      const [a, s, t] = sides
      expect(possible(a, s, t)).toBe(true)
      const A = answer(b)
      expect(A).toBeGreaterThan(90)
      expect(A).toBeLessThan(180)
      expect(Math.abs(heron(a, s, t) - 0.5 * s * t * sin(A))).toBeLessThan(0.002 * s * t)
    }
  })

  it('the third angle of a triangle is positive, on both sheets that ask it', () => {
    for (const b of [...build('sine-rule-cosine-rule-and-area', 'q16'), ...build('properties-of-angles', 'q7')]) {
      const [x, y] = numbers(b).filter((n) => n > 0)
      expect(answer(b)).toBe(180 - x! - y!)
      expect(answer(b)).toBeGreaterThan(0)
    }
  })

  it('3D: whole space diagonals are exact, and the third edge is a whole positive length', () => {
    for (const id of ['q5', 'q7', 'q9']) {
      for (const b of build('pythagoras-in-3d', id)) {
        const [x, y, z] = numbers(b)
        expect(x! ** 2 + y! ** 2 + z! ** 2).toBe(answer(b) ** 2)
      }
    }
    for (const b of build('pythagoras-in-3d', 'q11')) {
      const [d, x, y] = numbers(b)
      expect(x! ** 2 + y! ** 2 + answer(b) ** 2).toBe(d! ** 2)
      expect(answer(b)).toBeGreaterThan(0)
    }
    for (const b of build('pythagoras-in-3d', 'q12')) {
      const [x, y, z] = numbers(b)
      expect(Math.abs(answer(b) - Math.hypot(x!, y!, z!))).toBeLessThanOrEqual(0.05 + 1e-9)
    }
  })

  it('3D: the angle with the base has tan = height ÷ base diagonal, and lies between 0° and 90°', () => {
    for (const id of ['q5', 'q6', 'q11']) {
      for (const b of build('trigonometry-in-3d', id)) {
        const [x, y, h] = numbers(b)
        const theta = answer(b)
        expect(theta).toBeGreaterThan(0)
        expect(theta).toBeLessThan(90)
        expect(Math.abs(Math.atan(h! / Math.hypot(x!, y!)) / RAD - theta)).toBeLessThanOrEqual(0.05 + 1e-9)
      }
    }
    for (const b of build('trigonometry-in-3d', 'q13')) {
      const [x, y] = numbers(b)
      expect(answer(b)).toBe(Math.hypot(x!, y!))
    }
  })
})

describe('angles, polygons and quadrilaterals', () => {
  it('a regular polygon has a whole number of sides, in every polygon slot', () => {
    for (const b of build('properties-of-angles', 'q8')) {
      const n = Number(b.values.n)
      expect(Number.isInteger(n) && n >= 3).toBe(true)
      expect(answer(b) * n).toBe(360)
    }
    for (const b of build('properties-of-angles', 'q11')) {
      const [angle] = numbers(b)
      const n = answer(b)
      expect(Number.isInteger(n) && n >= 3).toBe(true)
      const exterior = b.values.from === 'interior' ? 180 - angle! : angle!
      expect(exterior * n).toBe(360)
    }
    for (const b of build('properties-of-angles', 'q12')) {
      const [e] = numbers(b)
      expect(Number.isInteger(360 / e!)).toBe(true)
      // Both formulae for the interior angle.
      const n = 360 / e!
      expect(answer(b)).toBe(((n - 2) * 180) / n)
      expect(answer(b)).toBe(180 - e!)
    }
    for (const b of build('properties-of-angles', 'q10')) {
      const n = Number(b.values.n)
      expect(answer(b)).toBe((n - 2) * 180)
      expect(answer(b)).toBe(n * 180 - 360)
    }
  })

  it('every angle of every quadrilateral is between 0° and 180°, and they total 360°', () => {
    for (const b of build('properties-of-2d-shapes', 'q9')) {
      const { a, b: side, c } = b.values as { a: number; b: number; c: number }
      for (const x of [a, side, c]) expect(x > 0 && x < 180).toBe(true)
      expect(a + 2 * side + c).toBe(360)
    }
    for (const b of build('properties-of-2d-shapes', 'q16')) {
      const { a, b: side, c, x } = b.values as { a: number; b: number; c: number; x: number }
      for (const v of [a, side, c]) expect(v > 0 && v < 180).toBe(true)
      expect(a + 2 * side + c).toBe(360)
      // The printed expressions, at the printed x, give the angles the solution uses.
      const exprs = [...b.question.prompt.matchAll(/= \(?(\d*)x(?: ([+-]) (\d+))?\)?°/g)].map((m) => (Number(m[1] || 1) * x) + (m[2] ? (m[2] === '-' ? -1 : 1) * Number(m[3]) : 0))
      expect(exprs).toEqual([side, side, a])
    }
    for (const b of build('properties-of-2d-shapes', 'q22')) {
      const { a, d } = b.values as { a: number; d: number }
      expect(a > 0 && d > 0 && a + d === 180).toBe(true)
    }
    for (const b of build('properties-of-2d-shapes', 'q15')) {
      const P = Number(b.values.P)
      expect(P > 0 && P < 180).toBe(true)
      expect([P, 180 - P]).toContain(answer(b))
    }
  })

  it('an isosceles triangle has positive angles that total 180°', () => {
    for (const b of build('properties-of-2d-shapes', 'q4')) {
      const { base, top } = b.values as { base: number; top: number }
      expect(base > 0 && top > 0 && 2 * base + top === 180).toBe(true)
    }
  })
})

describe('circle theorems leave every angle positive', () => {
  it('in every configuration', () => {
    for (const b of build('circle-theorems', 'q1')) {
      const [given] = numbers(b)
      const centre = b.values.find === 'centre' ? answer(b) : given!
      expect(centre).toBeLessThan(180)
      expect(centre).toBeGreaterThan(0)
      expect(Math.min(centre / 2, centre)).toBeGreaterThan(0)
    }
    for (const b of build('circle-theorems', 'q2')) {
      const [g] = numbers(b)
      expect(g! + answer(b)).toBe(90)
      expect(answer(b)).toBeGreaterThan(0)
    }
    for (const b of build('circle-theorems', 'q3')) {
      const [g] = numbers(b)
      expect(g! + answer(b)).toBe(180)
      expect(Math.min(g!, answer(b))).toBeGreaterThan(0)
    }
    for (const id of ['q5', 'q13']) {
      for (const b of build('circle-theorems', id)) {
        const apb = Number(b.values.APB ?? (id === 'q13' ? answer(b) : 180 - Number(b.values.AOB)))
        const aob = 180 - apb
        const oab = (180 - aob) / 2
        const pab = 90 - oab
        for (const x of [apb, aob, oab, pab]) expect(x).toBeGreaterThan(0)
        // PAB and PBA are equal tangents' base angles: the triangle PAB closes.
        expect(apb + 2 * pab).toBeCloseTo(180, 9)
      }
    }
    for (const b of build('circle-theorems', 'q9')) {
      const [g] = numbers(b)
      const base = 'OAB' in b.values ? g! : answer(b)
      expect(180 - 2 * base).toBeGreaterThan(0)
    }
    for (const b of build('circle-theorems', 'q14')) {
      const [g] = numbers(b)
      expect(g! + answer(b)).toBe(90)
      expect(Math.min(g!, answer(b))).toBeGreaterThan(0)
    }
    for (const id of ['q7', 'q8']) {
      for (const b of build('circle-theorems', id)) {
        const [g] = numbers(b)
        expect(answer(b)).toBe(g)
        expect(g! > 0 && g! < 90).toBe(true)
      }
    }
  })

  it('a chord is shorter than the diameter and the distance shorter than the radius', () => {
    for (const b of build('circle-theorems', 'q6')) {
      const [chord, r] = numbers(b)
      expect(chord!).toBeLessThan(2 * r!)
      expect((chord! / 2) ** 2 + answer(b) ** 2).toBe(r! ** 2)
    }
    for (const b of build('circle-theorems', 'q18')) {
      const [r, d] = numbers(b)
      expect(d!).toBeLessThan(r!)
      expect(answer(b)).toBeLessThan(2 * r!)
      expect((answer(b) / 2) ** 2 + d! ** 2).toBe(r! ** 2)
    }
  })
})

describe('bearings', () => {
  /** Written out by hand, not by the rule: both sides of 180°, and next to north. */
  const BACK: [number, number][] = [
    [1, 181], [10, 190], [45, 225], [60, 240], [90, 270], [150, 330], [179, 359],
    [181, 1], [200, 20], [250, 70], [270, 90], [300, 120], [330, 150], [355, 175], [359, 179],
  ]

  it('the back-bearing rule and the vector method agree with a hand-written table', () => {
    for (const [f, back] of BACK) {
      expect(backBearing(f), `${f}`).toBe(back)
      expect(backByVectors(f), `${f}`).toBe(back)
    }
  })

  it('a back bearing differs by exactly 180° and the generated forwards reach both ends of each range', () => {
    const forwards = (id: string) => build('scale-drawings-and-bearings', id).map((b) => Number(b.values.forward))
    for (const id of ['q5', 'q6', 'q15']) {
      for (const b of build('scale-drawings-and-bearings', id)) {
        const f = Number(b.values.forward)
        const back = b.question.type === 'numeric' ? b.question.answer : Number(accepted(b)[0])
        expect(Math.abs(f - back)).toBe(180)
        expect(back >= 0 && back < 360).toBe(true)
        // The forward bearing in the prompt is printed in three figures.
        expect(b.question.prompt).toContain(`is ${threeFigures(f)}°`)
      }
    }
    const under = forwards('q5')
    expect(under.some((f) => f <= 12) && under.some((f) => f >= 168)).toBe(true)
    expect(under.every((f) => f > 0 && f < 180)).toBe(true)
    const over = forwards('q6')
    expect(over.some((f) => f <= 192) && over.some((f) => f >= 348)).toBe(true)
    expect(over.every((f) => f > 180 && f < 360)).toBe(true)
  })

  it('a bearing is written in three figures, and the marker refuses it without the zeros', () => {
    for (const b of build('scale-drawings-and-bearings', 'q1')) {
      const n = Number(b.values.bearing)
      const [first] = accepted(b)
      expect(first).toMatch(/^\d{3}$/)
      expect(Number(first)).toBe(n)
      expect(mark(b.question, String(n)).correct).toBe(false)
      expect(mark(b.question, `${String(n).padStart(3, '0')}°`).correct).toBe(true)
    }
    for (const b of build('scale-drawings-and-bearings', 'q6')) {
      const back = Number(b.values.back)
      if (back < 100) expect(mark(b.question, String(back)).correct).toBe(false)
      for (const a of accepted(b)) expect(a).toMatch(/^\d{3}/)
    }
  })

  it('the angle inside the triangle at B is never just the turn, and matches the angle between the legs', () => {
    let wraps = 0
    let anticlockwise = 0
    for (const b of build('scale-drawings-and-bearings', 'q12', 500)) {
      const [b1, b2] = numbers(b)
      expect(b.question.prompt).toMatch(/bearing of \d{3}°.*bearing of \d{3}°/)
      // The angle at B between the way back to A (b1 + 180) and the way on to C (b2).
      const diff = Math.abs(((b1! + 180 - b2!) % 360 + 360) % 360)
      const inside = diff > 180 ? 360 - diff : diff
      expect(answer(b)).toBe(inside)
      expect(answer(b)).not.toBe(Number(b.values.turn))
      if (Math.abs(b2! - b1!) > 180) wraps++
      if (b.question.solution.includes('anticlockwise')) anticlockwise++
    }
    expect(wraps).toBeGreaterThan(20)
    expect(anticlockwise).toBeGreaterThan(100)
  })

  it('a right-angled journey has bearings 90° apart, and its distance squares back', () => {
    for (const b of build('scale-drawings-and-bearings', 'q13')) {
      const [d1, b1, d2, b2] = numbers(b)
      expect([90, 270]).toContain(Math.abs(b1! - b2!))
      expect(d1! ** 2 + d2! ** 2).toBe(answer(b) ** 2)
    }
  })
})

describe('exact values', () => {
  /** k√m, k sqrt m, with or without a unit, read as a number. */
  const surdValue = (s: string) => {
    const m = s.match(/^(\d*)\s*(?:√|sqrt)(\d+)(?:\s*[a-z]+)?$/)
    if (!m) throw new Error(`cannot read ${s}`)
    return Number(m[1] || 1) * Math.sqrt(Number(m[2]))
  }

  it('every accepted surd form is the true length worked from the prompt', () => {
    for (const id of ['q12', 'q13']) {
      for (const b of build('exact-trigonometric-values', id)) {
        const p = b.question.prompt
        let want: number
        const hyp = p.match(/hypotenuse (\d+)/)
        const angle = Number(p.match(/angle of (\d+)°/)![1])
        if (hyp) {
          const h = Number(hyp[1])
          want = /opposite/.test(p) ? h * Math.sin(angle * RAD) : h * Math.cos(angle * RAD)
        } else if (/each of its shorter sides is (\d+)/.test(p)) want = Number(p.match(/each of its shorter sides is (\d+)/)![1]) * Math.SQRT2
        else {
          const k = Number(p.match(/ is (\d+) /)![1])
          want = /side adjacent to it/.test(p) ? k * tan(angle) : k / tan(angle)
        }
        for (const a of accepted(b)) expect(surdValue(a), `${p} ${a}`).toBeCloseTo(want, 9)
        // A decimal is not the exact form asked for.
        expect(mark(b.question, want.toFixed(2)).correct).toBe(false)
      }
    }
  })

  it('every accepted surd in Pythagoras is the true side, and simplest form refuses the unsimplified root', () => {
    for (const id of ['q19', 'q20']) {
      for (const b of build('pythagoras-in-2d', id)) {
        const [x, y] = numbers(b)
        const want = /hypotenuse \d+/.test(b.question.prompt) ? Math.sqrt(x! ** 2 - y! ** 2) : Math.hypot(x!, y!)
        for (const a of accepted(b)) expect(surdValue(a)).toBeCloseTo(want, 9)
        if (id === 'q20') expect(mark(b.question, `√${Math.round(want * want)}`).correct).toBe(false)
      }
    }
  })

  /** The printed KaTeX expression evaluated with the calculator's sin, cos and tan. */
  function evaluate(tex: string): number {
    const js = tex
      .replace(/(\d*)\s*\\(sin|cos|tan)(\^2)?\s*(\d+)°/g, (_m, k: string, fn: string, sq: string | undefined, a: string) => `(${k || 1}*Math.${fn}(${a}*${RAD})${sq ? '**2' : ''})`)
      .replace(/\\times/g, '*')
    if (!/^[\d\s.()*+\-a-zA-Z]+$/.test(js)) throw new Error(`cannot evaluate ${tex}`)
    return Function(`return ${js}`)() as number
  }

  it('every exact-value sum and product matches the calculator', () => {
    for (const id of ['q5', 'q11', 'q14', 'q16']) {
      for (const b of build('exact-trigonometric-values', id)) {
        const tex = b.question.prompt.match(/\$(.+)\$/)![1]!
        expect(evaluate(tex), tex).toBeCloseTo(answer(b), 9)
      }
    }
  })
})

describe('trigonometric equations', () => {
  const f = (fn: string, x: number) => (fn === 'sin' ? Math.sin(x * RAD) : fn === 'cos' ? Math.cos(x * RAD) : Math.tan(x * RAD))
  /** A true root lies within half a degree of x: f - k changes sign across it. */
  const rootNear = (fn: string, k: number, x: number) => (f(fn, x - 0.5) - k) * (f(fn, x + 0.5) - k) <= 0

  it('every accepted answer rounds a true solution, in the range', () => {
    for (const id of ['q8', 'q12']) {
      for (const b of build('trigonometric-graphs', id)) {
        const m = b.question.prompt.match(/\\(sin|cos|tan) x = (-?[\d.]+)/)!
        const [fn, k] = [m[1]!, Number(m[2])]
        for (const a of accepted(b)) {
          const xs = a.split(',').map((s) => Number(s.trim()))
          expect(xs).toHaveLength(2)
          expect(new Set(xs).size).toBe(2)
          for (const x of xs) {
            expect(x >= 0 && x <= 360).toBe(true)
            expect(rootNear(fn, k, x), `${fn} ${k} ${x}`).toBe(true)
          }
        }
      }
    }
    for (const b of build('trigonometric-graphs', 'q7')) {
      const m = b.question.prompt.match(/\\(sin|cos|tan) x = (-?[\d.]+)\$ is \$x = (\d+)°/)!
      const [fn, k, given] = [m[1]!, Number(m[2]), Number(m[3])]
      expect(answer(b)).not.toBe(given)
      expect(rootNear(fn, k, answer(b))).toBe(true)
    }
  })

  it('tan takes negative values too, solved into the range', () => {
    const ks = build('trigonometric-graphs', 'q12').map((b) => Number(b.values.k))
    expect(ks.some((k) => k < 0) && ks.some((k) => k > 0)).toBe(true)
  })
})

describe('slots sharing a sheet ask different things', () => {
  const sheet = (topicId: string, level: 'core' | 'higher' | 'advanced', seed: string) => {
    const t = raw(topicId)
    const qs = bank(topicId)
    return sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => qs.find((q) => q.id === id)!), seed)
  }
  const values = (items: ReturnType<typeof sheet>, id: string) => items.find((s) => s.question.id === id)!.generated!.values

  it('as the written sheets spread them', () => {
    for (let i = 0; i < 200; i++) {
      const seed = `sheet-${i}`
      // Three space diagonals on one sheet, each in a different setting.
      const py3 = sheet('pythagoras-in-3d', 'higher', seed)
      expect(new Set(['q5', 'q7', 'q9'].map((id) => values(py3, id).context)).size).toBe(3)
      // Two angles with the base, in different settings.
      const t3 = sheet('trigonometry-in-3d', 'higher', seed)
      expect(values(t3, 'q5').context).not.toBe(values(t3, 'q6').context)
      // A back bearing under 180° and one over it.
      const br = sheet('scale-drawings-and-bearings', 'higher', seed)
      expect(Number(values(br, 'q5').forward)).toBeLessThan(180)
      expect(Number(values(br, 'q6').forward)).toBeGreaterThan(180)
      // Real to paper: a whole number of centimetres, then a decimal.
      const q7 = br.find((s) => s.question.id === 'q7')!.question
      const q9 = br.find((s) => s.question.id === 'q9')!.question
      if (q7.type !== 'numeric' || q9.type !== 'numeric') throw new Error('not numeric')
      expect(Number.isInteger(q7.answer)).toBe(true)
      expect(Number.isInteger(q9.answer)).toBe(false)
      // √2 then √3 on the exact-values sheet.
      const ex = sheet('exact-trigonometric-values', 'advanced', seed)
      expect(values(ex, 'q12').m).toBe(2)
      expect(values(ex, 'q13').m).toBe(3)
      // An acute area and an obtuse one.
      const sr = sheet('sine-rule-cosine-rule-and-area', 'higher', seed)
      expect(Number(values(sr, 'q7').C)).toBeLessThan(90)
      expect(Number(values(sr, 'q9').C)).toBeGreaterThan(90)
    }
  })

  it('each structural variant turns up across attempts', () => {
    const seen = (topicId: string, id: string, key: string) => new Set(build(topicId, id, 200).map((b) => String(b.values[key])))
    expect(seen('properties-of-angles', 'q11', 'from')).toEqual(new Set(['interior', 'exterior']))
    expect(seen('properties-of-2d-shapes', 'q4', 'find')).toEqual(new Set(['top', 'base']))
    expect(seen('properties-of-2d-shapes', 'q15', 'given')).toEqual(new Set(['opposite', 'neighbouring']))
    expect(seen('properties-of-2d-shapes', 'q22', 'asked')).toEqual(new Set(['ABC', 'BCD']))
    expect(seen('circle-theorems', 'q1', 'find')).toEqual(new Set(['centre', 'circumference']))
    expect(seen('pythagoras-in-2d', 'q19', 'add')).toEqual(new Set(['add', 'subtract']))
    expect(seen('exact-trigonometric-values', 'q13', 'kind')).toEqual(new Set(['0', '1', '2', '3']))
    expect(seen('trigonometric-graphs', 'q7', 'fn')).toEqual(new Set(['sin', 'cos', 'tan']))
    expect(seen('sine-rule-cosine-rule-and-area', 'q14', 'possible')).toEqual(new Set(['yes', 'no']))
  })
})

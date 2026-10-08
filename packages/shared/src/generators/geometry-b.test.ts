import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../content/questions.ts'
import { roundTo } from './format.ts'
import { GENERATORS, generate, sheetQuestions } from './index.ts'
import { countFaces, polyhedron } from './maths/mensuration.ts'
import type { Generated } from './types.ts'

/**
 * Structural checks for the mensuration, similarity, congruency, transformation,
 * construction and vector generators. The release check proves each answer agrees with the
 * generator's own second method; these work each answer out again here from the numbers the
 * generator drew, and check the route the solution takes: an area scales by k² and a volume
 * by k³, a sector is angle/360 of its circle, every exact-π form is the right number.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content')
const topicFile = (topicId: string) => JSON.parse(readFileSync(join(ROOT, 'maths', `${topicId}.json`), 'utf8'))
const bank = (topicId: string) => Question.array().parse(topicFile(topicId).questions)
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
const text = (b: Generated) => {
  if (b.question.type !== 'short-text') throw new Error('not short-text')
  return b.question.accepted
}
const v = (b: Generated, key: string) => Number(b.values[key])
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))

/** The value of an accepted exact form: 12π, 12π cm², 608π/3, (608/3)π. Undefined if it is none of them. */
function piValue(form: string): number | undefined {
  const s = form.replace(/\s*(?:cm|m|mm)[²³]$/, '')
  let m = s.match(/^(\d+)π$/)
  if (m) return Number(m[1]) * Math.PI
  m = s.match(/^(\d+)π\/3$/)
  if (m) return (Number(m[1]) * Math.PI) / 3
  m = s.match(/^\((\d+)\/3\)π$/)
  if (m) return (Number(m[1]) / 3) * Math.PI
  return undefined
}

describe('exact answers in terms of π', () => {
  it('a sector area: every accepted form is angle/360 of πr²', () => {
    for (const b of build('sector-area-exact', 'q19')) {
      const want = (v(b, 'angle') / 360) * Math.PI * v(b, 'r') ** 2
      for (const a of text(b)) expect(close(piValue(a)!, want), `${b.seed}: ${a}`).toBe(true)
      expect(text(b)).toHaveLength(2)
    }
  })

  it('a cylinder volume: every accepted form is πr²h', () => {
    for (const b of build('cylinder-volume-exact', 'q19')) {
      const want = Math.PI * v(b, 'r') ** 2 * v(b, 'h')
      for (const a of text(b)) expect(close(piValue(a)!, want), `${b.seed}: ${a}`).toBe(true)
    }
  })

  it('a composite volume: both accepted forms are the sum of the two parts, and a true fraction', () => {
    for (const b of build('composite-solid', 'q20')) {
      const [r, h, H] = [v(b, 'r'), v(b, 'h'), v(b, 'H')]
      const cylinder = Math.PI * r * r * h
      const cone = (Math.PI * r * r * H) / 3
      const hemisphere = (2 / 3) * Math.PI * r ** 3
      const want = b.values.shape === 'cylinder-hemisphere' ? cylinder + hemisphere : b.values.shape === 'cylinder-cone' ? cylinder + cone : cone + hemisphere
      const forms = text(b)
      expect(forms).toHaveLength(2)
      for (const a of forms) expect(close(piValue(a)!, want), `${b.seed}: ${a}`).toBe(true)
      // "As a single fraction": the answer is not a whole number of π.
      expect(Number.isInteger(want / Math.PI + 1e-12) && Math.abs(want / Math.PI - Math.round(want / Math.PI)) < 1e-9).toBe(false)
      expect(b.question.solution).toContain('common denominator')
    }
  })

  it('every composite shape turns up', () => {
    expect(new Set(build('composite-solid', 'q20').map((b) => b.values.shape))).toEqual(new Set(['cylinder-hemisphere', 'cylinder-cone', 'cone-hemisphere']))
  })
})

describe('arcs and sectors', () => {
  it('each answer is angle/360 of the circle, plus two radii for a perimeter, and the solution says so', () => {
    for (const [slot, task] of [['q3', 'arc'], ['q5', 'area'], ['q6', 'area'], ['q7', 'perimeter']] as const) {
      for (const b of build('sector-measures', slot)) {
        const [r, angle] = [v(b, 'r'), v(b, 'angle')]
        expect(b.values.task).toBe(task)
        const f = angle / 360
        const want = task === 'arc' ? f * 2 * Math.PI * r : task === 'area' ? f * Math.PI * r * r : f * 2 * Math.PI * r + 2 * r
        expect(num(b), b.seed).toBe(roundTo(want, 2))
        expect(b.question.solution).toContain(`\\frac{${angle}}{360}`)
        if (task === 'perimeter') expect(b.question.solution).toContain('both radii')
      }
    }
  })

  it('a semicircle adds its diameter and a quadrant its two radii', () => {
    const shapes = new Set<string>()
    for (const b of build('semicircle-perimeter', 'q15')) {
      const size = v(b, 'size')
      const shape = String(b.values.shape)
      shapes.add(shape)
      const r = shape === 'semicircle-diameter' ? size / 2 : size
      const want = shape === 'quadrant' ? (Math.PI * r) / 2 + 2 * r : Math.PI * r + 2 * r
      expect(num(b), b.seed).toBe(roundTo(want, 2))
      // Not the arc alone.
      expect(num(b)).toBeGreaterThan(roundTo(want - 2 * r, 2))
    }
    expect(shapes).toEqual(new Set(['semicircle-radius', 'semicircle-diameter', 'quadrant']))
  })

  it('the angle from an arc or area in π is the one the sector was built with', () => {
    for (const b of build('sector-angle-from-pi', 'q11')) {
      const [r, angle, k] = [v(b, 'r'), v(b, 'angle'), v(b, 'k')]
      expect(num(b)).toBe(angle)
      const given = b.values.kind === 'arc' ? (angle / 360) * 2 * r : (angle / 360) * r * r
      expect(close(given, k), b.seed).toBe(true)
      expect(b.question.prompt).toContain(`${k}\\pi`)
    }
  })
})

describe('surface area and volume', () => {
  it('a cylinder: q1 is πr²h and q5 is 2πrh', () => {
    for (const b of build('cylinder-measures', 'q1')) expect(num(b), b.seed).toBe(roundTo(Math.PI * v(b, 'r') ** 2 * v(b, 'h'), 1))
    for (const b of build('cylinder-measures', 'q5')) expect(num(b), b.seed).toBe(roundTo(2 * Math.PI * v(b, 'r') * v(b, 'h'), 1))
  })

  it('a sphere uses the radius, halving a diameter first', () => {
    for (const b of build('sphere-volume', 'q6')) {
      expect(num(b), b.seed).toBe(roundTo((4 / 3) * Math.PI * v(b, 'r') ** 3, 1))
      if (b.values.given === 'diameter') {
        expect(b.question.prompt).toContain(`diameter ${2 * v(b, 'r')}`)
        expect(b.question.solution).toContain('half the diameter')
      }
    }
  })

  it('a cone: the slant height is the hypotenuse, and the curved surface uses it, not the vertical height', () => {
    for (const b of build('cone-slant-height', 'q8')) {
      const [r, h, l] = [v(b, 'r'), v(b, 'h'), v(b, 'l')]
      expect(r * r + h * h).toBe(l * l)
      expect(num(b)).toBe(b.values.find === 'slant' ? l : h)
    }
    for (const b of build('cone-curved-surface', 'q11')) {
      const [r, h, l] = [v(b, 'r'), v(b, 'h'), v(b, 'l')]
      expect(num(b), b.seed).toBe(roundTo(Math.PI * r * Math.hypot(r, h), 1))
      expect(num(b)).not.toBe(roundTo(Math.PI * r * h, 1))
      expect(l * l).toBe(r * r + h * h)
    }
  })

  it('a pyramid is a third of the cuboid on its base', () => {
    for (const b of build('pyramid-volume', 'q9')) expect(num(b) * 3, b.seed).toBe(v(b, 'a') * v(b, 'b') * v(b, 'h'))
  })

  it('a composite volume is its two parts, each worked out here from its own formula', () => {
    for (const b of build('composite-solid', 'q12')) {
      const [r, h, H] = [v(b, 'r'), v(b, 'h'), v(b, 'H')]
      // Hemisphere as a cylinder r high less a cone r high (Archimedes), cone as a third of its cylinder.
      const hemisphere = Math.PI * r ** 3 - (Math.PI * r ** 3) / 3
      const cone = (Math.PI * r * r * H) / 3
      const cylinder = Math.PI * r * r * h
      const want = b.values.shape === 'cylinder-hemisphere' ? cylinder + hemisphere : b.values.shape === 'cylinder-cone' ? cylinder + cone : cone + hemisphere
      expect(num(b), b.seed).toBe(roundTo(want, 1))
    }
  })

  it('a composite surface has no joining circle', () => {
    for (const b of build('composite-solid', 'q16')) {
      const [r, h, H] = [v(b, 'r'), v(b, 'h'), v(b, 'H')]
      const l = Math.sqrt(r * r + H * H)
      const faces = b.values.shape === 'cylinder-hemisphere' ? [2 * r * h, r * r, 2 * r * r] : b.values.shape === 'cylinder-cone' ? [2 * r * h, r * r, r * l] : [r * l, 2 * r * r]
      const want = faces.reduce((s, f) => s + f * Math.PI, 0)
      expect(num(b), b.seed).toBe(roundTo(want, 1))
      // With the joining circle counted twice more it would be bigger by 2πr².
      expect(num(b)).not.toBe(roundTo(want + 2 * Math.PI * r * r, 1))
      expect(b.question.solution).toContain('no joining circle')
    }
  })
})

describe('3D shapes', () => {
  it('prisms and pyramids are counted from the solid itself', () => {
    for (const slot of ['q4', 'q6', 'q7', 'q8']) {
      for (const b of build('solid-counts', slot)) {
        const kind = b.values.kind as 'prism' | 'pyramid'
        expect(kind).toBe(slot === 'q4' || slot === 'q7' ? 'prism' : 'pyramid')
        const counts = countFaces(polyhedron(kind, v(b, 'n')))
        expect(num(b), b.seed).toBe(counts[b.values.count as 'faces' | 'edges' | 'vertices'])
      }
    }
  })

  it('the two count slots on a sheet ask for different counts, and every count turns up', () => {
    const t = topicFile('3d-shapes-plans-and-elevations')
    const written = bank('3d-shapes-plans-and-elevations')
    for (const level of ['core', 'higher'] as const) {
      const ids: string[] = t.worksheets[level].questionIds
      const firsts = new Set<string>()
      for (let i = 0; i < 100; i++) {
        const items = sheetQuestions('maths', '3d-shapes-plans-and-elevations', ids.map((id) => written.find((q) => q.id === id)!), `sheet-${i}`)
        const counts = items.filter((s) => s.generated?.generatorId === 'solid-counts').map((s) => s.generated!.values.count)
        expect(counts).toHaveLength(2)
        expect(new Set(counts).size).toBe(2)
        firsts.add(String(counts[0]))
      }
      expect(firsts.size).toBe(3)
    }
  })

  it("Euler's formula: the solid named in the solution has the counts in the prompt", () => {
    for (const b of build('euler-formula', 'q15')) {
      const F = Number(b.values.F ?? NaN), V = Number(b.values.V ?? NaN), E = Number(b.values.E ?? NaN)
      const answer = num(b)
      const full = { F: b.values.unknown === 'faces' ? answer : F, V: b.values.unknown === 'vertices' ? answer : V, E: b.values.unknown === 'edges' ? answer : E }
      expect(full.F + full.V - full.E, b.seed).toBe(2)
    }
  })

  it('a count from another count rebuilds the base it came from', () => {
    for (const [slot, kind] of [['q16', 'pyramid'], ['q17', 'prism']] as const) {
      for (const b of build('reverse-counts', slot)) {
        expect(b.values.kind).toBe(kind)
        const counts = countFaces(polyhedron(kind, v(b, 'n')))
        expect(b.question.prompt).toContain(`has ${counts[b.values.given as 'faces']} ${b.values.given}`)
        expect(num(b)).toBe(counts[b.values.wanted as 'faces'])
      }
    }
  })

  it('an L-shaped prism is its cross-section times its depth, not the bounding box', () => {
    for (const b of build('prism-from-views', 'q13')) {
      const [W, a, w, bb, D] = ['W', 'a', 'w', 'b', 'D'].map((k) => v(b, k)) as [number, number, number, number, number]
      expect(num(b)).toBe((W * a + w * bb) * D)
      expect(num(b)).toBeLessThan(W * (a + bb) * D)
    }
  })

  it('a cylinder from its views uses half the rectangle side as the radius', () => {
    for (const b of build('cylinder-from-views', 'q23')) {
      const [d, h] = [v(b, 'd'), v(b, 'h')]
      expect(num(b), b.seed).toBe(roundTo(Math.PI * (d / 2) ** 2 * h, 1))
      expect(b.question.prompt).toContain(b.values.standing === 'end' ? `${d} cm wide and ${h} cm tall` : `${h} cm wide and ${d} cm tall`)
    }
  })
})

describe('area and volume scale factors', () => {
  it('an area scales by k² and a volume by k³, the solution shows that power, and k alone gives another answer', () => {
    for (const [id, slot, power] of [['enlarged-area-volume', 'q5', 3], ['enlarged-area-volume', 'q6', 2], ['enlarged-area-volume', 'q16', 2]] as const) {
      for (const b of build(id, slot)) {
        const [k, before] = [v(b, 'k'), v(b, 'before')]
        expect(v(b, 'power')).toBe(power)
        expect(close(num(b), before * k ** power), b.seed).toBe(true)
        expect(b.question.solution).toContain(`^${power}`)
        expect(close(v(b, 'wrong'), num(b))).toBe(false)
      }
    }
    for (const [slot, power] of [['q12', 2], ['q16', 3]] as const) {
      for (const b of build('similar-area-volume', slot)) {
        const [k, small] = [v(b, 'k'), v(b, 'small')]
        const large = small * k ** power
        expect(close(num(b), b.values.direction === 'down' ? small : large), b.seed).toBe(true)
        expect(b.question.solution).toContain(`^${power}`)
        expect(close(small * k, large)).toBe(false)
      }
    }
  })

  it('a length from areas takes the square root, and from volumes the cube root', () => {
    for (const b of build('scale-from-ratio', 'q11')) {
      const [m, n, t] = [v(b, 'm'), v(b, 'n'), v(b, 't')]
      expect(num(b)).toBe(b.values.direction === 'up' ? n * t : m * t)
      expect(b.question.solution).toContain('\\sqrt')
    }
    for (const b of build('scale-from-ratio', 'q13')) {
      const [m, n] = [v(b, 'm'), v(b, 'n')]
      expect(close(num(b), b.values.direction === 'up' ? n / m : m / n), b.seed).toBe(true)
      expect(b.question.solution).toContain('cube root')
    }
    for (const b of build('side-ratio-from-area', 'q13')) {
      const [a, bb, j] = [v(b, 'a'), v(b, 'b'), v(b, 'j')]
      expect(num(b)).toBe((b.values.unknown === 'left' ? a : bb) * j)
    }
    for (const b of build('height-from-volumes', 'q14')) {
      const [m, n, t] = [v(b, 'm'), v(b, 'n'), v(b, 't')]
      expect(num(b)).toBe(b.values.direction === 'to small' ? n * t : m * t)
      expect(b.question.solution).toContain('cube root')
    }
  })
})

describe('similarity and linear scale factors', () => {
  it('the linear scale factor divides matching sides', () => {
    for (const b of build('linear-scale-factor', 'q2')) {
      const sides = String(b.values.sides).split(',').map(Number)
      for (const s of sides) expect(b.question.prompt).toContain(String(roundTo(s * num(b), 1)))
    }
    for (const b of build('linear-scale-factor', 'q4')) expect(b.question.prompt).toContain(`${v(b, 's')} cm and ${roundTo(v(b, 's') * num(b), 1)} cm`)
  })

  it('q5 has a whole factor, q6 a reduction and q8 a decimal one', () => {
    for (const b of build('similar-missing-side', 'q5')) expect(Number.isInteger(v(b, 'k'))).toBe(true)
    for (const b of build('similar-missing-side', 'q6')) {
      expect(v(b, 'p')).toBeLessThan(v(b, 'q'))
      expect(num(b)).toBe((v(b, 'other') * v(b, 'p')) / v(b, 'q'))
    }
    for (const b of build('similar-missing-side', 'q8')) {
      expect(Number.isInteger(v(b, 'k'))).toBe(false)
      expect(close(num(b), v(b, 's2') * v(b, 'k'))).toBe(true)
    }
  })

  it('a parallel line uses both distances from the apex, adding when one is from the base', () => {
    for (const b of build('parallel-line-triangle', 'q11')) {
      const [d1, d2, s] = [v(b, 'd1'), v(b, 'd2'), v(b, 's')]
      const want = b.values.direction === 'to large' ? (s * d2) / d1 : (s * d1) / d2
      expect(close(num(b), want), b.seed).toBe(true)
      if (b.values.fromBase === 'base') {
        expect(b.question.prompt).toContain(`${d2 - d1} cm from the base`)
        expect(b.question.solution).toContain(`${d1} + ${d2 - d1} = ${d2}`)
      }
    }
  })
})

describe('congruency', () => {
  it('the matching angle is the third angle at the vertex the equal sides pair with it', () => {
    for (const b of build('congruent-angle', 'q7')) {
      const letters = String(b.values.letters)
      const from = letters.slice(0, 3)
      const to = letters.slice(3)
      const missing = String(b.values.missing)
      // The prompt names an angle in the second triangle, matched to the missing one.
      const asked = b.question.prompt.match(/Work out angle \$(\w)\$/)![1]!
      expect(to.indexOf(asked)).toBe(from.indexOf(missing))
      const given = [...b.question.prompt.matchAll(/= (\d+)°/g)].map((m) => Number(m[1]))
      expect(num(b)).toBe(180 - given[0]! - given[1]!)
    }
  })

  it('the matching side is the images of its two letters', () => {
    for (const b of build('congruent-side', 'q8')) {
      const letters = String(b.values.letters)
      const map = new Map([...letters.slice(0, 3)].map((ch, i) => [ch, letters[3 + i]!]))
      const [p, q] = [...String(b.values.side)] as [string, string]
      expect(text(b)).toEqual([`${map.get(p)}${map.get(q)}`, `${map.get(q)}${map.get(p)}`])
    }
  })

  it('RHS: the asked side is the leg not given, by Pythagoras in the second triangle', () => {
    for (const b of build('congruent-rhs', 'q12')) {
      const [a, bb, c] = [v(b, 'a'), v(b, 'b'), v(b, 'c')]
      const given = b.values.given === 'QR' ? bb : a
      expect(num(b)).toBe(Math.sqrt(c * c - given * given))
    }
  })
})

describe('transformations and constructions', () => {
  it('each slot keeps its transformation, and an enlargement is measured from its centre', () => {
    for (const b of build('transform-a-point', 'q3')) expect(text(b)).toEqual([`(${v(b, 'x') + v(b, 'p')},${v(b, 'y') + v(b, 'q')})`])
    for (const b of build('transform-a-point', 'q7')) expect(text(b)).toEqual([`(${v(b, 'x') * v(b, 'k')},${v(b, 'y') * v(b, 'k')})`])
    for (const b of build('transform-a-point', 'q12')) {
      const [x, y, k, cx, cy] = ['x', 'y', 'k', 'cx', 'cy'].map((key) => v(b, key)) as [number, number, number, number, number]
      expect(cx !== 0 || cy !== 0).toBe(true)
      expect(text(b)).toEqual([`(${cx + k * (x - cx)},${cy + k * (y - cy)})`])
      expect(text(b)[0]).not.toBe(`(${k * x},${k * y})`)
    }
  })

  it('a right-angled triangle from three sides has half the two shorter sides as its area', () => {
    for (const b of build('right-triangle-area', 'q13')) {
      const [l1, l2] = String(b.values.legs).split(',').map(Number) as [number, number]
      expect(l1 * l1 + l2 * l2).toBe(v(b, 'hyp') ** 2)
      expect(num(b)).toBe((l1 * l2) / 2)
      expect(b.question.solution).toContain(`angle at $${b.values.right}$ is $90°$`)
    }
  })

  it('a scale drawing multiplies to real life and divides back', () => {
    for (const b of build('scale-drawing-length', 'q7')) {
      const [n, drawn] = [v(b, 'n'), v(b, 'drawn')]
      expect(close(num(b), b.values.direction === 'to real' ? drawn * n : drawn)).toBe(true)
    }
  })
})

describe('vectors', () => {
  it('every answer is p·a + q·b worked out by components, and each slot keeps its combination', () => {
    const kinds: Record<string, string> = { q2: 'sum', q4: 'multiple', q5: 'difference', q11: 'mixed' }
    for (const slot of Object.keys(kinds)) {
      for (const b of build('vector-combination', slot)) {
        expect(b.values.kind).toBe(kinds[slot])
        const [ax, ay] = String(b.values.a).split(',').map(Number) as [number, number]
        const [bx, by] = String(b.values.b).split(',').map(Number) as [number, number]
        const [p, q] = [v(b, 'p'), v(b, 'q')]
        const x = p * ax + q * bx
        const y = p * ay + q * by
        expect(text(b), b.seed).toEqual([`${x}, ${y}`, `(${x}, ${y})`])
        if (kinds[slot] === 'sum') expect([p, q]).toEqual([1, 1])
        if (kinds[slot] === 'difference') expect([p, q]).toEqual([1, -1])
        if (kinds[slot] === 'multiple') expect(q).toBe(0)
        if (kinds[slot] === 'mixed') expect(Math.abs(p) > 1 || Math.abs(q) > 1).toBe(true)
      }
    }
  })

  it('a magnitude is √(x² + y²), exact for a triple and to 1 decimal place otherwise', () => {
    const kinds = new Set<string>()
    for (const b of build('vector-magnitude', 'q7')) {
      const m = Math.hypot(v(b, 'x'), v(b, 'y'))
      kinds.add(String(b.values.whole))
      expect(num(b), b.seed).toBe(b.values.whole === 'triple' ? m : roundTo(m, 1))
    }
    expect(kinds).toEqual(new Set(['triple', 'rounded']))
  })
})

describe('slots on one sheet keep their own task', () => {
  const sheet = (topicId: string, level: 'core' | 'higher' | 'advanced', seed: string) => {
    const t = topicFile(topicId)
    const written = bank(topicId)
    return sheetQuestions('maths', topicId, t.worksheets[level].questionIds.map((id: string) => written.find((q) => q.id === id)!), seed)
  }
  const tasks = (items: ReturnType<typeof sheet>, generatorId: string, key: string) =>
    items.filter((s) => s.generated?.generatorId === generatorId).map((s) => `${s.question.id}:${s.generated!.values[key]}`)

  it('as the written sheets spread them', () => {
    for (let i = 0; i < 50; i++) {
      expect(tasks(sheet('arc-length-and-sector-area', 'higher', `s-${i}`), 'sector-measures', 'task')).toEqual(['q5:area', 'q6:area', 'q7:perimeter'])
      expect(tasks(sheet('surface-areas-and-volumes', 'advanced', `s-${i}`), 'composite-solid', 'task')).toEqual(['q12:volume', 'q16:surface', 'q20:exact'])
      expect(tasks(sheet('area-and-volume-scale-factors', 'higher', `s-${i}`), 'enlarged-area-volume', 'kind')).toEqual(['q5:volume', 'q6:area'])
      expect(tasks(sheet('similarity-and-linear-scale-factors', 'advanced', `s-${i}`), 'similar-area-volume', 'kind')).toEqual(['q12:area', 'q16:volume'])
      expect(tasks(sheet('transformations', 'core', `s-${i}`), 'transform-a-point', 'kind')).toEqual(['q3:translation'])
      expect(tasks(sheet('vector-arithmetic', 'core', `s-${i}`), 'vector-combination', 'kind')).toEqual(['q2:sum', 'q4:multiple'])
    }
  })
})

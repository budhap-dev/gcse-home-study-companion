import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, generatorFor, sheetQuestions } from '../index.ts'
import { evalTex } from '../maths/formulae.ts'
import type { Generated } from '../types.ts'
import { AREA_K, NAMED } from './transformations.ts'

/**
 * Structural tests for the Further Maths transformations-of-the-unit-square generators (8365
 * 5.1, 5.3, 5.4). The prompt's points, matrices and named transformations are read back with
 * this file's own rules ((x, y) → (−y, x) written out by hand, not the generator's cos and
 * sin), the answer worked again here (a preimage by searching the grid, an area by the
 * determinant, a product by sending (1, 0) and (0, 1) through both rules), every printed
 * product line evaluated, and the named wrong routes (direction reversed, the order reversed,
 * row times row, y = x for y = −x, the length factor or perimeter for the area) shown to differ.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'transformations-of-the-unit-square'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const POINT = 'fm-image-of-a-point'
const AREA = 'fm-unit-square-area'
const COMBINE = 'fm-combined-transformations'

function build(generatorId: string, slotId: string, count = 300, prefix = 'transform'): Generated[] {
  const g = GENERATORS.find((x) => x.id === generatorId)!
  return Array.from({ length: count }, (_, i) => generate(g, written(slotId), `${prefix}-${i}`))
}

const answer = (b: Generated) => (b.question.type === 'numeric' ? b.question.answer : NaN)
const tally = <K,>(items: Generated[], key: (b: Generated) => K) => {
  const m = new Map<K, number>()
  for (const b of items) m.set(key(b), (m.get(key(b)) ?? 0) + 1)
  return m
}
const top = (m: Map<unknown, number>, n: number) => Math.max(...m.values()) / n
const share = (items: Generated[], pred: (b: Generated) => boolean) => items.filter(pred).length / items.length

type P = [number, number]
type M = [[number, number], [number, number]]
/** The pack's transformations, written out by hand. */
const RULES: [string, (p: P) => P][] = [
  ['$90°$ anticlockwise', ([x, y]) => [-y, x]],
  ['$90°$ clockwise', ([x, y]) => [y, -x]],
  ['$270°$ anticlockwise', ([x, y]) => [y, -x]],
  ['$180°$', ([x, y]) => [-x, -y]],
  ['the line $x = 0$', ([x, y]) => [-x, y]],
  ['the line $y = 0$', ([x, y]) => [x, -y]],
  ['the line $y = x$', ([x, y]) => [y, x]],
  ['the line $y = -x$', ([x, y]) => [-y, -x]],
]
function ruleIn(text: string): { name: string; f: (p: P) => P } {
  const found = RULES.filter(([name]) => text.includes(name))
  if (found.length !== 1) throw new Error(`not one transformation in: ${text}`)
  return { name: found[0]![0], f: found[0]![1] }
}
const z = (n: number) => n || 0
const matrixOf = (f: (p: P) => P): M => {
  const [a, c] = f([1, 0])
  const [b, d] = f([0, 1])
  return [[z(a), z(b)], [z(c), z(d)]]
}
const matricesIn = (text: string): M[] =>
  [...text.matchAll(/\\begin\{pmatrix\} (-?\d+) & (-?\d+) \\\\ (-?\d+) & (-?\d+) \\end\{pmatrix\}/g)].map((m) => [[Number(m[1]), Number(m[2])], [Number(m[3]), Number(m[4])]])
const pointIn = (text: string): P => {
  const m = /\((-?\d+), (-?\d+)\)/.exec(text)!
  return [Number(m[1]), Number(m[2])]
}
const askIn = (text: string) => /\$([xy])\$-coordinate/.exec(text)![1] as 'x' | 'y'
const at = (p: P, ask: 'x' | 'y') => p[ask === 'x' ? 0 : 1]
/** Entry (i, j) of AB, summed by hand. */
const entry = (A: M, B: M, i: number, j: number) => z(A[i]![0] * B[0][j]! + A[i]![1] * B[1][j]!)
const transpose = (A: M): M => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]]

/** Each "$… \times … = n$" in a text: the left side evaluated and compared with n. */
function productLines(text: string): { lhs: string; rhs: number }[] {
  return [...text.matchAll(/\$([^$]*\\times[^$]*) = (-?\d+)\$/g)].map((m) => ({ lhs: m[1]!, rhs: Number(m[2]) }))
}

function common(generatorId: string, slotId: string, built: Generated[], minDistinct = 10) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an) \$\d/)
    expect(q.prompt, b.seed).not.toMatch(/\+ -|- -/)
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b)).replace('-', '−')).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(mark(q, String(-answer(b))).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    expect(q.marks).toBe(written(slotId).marks)
    expect(q.markScheme.map((l) => l.code).join()).toBe(written(slotId).markScheme.map((l) => l.code).join())
    expect(q.markScheme.at(-1)!.description, b.seed).not.toMatch(/-/)
    // Every printed product evaluates to what it says.
    for (const { lhs, rhs } of productLines(q.solution)) expect(z(evalTex(lhs)), `${b.seed}: ${lhs}`).toBe(rhs)
  }
  const answers = tally(built, answer)
  expect(top(answers, built.length)).toBeLessThanOrEqual(0.4)
  expect(answers.size).toBeGreaterThanOrEqual(minDistinct)
  const many = build(generatorId, slotId, 1000, 'variety')
  const prompts = tally(many, (b) => b.question.prompt)
  expect(prompts.size).toBeGreaterThan(100)
  expect(top(prompts, many.length)).toBeLessThanOrEqual(0.05)
  expect((prompts.get(written(slotId).prompt) ?? 0) / many.length).toBeLessThanOrEqual(0.05)
}

describe('routing', () => {
  it('sends each slot to its own builder, and leaves q16 written', () => {
    const want: Record<string, string> = { q2: POINT, q14: POINT, q5: AREA, q11: COMBINE }
    for (const [id, g] of Object.entries(want)) expect(generatorFor('further-maths', TOPIC, id)?.id, id).toBe(g)
    for (const id of ['q1', 'q3', 'q4', 'q6', 'q7', 'q8', 'q9', 'q10', 'q12', 'q13', 'q15', 'q16', 'q17', 'q18']) {
      expect(generatorFor('further-maths', TOPIC, id), id).toBeUndefined()
    }
    const keys = (g: string, id: string) => Object.keys(build(g, id, 1)[0]!.values).sort().join()
    expect(keys(POINT, 'q2')).toBe('answer,ask,turn,x,y')
    expect(keys(POINT, 'q14')).toBe('answer,ask,imageX,imageY,turn')
    expect(keys(AREA, 'q5')).toBe('area,form,k')
    expect(keys(COMBINE, 'q11')).toBe('answer,entry,first,k,kind,second')
  })

  it('builds every slot on 3000 seeds, each agreeing with its second route', () => {
    for (const [g, id] of [[POINT, 'q2'], [POINT, 'q14'], [AREA, 'q5'], [COMBINE, 'q11']] as const) {
      const built = build(g, id, 3000, 'many')
      expect(built.filter((b) => !b.check.agrees).map((b) => b.seed), id).toEqual([])
    }
  })

  it("names each transformation's matrix by where it sends (1, 0) and (0, 1)", () => {
    for (const n of Object.values(NAMED)) {
      const text = n.verb
      expect(matrixOf(ruleIn(text).f), n.key).toEqual(n.matrix)
      expect(matrixOf(n.map), n.key).toEqual(n.matrix)
    }
  })
})

describe('fm-image-of-a-point q2: the image of a point under a rotation', () => {
  const built = build(POINT, 'q2')
  it('is the rotated point, read back by hand, never the other direction or the point itself', () => {
    common(POINT, 'q2', built)
    for (const b of built) {
      const p = b.question.prompt
      const point = pointIn(p)
      const { name, f } = ruleIn(p)
      const ask = askIn(p)
      expect(p, b.seed).toMatch(/about the origin/)
      expect(point.every((v) => v !== 0 && Math.abs(v) <= 9), b.seed).toBe(true)
      expect(Math.abs(point[0]), b.seed).not.toBe(Math.abs(point[1]))
      const image = f(point)
      expect(answer(b), b.seed).toBe(at(image, ask))
      // The point unchanged, the other coordinate of the image.
      expect(at(point, ask), b.seed).not.toBe(answer(b))
      expect(at(image, ask === 'x' ? 'y' : 'x'), b.seed).not.toBe(answer(b))
      if (name !== '$180°$') {
        // The turn the other way: clockwise for anticlockwise.
        const back = name === '$90°$ anticlockwise' ? ruleIn('$90°$ clockwise').f : ruleIn('$90°$ anticlockwise').f
        expect(at(back(point), ask), b.seed).not.toBe(answer(b))
      }
      const M = matrixOf(f)
      const br = (n: number) => (n < 0 ? `(${n})` : `${n}`)
      expect(b.question.solution, b.seed).toContain(`$${br(M[0][0])} \\times ${br(point[0])} + ${br(M[0][1])} \\times ${br(point[1])} = ${image[0]}$`)
      expect(b.question.solution, b.seed).toContain(`The image is $(${image[0]}, ${image[1]})$`)
    }
    // Pinned: the written point and turn.
    const w = generate(GENERATORS.find((x) => x.id === POINT)!, written('q2'), 'pin-1919')
    expect(w.question.prompt).toBe("The point $A(3, -2)$ is rotated $90°$ anticlockwise about the origin. Work out the $x$-coordinate of its image, $A'$.")
    expect(w.question.solution).toContain('$0 \\times 3 + (-1) \\times (-2) = 2$ and $1 \\times 3 + 0 \\times (-2) = 3$. The image is $(2, 3)$')
  })
  it('spreads the turns, the coordinate asked and the points', () => {
    const turns = tally(built, (b) => b.values.turn)
    expect(turns.size).toBe(4)
    expect(share(built, (b) => b.values.turn === 'r180')).toBeGreaterThan(0.08)
    expect(share(built, (b) => b.values.turn === 'r180')).toBeLessThan(0.25)
    expect(share(built, (b) => b.values.ask === 'x')).toBeGreaterThan(0.4)
    expect(share(built, (b) => b.values.ask === 'x')).toBeLessThan(0.6)
    expect(tally(built, (b) => `${b.values.x},${b.values.y}`).size).toBeGreaterThan(150)
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.35)
    expect(share(built, (b) => answer(b) > 0)).toBeGreaterThan(0.35)
    for (const t of turns.keys()) expect(tally(built.filter((b) => b.values.turn === t), answer).size, String(t)).toBeGreaterThanOrEqual(10)
  })
})

describe('fm-image-of-a-point q14: a point from its image under a rotation', () => {
  const built = build(POINT, 'q14')
  it('finds the one grid point the rotation sends to the image, never the image turned forwards', () => {
    common(POINT, 'q14', built)
    for (const b of built) {
      const p = b.question.prompt
      const image = pointIn(p)
      const { name, f } = ruleIn(p)
      const ask = askIn(p)
      expect(name, b.seed).not.toBe('$180°$')
      expect(image.every((v) => v !== 0 && Math.abs(v) <= 9), b.seed).toBe(true)
      expect(Math.abs(image[0]), b.seed).not.toBe(Math.abs(image[1]))
      // Search the grid for the preimage.
      const found: P[] = []
      for (let x = -9; x <= 9; x++) for (let y = -9; y <= 9; y++) {
        const q = f([x, y])
        if (q[0] === image[0] && q[1] === image[1]) found.push([x, y])
      }
      expect(found, b.seed).toHaveLength(1)
      expect(answer(b), b.seed).toBe(at(found[0]!, ask))
      // The rotation applied to the image instead of undone, the image read off, its other coordinate.
      expect(at(f(image), ask), b.seed).not.toBe(answer(b))
      expect(at(image, ask), b.seed).not.toBe(answer(b))
      expect(b.question.markScheme.at(-1)!.description, b.seed).toBe(`${ask} = ${String(answer(b)).replace('-', '−')}`)
      expect(b.question.solution, b.seed).toContain(`= (${found[0]![0]}, ${found[0]![1]})$`)
      expect(b.question.solution, b.seed).toContain(`which is the image $(${image[0]}, ${image[1]})$`)
    }
  })
  it('prints the pinned 270° case line for line', () => {
    const b = generate(GENERATORS.find((x) => x.id === POINT)!, written('q14'), 'review-a')
    expect(b.question.prompt).toBe('A rotation of $270°$ anticlockwise about the origin sends the point $P$ to $(1, 3)$. Work out the $x$-coordinate of $P$.')
    expect(b.question.solution).toContain('So $y = 1$ and $-x = 3$, so $x = -3$ and $y = 1$: $P = (-3, 1)$')
    expect(b.question.solution).toContain('Check: $0 \\times (-3) + 1 \\times 1 = 1$ and $(-1) \\times (-3) + 0 \\times 1 = 3$')
    expect(answer(b)).toBe(-3)
  })
  it('spreads the turns, the coordinate asked and the answers', () => {
    expect(tally(built, (b) => b.values.turn).size).toBe(3)
    expect(share(built, (b) => b.values.ask === 'x')).toBeGreaterThan(0.4)
    expect(share(built, (b) => b.values.ask === 'x')).toBeLessThan(0.6)
    expect(share(built, (b) => /sends the point/.test(b.question.prompt))).toBeGreaterThan(0.55)
    expect(share(built, (b) => /Its image is/.test(b.question.prompt))).toBeGreaterThan(0.2)
    for (const t of ['r90', 'r90cw', 'r270']) expect(tally(built.filter((b) => b.values.turn === t), answer).size, t).toBeGreaterThanOrEqual(10)
  })
})

describe('fm-unit-square-area q5: the area of the image', () => {
  const built = build(AREA, 'q5')
  it('is the size of the determinant, never the length factor, the perimeter or a signed area', () => {
    common(AREA, 'q5', built)
    for (const b of built) {
      const [A] = matricesIn(b.question.prompt) as [M]
      const det = A[0][0] * A[1][1] - A[0][1] * A[1][0]
      expect(answer(b), b.seed).toBe(Math.abs(det))
      const entries = A.flat().filter((e) => e !== 0).map(Math.abs)
      expect(entries, b.seed).toHaveLength(2)
      const k = entries[0]!
      expect(entries[1], b.seed).toBe(k)
      expect(k, b.seed).toBeGreaterThanOrEqual(3)
      expect(k, b.seed).toBeLessThanOrEqual(13)
      // The length factor, the perimeter, the sum of the diagonal or of every entry.
      for (const wrong of [k, 4 * k, 2 * k, Math.abs(A[0][0] + A[1][1]), Math.abs(A.flat().reduce((s, e) => s + e, 0))]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(b.question.solution, b.seed).toContain(`$${k}^2 = ${answer(b)}$`)
      expect(b.question.solution, b.seed).toContain(`a square of side $${k}$`)
      expect(A, b.seed).not.toEqual([[3, 0], [0, -3]])
    }
  })
  it('spreads the forms and the scale factors, plain enlargements the most common', () => {
    const forms = tally(built, (b) => b.values.form)
    expect(forms.size).toBe(8)
    // Plain kI about 55%, as the written 2I; −kI about 10%; scaled turns and reflections (q13 and
    // q18's 8-9 idea) about 35% between them.
    const many = build(AREA, 'q5', 2000, 'mix')
    expect(share(many, (b) => b.values.form === 'enlargement')).toBeGreaterThan(0.5)
    expect(share(many, (b) => b.values.form === 'enlargement')).toBeLessThan(0.6)
    expect(share(many, (b) => b.values.form === 'negative')).toBeGreaterThan(0.07)
    expect(share(many, (b) => b.values.form === 'negative')).toBeLessThan(0.13)
    expect(share(many, (b) => !['enlargement', 'negative'].includes(String(b.values.form)))).toBeGreaterThan(0.3)
    expect(share(many, (b) => !['enlargement', 'negative'].includes(String(b.values.form)))).toBeLessThan(0.4)
    expect(tally(many, (b) => b.question.prompt).size).toBeGreaterThan(120)
    expect(tally(many, (b) => b.question.prompt.replace(/\\begin\{pmatrix\}.*?\\end\{pmatrix\}/, 'M')).size).toBe(5)
  })
  it('prints the pinned 6I case line for line', () => {
    const b = generate(GENERATORS.find((x) => x.id === AREA)!, written('q5'), 'review-a')
    expect(b.question.prompt).toBe('The unit square is transformed by the matrix $\\begin{pmatrix} 6 & 0 \\\\ 0 & 6 \\end{pmatrix}$. Work out the area of the image.')
    expect(b.question.solution).toContain('The matrix is $6I$, an enlargement of scale factor $6$ centred on the origin.')
    expect(b.question.solution).toContain('vertices $(0, 0)$, $(6, 0)$, $(6, 6)$ and $(0, 6)$: a square of side $6$')
    expect(b.question.solution).toContain('the area is $6^2 = 36$.')
    expect(tally(built, (b) => b.values.k).size).toBe(10)
    expect(AREA_K).not.toContain(4)
    expect(AREA_K).not.toContain(2)
  })
})

describe('fm-combined-transformations q11: the matrix of a combination', () => {
  const built = build(COMBINE, 'q11')
  const ENTRY = { 'top-left': [0, 0], 'top-right': [0, 1], 'bottom-left': [1, 0], 'bottom-right': [1, 1] } as const
  /** The two transformations in the order performed, as matrices read from the prompt. */
  function steps(prompt: string): [M, M] {
    const parts = prompt.split(' and the image is then ')
    expect(parts).toHaveLength(2)
    return parts.map((part) => matricesIn(part)[0] ?? matrixOf(ruleIn(part.split('. Work out')[0]!).f)) as [M, M]
  }
  it('is the second matrix times the first, never the other way round or row times row', () => {
    common(COMBINE, 'q11', built)
    for (const b of built) {
      const p = b.question.prompt
      const [M1, M2] = steps(p)
      const which = /the (top-left|top-right|bottom-left|bottom-right) entry/.exec(p)![1] as keyof typeof ENTRY
      const [i, j] = ENTRY[which]
      // Second route: (1, 0) or (0, 1) through the first, then the second, as points.
      const apply = (A: M, v: P): P => [z(A[0][0] * v[0] + A[0][1] * v[1]), z(A[1][0] * v[0] + A[1][1] * v[1])]
      const col = apply(M2, apply(M1, j === 0 ? [1, 0] : [0, 1]))
      expect(answer(b), b.seed).toBe(col[i])
      expect(answer(b), b.seed).not.toBe(0)
      // The first is a quarter turn (antisymmetric), the second a reflection (symmetric).
      expect(M1[0][0] === 0 && M1[1][1] === 0 && M1[0][1] === -M1[1][0], b.seed).toBe(true)
      expect(M2[0][1] === M2[1][0] && Math.abs(M2[0][0]) === Math.abs(M2[1][1]), b.seed).toBe(true)
      expect(M2[0][0] === 0 ? 'diagonal mirror' : M2[0][0] === -M2[1][1] ? 'axis mirror' : 'neither', b.seed).not.toBe('neither')
      // The order reversed, row times row, the turn's direction reversed, the other mirror line.
      const neg = (A: M): M => [[-A[0][0], -A[0][1]], [-A[1][0], -A[1][1]]]
      // (A quarter turn the other way is −M₁; the other mirror line through the origin, −M₂.)
      const wrongs = [entry(M1, M2, i, j), entry(M2, transpose(M1), i, j), entry(M2, neg(M1), i, j), entry(neg(M2), M1, i, j)]
      for (const w of wrongs) expect(w, b.seed).not.toBe(answer(b))
      // Never q13's answer (0 −2; 2 0) or q18's matrix (3 0; 0 −3), both later on this sheet.
      for (const A of matricesIn(p)) {
        expect(A, b.seed).not.toEqual([[0, -2], [2, 0]])
        expect(A, b.seed).not.toEqual([[3, 0], [0, -3]])
      }
      const P: M = [[entry(M2, M1, 0, 0), entry(M2, M1, 0, 1)], [entry(M2, M1, 1, 0), entry(M2, M1, 1, 1)]]
      expect(b.question.solution, b.seed).toContain(`So $M_2 M_1 = \\begin{pmatrix} ${P[0][0]} & ${P[0][1]} \\\\ ${P[1][0]} & ${P[1][1]} \\end{pmatrix}$`)
      expect(productLines(b.question.solution), b.seed).toHaveLength(4)
      expect(b.question.markScheme[0]!.description).toBe('M₂M₁ with the matrices the right way round')
    }
  })
  it('spreads the kinds, the entries and the answers within each kind', () => {
    for (const kind of ['named', 'matrix first', 'matrix second']) {
      const part = built.filter((b) => b.values.kind === kind)
      expect(part.length / built.length, kind).toBeGreaterThan(0.2)
      expect(tally(part, (b) => b.values.entry).size, kind).toBe(4)
      if (kind === 'named') {
        expect(new Set(part.map(answer))).toEqual(new Set([1, -1]))
        expect(share(part, (b) => answer(b) === 1)).toBeGreaterThan(0.3)
      } else {
        expect(tally(part, answer).size, kind).toBeGreaterThanOrEqual(10)
        expect(top(tally(part, answer), part.length), kind).toBeLessThanOrEqual(0.15)
      }
    }
    expect(tally(built, (b) => `${b.values.first}>${b.values.second}`).size).toBe(12)
  })
  /** Neither the prompt nor the solution prints q13's answer (0 −2; 2 0) or q18's matrix and description. */
  const gives = (q: { prompt: string; solution: string }, seed: string) => {
    for (const text of [q.prompt, q.solution]) {
      expect(text, seed).not.toContain('\\begin{pmatrix} 0 & -2 \\\\ 2 & 0 \\end{pmatrix}')
      expect(text, seed).not.toContain('\\begin{pmatrix} 3 & 0 \\\\ 0 & -3 \\end{pmatrix}')
      // q18's correct option in words. "y = 0" can still name the given mirror line, with the
      // scale factor 3 belonging to a different product.
      expect(text, seed).not.toMatch(/reflection in the line \$y = 0\$ combined with an enlargement of scale factor \$3\$/)
    }
  }
  it('keeps the advanced sheet from printing what q13 and q18 ask', () => {
    const sheet = topic.worksheets.advanced.questionIds.map(written)
    for (let n = 0; n < 200; n++) {
      const s = sheetQuestions('further-maths', TOPIC, sheet, `sheet-${n}`)
      gives(s.find((x) => x.question.id === 'q11')!.question, `sheet-${n}`)
    }
    for (const b of build(COMBINE, 'q11', 3000, 'giveaway')) gives(b.question, b.seed)
  })
  it('prints the pinned named case line for line', () => {
    const b = generate(GENERATORS.find((x) => x.id === COMBINE)!, written('q11'), 'review-a')
    expect(b.question.prompt).toBe('The unit square is rotated $90°$ clockwise about the origin and the image is then reflected in the line $y = -x$. Work out the top-left entry of the matrix of the single equivalent transformation.')
    expect(b.question.solution).toContain('top left $0 \\times 0 + (-1) \\times (-1) = 1$, top right $0 \\times 1 + (-1) \\times 0 = 0$')
    expect(b.question.solution).toContain('So $M_2 M_1 = \\begin{pmatrix} 1 & 0 \\\\ 0 & -1 \\end{pmatrix}$, and the top-left entry is $1$. That matrix is a reflection in the line $y = 0$.')
  })
})

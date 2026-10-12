import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { Question } from '../../content/questions.ts'
import { mark } from '../../marking.ts'
import { GENERATORS, generate, generatorFor, sheetQuestions } from '../index.ts'
import type { Generated } from '../types.ts'
import { FINITE_ORDER } from './matrices.ts'

/**
 * Structural tests for the Further Maths matrix generators (8365 5.1, 5.2). Each prompt's
 * matrices are read back with this file's own reader and multiplied again here with a sum over
 * k (the generator works entry formulas and checks by images); every printed step of the
 * solution is evaluated with this file's own arithmetic reader; the named wrong routes (AB
 * worked as BA, row with row, column with column, a power taken entry by entry, the scalar
 * added, the determinant for k, the sign of a product dropped) are shown never to pay; and
 * the answers and inputs are shown to spread, per case as well as per slot.
 */
const ROOT = join(import.meta.dirname, '../../../../../supabase/seed/content/further-maths')
const TOPIC = 'matrix-multiplication-and-the-identity'
const topic = JSON.parse(readFileSync(join(ROOT, `${TOPIC}.json`), 'utf8'))
const bank = Question.array().parse(topic.questions)
const written = (id: string) => bank.find((q) => q.id === id)!

const ENTRIES = 'fm-matrix-entries'
const UNKNOWNS = 'fm-matrix-unknowns'
const POWERS = 'fm-matrix-powers'

function build(generatorId: string, slotId: string, count = 300, prefix = 'matrices'): Generated[] {
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

// ---------------------------------------------------------------------------------------
// This file's own readers and arithmetic.
// ---------------------------------------------------------------------------------------

type M2 = number[][]
/** The cells of every pmatrix in a text, row by row: numbers or single letters. */
function cellsOf(text: string): string[][][] {
  const out: string[][][] = []
  let rest = text
  for (;;) {
    const s = rest.indexOf('\\begin{pmatrix}')
    if (s < 0) return out
    const e = rest.indexOf('\\end{pmatrix}', s)
    const body = rest.slice(s + '\\begin{pmatrix}'.length, e)
    out.push(body.split(/\\\\/).map((row) => row.split('&').map((c) => c.replace(/\s/g, ''))))
    rest = rest.slice(e + 1)
  }
}
const num = (cells: string[][]): M2 => cells.map((row) => row.map((c) => {
  expect(c, `cell ${c}`).toMatch(/^-?\d+$/)
  return Number(c)
}))
/** Σ over k of p[i][k] q[k][j]. */
function times(p: M2, q: M2): M2 {
  const rows = p.length
  const cols = q[0]!.length
  const out: M2 = []
  for (let i = 0; i < rows; i++) {
    out.push([])
    for (let j = 0; j < cols; j++) {
      let s = 0
      for (let k = 0; k < q.length; k++) s += p[i]![k]! * q[k]![j]!
      out[i]!.push(s)
    }
  }
  return out
}
const tr = (p: M2): M2 => [[p[0]![0]!, p[1]![0]!], [p[0]![1]!, p[1]![1]!]]
const flat = (p: M2) => p.flat()
const POSITIONS: Record<string, [number, number]> = { 'top-left': [0, 0], 'top-right': [0, 1], 'bottom-left': [1, 0], 'bottom-right': [1, 1] }
const posOf = (text: string) => {
  const m = /the (top-left|top-right|bottom-left|bottom-right) entry/.exec(text)
  expect(m, text).not.toBeNull()
  return POSITIONS[m![1]!]!
}

/**
 * Reads printed arithmetic: whole numbers, single letters, \times, + and −, brackets, implicit
 * products (3a, 2 \times 5). Throws on anything else.
 */
function arith(src: string, vars: Record<string, number> = {}): number {
  const s = src.replace(/\\times/g, '*').replace(/\s+/g, '')
  let i = 0
  const fail = (): never => {
    throw new Error(`cannot read "${src}" at ${i}`)
  }
  const atom = (): number => {
    if (s[i] === '(') {
      i++
      const v = sum()
      if (s[i] !== ')') fail()
      i++
      return v
    }
    if (s[i] === '-') {
      i++
      return -atom()
    }
    const n = /^\d+/.exec(s.slice(i))
    if (n) {
      i += n[0].length
      return Number(n[0])
    }
    if (/[a-z]/.test(s[i] ?? '')) {
      const name = s[i]!
      i++
      if (!(name in vars)) fail()
      return vars[name]!
    }
    return fail()
  }
  const product = (): number => {
    let v = atom()
    for (;;) {
      if (s[i] === '*') {
        i++
        v *= atom()
      } else if (s[i] === '(' || /[a-z]/.test(s[i] ?? '')) v *= atom()
      else return v
    }
  }
  const sum = (): number => {
    let v = product()
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i]
      i++
      const w = product()
      v = op === '+' ? v + w : v - w
    }
    return v
  }
  const v = sum()
  if (i !== s.length) fail()
  return v
}
const mathOf = (text: string) => [...text.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]!)
/** Every printed "lhs = rhs" of plain arithmetic in a text (no matrices), each side read and compared. */
function stepsHold(text: string, vars: Record<string, number> = {}) {
  let n = 0
  for (const m of mathOf(text)) {
    if (m.includes('pmatrix') || m.includes('^') || m.includes('I') || !m.includes(' = ')) continue
    const sides = m.split(' = ')
    const vals = sides.map((side) => arith(side, vars))
    for (const v of vals) expect(v + 0, `${m} in ${text}`).toBe(vals[0]! + 0)
    n++
  }
  return n
}

interface Rules { minDistinct?: number }

function common(generatorId: string, slotId: string, built: Generated[], { minDistinct = 10 }: Rules = {}) {
  for (const b of built) {
    const q = b.question
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \d/)
    expect(q.prompt, b.seed).not.toMatch(/\b(a|A|an|An) \$\d/)
    expect(q.type).toBe('numeric')
    expect(q.type === 'numeric' && q.tolerance, b.seed).toBe(0)
    expect(Number.isInteger(answer(b)), b.seed).toBe(true)
    expect(mark(q, String(answer(b))).correct, b.seed).toBe(true)
    expect(mark(q, String(answer(b) + 1)).correct, b.seed).toBe(false)
    expect(mark(q, String(-answer(b))).correct, b.seed).toBe(false)
    expect(q.solution, b.seed).toContain(String(answer(b)))
    expect(b.check.agrees, `${b.seed}: ${b.check.detail}`).toBe(true)
    // No generated question prints the sheet's A of q9, q12, q17 and q18.
    expect(q.prompt + q.solution, b.seed).not.toContain('\\begin{pmatrix} 2 & 1 \\\\ 3 & 4 \\end{pmatrix}')
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

/** Entries all different in size within a matrix, at most one zero and one negative: as written. */
function fair(m: M2, negatives = 1) {
  const v = flat(m)
  expect(new Set(v.map(Math.abs)).size, v.join()).toBe(4)
  expect(v.filter((x) => x < 0).length, v.join()).toBeLessThanOrEqual(negatives)
}

describe('routing', () => {
  it('sends each slot to its own builder and leaves the rest written', () => {
    const want: Record<string, string> = { q1: ENTRIES, q2: ENTRIES, q4: ENTRIES, q6: ENTRIES, q7: ENTRIES, q8: UNKNOWNS, q10: UNKNOWNS, q14: UNKNOWNS, q11: POWERS, q15: POWERS, q16: POWERS }
    for (const [id, g] of Object.entries(want)) expect(generatorFor('further-maths', TOPIC, id)?.id, id).toBe(g)
    for (const id of ['q3', 'q5', 'q9', 'q12', 'q13', 'q17', 'q18']) expect(generatorFor('further-maths', TOPIC, id), id).toBeUndefined()
    const keys = (g: string, id: string) => Object.keys(build(g, id, 1)[0]!.values).sort().join()
    expect(keys(ENTRIES, 'q1')).toBe('answer,entry,k,pos')
    expect(keys(ENTRIES, 'q2')).toBe('a,answer,entry,v1')
    expect(keys(ENTRIES, 'q4')).toBe('a,answer,b,pos')
    expect(keys(ENTRIES, 'q6')).toBe('answer,names,pos')
    expect(keys(ENTRIES, 'q7')).toBe('a,answer,d,pos')
    expect(keys(UNKNOWNS, 'q8')).toBe('answer,asked,letters,other,pattern,place,terms')
    expect(keys(UNKNOWNS, 'q10')).toBe('a,answer,det,form,other')
    expect(keys(UNKNOWNS, 'q14')).toBe('a,answer,det,form,other')
    expect(keys(POWERS, 'q11')).toBe('a,b,c,k')
    expect(keys(POWERS, 'q15')).toBe('matrix,n')
    expect(keys(POWERS, 'q16')).toBe('answer,n,s,shape')
  })

  it('builds every slot on 3000 seeds, each agreeing with its second route', () => {
    for (const [g, ids] of [[ENTRIES, ['q1', 'q2', 'q4', 'q6', 'q7']], [UNKNOWNS, ['q8', 'q10', 'q14']], [POWERS, ['q11', 'q15', 'q16']]] as const) {
      for (const id of ids) {
        const built = build(g, id, 3000, 'many')
        expect(built.filter((b) => !b.check.agrees).map((b) => b.seed), id).toEqual([])
      }
    }
  })

  it('keeps each slot worth what it was, with one method line per extra mark', () => {
    for (const [g, id] of [[ENTRIES, 'q1'], [ENTRIES, 'q6'], [UNKNOWNS, 'q8'], [UNKNOWNS, 'q10'], [UNKNOWNS, 'q14'], [POWERS, 'q11'], [POWERS, 'q15'], [POWERS, 'q16']] as const) {
      for (const b of build(g, id, 50)) {
        expect(b.question.marks).toBe(written(id).marks)
        expect(b.question.calculator).toBe('non-calculator')
        expect(b.question.markScheme.map((l) => l.code).join()).toBe(written(id).markScheme.map((l) => l.code).join())
        expect(b.question.markScheme.at(-1)!.description, b.seed).not.toMatch(/-/)
      }
    }
  })

  it('never names a matrix with a letter the advanced sheet\'s written questions use for another', () => {
    // q12, q17 and q18 define A (and q17 B); q13 defines S and R (R the quarter turn).
    const ids: string[] = topic.worksheets.advanced.questionIds
    for (let i = 0; i < 300; i++) {
      for (const s of sheetQuestions('further-maths', TOPIC, ids.map(written), `letters-${i}`)) {
        if (!s.generated) continue
        for (const m of s.question.prompt.matchAll(/\$([A-Z]) = (\\begin\{pmatrix\}.*?\\end\{pmatrix\})/g)) {
          expect(['A', 'B', 'S'], `${s.question.id} ${s.question.prompt}`).not.toContain(m[1])
          if (m[1] === 'R') expect(m[2], s.question.prompt).toBe('\\begin{pmatrix} 0 & -1 \\\\ 1 & 0 \\end{pmatrix}')
        }
      }
    }
  })

  it('fills every sheet, the written multiple-choice and extended questions left as they were', () => {
    for (const level of ['core', 'higher', 'advanced']) {
      const ids: string[] = topic.worksheets[level].questionIds
      for (let i = 0; i < 100; i++) {
        const sheet = sheetQuestions('further-maths', TOPIC, ids.map(written), `sheet-${level}-${i}`)
        for (const s of sheet) {
          if (['q3', 'q5', 'q9', 'q12', 'q13', 'q17', 'q18'].includes(s.question.id)) expect(s.generated).toBeUndefined()
          else expect(s.generated, `${level} ${s.question.id}`).toBeDefined()
        }
      }
    }
  })
})

describe('q1: an entry of a scalar multiple', () => {
  const built = build(ENTRIES, 'q1')
  it('is k times the asked entry, never k added, the entry itself or another entry scaled', () => {
    common(ENTRIES, 'q1', built)
    for (const b of built) {
      const p = b.question.prompt
      const k = Number(/\$(-?\d+)(?:[A-Z]\$|\\begin)/.exec(p)![1])
      const m = num(cellsOf(p)[0]!)
      fair(m)
      const [i, j] = posOf(p)
      const e = m[i]![j]!
      expect(answer(b), b.seed).toBe(k * e)
      expect(Math.abs(e), b.seed).toBeGreaterThanOrEqual(2)
      for (const wrong of [k + e, e, ...flat(m).filter((x) => x !== e).map((x) => k * x)]) expect(wrong, b.seed).not.toBe(answer(b))
      expect([k, ...flat(m)].map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
      // The whole scaled matrix as printed, then the one entry.
      const [, scaled] = cellsOf(b.question.solution)
      expect(flat(num(scaled!)), b.seed).toEqual(flat(m).map((x) => k * x + 0))
      stepsHold(b.question.solution)
      expect(b.question.solution, b.seed).toContain(`entry is $${k} \\times ${e < 0 ? `(${e})` : e} = ${answer(b)}$.`)
    }
  })
  it('spreads the scalar, the position and the entries', () => {
    const ks = tally(built, (b) => Number(b.values.k))
    expect(ks.size).toBeGreaterThanOrEqual(9)
    expect(top(ks, built.length)).toBeLessThanOrEqual(0.15)
    expect(share(built, (b) => Number(b.values.k) < 0)).toBeGreaterThan(0.15)
    expect(share(built, (b) => Number(b.values.k) < 0)).toBeLessThan(0.4)
    expect(top(tally(built, (b) => b.values.pos), built.length)).toBeLessThanOrEqual(0.33)
    expect(tally(built, (b) => Number(b.values.entry)).size).toBeGreaterThanOrEqual(10)
  })
})

describe('q2: an entry of a matrix times a column', () => {
  const built = build(ENTRIES, 'q2')
  it('is the asked row with the column, never the matrix read down, the other row or a sign dropped', () => {
    common(ENTRIES, 'q2', built)
    for (const b of built) {
      const [mc, vc] = cellsOf(b.question.prompt)
      const m = num(mc!)
      const v = num(vc!)
      fair(m)
      expect(flat(v).filter((x) => x < 0).length, b.seed).toBeLessThanOrEqual(1)
      expect(flat(m).concat(flat(v)), b.seed).not.toContain(0)
      const out = times(m, v)
      const i = /the top entry/.test(b.question.prompt) ? 0 : 1
      expect(answer(b), b.seed).toBe(out[i]![0])
      const down = m[0]![i]! * v[0]![0]! + m[1]![i]! * v[1]![0]!
      const dropped = m[i]![0]! * v[0]![0]! - m[i]![1]! * v[1]![0]!
      for (const wrong of [down, out[1 - i]![0], dropped]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(flat(m).concat(flat(v)).map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
      expect(stepsHold(b.question.solution), b.seed).toBe(2)
      expect(flat(num(cellsOf(b.question.solution).at(-1)!)), b.seed).toEqual(flat(out))
    }
  })
  it('asks both entries and spreads the inputs', () => {
    expect(share(built, (b) => b.values.entry === 'top')).toBeGreaterThan(0.35)
    expect(share(built, (b) => b.values.entry === 'top')).toBeLessThan(0.65)
    expect(tally(built, (b) => Number(b.values.a)).size).toBeGreaterThanOrEqual(8)
    expect(top(tally(built, (b) => Number(b.values.v1)), built.length)).toBeLessThanOrEqual(0.2)
  })
})

describe('q4: an entry of AB', () => {
  const built = build(ENTRIES, 'q4')
  it('is the asked row of the first with the asked column of the second, never BA, row with row or column with column', () => {
    common(ENTRIES, 'q4', built)
    for (const b of built) {
      const [pc, qc] = cellsOf(b.question.prompt)
      const p = num(pc!)
      const q = num(qc!)
      fair(p)
      fair(q)
      const [i, j] = posOf(b.question.prompt)
      const pq = times(p, q)
      expect(answer(b), b.seed).toBe(pq[i]![j])
      // BA, row with row, column with column, matching entries multiplied, the entry across the diagonal.
      const slips = [times(q, p)[i]![j], times(p, tr(q))[i]![j], times(tr(p), q)[i]![j], p[i]![j]! * q[i]![j]!, ...(i !== j ? [pq[j]![i]] : [])]
      for (const wrong of slips) expect(wrong, b.seed).not.toBe(answer(b))
      expect(flat(p).concat(flat(q)).map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
      expect(stepsHold(b.question.solution), b.seed).toBe(1)
      expect(flat(num(cellsOf(b.question.solution).at(-1)!)), b.seed).toEqual(flat(pq))
      expect(Math.abs(answer(b)), b.seed).toBeLessThanOrEqual(40)
    }
  })
  it('asks every position', () => {
    const pos = tally(built, (b) => b.values.pos)
    expect(pos.size).toBe(4)
    expect(top(pos, built.length)).toBeLessThanOrEqual(0.33)
  })
  it('writes the working as the written solution does', () => {
    const b = built.find((x) => x.values.pos === 'top-right')!
    expect(b.question.solution).toMatch(/^Top row of the first, \$-?\d+, -?\d+\$, with the right column of the second, \$-?\d+, -?\d+\$: \$/)
  })
})

describe('q6: an entry of BA', () => {
  const built = build(ENTRIES, 'q6')
  it('puts the second-named matrix on the left, and the same entry of AB differs', () => {
    common(ENTRIES, 'q6', built)
    for (const b of built) {
      const p = b.question.prompt
      const [n1, n2] = [...p.matchAll(/\$([A-Z]) = \\begin/g)].map((m) => m[1]!)
      const [ac, bc] = cellsOf(p)
      const a = num(ac!)
      const bm = num(bc!)
      fair(a)
      fair(bm)
      expect(p, b.seed).toContain(`entry of $${n2}${n1}$.`)
      const [i, j] = posOf(p)
      const ba = times(bm, a)[i]![j]!
      const ab = times(a, bm)[i]![j]!
      expect(answer(b), b.seed).toBe(ba)
      const slips = [ab, times(bm, tr(a))[i]![j], times(tr(bm), a)[i]![j], bm[i]![j]! * a[i]![j]!, ...(i !== j ? [times(bm, a)[j]![i]] : [])]
      for (const wrong of slips) expect(wrong, b.seed).not.toBe(answer(b))
      expect(b.question.solution, b.seed).toContain(`In $${n1}${n2}$ that entry is $${ab}$`)
      expect(stepsHold(b.question.solution), b.seed).toBe(1)
    }
  })
  it('spreads the positions and the letters', () => {
    expect(tally(built, (b) => b.values.pos).size).toBe(4)
    expect(tally(built, (b) => b.values.names).size).toBeGreaterThanOrEqual(4)
  })
})

describe('q7: an entry of A²', () => {
  const built = build(ENTRIES, 'q7')
  it('is a row with a column of A, never the entry squared, doubled, row with row or column with column', () => {
    common(ENTRIES, 'q7', built)
    for (const b of built) {
      const m = num(cellsOf(b.question.prompt)[0]!)
      fair(m)
      expect(flat(m), b.seed).not.toContain(0)
      expect(m[0]![0]! + m[1]![1]!, b.seed).not.toBe(0)
      const [i, j] = posOf(b.question.prompt)
      const sq = times(m, m)
      expect(answer(b), b.seed).toBe(sq[i]![j])
      expect(Math.abs(answer(b)), b.seed).toBeGreaterThanOrEqual(2)
      const e = m[i]![j]!
      for (const wrong of [e * e, 2 * e, times(m, tr(m))[i]![j], times(tr(m), m)[i]![j]]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(flat(m).map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
      expect(stepsHold(b.question.solution), b.seed).toBe(1)
      expect(flat(num(cellsOf(b.question.solution).at(-1)!)), b.seed).toEqual(flat(sq))
    }
  })
  it('asks every position, the corners and the diagonal both', () => {
    expect(tally(built, (b) => b.values.pos).size).toBe(4)
    expect(top(tally(built, (b) => b.values.pos), built.length)).toBeLessThanOrEqual(0.33)
  })
})

describe('q8: unknown entries from a product', () => {
  const built = build(UNKNOWNS, 'q8')
  it('has exactly one pair of whole numbers that fits, the asked one the answer, never a printed figure', () => {
    common(UNKNOWNS, 'q8', built, { minDistinct: 9 })
    for (const b of built) {
      const p = b.question.prompt
      const [lc, rc, nc] = cellsOf(p)
      const target = flat(num(nc!))
      const letters = [...new Set([...lc!.flat(), ...rc!.flat()].filter((c) => /^[a-z]$/.test(c)))]
      expect(letters, b.seed).toHaveLength(2)
      const asked = /value of \$([a-z])\$\.$/.exec(p)![1]!
      const fits: Record<string, number>[] = []
      for (let s = -12; s <= 12; s++) {
        for (let u = -12; u <= 12; u++) {
          const vars = { [letters[0]!]: s, [letters[1]!]: u }
          const fill = (cells: string[][]) => cells.map((row) => row.map((c) => (c in vars ? vars[c]! : Number(c))))
          if (flat(times(fill(lc!), fill(rc!))).every((x, k) => x === target[k])) fits.push(vars)
        }
      }
      expect(fits, b.seed).toHaveLength(1)
      const sol = fits[0]!
      expect(answer(b), b.seed).toBe(sol[asked])
      const other = letters.find((l) => l !== asked)!
      expect(Math.abs(sol[other]!), b.seed).not.toBe(Math.abs(answer(b)))
      // No printed figure the size of the answer.
      const printed = [...lc!.flat(), ...rc!.flat(), ...nc!.flat()].filter((c) => !/[a-z]/.test(c)).map((c) => Math.abs(Number(c)))
      expect(printed, b.seed).not.toContain(Math.abs(answer(b)))
      // The product with the letters in, as printed, gives the printed product at the solution;
      // no entry is a bare letter to read off.
      const symbolic = cellsOf(b.question.solution)[0]!.flat()
      symbolic.forEach((cell, k) => expect(arith(cell, sol), `${b.seed} ${cell}`).toBe(target[k]))
      for (const cell of symbolic) expect(cell, b.seed).not.toMatch(/^-?[a-z]$/)
      expect(target.every((v) => Math.abs(v) <= 30), b.seed).toBe(true)
      // Dividing or subtracting entry by entry (q18's slip on this sheet's advanced level) never pays.
      const knownCells = [lc!, rc!].find((cells) => cells.flat().every((c) => !/[a-z]/.test(c)))!
      const known = flat(num(knownCells))
      known.forEach((kv, k) => {
        if (kv !== 0) expect(target[k]! / kv, b.seed).not.toBe(answer(b))
        expect(target[k]! - kv, b.seed).not.toBe(answer(b))
      })
      expect(stepsHold(b.question.solution, sol), b.seed).toBeGreaterThanOrEqual(3)
      const L = String(b.values.letters)
      expect(letters.slice().sort()).toEqual([L[0], L[1]].sort())
      expect(b.question.markScheme[0]!.description).toBe(`product in terms of ${L[0]} and ${L[1]}`)
    }
  })
  it('mostly asks the letter whose simplest equation has a number beside it, as written', () => {
    const termsIn = (cell: string) => cell.replace(/^-/, '').split(/[+-]/).length
    const two = (b: Generated) => {
      const asked = /value of \$([a-z])\$\.$/.exec(b.question.prompt)![1]!
      const cells = cellsOf(b.question.solution)[0]!.flat().filter((c) => c.includes(asked))
      return Math.min(...cells.map(termsIn)) === 2
    }
    for (const b of built) expect(two(b), b.seed).toBe(b.values.terms === 2)
    expect(share(built, two)).toBeGreaterThanOrEqual(0.7)
    expect(share(built, two)).toBeLessThan(0.95)
  })
  it('writes the working as the written solution does (seed pin-a)', () => {
    const b = generate(GENERATORS.find((x) => x.id === UNKNOWNS)!, written('q8'), 'pin-a')
    expect(b.question.prompt).toBe('$\\begin{pmatrix} a & -3 \\\\ 3 & b \\end{pmatrix}\\begin{pmatrix} 1 & 3 \\\\ 2 & 5 \\end{pmatrix} = \\begin{pmatrix} -10 & -27 \\\\ 9 & 24 \\end{pmatrix}$. Work out the value of $a$.')
    expect(b.question.solution).toBe('Multiply out with the letters in: the product is $\\begin{pmatrix} a - 6 & 3a - 15 \\\\ 3 + 2b & 9 + 5b \\end{pmatrix}$. Top left: $a - 6 = -10$, so $a = -4$. Bottom left gives $b = 3$, and then $3a - 15 = -27$ checks.')
  })
  it('places the letters on either side and on either diagonal, the answers spread in each', () => {
    for (const key of ['place', 'pattern'] as const) {
      const groups = tally(built, (b) => b.values[key])
      expect(groups.size).toBe(2)
      for (const g of groups.keys()) {
        const some = built.filter((b) => b.values[key] === g)
        expect(tally(some, answer).size, String(g)).toBeGreaterThanOrEqual(8)
      }
    }
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.1)
    expect(share(built, (b) => b.values.asked === String(b.values.letters)[0])).toBeGreaterThan(0.35)
    expect(share(built, (b) => b.values.asked === String(b.values.letters)[0])).toBeLessThan(0.65)
  })
})

/** The two unknowns of a column question, by Cramer's rule on the printed matrix and image. */
function cramer(b: Generated) {
  const p = b.question.prompt
  const cells = cellsOf(p)
  const m = num(cells[0]!)
  const out = /maps the point/.test(p) ? /to the point \$\((-?\d+), (-?\d+)\)\$/.exec(p)!.slice(1).map(Number) : flat(num(cells[2]!))
  const [[a, c], [d, e]] = m as [[number, number], [number, number]]
  const det = a * e - c * d
  return { m, out, det, top: (out[0]! * e - c * out[1]!) / det, bottom: (a * out[1]! - d * out[0]!) / det }
}

describe('q10 and q14: the column from its image', () => {
  for (const [id, U, V, asksTop] of [['q10', 'x', 'y', false], ['q14', 'a', 'b', true]] as const) {
    describe(id, () => {
      const built = build(UNKNOWNS, id)
      it('solves to whole numbers by Cramer, the asked one the answer, the other never its size', () => {
        common(UNKNOWNS, id, built, { minDistinct: 10 })
        for (const b of built) {
          const { m, out, det, top: t, bottom } = cramer(b)
          expect(Number.isInteger(t) && Number.isInteger(bottom), b.seed).toBe(true)
          expect(answer(b), b.seed).toBe(asksTop ? t : bottom)
          expect(b.question.prompt.endsWith(`Work out the value of $${asksTop ? U : V}$.`), b.seed).toBe(true)
          expect(Math.abs(asksTop ? bottom : t), b.seed).not.toBe(Math.abs(answer(b)))
          expect(Math.abs(det), b.seed).toBeGreaterThanOrEqual(2)
          expect(Math.abs(det), b.seed).toBeLessThanOrEqual(15)
          expect(new Set(flat(m)).size, b.seed).toBe(4)
          // The image mapped again, a printed figure: never the answer's size.
          const again = times(m, [[out[0]!], [out[1]!]])
          expect(Math.abs(again[asksTop ? 0 : 1]![0]!), b.seed).not.toBe(Math.abs(answer(b)))
          expect([...flat(m), ...out].map(Math.abs), b.seed).not.toContain(Math.abs(answer(b)))
          // Every printed equation holds at the solution, and the working ends on the check.
          const vars = { [U]: t, [V]: bottom }
          expect(stepsHold(b.question.solution, vars), b.seed).toBeGreaterThanOrEqual(5)
          expect(b.question.solution, b.seed).toMatch(/Check in the second: \$[^$]+\$\.$/)
          // Working at the written scale: every figure up to 50 (q10) or 60 (q14), q10's image within ±25.
          for (const n of b.question.solution.match(/-?\d+/g)!.map(Number)) expect(Math.abs(n), b.seed).toBeLessThanOrEqual(asksTop ? 60 : 50)
          if (!asksTop) for (const o of out) expect(Math.abs(o), b.seed).toBeLessThanOrEqual(25)
          // Entries four different sizes (q14 negated one after drawing: −3 beside 3).
          expect(new Set(flat(m).map(Math.abs)).size, b.seed).toBe(4)
          // The elimination as worded: q10 scales one equation only; the asked unknown's
          // coefficient comes out positive, the other's cancels.
          const step = /To remove \$([a-z])\$: (?:\$([^$]+)\$ and \$([^$]+)\$; )?(subtract the second from the first|subtract the first from the second|add them): \$([^$]+)\$/.exec(b.question.solution)!
          expect(step, b.seed).not.toBeNull()
          const [eq1, eq2] = mathOf(b.question.solution).slice(0, 2)
          const s1 = step[2] ?? eq1!
          const s2 = step[3] ?? eq2!
          if (!asksTop) expect(s1 === eq1 || s2 === eq2, b.seed).toBe(true)
          const askedL = asksTop ? U : V
          const otherL = asksTop ? V : U
          const parts = (eq: string) => {
            const [lhs, rhs] = eq.split(' = ')
            return { a: arith(lhs!, { [askedL]: 1, [otherL]: 0 }), o: arith(lhs!, { [askedL]: 0, [otherL]: 1 }), r: Number(rhs) }
          }
          const [e1, e2] = [parts(s1), parts(s2)]
          const sign = step[4] === 'add them' ? 1 : -1
          const [f, g] = step[4] === 'subtract the first from the second' ? [e2, e1] : [e1, e2]
          expect(f.o + sign * g.o, b.seed).toBe(0)
          const D = f.a + sign * g.a
          expect(D, b.seed).toBeGreaterThan(0)
          expect(step[5], b.seed).toBe(`${D === 1 ? '' : D}${askedL} = ${f.r + sign * g.r}`)
        }
      })
      it('says which way to subtract, both ways used', () => {
        if (id === 'q10') {
          expect(share(built, (b) => /subtract the first from the second/.test(b.question.solution))).toBeGreaterThan(0.15)
          expect(share(built, (b) => /subtract the second from the first/.test(b.question.solution))).toBeGreaterThan(0.15)
        }
      })
      it('spreads the matrices and the answers', () => {
        expect(tally(built, (b) => Number(b.values.det)).size).toBeGreaterThanOrEqual(10)
        expect(tally(built, (b) => Number(b.values.a)).size).toBeGreaterThanOrEqual(5)
        expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.25)
        const neg = share(built, (b) => flat(cramer(b).m).some((x) => x < 0))
        if (id === 'q10') expect(neg).toBe(0)
        else {
          expect(neg).toBeGreaterThan(0.3)
          expect(neg).toBeLessThan(0.75)
        }
      })
    })
  }
  it('q10 writes the working as the written solution does (seed pin-a)', () => {
    const b = generate(GENERATORS.find((x) => x.id === UNKNOWNS)!, written('q10'), 'pin-a')
    expect(b.question.prompt).toBe('$\\begin{pmatrix} 4 & 3 \\\\ 1 & 2 \\end{pmatrix}\\begin{pmatrix} x \\\\ y \\end{pmatrix} = \\begin{pmatrix} -19 \\\\ -11 \\end{pmatrix}$. Work out the value of $y$.')
    expect(b.question.solution).toBe('The product gives two equations: $4x + 3y = -19$ and $x + 2y = -11$. To remove $x$: $4x + 3y = -19$ and $4x + 8y = -44$; subtract the first from the second: $5y = -25$, so $y = -5$. Substitute into the first: $4x - 15 = -19$, so $x = -1$. Check in the second: $1 \\times (-1) + 2 \\times (-5) = -11$.')
  })
  it('q10 sometimes says the matrix maps a point, as its skill names', () => {
    const built = build(UNKNOWNS, 'q10')
    expect(share(built, (b) => b.values.form === 'mapping')).toBeGreaterThan(0.25)
    expect(share(built, (b) => b.values.form === 'mapping')).toBeLessThan(0.55)
  })
})

describe('q11: C² = kI', () => {
  const built = build(POWERS, 'q11')
  it('squares to k times I, never a² alone, the determinant, a² − bc or a sum of squares', () => {
    common(POWERS, 'q11', built)
    for (const b of built) {
      const m = num(cellsOf(b.question.prompt)[0]!)
      const [[a, bb], [c, d]] = m as [[number, number], [number, number]]
      expect(d, b.seed).toBe(-a)
      const sq = times(m, m)
      expect(sq[0]![1], b.seed).toBe(0)
      expect(sq[1]![0], b.seed).toBe(0)
      expect(sq[0]![0], b.seed).toBe(sq[1]![1])
      expect(answer(b), b.seed).toBe(sq[0]![0])
      const k = answer(b)
      expect(Math.abs(k), b.seed).toBeGreaterThanOrEqual(2)
      for (const wrong of [a * a, a * d - bb * c, a * a - bb * c, a * a + bb * bb, a * a + c * c]) expect(wrong, b.seed).not.toBe(k)
      expect(new Set([a, bb, c].map(Math.abs)).size, b.seed).toBe(3)
      expect([a, bb, c].map(Math.abs), b.seed).not.toContain(Math.abs(k))
      expect(stepsHold(b.question.solution, { k }), b.seed).toBe(5)
    }
  })
  it('spreads k, a few negative', () => {
    expect(share(built, (b) => answer(b) < 0)).toBeGreaterThan(0.1)
    expect(share(built, (b) => answer(b) < 0)).toBeLessThan(0.45)
    expect(tally(built, (b) => Number(b.values.a)).size).toBeGreaterThanOrEqual(6)
  })
})

/** The smallest n up to 12 with Mⁿ = I, by this file's multiply. */
function order(m: M2): number {
  let p = m
  for (let n = 1; n <= 12; n++) {
    if (flat(p).join() === '1,0,0,1') return n
    p = times(p, m)
  }
  return 0
}

describe('q15: the smallest n with Rⁿ = I', () => {
  const built = build(POWERS, 'q15')
  it('is the order of the printed matrix, with the powers below shown not to be I', () => {
    common(POWERS, 'q15', built, { minDistinct: 4 })
    for (const b of built) {
      const m = num(cellsOf(b.question.prompt)[0]!)
      expect(order(m), b.seed).toBe(answer(b))
      expect(flat(m).every((x) => Math.abs(x) <= 3), b.seed).toBe(true)
      expect(flat(m).join(), b.seed).not.toBe('-1,0,0,-1')
      const s = b.question.solution
      expect(s, b.seed).toMatch(new RegExp(`[Tt]he smallest such \\$n\\$ is \\$${answer(b)}\\$`))
      if (answer(b) === 4) expect(s, b.seed).toMatch(/\^2 = -I\$/)
      if (answer(b) === 6) expect(s, b.seed).toMatch(/\^3 = -I\$/)
      if (answer(b) === 3) expect(s, b.seed).toMatch(/\^3 = I\$/)
      // Each printed product of the working is right.
      for (const piece of s.split(/, | so /)) {
        const step = /\$([^$]*\\times[^$]*) = (-?\d+)\$/.exec(piece)
        if (step) expect(arith(step[1]!) + 0, `${b.seed} ${piece}`).toBe(Number(step[2]))
      }
    }
  })
  it('spreads the orders and the matrices within each', () => {
    const orders = tally(built, answer)
    expect([...orders.keys()].sort()).toEqual([2, 3, 4, 6])
    for (const n of [2, 3, 4, 6]) expect((orders.get(n) ?? 0) / built.length, String(n)).toBeGreaterThan(0.15)
    const many = build(POWERS, 'q15', 1000, 'orders')
    for (const n of [2, 3, 4, 6]) {
      const some = many.filter((b) => answer(b) === n)
      expect(tally(some, (b) => b.values.matrix).size, String(n)).toBeGreaterThanOrEqual(Math.min(8, FINITE_ORDER[n]!.length))
    }
    // The written quarter turn is one of many.
    expect(share(many, (b) => b.values.matrix === '0 -1 1 0')).toBeLessThanOrEqual(0.05)
  })
  it('lists every matrix with entries −3 to 3 of each order, checked by this file', () => {
    const counts = Object.fromEntries(Object.entries(FINITE_ORDER).map(([n, ms]) => [n, ms.length]))
    expect(counts).toEqual({ 2: 36, 3: 12, 4: 10, 6: 12 })
    for (const [n, ms] of Object.entries(FINITE_ORDER)) for (const m of ms) expect(order([[m[0], m[1]], [m[2], m[3]]])).toBe(Number(n))
  })
})

describe('q16: a pattern in the powers', () => {
  const built = build(POWERS, 'q16')
  it('is n times the corner, never the corner to the power n, n plus the corner or one factor short', () => {
    common(POWERS, 'q16', built)
    for (const b of built) {
      const p = b.question.prompt
      const m = num(cellsOf(p)[0]!)
      const n = Number(/\^\{(\d+)\}\$\.$/.exec(p)![1])
      let pw = m
      for (let k = 1; k < n; k++) pw = times(pw, m)
      const [i, j] = posOf(p)
      expect(answer(b), b.seed).toBe(pw[i]![j])
      const s = m[i]![j]!
      expect(Math.abs(s), b.seed).toBeGreaterThanOrEqual(2)
      expect(n, b.seed).not.toBe(Math.abs(s))
      for (const wrong of [s ** n, n + s, (n - 1) * s, s * s]) expect(wrong, b.seed).not.toBe(answer(b))
      expect(m[0]![0]).toBe(1)
      expect(m[1]![1]).toBe(1)
      const [p2, p3] = cellsOf(b.question.solution).map(num)
      expect(flat(p2!), b.seed).toEqual(flat(times(m, m)))
      expect(flat(p3!), b.seed).toEqual(flat(times(times(m, m), m)))
      expect(b.question.solution.endsWith(`has $${answer(b)}$.`), b.seed).toBe(true)
    }
  })
  it('spreads the corner, the power and the shape', () => {
    expect(tally(built, (b) => Number(b.values.s)).size).toBeGreaterThanOrEqual(6)
    expect(tally(built, (b) => Number(b.values.n)).size).toBeGreaterThanOrEqual(8)
    expect(share(built, (b) => b.values.shape === 'lower')).toBeGreaterThan(0.2)
    expect(share(built, (b) => b.values.shape === 'lower')).toBeLessThan(0.5)
    // No one calculation over a sixth.
    expect(top(tally(built, (b) => `${b.values.s} ${b.values.n}`), built.length)).toBeLessThanOrEqual(1 / 6)
  })
})

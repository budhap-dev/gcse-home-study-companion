import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { coef, evalTex, gcd, sub } from '../maths/formulae.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), matrix multiplication and the identity: the numeric slots.
 *
 * 5.1  Multiplying a 2 × 2 matrix by a 2 × 2 matrix or by a 2 × 1 matrix, and by a scalar:
 *      one entry of kM (q1), of Av (q2), of AB (q4), of BA (q6) and of A² (q7); unknown
 *      entries from a product (q8); the column from its image (q10, q14).
 * 5.2  The identity matrix I, 2 × 2 only: C² = kI (q11), the smallest n with Rⁿ = I (q15),
 *      the pattern in the powers of a shear (q16).
 * All calculations are 2 × 2 or 2 × 1, as the specification restricts them. The multiple-choice
 * and extended questions (q3, q5, q9, q12, q13, q17, q18) stay written.
 *
 * All non-calculator: entries from about −5 to 9, products by hand. The generators work a
 * product entry by entry, row with column; every check reads the matrices back from the
 * prompt's own TeX and works again by images (AB sends (1, 0) and (0, 1) where A sends B's
 * images of them), by repeated addition, or by searching the integers for the unknowns.
 * No generated matrix is the sheet's A = (2 1; 3 4), which q9, q12, q17 and q18 print.
 */

const TOPIC = 'matrix-multiplication-and-the-identity'

/** A 2 × 2 matrix by rows: [a, b, c, d] is (a b; c d). */
export type Mat = [number, number, number, number]
type Vec = [number, number]

/** The written A of q9, q12, q17, q18: never printed by a generated question. */
const SHEET_A: Mat = [2, 1, 3, 4]
const same = (m: readonly number[], n: readonly number[]) => m.length === n.length && m.every((x, i) => x === n[i])

export const pm = (m: Mat) => `\\begin{pmatrix} ${m[0]} & ${m[1]} \\\\ ${m[2]} & ${m[3]} \\end{pmatrix}`
export const colTex = (v: Vec) => `\\begin{pmatrix} ${v[0]} \\\\ ${v[1]} \\end{pmatrix}`

/** Row with column, entry by entry. */
export const mul = (p: Mat, q: Mat): Mat => [
  p[0] * q[0] + p[1] * q[2],
  p[0] * q[1] + p[1] * q[3],
  p[2] * q[0] + p[3] * q[2],
  p[2] * q[1] + p[3] * q[3],
]
const mulVec = (p: Mat, v: Vec): Vec => [p[0] * v[0] + p[1] * v[1], p[2] * v[0] + p[3] * v[1]]
const at = (m: Mat, i: number, j: number) => m[2 * i + j]!
const rowOf = (m: Mat, i: number): Vec => [m[2 * i]!, m[2 * i + 1]!]
const colOf = (m: Mat, j: number): Vec => [m[j]!, m[2 + j]!]
const I: Mat = [1, 0, 0, 1]

export const POS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const ROW = ['top row', 'bottom row']
const COL = ['left column', 'right column']
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

/** "3 \times 2 + (-1) \times (-3)": a row with a column, negatives bracketed. */
export const dotTex = (u: Vec, v: Vec) => `${sub(u[0])} \\times ${sub(v[0])} + ${sub(u[1])} \\times ${sub(v[1])}`
/** "6 + 3", "6 - 15": the two products before adding. */
const pair = (p: number, q: number) => `${show(p)} ${q < 0 ? '-' : '+'} ${Math.abs(q)}`
const listTex = (v: Vec) => `${v[0]}, ${v[1]}`

// ---------------------------------------------------------------------------------------
// Second routes. The matrices are read back from the prompt's own TeX, and a product is
// worked by images: the matrix as a map sends (x, y) to x times its first column plus y times
// its second, and AB sends each corner of the unit square where A sends B's image of it.
// ---------------------------------------------------------------------------------------

/** Every pmatrix in a text, as rows of cells (numbers or letters), in order. */
export function matricesIn(text: string): string[][][] {
  return [...text.matchAll(/\\begin\{pmatrix\}(.*?)\\end\{pmatrix\}/g)].map((m) => m[1]!.split('\\\\').map((row) => row.split('&').map((c) => c.trim())))
}
const numeric = (cells: string[][]): number[] => cells.flat().map((c) => {
  const v = Number(c)
  if (c === '' || !Number.isFinite(v)) throw new Error(`not a number: ${c}`)
  return v
})
const asMat = (cells: string[][]): Mat => {
  const v = numeric(cells)
  if (v.length !== 4 || cells.length !== 2) throw new Error('not 2 × 2')
  return v as Mat
}
/** Where the map sends a point: x lots of the first column and y lots of the second. */
const image = (m: Mat, p: Vec): Vec => {
  const first: Vec = [m[0], m[2]]
  const second: Vec = [m[1], m[3]]
  return [p[0] * first[0] + p[1] * second[0], p[0] * first[1] + p[1] * second[1]]
}
/** The product AB found from the images of (1, 0) and (0, 1) under A after B. */
const byImages = (p: Mat, q: Mat): Mat => {
  const e1 = image(p, image(q, [1, 0]))
  const e2 = image(p, image(q, [0, 1]))
  return [e1[0], e2[0], e1[1], e2[1]]
}
/** The entry a prompt asks for, by its words. */
const posIn = (text: string) => {
  const k = POS.findIndex((p) => text.includes(`the ${p} entry`))
  if (k < 0) throw new Error(`no position in: ${text}`)
  return [Math.floor(k / 2), k % 2] as const
}

/** Distinct values (as written: no two entries equal), at most one zero. */
const distinct = (v: readonly number[]) => new Set(v).size === v.length && v.filter((x) => x === 0).length <= 1
const sizes = (v: readonly number[]) => v.map(Math.abs)

// ---------------------------------------------------------------------------------------
// q1: an entry of a scalar multiple. 5(1 −2; 0 3), the top-right entry: −10.
// ---------------------------------------------------------------------------------------

const SCALARS = [2, 3, 4, 5, 6, 7, 8, 9, -2, -3, -4]

function scalarEntry(r: Rng, slot: Question): Draft {
  const k = pick(r, SCALARS)
  const pos = int(r, 0, 3)
  const m = draw(
    r,
    (r): Mat => [int(r, -5, 9), int(r, -5, 9), int(r, -5, 9), int(r, -5, 9)],
    (m) => {
      const e = m[pos]!
      const ans = k * e
      // The asked entry a real one (not 0 or ±1); no printed figure the size of the answer; a
      // sum k + e never the product; at most one negative, as written.
      return distinct(m) && new Set(sizes(m)).size === 4 && Math.abs(e) >= 2 && !sizes([k, ...m]).includes(Math.abs(ans)) && k + e !== ans && m.filter((x) => x < 0).length <= 1 && Math.abs(e) !== Math.abs(k)
    },
  )
  const e = m[pos]!
  const ans = k * e
  const where = POS[pos]!
  const named = r() < 0.35
  const L = pick(r, ['M', 'A', 'B', 'P'])
  const prompt = named
    ? `$${L} = ${pm(m)}$. ${pick(r, ['Write down', 'Work out'])} the ${where} entry of $${k}${L}$.`
    : `${pick(r, ['Write down', 'Work out'])} the ${where} entry of $${k}${pm(m)}$.`
  const scaled = m.map((x) => k * x) as Mat
  const solution = `A scalar multiplies every entry: $${k}${pm(m)} = ${pm(scaled)}$. The ${where} entry is $${k} \\times ${sub(e)} = ${ans}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      // Second route: the printed matrix added to itself |k| times, negated for a negative k.
      const pk = Number(/\$(-?\d+)(?:[A-Z]|\\begin)/.exec(prompt)![1])
      const pmx = asMat(matricesIn(prompt)[0]!)
      const [i, j] = posIn(prompt)
      let total = 0
      for (let t = 0; t < Math.abs(pk); t++) total += at(pmx, i, j)
      if (pk < 0) total = -total
      return { agrees: total === ans, detail: `${pk} lots of ${at(pmx, i, j)} by adding: ${total}` }
    })(),
    values: { k, pos: where, entry: e, answer: ans },
  }
}

// ---------------------------------------------------------------------------------------
// q2: an entry of a matrix times a column. (3 −1; 2 5)(2; −3), the top entry: 9.
// ---------------------------------------------------------------------------------------

function columnEntry(r: Rng, slot: Question): Draft {
  const i = int(r, 0, 1)
  const [m, v] = draw(
    r,
    (r): [Mat, Vec] => [[int(r, -4, 6), int(r, -4, 6), int(r, -4, 6), int(r, -4, 6)], [int(r, -4, 5), int(r, -4, 5)]],
    ([m, v]) => {
      const ans = mulVec(m, v)[i]!
      const other = mulVec(m, v)[1 - i]!
      // Column with column (the matrix read down), the other row, the second product's sign
      // dropped: none of them the answer, and no printed figure its size.
      const wrongs = [colOf(m, i)[0] * v[0] + colOf(m, i)[1] * v[1], other, at(m, i, 0) * v[0] - at(m, i, 1) * v[1]]
      return (
        distinct(m) && new Set(sizes(m)).size === 4 && !m.includes(0) && v[0] !== 0 && v[1] !== 0 && Math.abs(v[0]) !== Math.abs(v[1]) && ans !== 0 && !wrongs.includes(ans) &&
        !sizes([...m, ...v]).includes(Math.abs(ans)) && m.filter((x) => x < 0).length <= 1 && v.filter((x) => x < 0).length <= 1 && !same(m, SHEET_A)
      )
    },
  )
  const out = mulVec(m, v)
  const ans = out[i]!
  const word = i === 0 ? 'top' : 'bottom'
  const L = pick(r, ['A', 'M', 'P', 'T'])
  const prompt = r() < 0.6
    ? `Work out the ${word} entry of $${pm(m)}${colTex(v)}$.`
    : `$${L} = ${pm(m)}$ and $\\mathbf{v} = ${colTex(v)}$. Work out the ${word} entry of $${L}\\mathbf{v}$.`
  const row = rowOf(m, i)
  const o = rowOf(m, 1 - i)
  const solution =
    `${cap(word)} row with the column: $${dotTex(row, v)} = ${pair(row[0] * v[0], row[1] * v[1])} = ${ans}$. ` +
    `The ${i === 0 ? 'bottom' : 'top'} entry is $${dotTex(o, v)} = ${out[1 - i]}$, so the product is $${colTex(out)}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      // Second route: the column read as a point and mapped by the printed matrix's columns.
      const [pmx, pv] = matricesIn(prompt)
      const p = image(asMat(pmx!), numeric(pv!) as Vec)
      const k = /the top entry/.test(prompt) ? 0 : 1
      return { agrees: p[k] === ans, detail: `image of (${numeric(pv!).join(', ')}): (${p.join(', ')})` }
    })(),
    values: { entry: word, a: m[0], v1: v[0], answer: ans },
  }
}

// ---------------------------------------------------------------------------------------
// q4: an entry of AB. (4 −2; 1 3)(1 5; 2 0), the top-right entry: 20.
// q6: an entry of BA with A and B named. A = (2 1; 3 4), B = (1 0; 2 −1), BA bottom right: −2.
// q7: an entry of A². A = (2 1; 3 4), bottom right: 19.
// ---------------------------------------------------------------------------------------

const t = (m: Mat): Mat => [m[0], m[2], m[1], m[3]]
/** The slips on one entry of PQ: QP, row with row, column with column, entry times entry, the transposed position. */
const productSlips = (p: Mat, q: Mat, i: number, j: number) => [
  at(mul(q, p), i, j),
  at(mul(p, t(q)), i, j),
  at(mul(t(p), q), i, j),
  // Matching entries multiplied, and the product's entry across the diagonal.
  at(p, i, j) * at(q, i, j),
  at(mul(p, q), j, i),
].filter((_, k) => k !== 4 || i !== j)
const okMatrix = (m: Mat) => distinct(m) && m.filter((x) => x < 0).length <= 2 && !same(m, SHEET_A) && !same(m, I)

/**
 * A matrix as the written ones are: entries of four different sizes up to 6 (no 2 beside −2 to
 * open a shortcut), at most one negative, at most one zero, never I or the sheet's A.
 */
function fairMatrix(r: Rng, zeroOk: boolean): Mat {
  return draw(
    r,
    (r): Mat => [int(r, -3, 6), int(r, -3, 6), int(r, -3, 6), int(r, -3, 6)],
    (m) => okMatrix(m) && new Set(sizes(m)).size === 4 && m.filter((x) => x < 0).length <= 1 && (zeroOk || !m.includes(0)),
  )
}

/** Two fair matrices whose product has a real entry at (i, j) that no slip gives and no printed figure matches. */
function drawPair(r: Rng, i: number, j: number): [Mat, Mat] {
  return draw(
    r,
    (r): [Mat, Mat] => [fairMatrix(r, false), fairMatrix(r, true)],
    ([p, q]) => {
      const ans = at(mul(p, q), i, j)
      return ans !== 0 && !productSlips(p, q, i, j).includes(ans) && !sizes([...p, ...q]).includes(Math.abs(ans)) && Math.abs(ans) <= 40
    },
  )
}

function productEntry(r: Rng, slot: Question): Draft {
  const pos = int(r, 0, 3)
  const [i, j] = [Math.floor(pos / 2), pos % 2]
  const [p, q] = drawPair(r, i, j)
  const pq = mul(p, q)
  const ans = at(pq, i, j)
  const prompt = `Work out the ${POS[pos]} entry of $${pm(p)}${pm(q)}$.`
  const solution = `${cap(ROW[i]!)} of the first, $${listTex(rowOf(p, i))}$, with the ${COL[j]} of the second, $${listTex(colOf(q, j))}$: $${dotTex(rowOf(p, i), colOf(q, j))} = ${ans}$. The whole product is $${pm(pq)}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      const [a, b] = matricesIn(prompt).map(asMat)
      const prod = byImages(a!, b!)
      const [pi, pj] = posIn(prompt)
      return { agrees: at(prod, pi, pj) === ans, detail: `by images of (1, 0) and (0, 1): (${prod.join(', ')})` }
    })(),
    values: { pos: POS[pos]!, a: p[0], b: q[0], answer: ans },
  }
}

const NAME_PAIRS = [['A', 'B'], ['P', 'Q'], ['M', 'N'], ['A', 'C'], ['R', 'S']] as const

function otherWayEntry(r: Rng, slot: Question): Draft {
  const pos = int(r, 0, 3)
  const [i, j] = [Math.floor(pos / 2), pos % 2]
  const [A, B] = pick(r, NAME_PAIRS)
  // The product asked is BA: the second-named matrix on the left.
  const [b, a] = drawPair(r, i, j)
  const ba = mul(b, a)
  const ans = at(ba, i, j)
  const ab = at(mul(a, b), i, j)
  const prompt = `$${A} = ${pm(a)}$ and $${B} = ${pm(b)}$. Work out the ${POS[pos]} entry of $${B}${A}$.`
  const solution =
    `$${B}${A}$ has $${B}$ on the left. ${cap(ROW[i]!)} of $${B}$, $${listTex(rowOf(b, i))}$, with the ${COL[j]} of $${A}$, $${listTex(colOf(a, j))}$: ` +
    `$${dotTex(rowOf(b, i), colOf(a, j))} = ${ans}$. In $${A}${B}$ that entry is $${ab}$: the order changes the answer.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      // The prompt names the first matrix, then the second; the product asked is read by its letters.
      const names = [...prompt.matchAll(/\$([A-Z]) = \\begin/g)].map((m) => m[1]!)
      const [m1, m2] = matricesIn(prompt).map(asMat)
      const asked = /entry of \$([A-Z])([A-Z])\$/.exec(prompt)!
      const byName: Record<string, Mat> = { [names[0]!]: m1!, [names[1]!]: m2! }
      const prod = byImages(byName[asked[1]!]!, byName[asked[2]!]!)
      const [pi, pj] = posIn(prompt)
      return { agrees: at(prod, pi, pj) === ans && ab !== ans, detail: `${asked[1]}${asked[2]} by images: (${prod.join(', ')})` }
    })(),
    values: { pos: POS[pos]!, names: `${A}${B}`, answer: ans },
  }
}

function squareEntry(r: Rng, slot: Question): Draft {
  const pos = int(r, 0, 3)
  const [i, j] = [Math.floor(pos / 2), pos % 2]
  const L = pick(r, ['A', 'M', 'B', 'P'])
  const m = draw(
    r,
    (r): Mat => [int(r, -3, 5), int(r, -3, 5), int(r, -3, 5), int(r, -3, 5)],
    (m) => {
      const ans = at(mul(m, m), i, j)
      // The entry squared, doubled, row with row, column with column: never the answer. A trace
      // of 0 would make the corners zero and the square a multiple of I (that is q11).
      const wrongs = [at(m, i, j) ** 2, 2 * at(m, i, j), at(mul(m, t(m)), i, j), at(mul(t(m), m), i, j)]
      return okMatrix(m) && new Set(sizes(m)).size === 4 && !m.includes(0) && m[0] + m[3] !== 0 && Math.abs(ans) >= 2 && !wrongs.includes(ans) && !sizes(m).includes(Math.abs(ans)) && m.filter((x) => x < 0).length <= 1
    },
  )
  const sq = mul(m, m)
  const ans = at(sq, i, j)
  const prompt = `$${L} = ${pm(m)}$. Work out the ${POS[pos]} entry of $${L}^2$.`
  const row = rowOf(m, i)
  const col = colOf(m, j)
  const solution =
    `$${L}^2 = ${L}${L}$. ${cap(ROW[i]!)} with the ${COL[j]}: $${dotTex(row, col)} = ${pair(row[0] * col[0], row[1] * col[1])} = ${ans}$. ` +
    `Squaring the entry, $${sub(at(m, i, j))}^2 = ${at(m, i, j) ** 2}$, is not the same sum. $${L}^2 = ${pm(sq)}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      const pmx = asMat(matricesIn(prompt)[0]!)
      const prod = byImages(pmx, pmx)
      const [pi, pj] = posIn(prompt)
      return { agrees: at(prod, pi, pj) === ans, detail: `square by images: (${prod.join(', ')})` }
    })(),
    values: { pos: POS[pos]!, a: m[0], d: m[3], answer: ans },
  }
}

// ---------------------------------------------------------------------------------------
// q8: unknown entries from a product. (a 2; 1 b)(3 1; 0 2) = (6 6; 3 9): b = 4.
// ---------------------------------------------------------------------------------------

type Cell = number | string
const LETTER_PAIRS = [['a', 'b'], ['p', 'q'], ['m', 'n'], ['h', 'k'], ['c', 'd']] as const
/** Unknown values: 2 to 7 either sign, positive more often, as written. */
const UNKNOWNS = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, -2, -3, -4, -5]

interface Term { k: number; letter?: string }
/** One entry of X·Y with letters in: the two products in order, as "3a", "a + 4", "1 + 2b". */
function entryTerms(x: Cell[], y: Cell[], i: number, j: number): Term[] {
  const terms: Term[] = []
  for (let s = 0; s < 2; s++) {
    const u = x[2 * i + s]!
    const v = y[2 * s + j]!
    if (typeof u === 'string') terms.push({ k: v as number, letter: u })
    else if (typeof v === 'string') terms.push({ k: u, letter: v })
    else terms.push({ k: u * v })
  }
  return terms.filter((term) => term.k !== 0)
}
function termsTex(terms: Term[]): string {
  if (!terms.length) return '0'
  return terms
    .map((term, n) => {
      const s = term.letter ? coef(term.k, term.letter) : show(term.k)
      if (n === 0) return s
      return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`
    })
    .join(' ')
}

function unknownEntries(r: Rng, slot: Question): Draft {
  const [x, y] = pick(r, LETTER_PAIRS)
  const askFirst = r() < 0.5
  const asked = askFirst ? x : y
  const vAsk = pick(r, UNKNOWNS)
  const lettersLeft = r() < 0.6
  const diagonal = r() < 0.6
  // As written (1 + 2b = 9), the asked letter's simplest equation mostly has a number beside it.
  // On the diagonal it always must: a lone term there (3a = 6 from a times 3) is the printed
  // entry divided by the known one, the slip refused below.
  const twoTerm = diagonal || r() < 0.5
  const built = draw(
    r,
    (r) => {
      const vOther = pick(r, UNKNOWNS)
      const [vx, vy] = askFirst ? [vAsk, vOther] : [vOther, vAsk]
      const p = int(r, -3, 5)
      const q = int(r, -3, 5)
      const letters: Cell[] = diagonal ? [x, p, q, y] : [p, x, y, q]
      // The known matrix as written (3 1; 0 2): sizes all different, one zero or negative at most.
      const known = draw(
        r,
        (r): Mat => [int(r, -2, 5), int(r, -2, 5), int(r, -2, 5), int(r, -2, 5)],
        (k) => distinct(k) && new Set(sizes(k)).size === 4 && !same(k, I) && !same(k, SHEET_A) && k.filter((v) => v < 0).length <= 1,
      )
      const filled = letters.map((c) => (c === x ? vx : c === y ? vy : c)) as Mat
      const [left, right]: [Cell[], Cell[]] = lettersLeft ? [letters, known] : [known, letters]
      const product = lettersLeft ? mul(filled, known) : mul(known, filled)
      return { vx, vy, p, q, letters, known, left, right, product }
    },
    (b) => {
      if (Math.abs(b.vx) === Math.abs(b.vy) || b.p === 0 || b.q === 0 || b.p === b.q) return false
      if ([b.p, b.q].filter((v) => v < 0).length > 1) return false
      const printed = [b.p, b.q, ...b.known, ...b.product]
      if (sizes(printed).includes(Math.abs(vAsk))) return false
      if (b.product.some((v) => Math.abs(v) > 30)) return false
      // Dividing or subtracting entry by entry (the sheet's q18 slip) never gives the answer.
      for (let k = 0; k < 4; k++) {
        if (b.known[k] !== 0 && b.product[k]! / b.known[k]! === vAsk) return false
        if (b.product[k]! - b.known[k]! === vAsk) return false
      }
      // Every entry with a letter in it is an equation to solve, never a read-off (b = 4 printed
      // as "b"), and each letter appears somewhere.
      const all = [0, 1, 2, 3].map((k) => entryTerms(b.left, b.right, Math.floor(k / 2), k % 2))
      for (const terms of all) {
        const lt = terms.find((term) => term.letter)
        if (lt && terms.length === 1 && Math.abs(lt.k) === 1) return false
      }
      const fewest = Math.min(...all.filter((terms) => terms.some((term) => term.letter === asked)).map((terms) => terms.length))
      if (fewest !== (twoTerm ? 2 : 1)) return false
      return [x, y].every((l) => all.some((terms) => terms.some((term) => term.letter === l)))
    },
  )
  const { vx, vy, left, right, product } = built
  const ans = vAsk
  const other = askFirst ? y : x
  const vOther = askFirst ? vy : vx
  const entries = [0, 1, 2, 3].map((k) => ({ k, terms: entryTerms(left, right, Math.floor(k / 2), k % 2) }))
  const withLetter = (l: string) => entries.filter((e) => e.terms.some((term) => term.letter === l))
  // The simplest equation for a letter: one term (3a = 6) before two (1 + 2b = 9).
  const best = (l: string) => [...withLetter(l)].sort((e, f) => e.terms.length - f.terms.length)[0]!
  const eAsk = best(asked)
  const eOther = best(other)
  const spare = entries.find((e) => e.k !== eAsk.k && e.k !== eOther.k && e.terms.some((term) => term.letter))
  const symbolic = pm(entries.map((e) => termsTex(e.terms)) as unknown as Mat)
  const cellTex = (c: Cell[]) => pm(c as unknown as Mat)
  const prompt = `$${cellTex(left)}${cellTex(right)} = ${pm(product)}$. Work out the value of $${asked}$.`
  const posName = (k: number) => cap(POS[k]!.replace('-', ' '))
  const solution =
    `Multiply out with the letters in: the product is $${symbolic}$. ` +
    `${posName(eAsk.k)}: $${termsTex(eAsk.terms)} = ${product[eAsk.k]}$, so $${asked} = ${ans}$. ` +
    `${posName(eOther.k)} gives $${other} = ${vOther}$` +
    (spare ? `, and then $${termsTex(spare.terms)} = ${product[spare.k]}$ checks.` : '.')
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [`product in terms of ${x} and ${y}`], `${asked} = ${minus(ans)}`),
      answer: ans,
      tolerance: 0,
    },
    check: (() => {
      // Second route: every pair of whole numbers from −20 to 20 put in for the letters, the
      // product worked by images and compared with the printed one; exactly one pair fits.
      const [lc, rc, nc] = matricesIn(prompt)
      const target = asMat(nc!)
      const fits: [number, number][] = []
      for (let s = -20; s <= 20; s++) {
        for (let u = -20; u <= 20; u++) {
          const put = (cells: string[][]) => cells.flat().map((c) => (c === x ? s : c === y ? u : Number(c))) as Mat
          if (same(byImages(put(lc!), put(rc!)), target)) fits.push([s, u])
        }
      }
      const pa = /value of \$([a-z])\$/.exec(prompt)![1]
      const got = fits.length === 1 ? (pa === x ? fits[0]![0] : fits[0]![1]) : NaN
      const printedOk = evalTex(termsTex(eAsk.terms), { [asked]: ans }) === product[eAsk.k]
      return { agrees: got === ans && printedOk, detail: `${fits.length} pair(s) fit: ${fits.map((f) => f.join(', ')).join('; ')}` }
    })(),
    values: { letters: `${x}${y}`, asked, terms: eAsk.terms.length, place: lettersLeft ? 'left' : 'right', pattern: diagonal ? 'diagonal' : 'anti', other: vOther, answer: ans },
  }
}

// ---------------------------------------------------------------------------------------
// q10: a point from its image. (2 1; 3 4)(x; y) = (5; 15): y = 3.
// q14: unknowns in the column. (2 3; 1 4)(a; b) = (8; 9): a = 1.
// ---------------------------------------------------------------------------------------

const lcm = (a: number, b: number) => Math.abs(a * b) / gcd(a, b)
const lin = (p: number, u: string, q: number, v: string) => `${coef(p, u)} ${q < 0 ? '-' : '+'} ${coef(Math.abs(q), v)}`
const COLUMN_VALUES = [1, 2, 3, 4, 5, 6, -1, -2, -3, -4, -5]

/**
 * Removing the unknown not asked from a·U + b·V = u and c·U + d·V = v: each equation scaled
 * so that unknown's coefficients match in size (by their lowest common multiple, as written:
 * 8x + 4y = 20 from twice 4x + 2y), then subtracted, or added where the signs differ.
 */
function eliminate(m: Mat, out: Vec, askTop: boolean) {
  const [p, q, s, w] = m
  const [c1, c2] = askTop ? [q, w] : [p, s]
  const l = lcm(c1, c2)
  const k1 = l / Math.abs(c1)
  const k2 = l / Math.abs(c2)
  const sameSign = Math.sign(c1) === Math.sign(c2)
  const [ask1, ask2] = askTop ? [p, s] : [q, w]
  // Subtracting, the order that leaves the asked unknown a positive coefficient; adding where
  // the signs differ (the draw then keeps only a positive sum).
  let order: 'first-second' | 'second-first' | 'add' = sameSign ? 'first-second' : 'add'
  let d = sameSign ? k1 * ask1 - k2 * ask2 : k1 * ask1 + k2 * ask2
  let e = sameSign ? k1 * out[0] - k2 * out[1] : k1 * out[0] + k2 * out[1]
  if (sameSign && d < 0) {
    order = 'second-first'
    d = -d
    e = -e
  }
  const biggest = Math.max(...[k1 * p, k1 * q, k1 * out[0], k2 * s, k2 * w, k2 * out[1], d, e].map(Math.abs))
  return { k1, k2, order, d, e, l, biggest }
}

function columnUnknowns(r: Rng, slot: Question): Draft {
  const higher = slot.id === 'q14'
  const [U, V] = higher ? ['a', 'b'] : ['x', 'y']
  // q10 asks the bottom unknown, q14 the top, as written.
  const askTop = higher
  const vAsk = pick(r, COLUMN_VALUES)
  // With an answer of ±1 or ±2 no entry may be that size, and a negative entry then leaves no
  // matrix whose working stays within the caps.
  const negatives = higher && Math.abs(vAsk) > 2 ? pick(r, [0, 1, 1]) : 0
  const { m, v, out } = draw(
    r,
    (r) => {
      const vOther = pick(r, COLUMN_VALUES)
      // The matrix first, on its own conditions: four different entries, none the answer's
      // size, and a determinant from 2 to 15 so the elimination stays by hand.
      const m = draw(
        r,
        (r): Mat => {
          const m: Mat = [int(r, 1, 6), int(r, 1, 6), int(r, 1, 6), int(r, 1, 6)]
          if (negatives) {
            const k = int(r, 0, 3)
            m[k] = -m[k]!
          }
          return m
        },
        (m) => distinct(m) && new Set(sizes(m)).size === 4 && !same(m, SHEET_A) && !sizes(m).includes(Math.abs(vAsk)) && Math.abs(m[0] * m[3] - m[1] * m[2]) >= 2 && Math.abs(m[0] * m[3] - m[1] * m[2]) <= 15,
      )
      const v: Vec = askTop ? [vAsk, vOther] : [vOther, vAsk]
      return { m, v, out: mulVec(m, v) }
    },
    ({ m, v, out }) => {
      const det = m[0] * m[3] - m[1] * m[2]
      const el = eliminate(m, out, askTop)
      // Working at the written scale: q10 scales one equation only (its coefficient of the
      // removed unknown divides the other), figures up to 50 and an image within ±25; q14 up to
      // 60. The asked unknown's coefficient comes out positive.
      const substituted = Math.abs((askTop ? m[0] : m[1]) * vAsk)
      const capFig = higher ? 60 : 50
      const capOut = higher ? 40 : 25
      const oneScaled = Math.min(el.k1, el.k2) === 1
      // The other unknown's size, the image's entries, the image mapped again: never the answer.
      return (
        Math.abs(det) >= 2 && Math.abs(det) <= 15 && el.l <= 12 && el.biggest <= capFig && substituted <= capFig && el.d > 0 && (higher || oneScaled) &&
        Math.abs(v[0]) !== Math.abs(v[1]) && out[0] !== 0 && out[1] !== 0 && out[0] !== out[1] && Math.abs(out[0]) <= capOut && Math.abs(out[1]) <= capOut &&
        !sizes([...m, ...out]).includes(Math.abs(vAsk)) && Math.abs(mulVec(m, out)[askTop ? 0 : 1]!) !== Math.abs(vAsk)
      )
    },
  )
  const ans = vAsk
  const [p, q, s, w] = m
  const [u1, u2] = out
  const asked = askTop ? U : V
  const other = askTop ? V : U
  const vOther = askTop ? v[1] : v[0]
  const eq1 = `${lin(p, U, q, V)} = ${u1}`
  const eq2 = `${lin(s, U, w, V)} = ${u2}`
  const { k1, k2, order, d, e } = eliminate(m, out, askTop)
  const s1 = k1 === 1 ? eq1 : `${lin(k1 * p, U, k1 * q, V)} = ${k1 * u1}`
  const s2 = k2 === 1 ? eq2 : `${lin(k2 * s, U, k2 * w, V)} = ${k2 * u2}`
  const scaledText = k1 === 1 && k2 === 1 ? '' : `$${s1}$ and $${s2}$; `
  const combine = order === 'add' ? 'add them' : order === 'first-second' ? 'subtract the second from the first' : 'subtract the first from the second'
  // Back into the first equation for the other unknown: its term, then the asked one's value.
  const [ca, cb] = askTop ? [q, p] : [p, q]
  const known = cb * ans
  const subst = `${coef(ca, other)} ${known < 0 ? '-' : '+'} ${Math.abs(known)} = ${u1}`
  const xv = askTop ? ans : vOther
  const yv = askTop ? vOther : ans
  const check2 = `${sub(s)} \\times ${sub(xv)} + ${sub(w)} \\times ${sub(yv)} = ${u2}`
  const mapping = !higher && r() < 0.4
  const prompt = mapping
    ? `The matrix $${pm(m)}$ maps the point $(${U}, ${V})$ to the point $(${u1}, ${u2})$. Work out the value of $${asked}$.`
    : `$${pm(m)}${colTex([U, V] as unknown as Vec)} = ${colTex(out)}$. Work out the value of $${asked}$.`
  const solution =
    `The product gives two equations: $${eq1}$ and $${eq2}$. ` +
    `To remove $${other}$: ${scaledText}${combine}: ${d === 1 ? `$${asked} = ${ans}$. ` : `$${coef(d, asked)} = ${e}$, so $${asked} = ${ans}$. `}` +
    `Substitute into the first: $${subst}$, so $${other} = ${vOther}$. Check in the second: $${check2}$.`
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, ['both equations'], `${asked} = ${minus(ans)}`),
      answer: ans,
      tolerance: 0,
    },
    check: (() => {
      // Second route: every whole-number point from −30 to 30 mapped by the printed matrix's
      // columns; exactly one lands on the printed image.
      const pmx = asMat(matricesIn(prompt)[0]!)
      const target: Vec = mapping
        ? (/to the point \$\((-?\d+), (-?\d+)\)\$/.exec(prompt)!.slice(1).map(Number) as Vec)
        : (numeric(matricesIn(prompt)[2]!) as Vec)
      const fits: Vec[] = []
      for (let s1 = -30; s1 <= 30; s1++) for (let s2 = -30; s2 <= 30; s2++) if (same(image(pmx, [s1, s2]), target)) fits.push([s1, s2])
      const pa = /value of \$([a-z])\$/.exec(prompt)![1]
      const got = fits.length === 1 ? fits[0]![pa === 'a' || pa === 'x' ? 0 : 1] : NaN
      return { agrees: got === ans && d * ans === e, detail: `${fits.length} point(s) fit: ${fits.map((f) => f.join(', ')).join('; ')}` }
    })(),
    values: { form: mapping ? 'mapping' : 'column', a: p, det: p * w - q * s, other: vOther, answer: ans },
  }
}

// ---------------------------------------------------------------------------------------
// q11: a square that is a multiple of I. C = (1 3; 2 −1), C² = 7I: k = 7.
// ---------------------------------------------------------------------------------------

function squareMultipleOfI(r: Rng, slot: Question): Draft {
  // Never A, B, R or S: the advanced sheet's written q12, q13, q17 and q18 name those matrices.
  const L = pick(r, ['C', 'M', 'N', 'T'])
  const [a, b, c] = draw(
    r,
    (r) => [pick(r, [1, 2, 3, 4, -1, -2, -3]), pick(r, [1, 2, 3, 4, 5, -1, -2, -3, -4]), pick(r, [1, 2, 3, 4, 5, -1, -2, -3, -4])] as const,
    ([a, b, c]) => {
      const k = a * a + b * c
      // Sizes all different (as written 1, 3, 2); k a real multiple, never ±1 or 0, and not
      // a printed figure; a² alone, a² − bc, a² + b², the determinant: never k.
      const wrongs = [a * a, a * a - b * c, a * a + b * b, -k, a * a + c * c]
      return new Set(sizes([a, b, c])).size === 3 && Math.abs(k) >= 2 && Math.abs(k) <= 30 && !sizes([a, b, c]).includes(Math.abs(k)) && !wrongs.includes(k)
    },
  )
  const m: Mat = [a, b, c, -a]
  const sq = mul(m, m)
  const k = sq[0]
  const prompt = pick(r, [
    `$${L} = ${pm(m)}$ and $${L}^2 = kI$. Work out the value of $k$.`,
    `$${L} = ${pm(m)}$. $${L}^2 = kI$, where $I$ is the $2 \\times 2$ identity matrix. Work out the value of $k$.`,
    `$${L} = ${pm(m)}$. Show that $${L}^2$ is a multiple of the identity matrix $I$: $${L}^2 = kI$. Work out the value of $k$.`,
  ])
  const solution =
    `Square it: top left $${dotTex(rowOf(m, 0), colOf(m, 0))} = ${sq[0]}$, top right $${dotTex(rowOf(m, 0), colOf(m, 1))} = ${sq[1]}$, ` +
    `bottom left $${dotTex(rowOf(m, 1), colOf(m, 0))} = ${sq[2]}$, bottom right $${dotTex(rowOf(m, 1), colOf(m, 1))} = ${sq[3]}$. ` +
    `So $${L}^2 = ${pm(sq)} = ${k}I$ and $k = ${k}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`all four entries of ${L}² attempted`], `k = ${minus(k)}`), answer: k, tolerance: 0 },
    check: (() => {
      // Second route: the printed matrix applied twice to (1, 0) and to (0, 1); each comes back
      // k times itself.
      const pmx = asMat(matricesIn(prompt)[0]!)
      const e1 = image(pmx, image(pmx, [1, 0]))
      const e2 = image(pmx, image(pmx, [0, 1]))
      return { agrees: e1[1] === 0 && e2[0] === 0 && e1[0] === k && e2[1] === k, detail: `(1, 0) → (${e1.join(', ')}), (0, 1) → (${e2.join(', ')})` }
    })(),
    values: { a, b, c, k },
  }
}

// ---------------------------------------------------------------------------------------
// q15: the smallest n with Rⁿ = I. R = (0 −1; 1 0): n = 4.
// ---------------------------------------------------------------------------------------

/** The smallest n up to 12 with Mⁿ = I, or 0. */
export function orderOf(m: Mat): number {
  let p = m
  for (let n = 1; n <= 12; n++) {
    if (same(p, I)) return n
    p = mul(p, m)
  }
  return 0
}

/** Every matrix with entries −3 to 3 whose powers return to I, by that smallest power; I and −I left out. */
export const FINITE_ORDER: Record<number, Mat[]> = (() => {
  const out: Record<number, Mat[]> = { 2: [], 3: [], 4: [], 6: [] }
  const R = [-3, -2, -1, 0, 1, 2, 3]
  for (const a of R) for (const b of R) for (const c of R) for (const d of R) {
    const m: Mat = [a, b, c, d]
    if (same(m, [-1, 0, 0, -1])) continue
    const n = orderOf(m)
    if (n > 1) out[n]!.push(m)
  }
  return out
})()

/** Orders weighted so that each answer stays under 40%: the quarter turn's family most. */
const ORDERS: [number, number][] = [[2, 0.25], [3, 0.24], [4, 0.3], [6, 0.21]]

const powerLine = (p: Mat, q: Mat) =>
  `top left $${dotTex(rowOf(p, 0), colOf(q, 0))} = ${at(mul(p, q), 0, 0)}$, top right $${dotTex(rowOf(p, 0), colOf(q, 1))} = ${at(mul(p, q), 0, 1)}$, ` +
  `bottom left $${dotTex(rowOf(p, 1), colOf(q, 0))} = ${at(mul(p, q), 1, 0)}$, bottom right $${dotTex(rowOf(p, 1), colOf(q, 1))} = ${at(mul(p, q), 1, 1)}$`

function orderToIdentity(r: Rng, slot: Question): Draft {
  let left = r()
  let n = 4
  for (const [o, w] of ORDERS) if ((left -= w) < 0) { n = o; break }
  const m = pick(r, FINITE_ORDER[n]!)
  // R only for the written quarter turn (q13 on the same sheet names it R); never A or S.
  const L = same(m, [0, -1, 1, 0]) ? pick(r, ['R', 'M', 'T', 'N']) : pick(r, ['M', 'T', 'N', 'Q'])
  const prompt = pick(r, [
    `$${L} = ${pm(m)}$. Work out the smallest positive integer $n$ for which $${L}^n = I$.`,
    `$${L} = ${pm(m)}$ and $I$ is the $2 \\times 2$ identity matrix. Work out the smallest positive integer $n$ for which $${L}^n = I$.`,
  ])
  const m2 = mul(m, m)
  const m3 = mul(m2, m)
  const quarter = same(m, [0, -1, 1, 0]) || same(m, [0, 1, -1, 0])
  let solution: string
  let method: string
  let answerText: string
  if (n === 2) {
    solution = `$${L}^2$: ${powerLine(m, m)}, so $${L}^2 = I$. $${L}$ itself is not $I$, so the smallest such $n$ is $2$.`
    method = `${L}² = I`
    answerText = `n = 2 with ${L} ≠ I noted`
  } else if (n === 4) {
    solution =
      `$${L}^2$: ${powerLine(m, m)}, so $${L}^2 = -I$. Then $${L}^3 = ${L}^2 ${L} = -${L}$, which is not $I$, and $${L}^4 = (${L}^2)^2 = (-I)^2 = I$. ` +
      `The smallest such $n$ is $4$${quarter ? ': a quarter turn repeated four times is a full turn' : ''}.`
    method = `${L}² = −I`
    answerText = `n = 4 with ${L}³ ≠ I noted`
  } else if (n === 3) {
    solution =
      `$${L}^2 = ${pm(m2)}$, which is not $I$. $${L}^3 = ${L}^2 ${L}$: ${powerLine(m2, m)}, so $${L}^3 = I$. The smallest such $n$ is $3$.`
    method = `${L}² found and ${L}³ = ${L}²${L} attempted`
    answerText = `n = 3 with ${L}² ≠ I noted`
  } else {
    solution =
      `$${L}^2 = ${pm(m2)}$, which is not $I$. $${L}^3 = ${L}^2 ${L}$: ${powerLine(m2, m)}, so $${L}^3 = -I$. ` +
      `Then $${L}^4 = -${L}$ and $${L}^5 = -${L}^2$, neither of which is $I$, and $${L}^6 = (${L}^3)^2 = (-I)^2 = I$. The smallest such $n$ is $6$.`
    method = `${L}³ = −I`
    answerText = `n = 6 with ${L}⁴ and ${L}⁵ ≠ I noted`
  }
  if (!(n === 3 ? same(m3, I) : n === 6 ? same(m3, [-1, 0, 0, -1]) : true)) throw new Error('order family mislabelled')
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], answerText), answer: n, tolerance: 0 },
    check: (() => {
      // Second route: (1, 0) and (0, 1) mapped again and again by the printed matrix until both
      // come home together.
      const pmx = asMat(matricesIn(prompt)[0]!)
      let e1: Vec = [1, 0]
      let e2: Vec = [0, 1]
      let found = 0
      for (let k = 1; k <= 24 && !found; k++) {
        e1 = image(pmx, e1)
        e2 = image(pmx, e2)
        if (same(e1, [1, 0]) && same(e2, [0, 1])) found = k
      }
      return { agrees: found === n, detail: `both corners home after ${found}` }
    })(),
    values: { n, matrix: m.join(' ') },
  }
}

// ---------------------------------------------------------------------------------------
// q16: a pattern in the powers. P = (1 2; 0 1): the top-right entry of P¹⁰ is 20.
// ---------------------------------------------------------------------------------------

const SHEARS = [2, 3, 4, 5, -2, -3, -4]

function shearPower(r: Rng, slot: Question): Draft {
  const s = pick(r, SHEARS)
  // The power never the corner's size (P⁵ with a corner of 5 makes 5 × 5 the corner squared).
  const n = pick(r, [5, 6, 7, 8, 9, 10, 11, 12, 15, 20].filter((k) => k !== Math.abs(s)))
  const upper = r() < 0.65
  // Never S, the reflection q13 names on the same sheet.
  const L = pick(r, ['P', 'Q', 'M', 'N'])
  const m: Mat = upper ? [1, s, 0, 1] : [1, 0, s, 1]
  const where = upper ? 'top-right' : 'bottom-left'
  const corner = upper ? 1 : 2
  const ans = n * s
  const p2 = mul(m, m)
  const p3 = mul(p2, m)
  const prompt = `$${L} = ${pm(m)}$. Work out the ${where} entry of $${L}^{${n}}$.`
  const step = s > 0 ? `adds $${s}$ to the corner` : `takes $${-s}$ from the corner`
  const solution =
    `$${L}^2 = ${pm(p2)}$ and $${L}^3 = ${pm(p3)}$: each extra factor of $${L}$ ${step} while the other entries stay $1, 0, 1$. ` +
    `So $${L}^n$ has ${where} entry $${coef(s, 'n')}$, and $${L}^{${n}}$ has $${ans}$.`
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`${L}² and ${L}³ found, or the pattern ${minus(coef(s, 'n'))} stated`], minus(ans)), answer: ans, tolerance: 0 },
    check: (() => {
      // Second route: the printed matrix applied n times to (1, 0) and (0, 1) one step at a
      // time; the asked entry read from the images.
      const pmx = asMat(matricesIn(prompt)[0]!)
      const pn = Number(/\^\{(\d+)\}\$\.$/.exec(prompt)![1])
      let e1: Vec = [1, 0]
      let e2: Vec = [0, 1]
      for (let k = 0; k < pn; k++) {
        e1 = image(pmx, e1)
        e2 = image(pmx, e2)
      }
      const power: Mat = [e1[0], e2[0], e1[1], e2[1]]
      const [i, j] = posIn(prompt)
      return { agrees: at(power, i, j) === ans && corner === 2 * i + j, detail: `${pn}th power by images: (${power.join(', ')})` }
    })(),
    values: { s, n, shape: upper ? 'upper' : 'lower', answer: ans },
  }
}

export const matrixGenerators: Generator[] = [
  fmBySlot('fm-matrix-entries', TOPIC, { q1: scalarEntry, q2: columnEntry, q4: productEntry, q6: otherWayEntry, q7: squareEntry }),
  fmBySlot('fm-matrix-unknowns', TOPIC, { q8: unknownEntries, q10: columnUnknowns, q14: columnUnknowns }),
  fmBySlot('fm-matrix-powers', TOPIC, { q11: squareMultipleOfI, q15: orderToIdentity, q16: shearPower }),
]

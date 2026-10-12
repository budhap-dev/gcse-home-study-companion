import type { Question } from '../../content/questions.ts'
import { int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), transformations-of-the-unit-square: the numeric slots.
 *
 * 5.1  Multiplying a 2 × 2 matrix by a 2 × 2 or a 2 × 1 matrix, and by a scalar (a point as a
 *      column; an enlargement as a scalar times a rotation or reflection matrix).
 * 5.3  Transformations of the unit square by a 2 × 2 matrix: rotations of 90°, 180° and 270°
 *      about the origin, reflections in x = 0, y = 0, y = x and y = −x, and enlargements
 *      centred on the origin.
 * 5.4  Combinations of transformations by matrix multiplication: A then B is BA.
 *
 * q16 (the smallest n with Mⁿ = I for a reflection) stays written: every reflection gives 2,
 * and the seven rotations and reflections in the specification cannot make 100 prompts.
 *
 * All non-calculator. Coordinates and q11's entries are single figures; q5's scale factor runs
 * from 3 to 13 (2 and 4 left out), so its area is at most 169. Every matrix is checked a second
 * way: rotations by cos and sin of the angle, reflections by 2(p·u)u − p with u along the
 * mirror line, a printed matrix by adding multiples of its columns, never by the row-times-
 * column product the solution prints.
 */

const TOPIC = 'transformations-of-the-unit-square'

export type Mat = [[number, number], [number, number]]
export type Pt = [number, number]

/** Row times column, as the solution prints it. */
export const mul = (A: Mat, B: Mat): Mat => [
  [A[0][0] * B[0][0] + A[0][1] * B[1][0] || 0, A[0][0] * B[0][1] + A[0][1] * B[1][1] || 0],
  [A[1][0] * B[0][0] + A[1][1] * B[1][0] || 0, A[1][0] * B[0][1] + A[1][1] * B[1][1] || 0],
]
export const scale = (k: number, A: Mat): Mat => [
  [k * A[0][0] || 0, k * A[0][1] || 0],
  [k * A[1][0] || 0, k * A[1][1] || 0],
]
/** The pack's pmatrix: `\begin{pmatrix} 0 & -1 \\ 1 & 0 \end{pmatrix}`. */
export const matTex = (A: Mat) => `\\begin{pmatrix} ${A[0][0]} & ${A[0][1]} \\\\ ${A[1][0]} & ${A[1][1]} \\end{pmatrix}`
/** The mark scheme's plain form: (0 −1; 1 0). */
const matText = (A: Mat) => minus(`(${A[0][0]} ${A[0][1]}; ${A[1][0]} ${A[1][1]})`)
/** A negative factor bracketed: (-2). */
const br = (n: number) => (n < 0 ? `(${n})` : String(n))
const pt = (p: Pt) => `(${p[0]}, ${p[1]})`
const same = (A: Mat, B: Mat) => A[0][0] === B[0][0] && A[0][1] === B[0][1] && A[1][0] === B[1][0] && A[1][1] === B[1][1]

/** Rounds away the cos/sin residue: these maps only ever land on whole numbers. */
const whole = (x: number) => Math.round(x * 1e9) / 1e9 || 0
const rotateBy = (deg: number) => (p: Pt): Pt => {
  const t = (deg * Math.PI) / 180
  return [whole(p[0] * Math.cos(t) - p[1] * Math.sin(t)), whole(p[0] * Math.sin(t) + p[1] * Math.cos(t))]
}
/** Reflection in the line through the origin at `deg` to the x axis: 2(p·u)u − p. */
const reflectIn = (deg: number) => (p: Pt): Pt => {
  const t = (deg * Math.PI) / 180
  const u: Pt = [Math.cos(t), Math.sin(t)]
  const d = p[0] * u[0] + p[1] * u[1]
  return [whole(2 * d * u[0] - p[0]), whole(2 * d * u[1] - p[1])]
}
/** A printed matrix applied as x times its first column plus y times its second. */
const byColumns = (A: Mat) => (p: Pt): Pt => [p[0] * A[0][0] + p[1] * A[0][1] || 0, p[0] * A[1][0] + p[1] * A[1][1] || 0]

export interface Named {
  key: string
  /** After "is": "rotated $90°$ anticlockwise about the origin". */
  verb: string
  /** As a noun: "a rotation of $90°$ anticlockwise about the origin". */
  noun: string
  matrix: Mat
  /** The same transformation by geometry, for the second route. */
  map: (p: Pt) => Pt
}

const R90: Mat = [[0, -1], [1, 0]]
const R180: Mat = [[-1, 0], [0, -1]]
const R270: Mat = [[0, 1], [-1, 0]]

export const NAMED: Record<string, Named> = {
  r90: { key: 'r90', verb: 'rotated $90°$ anticlockwise about the origin', noun: 'a rotation of $90°$ anticlockwise about the origin', matrix: R90, map: rotateBy(90) },
  r90cw: { key: 'r90cw', verb: 'rotated $90°$ clockwise about the origin', noun: 'a rotation of $90°$ clockwise about the origin', matrix: R270, map: rotateBy(-90) },
  r270: { key: 'r270', verb: 'rotated $270°$ anticlockwise about the origin', noun: 'a rotation of $270°$ anticlockwise about the origin', matrix: R270, map: rotateBy(270) },
  r180: { key: 'r180', verb: 'rotated $180°$ about the origin', noun: 'a rotation of $180°$ about the origin', matrix: R180, map: rotateBy(180) },
  fx0: { key: 'fx0', verb: 'reflected in the line $x = 0$', noun: 'a reflection in the line $x = 0$', matrix: [[-1, 0], [0, 1]], map: reflectIn(90) },
  fy0: { key: 'fy0', verb: 'reflected in the line $y = 0$', noun: 'a reflection in the line $y = 0$', matrix: [[1, 0], [0, -1]], map: reflectIn(0) },
  fyx: { key: 'fyx', verb: 'reflected in the line $y = x$', noun: 'a reflection in the line $y = x$', matrix: [[0, 1], [1, 0]], map: reflectIn(45) },
  fynx: { key: 'fynx', verb: 'reflected in the line $y = -x$', noun: 'a reflection in the line $y = -x$', matrix: [[0, -1], [-1, 0]], map: reflectIn(135) },
}
const REFLECTIONS = ['fx0', 'fy0', 'fyx', 'fynx'] as const
const QUARTER_TURNS = ['r90', 'r90cw', 'r270'] as const

/** The named transformation a matrix is, if any (r90cw and r270 share one: the first wins). */
const nameOf = (A: Mat) => Object.values(NAMED).find((n) => same(n.matrix, A))

/** Weighted choice: [value, weight] pairs. */
function weighted<T>(r: Rng, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [v, w] of items) {
    x -= w
    if (x < 0) return v
  }
  return items[items.length - 1]![0]
}

/** A non-zero coordinate from −9 to 9. */
const coord = (r: Rng) => int(r, 1, 9) * (r() < 0.5 ? -1 : 1)
/** A point with both coordinates non-zero and of different sizes, so no coordinate is the other's mirror. */
function point(r: Rng): Pt {
  const a = coord(r)
  let b = coord(r)
  while (Math.abs(b) === Math.abs(a)) b = coord(r)
  return [a, b]
}

/** The row-times-column lines for M times a point: "0 \times 3 + (-1) \times (-2) = 2". */
const pointLines = (M: Mat, p: Pt, image: Pt): [string, string] => [
  `${br(M[0][0])} \\times ${br(p[0])} + ${br(M[0][1])} \\times ${br(p[1])} = ${image[0]}`,
  `${br(M[1][0])} \\times ${br(p[0])} + ${br(M[1][1])} \\times ${br(p[1])} = ${image[1]}`,
]

// ---------------------------------------------------------------------------------------
// q2: the image of a point under a rotation. (3, −2) turned 90° anticlockwise: x = 2.
// ---------------------------------------------------------------------------------------

function pointImage(r: Rng, slot: Question): Draft {
  const t = NAMED[weighted<string>(r, [['r90', 0.35], ['r90cw', 0.25], ['r270', 0.25], ['r180', 0.15]])]!
  const p = point(r)
  const ask = r() < 0.5 ? 'x' : 'y'
  const image: Pt = [t.matrix[0][0] * p[0] + t.matrix[0][1] * p[1] || 0, t.matrix[1][0] * p[0] + t.matrix[1][1] * p[1] || 0]
  const answer = ask === 'x' ? image[0] : image[1]
  const label = pick(r, ['', 'A', 'P', 'B', 'Q'])
  const prompt = label
    ? `The point $${label}${pt(p)}$ is ${t.verb}. Work out the $${ask}$-coordinate of its image, $${label}'$.`
    : `The point $${pt(p)}$ is ${t.verb}. Work out the $${ask}$-coordinate of its image.`
  const [l1, l2] = pointLines(t.matrix, p, image)
  const solution = `Multiply by $${matTex(t.matrix)}$, the matrix of ${t.noun}: $${l1}$ and $${l2}$. The image is $${pt(image)}$, so the $${ask}$-coordinate is $${answer}$.`
  const second = t.map(p)
  const secondAnswer = ask === 'x' ? second[0] : second[1]
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], minus(answer)), answer, tolerance: 0 },
    check: { agrees: secondAnswer === answer, detail: `${pt(p)} turned by angle: ${pt(second)}` },
    values: { turn: t.key, x: p[0], y: p[1], ask, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q14: a point from its image under a rotation. 90° anticlockwise sends P to (−4, 6): x = 6.
// ---------------------------------------------------------------------------------------

/** How each quarter turn moves (x, y), as the solution states it, with its inverse. */
const RULES: Record<string, { rule: string; solve: (img: Pt) => Pt; lines: (img: Pt, P: Pt) => string }> = {
  r90: {
    rule: '(-y, x)',
    solve: (img) => [img[1], -img[0] || 0],
    lines: (img, P) => `$-y = ${img[0]}$ and $x = ${img[1]}$, so $x = ${P[0]}$ and $y = ${P[1]}$`,
  },
  r270: {
    rule: '(y, -x)',
    solve: (img) => [-img[1] || 0, img[0]],
    lines: (img, P) => `$y = ${img[0]}$ and $-x = ${img[1]}$, so $x = ${P[0]}$ and $y = ${P[1]}$`,
  },
}

function pointFromImage(r: Rng, slot: Question): Draft {
  const t = NAMED[weighted<string>(r, [['r90', 0.4], ['r90cw', 0.3], ['r270', 0.3]])]!
  const img = point(r)
  const ask = r() < 0.5 ? 'x' : 'y'
  const rule = RULES[t.key === 'r90' ? 'r90' : 'r270']!
  const P = rule.solve(img)
  const answer = ask === 'x' ? P[0] : P[1]
  const label = pick(r, ['P', 'P', 'A', 'B', 'Q'])
  const prompt = r() < 0.7
    ? `A rotation of ${t.noun.replace(/^a rotation of /, '')} sends the point $${label}$ to $${pt(img)}$. Work out the $${ask}$-coordinate of $${label}$.`
    : `The point $${label}$ is ${t.verb}. Its image is $${pt(img)}$. Work out the $${ask}$-coordinate of $${label}$.`
  const [l1, l2] = pointLines(t.matrix, P, img)
  const solution = `The matrix is $${matTex(t.matrix)}$, and it sends $(x, y)$ to $${rule.rule}$. So ${rule.lines(img, P)}: $${label} = ${pt(P)}$, and its $${ask}$-coordinate is $${answer}$. Check: $${l1}$ and $${l2}$, which is the image $${pt(img)}$.`
  const forward = t.map(P)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`the product with x and y in, or the rule (x, y) → ${rule.rule}`)], `${ask} = ${minus(answer)}`),
      answer,
      tolerance: 0,
    },
    check: { agrees: forward[0] === img[0] && forward[1] === img[1], detail: `${pt(P)} turned by angle: ${pt(forward)}` },
    values: { turn: t.key, imageX: img[0], imageY: img[1], ask, answer },
  }
}

// ---------------------------------------------------------------------------------------
// q5: the area after an enlargement. The matrix 2I: area 4.
// ---------------------------------------------------------------------------------------

/**
 * Scale factors, the same for every form. Never 4, where the perimeter 4k equals the area k²,
 * and never 2, where the two entries' sizes add to k² (2 + 2 = 2²) and so does the diagonal of 2I.
 */
export const AREA_K = [3, 5, 6, 7, 8, 9, 10, 11, 12, 13]

/** Shoelace area of a polygon, the second route. */
const shoelace = (v: Pt[]) => Math.abs(v.reduce((s, p, i) => s + p[0] * v[(i + 1) % v.length]![1] - v[(i + 1) % v.length]![0] * p[1], 0)) / 2

function enlargedArea(r: Rng, slot: Question): Draft {
  // Plain kI most of the time, as the written 2I; a scaled turn or reflection is q13 and q18's
  // idea (8-9), kept to about a third.
  const form = weighted<string>(r, [['enlargement', 0.55], ['negative', 0.1], ['r90', 0.0875], ['r270', 0.0875], ['fx0', 0.04375], ['fy0', 0.04375], ['fyx', 0.04375], ['fynx', 0.04375]])
  // Not (3 0; 0 −3) with its description: q18's answer, word for word, on the advanced sheet.
  const k = pick(r, form === 'fy0' ? AREA_K.filter((x) => x !== 3) : AREA_K)
  const base: Mat = form === 'enlargement' ? [[1, 0], [0, 1]] : form === 'negative' ? R180 : NAMED[form]!.matrix
  const M = scale(k, base)
  const area = k * k
  const c1: Pt = [M[0][0], M[1][0]]
  const c2: Pt = [M[0][1], M[1][1]]
  const far: Pt = [c1[0] + c2[0], c1[1] + c2[1]]
  const asks = [
    `The unit square is transformed by the matrix $${matTex(M)}$. Work out the area of the image.`,
    `The matrix $${matTex(M)}$ maps the unit square onto the shape $S$. Work out the area of $S$.`,
    `The unit square is mapped by the matrix $${matTex(M)}$. What is the area of its image?`,
    `The matrix $${matTex(M)}$ transforms the unit square. Work out the area of the image.`,
    `The unit square $OABC$ is transformed by the matrix $${matTex(M)}$ to $OA'B'C'$. Work out the area of $OA'B'C'$.`,
  ]
  const prompt = asks[weighted<number>(r, [[0, 0.4], [1, 0.15], [2, 0.15], [3, 0.15], [4, 0.15]])]!
  const what =
    form === 'enlargement'
      ? `The matrix is $${k}I$, an enlargement of scale factor $${k}$ centred on the origin.`
      : form === 'negative'
        ? `The matrix is $-${k}I$, an enlargement of scale factor $-${k}$ centred on the origin.`
        : `The matrix is $${k}$ times the matrix of ${NAMED[form]!.noun}, so it is that ${form.startsWith('r') ? 'rotation' : 'reflection'} combined with an enlargement of scale factor $${k}$ centred on the origin.`
  const solution = `${what} Its columns are the images of $(1, 0)$ and $(0, 1)$, so the image of the unit square has vertices $(0, 0)$, $${pt(c1)}$, $${pt(far)}$ and $${pt(c2)}$: a square of side $${k}$. Lengths are multiplied by $${k}$, so the area is multiplied by $${k}^2$: the area is $${k}^2 = ${area}$.`
  const corners: Pt[] = ([[0, 0], [1, 0], [1, 1], [0, 1]] as Pt[]).map(byColumns(M))
  const measured = shoelace(corners)
  return {
    question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], String(area)), answer: area, tolerance: 0 },
    check: { agrees: measured === area, detail: `image corners ${corners.map(pt).join(' ')}, shoelace area ${measured}` },
    values: { form, k, area },
  }
}

// ---------------------------------------------------------------------------------------
// q11: the matrix of a combination. Reflect in y = x, then in x = 0: M₂M₁, bottom left 1.
// ---------------------------------------------------------------------------------------

export const ENTRIES = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const

/**
 * The first transformation is always a quarter turn and the second a reflection. A reflection
 * first would let row-times-row pay (a reflection's matrix is its own transpose), and two
 * rotations, or anything with 180° or a plain enlargement, give the same matrix in either
 * order. With a quarter turn then a reflection, the order reversed, row times row, the turn's
 * direction reversed and y = x for y = −x each give the answer's negative.
 */
function combination(r: Rng, slot: Question): Draft {
  const kind = weighted<string>(r, [['named', 0.35], ['matrix first', 0.3], ['matrix second', 0.35]])
  const first = NAMED[pick(r, kind === 'matrix first' ? ['r90', 'r270'] : QUARTER_TURNS)]!
  const second = NAMED[pick(r, REFLECTIONS)]!
  let k = 1
  if (kind !== 'named') {
    // Not (0 −2; 2 0), q13's answer on the same sheet, nor (3 0; 0 −3), q18's.
    // Never (0 −2; 2 0), q13's answer on the same sheet; never (3 0; 0 −3), q18's matrix, in the
    // prompt or as the product the solution prints and names.
    const banned: number[] = []
    if (kind === 'matrix first' && first.key === 'r90') banned.push(2)
    if ((kind === 'matrix second' && second.key === 'fy0') || same(mul(second.matrix, first.matrix), NAMED.fy0!.matrix)) banned.push(3)
    k = pick(r, [2, 3, 4, 5, 6, 7, 8, 9].filter((x) => !banned.includes(x)))
  }
  const M1 = kind === 'matrix first' ? scale(k, first.matrix) : first.matrix
  const M2 = kind === 'matrix second' ? scale(k, second.matrix) : second.matrix
  const P = mul(M2, M1)
  const nonzero = [0, 1, 2, 3].filter((i) => P[i >> 1]![i & 1] !== 0)
  const e = pick(r, nonzero)
  const [i, j] = [e >> 1, e & 1]
  const answer = P[i]![j]!
  const entry = ENTRIES[e]!
  const step1 = kind === 'matrix first' ? `transformed by the matrix $${matTex(M1)}$` : first.verb
  const step2 = kind === 'matrix second' ? `transformed by the matrix $${matTex(M2)}$` : second.verb
  const ask = kind === 'named' ? 'the matrix of the single equivalent transformation' : 'the matrix of the combined transformation'
  const prompt = `The unit square is ${step1} and the image is then ${step2}. Work out the ${entry} entry of ${ask}.`
  const cap = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`
  const intro1 = kind === 'matrix first' ? `The first matrix is $M_1 = ${matTex(M1)}$` : `${cap(first.noun.replace(/^a /, ''))} is $M_1 = ${matTex(M1)}$`
  const intro2 = kind === 'matrix second' ? `the second is $M_2 = ${matTex(M2)}$` : `${second.noun.replace(/^a /, '')} is $M_2 = ${matTex(M2)}$`
  const opening = `${intro1} and ${intro2}.`
  const cell = (a: number, b: number) => `${br(M2[a]![0])} \\times ${br(M1[0]![b])} + ${br(M2[a]![1])} \\times ${br(M1[1]![b])} = ${P[a]![b]}`
  const lines = ENTRIES.map((name, n) => `${name.replace('-', ' ')} $${cell(n >> 1, n & 1)}$`).join(', ')
  const reflection = nameOf(scale(1 / k, P))!
  const result = k === 1 ? `That matrix is ${reflection.noun}.` : `That matrix is ${reflection.noun} combined with an enlargement of scale factor $${k}$ centred on the origin.`
  const solution = `${opening} The second transformation goes on the left, so the combination is $M_2 M_1$: ${lines}. So $M_2 M_1 = ${matTex(P)}$, and the ${entry} entry is $${answer}$. ${result}`
  // Second route: (1, 0) and (0, 1) sent through both transformations by geometry, or a
  // printed matrix by adding multiples of its columns; their images are the product's columns.
  const map1 = kind === 'matrix first' ? byColumns(M1) : first.map
  const map2 = kind === 'matrix second' ? byColumns(M2) : second.map
  const col = map2(map1(j === 0 ? [1, 0] : [0, 1]))
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, ['M₂M₁ with the matrices the right way round'], `${minus(answer)}, from ${matText(P)}`),
      answer,
      tolerance: 0,
    },
    check: { agrees: col[i] === answer, detail: `column ${j + 1} by geometry: ${pt(col)}` },
    values: { kind, first: first.key, second: second.key, k, entry, answer },
  }
}

export const transformationGenerators: Generator[] = [
  fmBySlot('fm-image-of-a-point', TOPIC, { q2: pointImage, q14: pointFromImage }),
  fmBySlot('fm-unit-square-area', TOPIC, { q5: enlargedArea }),
  fmBySlot('fm-combined-transformations', TOPIC, { q11: combination }),
]

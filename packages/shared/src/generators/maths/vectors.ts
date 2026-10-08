import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

/** Generators for vector arithmetic. */

const TOPIC = 'vector-arithmetic'

type Vec = [number, number]

const NAMES: [string, string][] = [['a', 'b'], ['p', 'q'], ['u', 'v']]
const bold = (n: string) => `\\mathbf{${n}}`
const col = ([x, y]: Vec) => `\\begin{pmatrix} ${x} \\\\ ${y} \\end{pmatrix}`
/** The answer as the written questions take it, two numbers and a comma, and in brackets. */
const forms = ([x, y]: Vec) => [`${x}, ${y}`, `(${x}, ${y})`]
/** A number in a sum, bracketed when negative: 3 + (-2). */
const term = (n: number) => (n < 0 ? `(${n})` : `${n}`)

/** A vector with whole-number parts, not the zero vector. */
const vector = (r: Rng, lo = -6, hi = 9): Vec => draw(r, (r) => [int(r, lo, hi), int(r, lo, hi)] as Vec, ([x, y]) => x !== 0 || y !== 0)

/**
 * The end of a walk from a starting point, one step at a time. The second route for every
 * combination: k lots of a vector is k steps of it, and a − b is a step of a then a step
 * back along b. The answer must be where the walk ends, less where it began.
 */
function walk(start: Vec, steps: Vec[]): Vec {
  let [x, y] = start
  for (const [dx, dy] of steps) {
    x += dx
    y += dy
  }
  return [x - start[0], y - start[1]]
}
const times = (k: number, v: Vec): Vec[] => Array.from({ length: Math.abs(k) }, () => (k < 0 ? [-v[0], -v[1]] : v))

/** Each written slot's combination: q2 a + b, q4 ka (core); q5 a − b (higher); q11 pa ± qb (advanced). */
type Combination = 'sum' | 'multiple' | 'difference' | 'mixed'
const COMBINATION: Record<string, Combination> = { q2: 'sum', q4: 'multiple', q5: 'difference', q11: 'mixed' }

/**
 * Adding, subtracting and multiplying column vectors: written as q2 (a + b), q4 (2a), q5
 * (a − b) and q11 (2a + b, grade 8-9). Each slot keeps its combination; q11 varies both
 * multipliers and the sign. Accepted, as the written ones are: "x, y", and "(x, y)" as q5
 * already takes.
 */
export const vectorCombination: Generator = {
  id: 'vector-combination',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q2', 'q4', 'q5', 'q11'],
  build(r, slot): Draft {
    const kind = COMBINATION[slot.id] ?? 'sum'
    const [na, nb] = pick(r, NAMES)
    const A = bold(na), B = bold(nb)
    const a = vector(r)
    const tail = ' Give two numbers separated by a comma.'
    let p = 1, q = 0
    if (kind === 'sum') q = 1
    if (kind === 'difference') q = -1
    if (kind === 'multiple') p = pick(r, [2, 2, 3, 3, 4, 5, -2, -3])
    if (kind === 'mixed') {
      p = pick(r, [2, 3, 4])
      q = pick(r, [1, 2, 3, -1, -2, -3])
    }
    const b = q === 0 ? ([0, 0] as Vec) : draw(r, (r) => vector(r), (v) => v[0] !== a[0] || v[1] !== a[1])
    const answer: Vec = [p * a[0] + q * b[0], p * a[1] + q * b[1]]
    const coef = (k: number, name: string) => (k === 1 ? name : k === -1 ? `-${name}` : `${k}${name}`)
    const expr = q === 0 ? coef(p, A) : `${coef(p, A)} ${q < 0 ? '-' : '+'} ${coef(Math.abs(q), B)}`
    const given = q === 0 ? `$${A} = ${col(a)}$` : `$${A} = ${col(a)}$ and $${B} = ${col(b)}$`
    let solution: string
    if (kind === 'sum') solution = `Add the top numbers and the bottom numbers: $${a[0]} + ${term(b[0])} = ${answer[0]}$ and $${a[1]} + ${term(b[1])} = ${answer[1]}$.`
    else if (kind === 'difference') solution = `Subtract each part of $${B}$ from the same part of $${A}$: $${a[0]} - ${term(b[0])} = ${answer[0]}$ and $${a[1]} - ${term(b[1])} = ${answer[1]}$.`
    else if (kind === 'multiple') solution = `Multiply both parts by ${p}: $${p} \\times ${term(a[0])} = ${answer[0]}$ and $${p} \\times ${term(a[1])} = ${answer[1]}$.`
    else {
      const pa: Vec = [p * a[0], p * a[1]]
      const qb: Vec = [Math.abs(q) * b[0], Math.abs(q) * b[1]]
      const qName = coef(Math.abs(q), B)
      solution = `$${coef(p, A)}$ is $(${pa[0]}, ${pa[1]})$${Math.abs(q) === 1 ? '' : ` and $${qName}$ is $(${qb[0]}, ${qb[1]})$`}, then ${q > 0 ? 'add' : 'subtract'} $(${qb[0]}, ${qb[1]})$ to get $(${answer[0]}, ${answer[1]})$.`
    }
    // Second route: a walk from a random point, one step of a or b at a time.
    const start: Vec = [int(r, -5, 5), int(r, -5, 5)]
    const walked = walk(start, [...times(p, a), ...times(q, b)])
    return {
      question: {
        type: 'short-text',
        prompt: `Work out $${expr}$ where ${given}.${tail}`,
        solution,
        markScheme: scheme(slot, [], `${answer[0]}, ${answer[1]}`),
        accepted: forms(answer),
      },
      check: { agrees: walked[0] === answer[0] && walked[1] === answer[1], detail: `walked from (${start.join(', ')}) by ${Math.abs(p)} steps of ${na} and ${Math.abs(q)} of ${nb}: (${walked.join(', ')})` },
      values: { kind, p, q, a: a.join(','), b: b.join(',') },
    }
  },
}

/** Pythagorean triples: a vector whose length is a whole number. */
const TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20]]

/**
 * A vector's magnitude: written as q7 (3 and 4, so 5; tolerance 0.05). Usually the parts come
 * from a Pythagorean triple, in either order and with either sign; otherwise the answer is
 * given to 1 decimal place. The second route uses the vector's direction: its length is the
 * x part over the cosine of its angle with the x axis.
 */
export const vectorMagnitude: Generator = {
  id: 'vector-magnitude',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q7'],
  build(r, slot): Draft {
    const whole = r() < 0.6
    const v: Vec = whole
      ? (() => {
          const [x, y] = pick(r, TRIPLES)
          const flip = r() < 0.5
          return [(flip ? y : x) * (r() < 0.5 ? -1 : 1), (flip ? x : y) * (r() < 0.5 ? -1 : 1)] as Vec
        })()
      : draw(r, (r) => [int(r, -9, 9), int(r, -9, 9)] as Vec, ([x, y]) => x !== 0 && y !== 0 && !Number.isInteger(Math.hypot(x, y)) && Math.hypot(x, y) >= 3 && clearOfHalf(Math.hypot(x, y), 1))
    const sum = v[0] ** 2 + v[1] ** 2
    const exact = Math.sqrt(sum)
    const answer = whole ? exact : roundTo(exact, 1)
    const sq = (n: number) => (n < 0 ? `(${n})^2` : `${n}^2`)
    const end = whole ? `${answer}` : `${exact.toFixed(4).slice(0, -1)}\\ldots = ${fixed(exact, 1)}$ to 1 decimal place.`
    // Second route: the angle with the x axis, then the length as x ÷ cos θ.
    const theta = Math.atan2(v[1], v[0])
    const viaAngle = Math.abs(v[0] / Math.cos(theta))
    return {
      question: {
        type: 'numeric',
        prompt: `What is the magnitude of the vector $${col(v)}$?${whole ? '' : ' Give your answer to 1 decimal place.'}`,
        solution: `The magnitude is the length of the hypotenuse of a right-angled triangle with sides ${Math.abs(v[0])} and ${Math.abs(v[1])}: $\\sqrt{${sq(v[0])} + ${sq(v[1])}} = \\sqrt{${sum}} = ${end}${whole ? '$.' : ''}`,
        markScheme: scheme(slot, ['uses Pythagoras'], whole ? String(answer) : fixed(exact, 1)),
        answer,
        tolerance: 0.05,
      },
      check: { agrees: Math.abs(viaAngle - exact) < 1e-9 && (whole ? Number.isInteger(answer) : roundTo(viaAngle, 1) === answer), detail: `angle ${show(roundTo((theta * 180) / Math.PI, 4))}°: |${v[0]} ÷ cos θ| = ${show(roundTo(viaAngle, 6))}` },
      values: { x: v[0], y: v[1], whole: whole ? 'triple' : 'rounded' },
    }
  },
}

export const vectorsGenerators: Generator[] = [vectorCombination, vectorMagnitude]

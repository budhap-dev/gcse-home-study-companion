import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { minus } from './build.ts'
import { evalTex, fracTex, fracText, gcd, reduce, sub, terminates } from '../maths/formulae.ts'
import { equationPoly, fromTex, lin, mathIn, poly, polyAt, polyOf } from '../maths/quadratics.ts'

/**
 * Further Maths (AQA 8365): completing-the-square-and-quadratic-equations.
 *
 * 2.12 Completing the square: reading the minimum of a(x − h)² + k, and b in the
 *      specification's own 2x² + 6x + 7 ≡ a(x + b)² + c.
 * 2.14 Solution of quadratic equations, by factorising in a context (a ball thrown upwards)
 *      and by the formula to 2 decimal places.
 */

const TOPIC = 'completing-the-square-and-quadratic-equations'

const either = (r: Rng, most: number) => (r() < 0.5 ? -1 : 1) * int(r, 1, most)

// ---------------------------------------------------------------------------------------
// q3: the minimum of 2(x - 1)^2 + 3.
// ---------------------------------------------------------------------------------------

/**
 * The minimum value of a(x − h)² + k: written as q3, 2(x − 1)² + 3. The a is 2 to 5 as the
 * written one is, and k is never ±h or ±a, so the x of the minimum or the multiplier read off
 * by mistake is never the answer.
 */
export const minimumValue: Generator = {
  id: 'fm-minimum-value',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q3'],
  build(r, slot): Draft {
    const { a, h, k } = draw(
      r,
      (r) => ({ a: int(r, 2, 5), h: either(r, 9), k: either(r, 20) }),
      ({ a, h, k }) => Math.abs(k) !== Math.abs(h) && Math.abs(k) !== a && Math.abs(h) !== a,
    )
    const expr = `${a}(${lin(1, -h, 'x', true)})^2 ${k < 0 ? '-' : '+'} ${Math.abs(k)}`
    const prompt = r() < 0.7 ? `What is the minimum value of $${expr}$?` : `Write down the minimum value of $${expr}$.`
    // Second route: evaluate the printed expression across a grid of x and take the least.
    let least = Infinity
    let at = NaN
    for (let i = -100; i <= 100; i++) {
      const x = i / 4
      const y = evalTex(expr, { x })
      if (y < least) [least, at] = [y, x]
    }
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `The bracket is never negative and is $0$ at $x = ${h}$, so the expression is at least $${k}$. The minimum value is $${k}$, at $x = ${h}$.`,
        markScheme: scheme(slot, [], minus(k)),
        answer: k,
        tolerance: 0,
      },
      check: { agrees: least === k && at === h, detail: `least of ${expr} on a grid: ${least} at x = ${at}` },
      values: { a, h, k },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q8: a ball thrown upwards. h = 20t - 5t^2, first at 15 m.
// ---------------------------------------------------------------------------------------

/** The two times it passes the height, whole seconds, with a launch speed of 15 to 30 m/s. */
export const TIMES: [number, number][] = [
  [1, 2],
  [1, 3],
  [1, 4],
  [1, 5],
  [2, 3],
  [2, 4],
]

/** Where it is thrown from, and the heights that start can have. */
export const STARTS = [
  { heights: [0], text: (_: number) => 'A ball is thrown straight up from the ground.', above: 'Its height' },
  { heights: [1, 2], text: (h0: number) => `A ball is thrown straight up from ${h0} m above the ground.`, above: 'Its height above the ground' },
  { heights: [5, 6, 8, 10, 12, 15], text: (h0: number) => `A ball is thrown straight up from a window ${h0} m above the ground.`, above: 'Its height above the ground' },
  { heights: [20, 25, 30, 40, 45, 50, 60], text: (h0: number) => `A stone is thrown straight up from the top of a cliff ${h0} m high.`, above: 'Its height above the beach' },
]

/**
 * A thrown ball reaching a height: written as q8, h = 20t − 5t² and 15 m first reached at
 * 1 s. The start can be above the ground (h = h₀ + ut − 5t²), and the question asks for the
 * first time half the time and the time on the way down the other half, so the smaller root
 * is not always the answer.
 */
export const ballHeight: Generator = {
  id: 'fm-ball-height',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q8'],
  build(r, slot): Draft {
    // The answer first. Picking a pair of times made 1 s the answer to two "first" questions
    // in three: on the way up it is 1 or 2 evenly, on the way down 3 and 4 twice as often as
    // 2 and 5, so 5 s is under a tenth of all builds.
    const first = r() < 0.5
    const asked = first ? pick(r, [1, 2]) : pick(r, [2, 3, 3, 4, 4, 5])
    const [t1, t2] = pick(r, TIMES.filter(([a, b]) => (first ? a : b) === asked))
    const { start, h0 } = draw(
      r,
      (r) => {
        const start = pick(r, STARTS)
        return { start, h0: pick(r, start.heights) }
      },
      ({ h0 }) => h0 !== asked,
    )
    const S = t1 + t2
    const P = t1 * t2
    const u = 5 * S
    const X = h0 + 5 * P
    const answer = first ? t1 : t2
    const formula = h0 === 0 ? `${u}t - 5t^2` : `${h0} + ${u}t - 5t^2`
    const thing = start.text(h0).startsWith('A stone') ? 'stone' : 'ball'
    const ask = first ? `does it first reach a height of ${X} m?` : `is it at a height of ${X} m on its way down?`
    const prompt = `${start.text(h0)} ${start.above} is $h = ${formula}$ metres after $t$ seconds. At what time, in seconds, ${ask}`
    const seconds = (t: number) => `$${t}$ second${t === 1 ? '' : 's'}`
    const solution =
      `$${formula} = ${X}$, so $5t^2 - ${u}t + ${5 * P} = 0$ and $t^2 - ${S}t + ${P} = 0$: $(t - ${t1})(t - ${t2}) = 0$. ` +
      `The ${thing} is at ${X} m at $t = ${t1}$ on the way up and $t = ${t2}$ on the way down, so ${first ? 'first at' : 'on the way down at'} ${seconds(answer)}.`
    // Second route: the printed formula at the answer, and the height either side of it.
    const hAt = (t: number) => evalTex(formula, { t })
    const before = Array.from({ length: 50 }, (_, i) => hAt((answer * i) / 50))
    const rising = hAt(answer - 0.01) < X && hAt(answer + 0.01) > X
    const falling = hAt(answer - 0.01) > X && hAt(answer + 0.01) < X
    const agrees = Math.abs(hAt(answer) - X) < 1e-9 && (first ? rising && before.every((h) => h < X) : falling)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [`t² − ${S}t + ${P} = 0`], `t = ${answer}`),
        answer,
        tolerance: 0,
        units: 's',
      },
      check: { agrees, detail: `h(${answer}) = ${hAt(answer)} against ${X}; ${first ? 'rising, below before' : 'falling'}: ${first ? rising : falling}` },
      values: { u, h0, X, t1, t2, asked: first ? 'first' : 'on the way down' },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q11: the formula to 2 decimal places. x^2 + 4x - 7 = 0, the positive solution.
// ---------------------------------------------------------------------------------------

/** A root of the printed quadratic by halving, from the vertex outwards: a route that never uses the formula. */
function halving(f: (x: number) => number, lo: number, hi: number): number {
  let L = lo
  let H = hi
  for (let i = 0; i < 200; i++) {
    const m = (L + H) / 2
    if (Math.sign(f(m)) === Math.sign(f(L))) L = m
    else H = m
  }
  return (L + H) / 2
}

/**
 * The quadratic formula with a negative c: written as q11, x² + 4x − 7 = 0 and the positive
 * solution to 2 d.p. The a is 1 most often and sometimes 2 or 3; c < 0 makes one root of each
 * sign, and the question asks for the positive one or the negative one.
 */
export const formulaTwoPlaces: Generator = {
  id: 'fm-formula-two-places',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q11'],
  build(r, slot): Draft {
    const positive = r() < 0.6
    const { a, b, c } = draw(
      r,
      (r) => ({ a: pick(r, [1, 1, 1, 2, 3]), b: (r() < 0.5 ? -1 : 1) * int(r, 2, 9), c: -int(r, 1, 15) }),
      ({ a, b, c }) => {
        const D = b * b - 4 * a * c
        if (Number.isInteger(Math.sqrt(D)) || Math.abs(c) === Math.abs(b) || Math.abs(b) === a || gcd(gcd(a, b), c) !== 1) return false
        const root = (-b + (positive ? 1 : -1) * Math.sqrt(D)) / (2 * a)
        const shown = (-b + (positive ? 1 : -1) * roundTo(Math.sqrt(D), 3)) / (2 * a)
        // √D shown to 3 places, or rounded to 2 first as a student might, gives the same answer.
        const twoPlaces = (-b + (positive ? 1 : -1) * roundTo(Math.sqrt(D), 2)) / (2 * a)
        return (
          Math.abs(root) >= 0.3 && clearOfHalf(root, 2, 0.05) && clearOfHalf(Math.sqrt(D), 2, 0.05) &&
          roundTo(shown, 2) === roundTo(root, 2) && roundTo(twoPlaces, 2) === roundTo(root, 2)
        )
      },
    )
    const D = b * b - 4 * a * c
    const sq = Math.sqrt(D)
    const root = (-b + (positive ? 1 : -1) * sq) / (2 * a)
    const other = (-b + (positive ? -1 : 1) * sq) / (2 * a)
    const answer = roundTo(root, 2)
    const word = positive ? 'positive' : 'negative'
    const equation = `${poly([c, b, a])} = 0`
    const prompt = `Solve $${equation}$. Give the ${word} solution to 2 decimal places.`
    const solution =
      `The formula with $a = ${a}$, $b = ${b}$, $c = ${c}$: $x = \\dfrac{${-b} \\pm \\sqrt{${b * b} + ${-4 * a * c}}}{${2 * a}} = \\dfrac{${-b} \\pm \\sqrt{${D}}}{${2 * a}}$. ` +
      `The ${word} root is $\\dfrac{${-b} ${positive ? '+' : '-'} ${fixed(sq, 3)}}{${2 * a}} = ${fixed(root, 2)}$ to 2 d.p.; the other is $${fixed(other, 2)}$.`
    // Second route: halving on the printed equation, on the side of zero the asked-for root lies.
    const p = equationPoly(mathIn(prompt))!
    const f = (x: number) => polyAt(p, x)
    const found = positive ? halving(f, 0, 100) : halving(f, -100, 0)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [`$x = \\dfrac{${-b} \\pm \\sqrt{${sub(b)}^2 - 4(${a})(${c})}}{${2 * a}}$, the negative $c$ bracketed`], fixed(root, 2).replace('-', '−')),
        answer,
        tolerance: 0.005,
      },
      check: { agrees: roundTo(found, 2) === answer && Math.abs(found - root) < 1e-9, detail: `halving on ${equation}: ${found}; formula ${root}` },
      values: { a, b, c, root: word },
    }
  },
}

// ---------------------------------------------------------------------------------------
// q12: the specification example. 2x^2 + 6x + 7 = a(x + b)^2 + c, find b.
// ---------------------------------------------------------------------------------------

/** Every B for a given A with b = B/(2A) a decimal that is not whole: at most 3 places. */
const bsFor = (A: number) => Array.from({ length: 41 }, (_, i) => i - 20).filter((B) => B !== 0 && B % (2 * A) !== 0 && terminates(B, 2 * A) && Math.abs(B) !== A)

/**
 * b in Ax² + Bx + C ≡ a(x + b)² + c: written as q12, the specification's 2x² + 6x + 7 and
 * b = 1.5. A is 2 to 5, so halving B without dividing by A first (the commonest slip) or
 * dividing by A without halving never gives b. b is drawn first, uniformly, and B fitted.
 */
export const completingTheSquareB: Generator = {
  id: 'fm-completing-the-square-b',
  subjectId: 'further-maths',
  topicId: TOPIC,
  replaces: ['q12'],
  build(r, slot): Draft {
    const A = int(r, 2, 5)
    const B = pick(r, bsFor(A))
    const C = draw(
      r,
      (r) => either(r, 15),
      (C) => Math.abs(C) !== Math.abs(B) && Math.abs(C) !== A && 4 * A * C !== B * B,
    )
    const b = Number(show(B / (2 * A)))
    const [cn, cd] = reduce(4 * A * C - B * B, 4 * A)
    const quad = poly([C, B, A])
    const inside = `x^2 ${B < 0 ? '-' : '+'} ${fracTex(Math.abs(B), A)}x`
    const bTex = fracTex(B, 2 * A, '\\frac')
    const square = `${A}\\left(x ${B < 0 ? '-' : '+'} ${fracTex(Math.abs(B), 2 * A)}\\right)^2 ${cn < 0 ? '-' : '+'} ${fracTex(Math.abs(cn), cd)}`
    const prompt = `Given $${quad} \\equiv a(x + b)^2 + c$, find $b$. Give your answer as a decimal.`
    const solution =
      `$${A}\\left(${inside}\\right) ${C < 0 ? '-' : '+'} ${Math.abs(C)}$: halve the $${fracTex(B, A)}$ inside the bracket, so $b = ${bTex} = ${show(b)}$. ` +
      `The full form is $${square}$.`
    // Second route: the printed quadratic is symmetric about x = −b, and the completed form
    // agrees with it everywhere.
    const p = polyOf(fromTex(mathIn(prompt).split('\\equiv')[0]!))!
    const symmetric = [0.5, 1, 2.5, 4].every((t) => Math.abs(polyAt(p, -b + t) - polyAt(p, -b - t)) < 1e-9)
    const same = [-3, -1, 0, 2, 5].every((x) => Math.abs(polyAt(p, x) - (A * (x + b) ** 2 + cn / cd)) < 1e-9)
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [], minus(`b = ${fracText(B, 2 * A)} or ${show(b)}`)),
        answer: b,
        tolerance: 0,
      },
      check: { agrees: symmetric && same, detail: `${quad} symmetric about x = ${-b}: ${symmetric}; equal to the completed form: ${same}` },
      values: { A, B, C },
    }
  },
}

export const completingGenerators: Generator[] = [minimumValue, ballHeight, formulaTwoPlaces, completingTheSquareB]

import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { evalTex, fracTex, reduce, sum } from '../maths/formulae.ts'
import { lin, poly, polyAt } from '../maths/quadratics.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), the-factor-theorem-and-cubics: specification 2.11, the factor
 * theorem for rational values of the variable for polynomials. Testing a whole-number value
 * (q1), a value that is not a root (q7) and a half (q10), and finding an unknown coefficient
 * from a given factor (q6).
 *
 * q14 ("how many real solutions") stays written: its answer is a count the structure of the
 * polynomial fixes, so fresh numbers would not change what is asked.
 */

const TOPIC = 'the-factor-theorem-and-cubics'

/** A cubic, coefficients highest power first: [1, -4, 1, 6] is x^3 - 4x^2 + x + 6. */
const cubic = (k: number[]) => poly([...k].reverse())

/** The value of the printed f(x) at x, read from the prompt's own TeX: the second route. */
function promptValue(prompt: string, x: number): number {
  const m = /\$f\(x\) = ([^$]+)\$/.exec(prompt)
  if (!m) throw new Error(`no f(x) in ${prompt}`)
  return evalTex(m[1]!, { x })
}

/** The substitution line for whole x: −1 − 4 − 1 + 6. */
const termValues = (k: number[], x: number) => sum(k.map((c, i) => [c * x ** (3 - i), ''] as [number, string]))

/** (x - 2), (x + 1): the factor that goes with a root. */
const factorOf = (root: number) => `(${lin(1, -root, 'x', true)})`

/** q1: f(a) for a negative whole a, a root about 30% of the time: the zero answer must not dominate the spread (no answer over 40%). */
function testingAValue(r: Rng, slot: Question): Draft {
  const a = pick(r, [-1, -1, -2, -2, -3])
  // Whether it is a root is drawn first, so a root does not dominate (0 is about 30%).
  const root = r() < 0.3
  const { p, q, R } = draw(
    r,
    (r) => ({ p: int(r, -6, 6), q: int(r, -6, 6), R: root ? 0 : draw(r, (r) => int(r, -24, 24), (v) => v !== 0) }),
    ({ p, q, R }) => {
      const b = p - a
      const c = q - a * p
      const d = -a * q + R
      const sizes = [Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)]
      return (
        Math.abs(b) >= 2 && c !== 0 && d !== 0 && Math.abs(b) <= 9 && Math.abs(c) <= 9 && Math.abs(d) <= 30 &&
        // No two of |b|, |c|, |d| alike, so the terms are told apart.
        new Set(sizes.slice(1)).size === 3 &&
        // f(−a) = f(a) would let the sign slip give the right answer.
        c !== -a * a &&
        (R === 0 || !sizes.includes(Math.abs(R)))
      )
    },
  )
  const k = [1, p - a, q - a * p, -a * q + R]
  const prompt = `For $f(x) = ${cubic(k)}$, work out $f(${a})$.`
  const verdict = R === 0 ? `So $${factorOf(a)}$ is a factor of $f(x)$.` : `It is not zero, so $${factorOf(a)}$ is not a factor of $f(x)$.`
  const read = promptValue(prompt, a)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$f(${a}) = ${termValues(k, a)} = ${R}$. ${verdict}`,
      markScheme: scheme(slot, [], minus(String(R))),
      answer: R,
      tolerance: 0,
    },
    check: { agrees: read === R && polyAt([...k].reverse(), a) === R, detail: `printed f(x) at ${a}: ${read}` },
    values: { a, b: k[1]!, c: k[2]!, d: k[3]!, R },
  }
}

/** q7: f(t) where t is not a root; the cubic has three whole-number roots, named in the solution. */
function valueNotARoot(r: Rng, slot: Question): Draft {
  // t first: f(±1) is only the coefficients summed, and the written question uses f(2), so
  // |t| = 1 is about 15% and ±2, ±3 the rest. Drawn with the roots, t = ±1 passed the
  // filters more often and reached 38%.
  const t = r() < 0.15 ? pick(r, [1, -1]) : pick(r, [2, -2, 3, -3])
  const { roots } = draw(
    r,
    (r) => ({ roots: [int(r, -6, 6), int(r, -6, 6), int(r, -6, 6)], t }),
    ({ roots, t }) => {
      const [p, q, s] = roots as [number, number, number]
      if (roots.includes(0) || new Set(roots).size < 3 || roots.includes(t)) return false
      const s1 = p + q + s
      const s2 = p * q + q * s + s * p
      const s3 = p * q * s
      const R = (t - p) * (t - q) * (t - s)
      const sizes = [Math.abs(t), Math.abs(s1), Math.abs(s2), Math.abs(s3)]
      return Math.abs(s1) >= 2 && s2 !== 0 && Math.abs(s1) !== Math.abs(s2) && Math.abs(s3) <= 40 && Math.abs(R) <= 60 && s2 !== -t * t && !sizes.includes(Math.abs(R))
    },
  )
  const [p, q, s] = roots as [number, number, number]
  const k = [1, -(p + q + s), p * q + q * s + s * p, -p * q * s]
  const R = (t - p) * (t - q) * (t - s)
  const prompt = `For $f(x) = ${cubic(k)}$, work out $f(${t})$, and hence decide whether $${factorOf(t)}$ is a factor of $f(x)$. Give the value of $f(${t})$.`
  const sorted = [...roots].sort((x, y) => x - y)
  const factors = `$${factorOf(sorted[0]!)}$, $${factorOf(sorted[1]!)}$ and $${factorOf(sorted[2]!)}$`
  const read = promptValue(prompt, t)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$f(${t}) = ${termValues(k, t)} = ${R}$. It is not zero, so $${factorOf(t)}$ is not a factor: the factors are ${factors}.`,
      markScheme: scheme(slot, [], minus(String(R))),
      answer: R,
      tolerance: 0,
    },
    check: { agrees: read === R && R !== 0 && roots.every((x) => promptValue(prompt, x) === 0), detail: `printed f(x) at ${t}: ${read}; zero at ${roots}` },
    values: { p, q, s, t, R },
  }
}

/** A fraction in TeX, bracketed when negative so it can follow \cdot: \frac{1}{8}, \left(-\frac{27}{8}\right). */
function bracketed(n: number, d: number): string {
  const f = fracTex(n, d, '\\frac')
  return n < 0 ? `\\left(${f}\\right)` : f
}

/** q10: f(p/2) for a cubic with leading coefficient 2; a root about 30% of the time: the zero answer must not dominate the spread (no answer over 40%). */
function rationalValue(r: Rng, slot: Question): Draft {
  const p = pick(r, [1, 1, 1, -1, -1, 3, 3, -3])
  // The value is drawn first, in quarters: 4 f(p/2) = p^3 + b p^2 + 2cp + 4d is a whole number.
  const kind = r()
  const N = kind < 0.3 ? 0 : kind < 0.62 ? 4 * draw(r, (r) => int(r, -10, 10), (v) => v !== 0 && Math.abs(v) !== 2) : draw(r, (r) => int(r, -40, 40), (v) => v % 4 !== 0)
  const { b, c, d } = draw(
    r,
    (r) => {
      const c = draw(r, (r) => int(r, -9, 9), (v) => v !== 0)
      // p is odd, so p^2 is 1 more than a multiple of 4 and b's remainder mod 4 is fixed.
      const want = (((N - p ** 3 - 2 * c * p) % 4) + 4) % 4
      const options = Array.from({ length: 19 }, (_, i) => i - 9).filter((v) => v !== 0 && ((v % 4) + 4) % 4 === want)
      const b = pick(r, options)
      return { b, c, d: (N - p ** 3 - b * p * p - 2 * c * p) / 4 }
    },
    ({ b, c, d }) =>
      d !== 0 && Math.abs(d) <= 15 && Number.isInteger(d) && Math.abs(b) !== 1 && Math.abs(c) !== 1 && Math.abs(d) !== 1 &&
      // No answer equal to a printed coefficient (the leading 2 included: so ±8 is left out of N).
      (N === 0 || ![2, Math.abs(b), Math.abs(c), Math.abs(d)].includes(Math.abs(N / 4))),
  )
  const k = [2, b, c, d]
  const V = N / 4
  const x = p / 2
  const at = `f\\left(${fracTex(p, 2, '\\frac')}\\right)`
  const decimal = !Number.isInteger(V)
  const prompt = `For $f(x) = ${cubic(k)}$, work out $${at}$.${decimal ? ' Give your answer as a decimal.' : ''}`
  // 2·(p/2)^3, b·(p/2)^2, c·(p/2), d: each product written out, then each value.
  const products = [
    [2, bracketed(p ** 3, 8)],
    [b, bracketed(p * p, 4)],
    [c, bracketed(p, 2)],
  ] as const
  const productLine =
    products
      .map(([coef, f], i) => {
        const size = Math.abs(coef)
        const body = size === 1 ? f : `${size} \\cdot ${f}`
        return i === 0 ? (coef < 0 ? `-${body}` : body) : ` ${coef < 0 ? '-' : '+'} ${body}`
      })
      .join('') + ` ${d < 0 ? '-' : '+'} ${Math.abs(d)}`
  const values: [number, number][] = [
    [2 * p ** 3, 8],
    [b * p * p, 4],
    [c * p, 2],
    [d, 1],
  ]
  const valueLine = values
    .map(([n, den], i) => {
      const [rn, rd] = reduce(n, den)
      const size = rd === 1 ? String(Math.abs(rn)) : `\\frac{${Math.abs(rn)}}{${rd}}`
      return i === 0 ? (rn < 0 ? `-${size}` : size) : ` ${rn < 0 ? '-' : '+'} ${size}`
    })
    .join('')
  const result = decimal ? `${fracTex(N, 4, '\\frac')} = ${show(V)}` : String(V)
  const factor = `(${lin(2, -p, 'x', true)})`
  const verdict = V === 0 ? `So $${factor}$ is a factor.` : `It is not zero, so $${factor}$ is not a factor.`
  const read = promptValue(prompt, x)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$${at} = ${productLine} = ${valueLine} = ${result}$. ${verdict}`,
      markScheme: scheme(slot, [], minus(show(V))),
      answer: V,
      tolerance: 0,
    },
    check: { agrees: Math.abs(read - V) < 1e-12 && Math.abs(polyAt([d, c, b, 2], x) - V) < 1e-12, detail: `printed f(x) at ${show(x)}: ${read}` },
    values: { p, b, c, d, V },
  }
}

/** q6: (x − a) is a factor of kx^3 + cx^2 + ex + g; find c. */
function unknownCoefficient(r: Rng, slot: Question): Draft {
  // a, k and the sign of c first, so ±2 against ±3, 2 against 3 and c's sign against a's are
  // each about even; then e from those that leave some c, then c from those that pass.
  const a = pick(r, [2, -2, 3, -3])
  const k = pick(r, [2, 3])
  const sign = r() < 0.5 ? 1 : -1
  // The constant term stays within 40, or 80 for ±3, where k·a^3 alone is up to 81.
  const limit = Math.abs(a) === 3 ? 80 : 40
  const fits = (e: number, c: number) => {
    const g = -(k * a ** 3 + c * a * a + e * a)
    return (
      g !== 0 && Math.abs(g) <= limit && Math.abs(e) !== Math.abs(g) &&
      // No answer equal to a printed number.
      ![k, Math.abs(e), Math.abs(g), Math.abs(a)].includes(Math.abs(c))
    )
  }
  const cs = (e: number) => [2, 3, 4, 5, 6, 7, 8, 9].map((v) => sign * v).filter((c) => fits(e, c))
  // Substituting x = −a instead must give a different c: e ≠ −k a^2.
  const es = Array.from({ length: 19 }, (_, i) => i - 9).filter((e) => Math.abs(e) >= 2 && e !== -k * a * a && cs(e).length > 0)
  if (!es.length) throw new Error(`no e for a = ${a}, k = ${k}, sign ${sign}`)
  const e = pick(r, es)
  const c = pick(r, cs(e))
  const g = -(k * a ** 3 + c * a * a + e * a)
  const tail = sum([[e, 'x'], [g, '']])
  const expr = `${k}x^3 + cx^2 ${tail.startsWith('-') ? `- ${tail.slice(1)}` : `+ ${tail}`}`
  const prompt = `$${factorOf(a)}$ is a factor of $${expr}$. Find $c$.`
  const K = k * a ** 3 + e * a + g
  const substituted = sum([[k * a ** 3, ''], [a * a, 'c'], [e * a, ''], [g, '']])
  const collected = sum([[a * a, 'c'], [K, '']])
  // Second route: the printed cubic with the answer put in is zero at x = a.
  const back = evalTex(expr, { x: a, c })
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `$f(${a}) = 0$: $${substituted} = ${collected} = 0$, so $c = ${c}$.`,
      markScheme: scheme(slot, [`substitutes x = ${minus(String(a))} and sets to zero`], `c = ${minus(String(c))}`),
      answer: c,
      tolerance: 0,
    },
    check: { agrees: back === 0 && K === -a * a * c, detail: `printed cubic at x = ${a}, c = ${c}: ${back}` },
    values: { a, k, c, e, g },
  }
}

export const factorTheoremGenerators: Generator[] = [
  fmBySlot('fm-factor-theorem-value', TOPIC, { q1: testingAValue, q7: valueNotARoot, q10: rationalValue }),
  fmBySlot('fm-factor-theorem-coefficient', TOPIC, { q6: unknownCoefficient }),
]

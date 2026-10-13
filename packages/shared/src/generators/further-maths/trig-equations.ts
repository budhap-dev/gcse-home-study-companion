import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, roundTo } from '../format.ts'
import { bisect, coef, evalEquation, gcd, near } from '../maths/formulae.ts'
import { int, pick, draw, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { fmBySlot, minus } from './build.ts'

/**
 * Further Maths (AQA 8365), trigonometric-graphs-identities-and-equations: specification 6.6
 * (the graphs of sin, cos and tan and their symmetries), 6.7 (the ratios of any positive angle
 * up to 360°), 6.8 (the exact values from the 30°, 60°, 90° and 45°, 45°, 90° triangles), 6.9
 * (tan θ = sin θ / cos θ) and 6.10 (simple equations in a given interval).
 *
 * Exact-value equations by hand: a sine (q3), a negative cosine (q6) and a tangent in an
 * interval of 180° (q7). A cosine equation by calculator (q9). a sin x = b cos x reduced to
 * tan x (q11 the smaller solution, q14 the larger).
 *
 * Left written: q1 (sin 30° is a fact to recall, and only a handful of exact values
 * terminate), q12 (the sum of the solutions of sin²x = k or cos²x = k is 720° for every k
 * between 0 and 1, so the structure fixes the answer) and q16 (a count of solutions).
 * Angles stay in 0° to 360°: 6.7 takes angles as positive and up to 360°.
 */

const TOPIC = 'trigonometric-graphs-identities-and-equations'
const RAD = Math.PI / 180
type Fn = 'sin' | 'cos' | 'tan'
const ratio = (fn: Fn, deg: number) => Math[fn](deg * RAD)

/** The first maths span of a text. */
const firstMath = (text: string) => /\$([^$]+)\$/.exec(text)![1]!

/** The interval a prompt prints: $0° \leqslant x \leqslant 360°$. */
function intervalIn(prompt: string): [number, number] {
  const m = /\$(-?\d+)° \\leqslant x \\leqslant (-?\d+)°\$/.exec(prompt)
  if (!m) throw new Error(`no interval in ${prompt}`)
  return [Number(m[1]), Number(m[2])]
}

/**
 * Every solution of a printed equation in sin x, cos x and tan x on [lo, hi], by scanning the
 * interval in quarter degrees and halving each sign change: the second route, which never
 * uses the inverse functions or the symmetries the solution uses. The grid is offset so it
 * never lands on a whole degree, where exact solutions sit; a sign change across an asymptote
 * of tan is thrown out because the equation is far from balanced there.
 */
export function rootsOf(equation: string, lo: number, hi: number): number[] {
  const tex = equation.replace(/\\sin x/g, 's').replace(/\\cos x/g, 'c').replace(/\\tan x/g, 't')
  // The printed equation is read once per function, as the coefficient of sin x, cos x and
  // tan x and the constant, which keeps the scan fast; a fifth reading at other values
  // confirms the equation is linear in them, as every equation here is.
  const at = (s: number, c: number, t: number) => evalEquation(tex, { s, c, t })
  const k0 = at(0, 0, 0)
  const [ks, kc, kt] = [at(1, 0, 0) - k0, at(0, 1, 0) - k0, at(0, 0, 1) - k0]
  if (!near(at(0.3, -0.7, 2.1), k0 + 0.3 * ks - 0.7 * kc + 2.1 * kt)) throw new Error(`not linear in sin, cos and tan: ${equation}`)
  const f = (x: number) => k0 + ks * ratio('sin', x) + kc * ratio('cos', x) + kt * ratio('tan', x)
  const roots: number[] = []
  const step = 0.25
  for (let a = lo - 0.137; a < hi + step; a += step) {
    const b = a + step
    if (f(a) * f(b) >= 0) continue
    const x = bisect(f, a, b)
    if (x >= lo - 1e-9 && x <= hi + 1e-9 && Math.abs(f(x)) < 1e-6) roots.push(x)
  }
  return roots
}

// ---------------------------------------------------------------------------------------
// q3, q6, q7: exact values, by hand.
// ---------------------------------------------------------------------------------------

/** The exact values of the 6.8 triangles: ½, √3/2 and √2/2 for sin and cos; 1 and 1/√3 for tan. */
export type Kind = 'half' | 'root3' | 'root2' | 'one' | 'inv3'
export const SIZE: Record<Kind, number> = { half: 0.5, root3: Math.sqrt(3) / 2, root2: Math.SQRT2 / 2, one: 1, inv3: 1 / Math.sqrt(3) }
/** The acute angle with each value, from the triangles. */
export const ACUTE: Record<Fn, Partial<Record<Kind, number>>> = {
  sin: { half: 30, root3: 60, root2: 45 },
  cos: { half: 60, root3: 30, root2: 45 },
  tan: { one: 45, inv3: 30 },
}

/** An equation that gives fn x one exact value, and the value as the solution names it. */
interface Form {
  equation: string
  /** fn x = value, as the working writes it once fn x is alone. */
  value: string
  /** The working that leaves fn x alone, or '' where the equation already has it alone. */
  isolate: string
  form: string
}

/**
 * The ways one exact value is printed: alone (sin x = 0.5, the written way), with a
 * coefficient (2 sin x = √3, 6 cos x = −3√3), set to zero (√2 cos x + 1 = 0), and for the
 * whole-number values with a constant to move (4 sin x + 3 = 5, 3 − 4 cos x = 5).
 */
function exactForm(r: Rng, fn: Fn, kind: Kind, sign: 1 | -1): Form {
  const F = `\\${fn} x`
  const neg = sign < 0 ? '-' : ''
  const take = sign < 0 ? '+' : '-'
  const alone = (printed: string, form: string): Form => ({ equation: `${F} = ${printed}`, value: printed.replace(/\\dfrac/g, '\\frac'), isolate: '', form })
  const moved = (equation: string, value: string, form: string, middle = ''): Form => ({
    equation,
    value,
    isolate: `${middle ? `$${middle}$, so ` : ''}$${F} = ${value}$. `,
    form,
  })
  /**
   * p fn x + q = t, or q − p fn x = t, with fn x = sign × whole (½ or 1): the constant moved,
   * then a division. The constant is never the size of p fn x, so 2 sin x + 1 = 2 cannot appear.
   */
  const withConstant = (whole: number, reversed: boolean): Form => {
    const p = pick(r, whole === 0.5 ? [2, 4, 6, 8] : [2, 3, 4, 5])
    const k = sign * p * whole
    const value = whole === 0.5 ? `${neg}\\frac{1}{2}` : `${neg}1`
    if (reversed) {
      const { q, t } = draw(
        r,
        (r) => {
          const q = int(r, 1, 10)
          return { q, t: q - k }
        },
        ({ q, t }) => t !== 0 && Math.abs(t) <= 12 && q !== Math.abs(k) && Math.abs(t) !== q,
      )
      return moved(`${q} - ${p}${F} = ${t}`, value, 'constant reversed', `-${p}${F} = ${t - q}`)
    }
    const { q, t } = draw(
      r,
      (r) => {
        const q = (r() < 0.5 ? -1 : 1) * int(r, 1, 10)
        return { q, t: q + k }
      },
      ({ q, t }) => t !== 0 && Math.abs(t) <= 12 && Math.abs(q) !== Math.abs(k),
    )
    return moved(`${p}${F} ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${t}`, value, 'constant', `${p}${F} = ${k}`)
  }
  /** p fn x = m√n, or p fn x ∓ m√n = 0, with p/m the denominator of the value. */
  const surdMultiple = (n: 2 | 3, denominator: number, value: string, zero: 'no' | 'after' | 'before' | 'negated'): Form => {
    const m = pick(r, [1, 2, 3, 4])
    const p = denominator * m
    const root = `${m === 1 ? '' : m}\\sqrt{${n}}`
    if (zero === 'after') return moved(`${p}${F} ${take} ${root} = 0`, value, 'multiple zero')
    // √3 + 2 cos x = 0: the surd first, so moving it changes its sign.
    if (zero === 'before') return moved(`${root} ${sign < 0 ? '+' : '-'} ${p}${F} = 0`, value, 'surd first', `${p}${F} = ${neg}${root}`)
    // −2 cos x = √3: the coefficient's sign carries the value's.
    if (zero === 'negated') return moved(`-${p}${F} = ${sign < 0 ? '' : '-'}${root}`, value, 'negated')
    return moved(`${p}${F} = ${neg}${root}`, value, 'multiple')
  }
  switch (kind) {
    case 'half':
      return pick(r, [
        () => alone(`${neg}0.5`, 'decimal'),
        () => alone(`${neg}\\dfrac{1}{2}`, 'fraction'),
        () => moved(`2${F} = ${neg}1`, `${neg}\\frac{1}{2}`, 'coefficient'),
        () => moved(`2${F} ${take} 1 = 0`, `${neg}\\frac{1}{2}`, 'zero'),
        () => {
          const p = pick(r, [4, 6, 8, 10])
          return moved(`${p}${F} = ${(sign * p) / 2}`, `${neg}\\frac{1}{2}`, 'multiple')
        },
        () => withConstant(0.5, false),
        () => withConstant(0.5, false),
        () => withConstant(0.5, true),
      ])()
    case 'root3':
      return pick(r, [
        () => alone(`${neg}\\dfrac{\\sqrt{3}}{2}`, 'fraction'),
        () => surdMultiple(3, 2, `${neg}\\frac{\\sqrt{3}}{2}`, 'no'),
        () => surdMultiple(3, 2, `${neg}\\frac{\\sqrt{3}}{2}`, 'after'),
        () => surdMultiple(3, 2, `${neg}\\frac{\\sqrt{3}}{2}`, 'before'),
        () => surdMultiple(3, 2, `${neg}\\frac{\\sqrt{3}}{2}`, 'negated'),
      ])()
    case 'root2':
      return pick(r, [
        () => alone(`${neg}\\dfrac{\\sqrt{2}}{2}`, 'fraction'),
        () => alone(`${neg}\\dfrac{1}{\\sqrt{2}}`, 'reciprocal'),
        () => moved(`\\sqrt{2}${F} = ${neg}1`, `${neg}\\frac{1}{\\sqrt{2}}`, 'coefficient'),
        () => moved(`\\sqrt{2}${F} ${take} 1 = 0`, `${neg}\\frac{1}{\\sqrt{2}}`, 'zero'),
        () => surdMultiple(2, 2, `${neg}\\frac{\\sqrt{2}}{2}`, 'no'),
        () => surdMultiple(2, 2, `${neg}\\frac{\\sqrt{2}}{2}`, 'after'),
      ])()
    case 'one':
      return pick(r, [
        () => alone(`${neg}1`, 'whole'),
        () => moved(`${F} ${take} 1 = 0`, `${neg}1`, 'zero'),
        () => {
          const p = pick(r, [2, 3, 4, 5])
          return moved(`${p}${F} = ${sign * p}`, `${neg}1`, 'multiple')
        },
        () => withConstant(1, false),
        () => withConstant(1, true),
      ])()
    case 'inv3':
      return pick(r, [
        () => alone(`${neg}\\dfrac{1}{\\sqrt{3}}`, 'reciprocal'),
        () => alone(`${neg}\\dfrac{\\sqrt{3}}{3}`, 'fraction'),
        () => moved(`\\sqrt{3}${F} = ${neg}1`, `${neg}\\frac{1}{\\sqrt{3}}`, 'coefficient'),
        () => moved(`\\sqrt{3}${F} ${take} 1 = 0`, `${neg}\\frac{1}{\\sqrt{3}}`, 'zero'),
        () => surdMultiple(3, 3, `${neg}\\frac{\\sqrt{3}}{3}`, 'no'),
        () => surdMultiple(3, 3, `${neg}\\frac{\\sqrt{3}}{3}`, 'after'),
      ])()
  }
}

/**
 * q3's forms, at the written question's level: the value alone, or one coefficient to divide
 * by (2 sin x = 1, 3 sin x = 1.5, 4 sin x = 2√3, 3√2 sin x = 3). No constant to move and
 * nothing set to zero; those stay with q6 and q7. Every form is listed and one drawn evenly.
 */
export function plainForm(r: Rng, fn: Fn, kind: 'half' | 'root3' | 'root2', sign: 1 | -1): Form {
  const F = `\\${fn} x`
  const neg = sign < 0 ? '-' : ''
  const forms: Form[] = []
  const alone = (printed: string, form: string) => forms.push({ equation: `${F} = ${printed}`, value: printed.replace(/\\dfrac/g, '\\frac'), isolate: '', form })
  const divide = (equation: string, value: string, form: string) => forms.push({ equation, value, isolate: `$${F} = ${value}$. `, form })
  const root = (m: number, n: number) => `${m === 1 ? '' : m}\\sqrt{${n}}`
  if (kind === 'half') {
    alone(`${neg}0.5`, 'decimal')
    alone(`${neg}\\dfrac{1}{2}`, 'fraction')
    // 2 sin x = 1 up to 24 sin x = 12, and the odd ones with a half: 3 sin x = 1.5.
    for (let p = 2; p <= 24; p += 2) divide(`${p}${F} = ${neg}${p / 2}`, `${neg}\\frac{1}{2}`, p === 2 ? 'coefficient' : 'multiple')
    for (let p = 3; p <= 11; p += 2) divide(`${p}${F} = ${neg}${p / 2}`, `${neg}\\frac{1}{2}`, 'multiple')
  } else if (kind === 'root3') {
    alone(`${neg}\\dfrac{\\sqrt{3}}{2}`, 'fraction')
    for (let m = 1; m <= 8; m++) divide(`${2 * m}${F} = ${neg}${root(m, 3)}`, `${neg}\\frac{\\sqrt{3}}{2}`, m === 1 ? 'coefficient' : 'multiple')
  } else {
    alone(`${neg}\\dfrac{\\sqrt{2}}{2}`, 'fraction')
    alone(`${neg}\\dfrac{1}{\\sqrt{2}}`, 'reciprocal')
    for (let m = 1; m <= 6; m++) divide(`${root(m, 2)}${F} = ${neg}${m}`, `${neg}\\frac{1}{\\sqrt{2}}`, m === 1 ? 'coefficient' : 'multiple')
    for (let m = 1; m <= 8; m++) divide(`${2 * m}${F} = ${neg}${root(m, 2)}`, `${neg}\\frac{\\sqrt{2}}{2}`, 'multiple')
  }
  return pick(r, forms)
}

/** The value without its sign, for "the acute angle with sine ½". */
const size = (value: string) => value.replace(/^-/, '')
/** Brackets round a fraction after an inverse: \sin^{-1}\left(\frac{1}{2}\right), \tan^{-1}(1). */
const inverse = (fn: Fn, value: string) => (value.includes('\\frac') ? `\\${fn}^{-1}\\left(${value}\\right)` : `\\${fn}^{-1}(${value})`)

/** One exact-value equation in 0° to 360° with two solutions; the slot asks the larger or the smaller. */
function twoSolutions(r: Rng, slot: Question, fn: 'sin' | 'cos', sign: 1 | -1, which: 'larger' | 'smaller', plain = false): Draft {
  const kind = pick(r, ['half', 'root3', 'root2'] as const)
  const a = ACUTE[fn][kind]!
  const f = plain ? plainForm(r, fn, kind, sign) : exactForm(r, fn, kind, sign)
  // The two solutions in order: sine above the axis at α and 180° − α, below at 180° + α and
  // 360° − α; cosine below the axis at 180° − α and 180° + α.
  let first: number
  let second: number
  let reason: string
  if (fn === 'sin' && sign > 0) {
    first = a
    second = 180 - a
    reason = `$${inverse('sin', f.value)} = ${a}°$, and the sine graph is symmetric about $90°$, so the second solution is $180° - ${a}° = ${second}°$.`
  } else if (fn === 'sin') {
    first = 180 + a
    second = 360 - a
    reason = `The acute angle with sine $${size(f.value)}$ is $${a}°$. Sine is negative from $180°$ to $360°$, where the graph is symmetric about $270°$: $180° + ${a}° = ${first}°$ and $360° - ${a}° = ${second}°$.`
  } else {
    first = 180 - a
    second = 180 + a
    reason = `The acute angle with cosine $${size(f.value)}$ is $${a}°$. Cosine is negative in the second and third quadrants: $180° - ${a}° = ${first}°$ and $180° + ${a}° = ${second}°$.`
  }
  const answer = which === 'larger' ? second : first
  const prompt = `Solve $${f.equation}$ for $0° \\leqslant x \\leqslant 360°$. Write down the ${which} solution.`
  const roots = rootsOf(firstMath(prompt), ...intervalIn(prompt))
  const read = which === 'larger' ? roots.at(-1)! : roots[0]!
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${f.isolate}${reason} The ${which} is $${answer}°$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: {
      agrees: roots.length === 2 && near(read, answer, 1e-7) && near(ratio(fn, a), SIZE[kind]),
      detail: `scanned ${roots.map((x) => x.toFixed(6)).join(', ')}`,
    },
    values: { fn, kind, sign, which, form: f.form },
  }
}

/**
 * q3: sin x = 0.5, the larger solution, 150°. A positive value, in 70% of builds as the grade
 * 4-5 band wants, asks the larger (the smaller is the calculator's own angle); a negative value
 * asks either. Each positive calculation is about 23% of builds: there are only three.
 */
function sineEquation(r: Rng, slot: Question): Draft {
  // Positive four times in five, as the written sin x = 0.5 is: this is the core, grade 4-5 slot, and
  // the 180° + α and 360° − α work for a negative value is q6's, on the higher sheet. A positive value
  // always asks the larger solution, the smaller being the calculator's own angle.
  if (r() < 0.8) return twoSolutions(r, slot, 'sin', 1, 'larger', true)
  return twoSolutions(r, slot, 'sin', -1, r() < 0.5 ? 'larger' : 'smaller', true)
}

/** q6: cos x = −√3/2, the smaller solution, 150°. Always a negative value, either solution. */
function negativeCosine(r: Rng, slot: Question): Draft {
  return twoSolutions(r, slot, 'cos', -1, r() < 0.5 ? 'smaller' : 'larger')
}

/**
 * q7: tan x = 1 for 180° ≤ x ≤ 360°, 225°. Each interval is 180° wide and holds one solution,
 * never the calculator's own angle: a positive value in 180° to 360°; a negative value in 0°
 * to 180° (add 180°) or in 180° to 360° (add 360°). ±√3 is left out: its working names
 * tan 60° = √3, which q10 on the same sheet asks.
 */
function tangentInterval(r: Rng, slot: Question): Draft {
  const kind = pick(r, ['one', 'inv3'] as const)
  const sign = r() < 1 / 3 ? 1 : -1
  const [lo, hi] = sign > 0 ? [180, 360] : pick(r, [[0, 180], [180, 360]] as const)
  const a = ACUTE.tan[kind]!
  const f = exactForm(r, 'tan', kind, sign)
  const principal = sign * a
  const shift = sign > 0 ? 180 : hi === 180 ? 180 : 360
  const answer = principal + shift
  const quadrant = answer < 90 ? 'first' : answer < 180 ? 'second' : answer < 270 ? 'third' : 'fourth'
  const where = `the ${quadrant} quadrant, where tan is ${sign > 0 ? 'positive' : 'negative'}`
  let reason: string
  if (sign > 0) {
    reason = `$${inverse('tan', f.value)} = ${a}°$, and tan repeats every $180°$, so the solution in the given interval is $${a}° + 180° = ${answer}°$: ${where}.`
  } else {
    const slip = shift === 360 ? ` Adding only $180°$ gives $${principal + 180}°$, outside the interval.` : ''
    reason = `$${inverse('tan', f.value)} = ${principal}°$, outside the interval. Tan repeats every $180°$, so the solution in the given interval is $${principal}° + ${shift}° = ${answer}°$: ${where}.${slip}`
  }
  const prompt = `Solve $${f.equation}$ for $${lo}° \\leqslant x \\leqslant ${hi}°$.`
  const roots = rootsOf(firstMath(prompt), ...intervalIn(prompt))
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `${f.isolate}${reason}`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: {
      agrees: roots.length === 1 && near(roots[0]!, answer, 1e-7) && near(ratio('tan', a), SIZE[kind]),
      detail: `scanned ${roots.map((x) => x.toFixed(6)).join(', ')}`,
    },
    values: { kind, sign, lo, hi, form: f.form },
  }
}

// ---------------------------------------------------------------------------------------
// q9: cos x = 0.3, the larger solution to 2 d.p., 287.46.
// ---------------------------------------------------------------------------------------

/**
 * The value is a decimal (0.3, −0.45) or a fraction from p cos x = q; never ±0.5, which is
 * exact, and the angle is drawn clear of a rounding boundary. Mostly positive, as written; a
 * negative value puts the calculator's angle in the second quadrant.
 */
function cosineByCalculator(r: Rng, slot: Question): Draft {
  const sign = r() < 0.7 ? 1 : -1
  const fraction = r() < 0.25
  const { c, p, q } = draw(
    r,
    (r) => {
      if (fraction) {
        const p = int(r, 3, 9)
        const q = sign * int(r, 1, p - 1)
        return { c: q / p, p, q }
      }
      const k = r() < 0.35 ? int(r, 1, 9) * 10 : int(r, 5, 95)
      return { c: (sign * k) / 100, p: 0, q: 0 }
    },
    ({ c, p, q }) =>
      Math.abs(c) !== 0.5 &&
      (p === 0 || (gcd(p, q) === 1 && Math.abs(q) / p !== 0.5)) &&
      clearOfHalf(Math.acos(c) / RAD, 2, 0.05),
  )
  const alpha = Math.acos(c) / RAD
  const answer = roundTo(360 - alpha, 2)
  const valueTex = p ? `${q < 0 ? '-' : ''}\\frac{${Math.abs(q)}}{${p}}` : String(c)
  const equation = p ? `${p}\\cos x = ${q}` : `\\cos x = ${c}`
  const isolate = p ? `Divide by $${p}$: $\\cos x = ${valueTex}$. ` : ''
  const quadrants = sign > 0 ? 'positive in the first and fourth quadrants' : 'negative in the second and third quadrants'
  const solution =
    `${isolate}$${inverse('cos', valueTex)} = ${fixed(alpha, 2)}°$. Cosine is ${quadrants}, and the cosine graph is symmetric about $180°$, ` +
    `so the second solution is $360° - ${fixed(alpha, 2)}° = ${fixed(answer, 2)}°$.`
  const prompt = `Solve $${equation}$ for $0° \\leqslant x \\leqslant 360°$. Write down the larger solution to two decimal places.`
  const roots = rootsOf(firstMath(prompt), ...intervalIn(prompt))
  const shown = p ? `${q}/${p}` : String(c)
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`cos⁻¹(${shown}) = ${fixed(alpha, 2)}`)], fixed(answer, 2)),
      answer,
      tolerance: 0.005,
    },
    check: {
      agrees: roots.length === 2 && roundTo(roots[1]!, 2) === answer && near(roots[0]! + roots[1]!, 360, 1e-7),
      detail: `scanned ${roots.map((x) => x.toFixed(6)).join(', ')}`,
    },
    values: { c, p, q, sign },
  }
}

// ---------------------------------------------------------------------------------------
// q11, q14: a sin x = b cos x, so tan x = b/a; q11 the smaller solution, q14 the larger.
// ---------------------------------------------------------------------------------------

/**
 * a is 2 to 9 and b 1 to 9, unequal and with no common factor; b/a is never 3, the value of
 * tan x that q13(b) on the same sheet solves. A negative ratio (a sin x + b cos x = 0) needs
 * the calculator's negative angle moved into the interval.
 */
function sinOverCos(r: Rng, slot: Question, turn: number): Draft {
  const which = slot.id === 'q11' ? 'smaller' : 'larger'
  const sign = r() < 0.6 ? 1 : -1
  // q11 and q14 sit on one sheet with consecutive turns: an even turn takes a ratio below 1
  // (a > b), an odd one a ratio above 1, so the two never share a ratio and q14's answer is
  // never q11's plus 180°. a is at least 2, so dividing by it is a real step, as written.
  const below = turn % 2 === 0
  const { a, b, beta } = draw(
    r,
    (r) => {
      const a = int(r, 2, 9)
      const b = int(r, 1, 9)
      return { a, b, beta: Math.atan(b / a) / RAD }
    },
    ({ a, b, beta }) => (below ? a > b : b > a) && gcd(a, b) === 1 && b !== 3 * a && clearOfHalf(beta, 2, 0.05),
  )
  const S = coef(a, '\\sin x')
  const C = coef(b, '\\cos x')
  const tanTex = coef(a, '\\tan x')
  const k = `\\frac{${b}}{${a}}`
  const kText = `${b}/${a}`
  let equation: string
  let move: string
  if (sign > 0) {
    const zero = r() < 0.4
    equation = zero ? `${S} - ${C} = 0` : `${S} = ${C}`
    move = zero ? `Add $${C}$ to both sides and divide by $\\cos x$` : 'Divide both sides by $\\cos x$'
  } else {
    const zero = r() < 0.6
    equation = zero ? `${S} + ${C} = 0` : `${S} = -${C}`
    move = zero ? `Subtract $${C}$ from both sides and divide by $\\cos x$` : 'Divide both sides by $\\cos x$'
  }
  const neg = sign < 0 ? '-' : ''
  const tanLine = `$${tanTex} = ${sign * b}$, so $\\tan x = ${neg}${k}$`
  let first: number
  let second: number
  let reason: string
  const B = fixed(beta, 2)
  if (sign > 0) {
    first = roundTo(beta, 2)
    second = roundTo(beta + 180, 2)
    reason = `and $x = \\tan^{-1}\\left(${k}\\right) = ${B}°$. The other solution is $${B}° + 180° = ${fixed(second, 2)}°$.`
  } else {
    first = roundTo(180 - beta, 2)
    second = roundTo(360 - beta, 2)
    reason =
      `The calculator gives $\\tan^{-1}\\left(-${k}\\right) = -${B}°$, outside the interval. Tan repeats every $180°$, so the solutions are ` +
      `$-${B}° + 180° = ${fixed(first, 2)}°$ and $-${B}° + 360° = ${fixed(second, 2)}°$.`
  }
  const answer = which === 'smaller' ? first : second
  const solution = `${move}: ${tanLine}${sign > 0 ? ' ' : '. '}${reason} The ${which} is $${fixed(answer, 2)}°$.`
  const prompt = `Solve $${equation}$ for $0° \\leqslant x \\leqslant 360°$. Write down the ${which} solution to two decimal places.`
  const roots = rootsOf(firstMath(prompt), ...intervalIn(prompt))
  const read = which === 'smaller' ? roots[0]! : roots.at(-1)!
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, [minus(`tan x = ${neg}${kText}`)], fixed(answer, 2)),
      answer,
      tolerance: 0.005,
    },
    check: {
      agrees: roots.length === 2 && roundTo(read, 2) === answer && near(ratio('tan', read), (sign * b) / a, 1e-6),
      detail: `scanned ${roots.map((x) => x.toFixed(6)).join(', ')}`,
    },
    values: { a, b, sign, equation },
  }
}

export const trigEquationGenerators: Generator[] = [
  fmBySlot('fm-trig-exact-equation', TOPIC, { q3: sineEquation, q6: negativeCosine, q7: tangentInterval }),
  fmBySlot('fm-trig-cosine-calculator', TOPIC, { q9: cosineByCalculator }),
  fmBySlot('fm-trig-sin-cos-ratio', TOPIC, { q11: sinOverCos, q14: sinOverCos }),
]

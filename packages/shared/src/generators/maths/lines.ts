import type { Question } from '../../content/questions.ts'
import { show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft, Generator } from '../types.ts'
import { bySlot, coef, evalEquation, fracTex, fracText, gcd, near, reduce, sub, sum, terminates } from './formulae.ts'

const LINES = 'equations-of-straight-lines'
const PERP = 'parallel-and-perpendicular-lines'
const CIRCLE = 'equation-of-a-circle'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const nonZero = (r: Rng, lo: number, hi: number) => pm(r) * int(r, lo, hi)
/** − for a mark scheme, which is read as text rather than KaTeX. */
const minus = (s: string) => s.replace(/-/g, '−')

/** The x term of a line with gradient p/q, in TeX: 3x, -x, -\tfrac{1}{2}x. */
function xTerm(p: number, q: number): string {
  const [n, d] = reduce(p, q)
  return d === 1 ? coef(n, 'x') : `${fracTex(n, d)}x`
}

/** y = mx + c in TeX, with m = p/q and c whole. */
export function lineTex(p: number, q: number, c: number): string {
  const t = xTerm(p, q)
  return c === 0 ? `y = ${t}` : `y = ${t} ${c < 0 ? '-' : '+'} ${Math.abs(c)}`
}

const cTyped = (c: number) => (c === 0 ? '' : c < 0 ? `${c}` : `+${c}`)

/**
 * Every typed form of y = (p/q)x + c the marker takes, as the written lists give them: the
 * gradient as a fraction before or after the x, as a decimal when it terminates, in
 * brackets, the terms either way round, cleared of fractions, and as ax + by = c and
 * ax + by + c = 0. Each is checked by substitution in algebra-b.test.ts.
 */
export function lineForms(p0: number, q0: number, c: number, general = true): string[] {
  const [p, q] = reduce(p0, q0)
  const out: string[] = []
  if (q === 1) {
    out.push(`y=${coef(p, 'x')}${cTyped(c)}`)
    if (c !== 0) out.push(`y=${c}${p < 0 ? '-' : '+'}${coef(Math.abs(p), 'x')}`)
  } else {
    const a = Math.abs(p)
    const s = p < 0 ? '-' : ''
    const unsigned = [`${a}/${q}x`, `${a === 1 ? '' : a}x/${q}`, ...(terminates(a, q) ? [`${show(a / q)}x`] : []), `(${a}/${q})x`]
    for (const u of unsigned) out.push(`y=${s}${u}${cTyped(c)}`)
    out.push(`y=(${p}/${q})x${cTyped(c)}`)
    if (c !== 0) {
      for (const u of unsigned) out.push(`y=${c}${p < 0 ? '-' : '+'}${u}`)
      out.push(`y=${c}${p < 0 ? '-' : '+'}(${a === 1 ? '' : a}x/${q})`)
      out.push(`${q}y=${sum([[p, 'x'], [q * c, '']], false)}`, `${q}y=${sum([[q * c, ''], [p, 'x']], false)}`)
      out.push(`y=(${sum([[q * c, ''], [p, 'x']], false)})/${q}`)
    } else out.push(`${q}y=${coef(p, 'x')}`)
  }
  if (general) {
    // px − qy = −qc, with a positive x coefficient.
    const k = p < 0 ? -1 : 1
    const A = k * p
    const B = -k * q
    const C = -k * q * c
    out.push(`${sum([[A, 'x'], [B, 'y']], false)}=${C}`, `${sum([[B, 'y'], [A, 'x']], false)}=${C}`, `${sum([[A, 'x'], [B, 'y'], [-C, '']], false)}=0`)
  }
  return [...new Set(out)]
}

/** ax + by + c = 0 written three ways: as given, y first, and multiplied by −1. */
export function zeroForms(A: number, B: number, C: number): string[] {
  return [
    `${sum([[A, 'x'], [B, 'y'], [C, '']], false)}=0`,
    `${sum([[B, 'y'], [A, 'x'], [C, '']], false)}=0`,
    `${sum([[-A, 'x'], [-B, 'y'], [-C, '']], false)}=0`,
  ]
}

/** y on a printed line at x, read from the text: the equation is linear in y. */
export function yOn(tex: string, x: number): number {
  const f0 = evalEquation(tex, { x, y: 0 })
  const f1 = evalEquation(tex, { x, y: 1 })
  return -f0 / (f1 - f0)
}
/** The gradient of a printed line, read from two of its points. */
export const slopeOf = (tex: string) => yOn(tex, 1) - yOn(tex, 0)
export const onLine = (tex: string, x: number, y: number) => near(evalEquation(tex, { x, y }), 0, 1e-9)

const pt = (x: number, y: number) => `(${x}, ${y})`
const both = (x: number, y: number) => [`(${x},${y})`, `${x},${y}`]

/* ------------------------------------------------------------------------------------------
 * Equations of straight lines
 * ---------------------------------------------------------------------------------------- */

const FRACTION_GRADIENTS: [number, number][] = [[1, 2], [1, 4], [3, 4], [2, 5], [3, 2], [5, 2], [1, 5]]

/** q1: the gradient of y = mx + c, written in one of several orders. */
function readGradient(r: Rng, slot: Question): Draft {
  const fraction = r() < 0.2
  const [p, q] = fraction ? pick(r, FRACTION_GRADIENTS).map((v, i) => (i === 0 ? v * pm(r) : v)) as [number, number] : [nonZero(r, 1, 9), 1]
  const c = nonZero(r, 1, 12)
  const flipped = !fraction && r() < 0.35
  const rhs = flipped ? sum([[c, ''], [p, 'x']]) : lineTex(p, q, c).slice(4)
  const line = `y = ${rhs}`
  const m = p / q
  const tail = q === 1 ? `$${p}$` : `$${fracTex(p, q)}$, which is $${show(m)}$`
  return {
    question: {
      type: 'numeric',
      prompt: `Write down the gradient of the line $${line}$.`,
      solution: `In $y = mx + c$ the gradient is $m$, the number multiplying $x$${flipped ? ', whichever order the terms are written in' : ''}: ${tail}.`,
      markScheme: scheme(slot, [], q === 1 ? String(p) : `${fracText(p, q)} or ${show(m)}`),
      answer: m,
      tolerance: 0,
    },
    check: { agrees: near(slopeOf(line), m), detail: `read from two points of ${line}: ${slopeOf(line)}` },
    values: { p, q, c, flipped: flipped ? 'yes' : 'no' },
  }
}

/** q2: where y = mx + c crosses the y-axis. */
function readIntercept(r: Rng, slot: Question): Draft {
  const m = nonZero(r, 1, 9)
  const c = nonZero(r, 1, 12)
  const flipped = r() < 0.35
  const line = `y = ${flipped ? sum([[c, ''], [m, 'x']]) : sum([[m, 'x'], [c, '']])}`
  return {
    question: {
      type: 'short-text',
      prompt: `Write down the coordinates of the point where $${line}$ crosses the $y$-axis.`,
      solution: `$c = ${c}$, so the line crosses at $${pt(0, c)}$.`,
      markScheme: scheme(slot, [], `$${pt(0, c)}$`),
      accepted: both(0, c),
    },
    check: { agrees: near(yOn(line, 0), c), detail: `y at x = 0 read from ${line}: ${yOn(line, 0)}` },
    values: { m, c },
  }
}

/** Two points on a line with a whole-number gradient, in the order the question gives them. */
function twoPoints(r: Rng, mLo = 1, mHi = 6) {
  return draw(
    r,
    (r) => {
      const m = nonZero(r, mLo, mHi)
      const x1 = int(r, -4, 8)
      const x2 = x1 + nonZero(r, 1, 6)
      const y1 = int(r, -6, 12)
      return { m, x1, y1, x2, y2: y1 + m * (x2 - x1) }
    },
    ({ y2, x2, y1, x1, m }) => Math.abs(y2) <= 20 && Math.abs(x2) <= 10 && y1 - m * x1 !== 0,
  )
}

const rise = (x1: number, y1: number, x2: number, y2: number) => `\\dfrac{${y2} - ${sub(y1)}}{${x2} - ${sub(x1)}}`

/** q3: the gradient through two points. */
function gradientFromPoints(r: Rng, slot: Question): Draft {
  const { m, x1, y1, x2, y2 } = twoPoints(r)
  const c = y1 - m * x1
  return {
    question: {
      type: 'numeric',
      prompt: `Find the gradient of the line through $${pt(x1, y1)}$ and $${pt(x2, y2)}$.`,
      solution: `$m = ${rise(x1, y1, x2, y2)} = \\dfrac{${y2 - y1}}{${x2 - x1}} = ${m}$. Subtract in the same order on the top and the bottom.`,
      markScheme: scheme(slot, [`$\\frac{${y2}-${sub(y1)}}{${x2}-${sub(x1)}}$ or a correct rise over run`], String(m)),
      answer: m,
      tolerance: 0,
    },
    check: { agrees: (y1 - y2) / (x1 - x2) === m && y2 === m * x2 + c, detail: `the other way round ${(y1 - y2) / (x1 - x2)}; c = ${c} puts the second point on the line` },
    values: { x1, y1, x2, y2 },
  }
}

/** q4: the equation from a gradient and the y-intercept. */
function equationFromIntercept(r: Rng, slot: Question): Draft {
  const m = nonZero(r, 1, 9)
  const c = nonZero(r, 1, 12)
  const answer = lineTex(m, 1, c)
  const how = pick(r, ['passes through', 'crosses the $y$-axis at'])
  return {
    question: {
      type: 'short-text',
      prompt: `A line has gradient $${m}$ and ${how} $${pt(0, c)}$. Write down its equation.`,
      solution: `$m = ${m}$ and $c = ${c}$: $${answer}$.`,
      markScheme: scheme(slot, [], `$${answer}$`),
      accepted: lineForms(m, 1, c, false),
    },
    check: { agrees: near(yOn(answer, 0), c) && near(slopeOf(answer), m), detail: `${answer} at x = 0: ${yOn(answer, 0)}, gradient ${slopeOf(answer)}` },
    values: { m, c },
  }
}

/** q5: a fraction gradient and a point. */
function equationFromFractionGradient(r: Rng, slot: Question): Draft {
  const { p, q, x1, c } = draw(
    r,
    (r) => ({ p: nonZero(r, 1, 4), q: int(r, 2, 5), x1: nonZero(r, 1, 3), c: nonZero(r, 1, 10) }),
    ({ p, q }) => gcd(p, q) === 1,
  )
  const X = x1 * q
  const Y = (p * X) / q + c
  const answer = lineTex(p, q, c)
  const mx = (p * X) / q
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line with gradient $${fracTex(p, q)}$ passing through $${pt(X, Y)}$.`,
      solution: `Substitute into $y = mx + c$: $${Y} = ${fracTex(p, q)}(${X}) + c = ${mx} + c$, so $c = ${c}$. The line is $${answer}$.`,
      markScheme: scheme(slot, [`$y = ${xTerm(p, q).replace('\\tfrac', '\\frac')} + c$`, `$${Y} = ${mx} + c$`], `$${answer.replace('\\tfrac', '\\frac')}$`),
      accepted: lineForms(p, q, c),
    },
    check: { agrees: onLine(answer, X, Y) && near(slopeOf(answer), p / q), detail: `${pt(X, Y)} on ${answer}; gradient ${slopeOf(answer)}` },
    values: { p, q, X, Y, c },
  }
}

/** q6: the equation through two points. */
function equationFromTwoPoints(r: Rng, slot: Question): Draft {
  const { m, x1, y1, x2, y2 } = twoPoints(r)
  const c = y1 - m * x1
  const answer = lineTex(m, 1, c)
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line through $${pt(x1, y1)}$ and $${pt(x2, y2)}$.`,
      solution: `Gradient $= ${rise(x1, y1, x2, y2)} = ${m}$. Then $${y1} = ${m}(${x1}) + c$, so $c = ${c}$: $${answer}$.`,
      markScheme: scheme(slot, [`Gradient ${minus(String(m))}`, 'Substitutes a point to find $c$'], `$${answer}$`),
      accepted: lineForms(m, 1, c, false),
    },
    check: { agrees: onLine(answer, x1, y1) && onLine(answer, x2, y2), detail: `both points on ${answer}` },
    values: { x1, y1, x2, y2 },
  }
}

/** q8: rearrange ay − bx = c into y = mx + c. */
function rearrangeToSlopeIntercept(r: Rng, slot: Question): Draft {
  const m = nonZero(r, 1, 6)
  const c = nonZero(r, 1, 9)
  const A = int(r, 2, 6)
  const yFirst = r() < 0.6
  const lhs = yFirst ? sum([[A, 'y'], [-A * m, 'x']]) : sum([[-A * m, 'x'], [A, 'y']])
  const given = `${lhs} = ${A * c}`
  const answer = lineTex(m, 1, c)
  const move = m > 0 ? `Add $${coef(A * m, 'x')}$ to both sides` : `Subtract $${coef(-A * m, 'x')}$ from both sides`
  const step = `${A}y = ${sum([[A * m, 'x'], [A * c, '']])}`
  const xs = [-2, 0, 3]
  return {
    question: {
      type: 'short-text',
      prompt: `Rearrange $${given}$ into the form $y = mx + c$.`,
      solution: `${move}: $${step}$. Divide everything by ${A}: $${answer}$.`,
      markScheme: scheme(slot, [`$${step}$`], `$${answer}$`),
      accepted: lineForms(m, 1, c, false),
    },
    check: { agrees: xs.every((x) => onLine(given, x, yOn(answer, x))), detail: `points of ${answer} satisfy ${given}` },
    values: { m, c, A },
  }
}

/** q9: the triangle a line cuts off the axes. */
function interceptTriangle(r: Rng, slot: Question): Draft {
  const { X, Y, A, B, L } = draw(
    r,
    (r) => {
      const X = int(r, 2, 15)
      const Y = int(r, 2, 15)
      const L = (X * Y) / gcd(X, Y)
      return { X, Y, L, A: L / X, B: L / Y }
    },
    ({ X, Y, A, B }) => X !== Y && A <= 12 && B <= 12 && A + B > 2,
  )
  const line = r() < 0.75 ? `${coef(A, 'x')} + ${coef(B, 'y')} = ${L}` : `${coef(B, 'y')} + ${coef(A, 'x')} = ${L}`
  const area = (X * Y) / 2
  // Shoelace on O, A, B with the corners checked against the printed line.
  const shoelace = Math.abs(X * Y - 0) / 2
  return {
    question: {
      type: 'numeric',
      prompt: `The line $${line}$ crosses the $x$-axis at $A$ and the $y$-axis at $B$. Work out the area of triangle $OAB$, where $O$ is the origin.`,
      solution: `At $A$, $y = 0$ so $${coef(A, 'x')} = ${L}$${A === 1 ? '' : ` and $x = ${X}$`}. At $B$, $x = 0$ so $${coef(B, 'y')} = ${L}$${B === 1 ? '' : ` and $y = ${Y}$`}. Area $= \\tfrac{1}{2} \\times ${X} \\times ${Y} = ${show(area)}$.`,
      markScheme: scheme(slot, [`$A = (${X}, 0)$ or $B = (0, ${Y})$`, 'Both intercepts'], show(area)),
      answer: area,
      tolerance: 0,
    },
    check: { agrees: onLine(line, X, 0) && onLine(line, 0, Y) && shoelace === area, detail: `(${X}, 0) and (0, ${Y}) on ${line}; shoelace ${shoelace}` },
    values: { X, Y, A, B },
  }
}

/** ax + by + c = 0 for y = mx + c, with a positive x coefficient. */
function zeroForm(m: number, c: number): [number, number, number] {
  return m > 0 ? [m, -1, c] : [-m, 1, -c]
}

/** q10: the line PQ in the form ax + by + c = 0. */
function lineInGeneralForm(r: Rng, slot: Question): Draft {
  const { m, x1, y1, x2, y2 } = twoPoints(r, 1, 5)
  const c = y1 - m * x1
  const [A, B, C] = zeroForm(m, c)
  const answer = `${sum([[A, 'x'], [B, 'y'], [C, '']])} = 0`
  const negated = `${sum([[-A, 'x'], [-B, 'y'], [-C, '']])} = 0`
  return {
    question: {
      type: 'short-text',
      prompt: `$P$ is the point $${pt(x1, y1)}$ and $Q$ is the point $${pt(x2, y2)}$. Find the equation of the line $PQ$. Give your answer in the form $ax + by + c = 0$ where $a$, $b$ and $c$ are integers.`,
      solution: `Gradient $= ${rise(x1, y1, x2, y2)} = \\dfrac{${y2 - y1}}{${x2 - x1}} = ${m}$. Then $${y1} = ${m}(${x1}) + c$, so $c = ${c}$ and $${lineTex(m, 1, c)}$. Rearranged: $${answer}$.`,
      markScheme: scheme(slot, [`Gradient $${m}$`, `$c = ${c}$ or $${lineTex(m, 1, c)}$`, 'Rearranges to one side'], `$${answer}$ (or $${negated}$)`),
      accepted: zeroForms(A, B, C),
    },
    check: { agrees: onLine(answer, x1, y1) && onLine(answer, x2, y2), detail: `P and Q both satisfy ${answer}` },
    values: { x1, y1, x2, y2 },
  }
}

/** q11: (k, 2k) lies on y = 3x − 4. */
function pointWithUnknown(r: Rng, slot: Question): Draft {
  const swap = r() < 0.4
  const { m, p, k, c } = draw(
    r,
    (r) => {
      const m = nonZero(r, 1, 6)
      const p = pick(r, [2, 3, 4, -1, -2, -3])
      const k = nonZero(r, 1, 9)
      // (k, pk): pk = mk + c. (pk, k): k = mpk + c.
      const c = swap ? k - m * p * k : p * k - m * k
      return { m, p, k, c }
    },
    ({ m, p, c }) => c !== 0 && Math.abs(c) <= 30 && (swap ? 1 - m * p !== 0 : p !== m),
  )
  const line = lineTex(m, 1, c)
  const [X, Y] = swap ? [coef(p, 'k'), 'k'] : ['k', coef(p, 'k')]
  const [x, y] = swap ? [p * k, k] : [k, p * k]
  const rhs = swap ? sum([[m * p, 'k'], [c, '']]) : sum([[m, 'k'], [c, '']])
  const net = swap ? 1 - m * p : p - m
  const collected = `${coef(net, 'k')} = ${c}`
  return {
    question: {
      type: 'numeric',
      prompt: `The point $(${X}, ${Y})$ lies on the line $${line}$. Find the value of $k$.`,
      solution: `Substitute $x = ${X}$ and $y = ${Y}$: $${Y} = ${swap ? `${m}(${X}) ${c < 0 ? '-' : '+'} ${Math.abs(c)}` : rhs}$${swap ? `, which is $k = ${rhs}$` : ''}. Collect the $k$ terms: $${collected}$, so $k = ${k}$.`,
      markScheme: scheme(slot, [`$${Y} = ${rhs}$`, 'Collects $k$ terms'], `$k = ${k}$`),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: onLine(line, x, y), detail: `(${x}, ${y}) on ${line}` },
    values: { m, p, c, swap: swap ? 'yes' : 'no' },
  }
}

const HALVES = [-3, -2.5, -2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2, 2.5, 3]

/** q13: y = mx + 7 through (4, 1) and (−2, k). */
function unknownGradientThenPoint(r: Rng, slot: Question): Draft {
  const half = r() < 0.7
  const { m, c, x1, x2 } = draw(
    r,
    (r) => ({ m: pick(r, HALVES), c: nonZero(r, 1, 10), x1: nonZero(r, 1, 6), x2: nonZero(r, 1, 6) }),
    ({ m, x1, x2 }) => x1 !== x2 && Number.isInteger(m * x1) && Number.isInteger(m * x2) && Number.isInteger(m) !== half,
  )
  const y1 = m * x1 + c
  const k = m * x2 + c
  const line = `y = mx ${c < 0 ? '-' : '+'} ${Math.abs(c)}`
  const found = lineTex(m, 1, c)
  const mx2 = m * x2
  return {
    question: {
      type: 'numeric',
      prompt: `The line $${line}$ passes through $${pt(x1, y1)}$ and $(${x2}, k)$. Find the value of $k$.`,
      solution: `Substitute $${pt(x1, y1)}$: $${y1} = ${coef(x1, 'm')} ${c < 0 ? '-' : '+'} ${Math.abs(c)}$, so $m = ${show(m)}$. The line is $${found}$. At $x = ${x2}$: $k = ${show(m)}(${x2}) ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${show(mx2)} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${show(k)}$.`,
      markScheme: scheme(slot, [`$${y1} = ${coef(x1, 'm')} ${c < 0 ? '-' : '+'} ${Math.abs(c)}$ giving $m = ${show(m)}$`, `Substitutes $x = ${x2}$ into $${found}$`], show(k)),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: near((k - y1) / (x2 - x1), (y1 - c) / x1), detail: `gradient from the two points ${(k - y1) / (x2 - x1)}, from the intercept ${(y1 - c) / x1}` },
    values: { m, c, x1, x2 },
  }
}

/** q14: the same y-intercept as another line, through a point. */
function sameIntercept(r: Rng, slot: Question): Draft {
  const { M, C, m, x1 } = draw(
    r,
    (r) => ({ M: nonZero(r, 1, 6), C: nonZero(r, 1, 9), m: nonZero(r, 1, 6), x1: nonZero(r, 1, 6) }),
    ({ M, m, C, x1 }) => M !== m && Math.abs(m * x1 + C) <= 25,
  )
  const y1 = m * x1 + C
  const given = lineTex(M, 1, C)
  return {
    question: {
      type: 'numeric',
      prompt: `A line passes through $${pt(x1, y1)}$ and has the same $y$-intercept as the line $${given}$. Work out its gradient.`,
      solution: `The $y$-intercept is $${C}$, so the line is $y = mx ${C < 0 ? '-' : '+'} ${Math.abs(C)}$. Substituting $${pt(x1, y1)}$: $${y1} = ${coef(x1, 'm')} ${C < 0 ? '-' : '+'} ${Math.abs(C)}$, so $m = ${m}$.`,
      markScheme: scheme(slot, [`$c = ${C}$`, `$${y1} = ${coef(x1, 'm')} ${C < 0 ? '-' : '+'} ${Math.abs(C)}$`], String(m)),
      answer: m,
      tolerance: 0,
    },
    check: { agrees: near(y1 - m * x1, yOn(given, 0)), detail: `back from ${pt(x1, y1)} with gradient ${m} to x = 0: ${y1 - m * x1}` },
    values: { M, C, x1, y1 },
  }
}

/** q15: the midpoint of AB. */
function midpoint(r: Rng, slot: Question): Draft {
  const { ax, ay, bx, by } = draw(
    r,
    (r) => ({ ax: int(r, -6, 12), ay: int(r, -6, 12), bx: int(r, -6, 12), by: int(r, -6, 12) }),
    ({ ax, ay, bx, by }) => (ax + bx) % 2 === 0 && (ay + by) % 2 === 0 && ax !== bx && ay !== by,
  )
  const mx = (ax + bx) / 2
  const my = (ay + by) / 2
  const d1 = Math.hypot(mx - ax, my - ay)
  const d2 = Math.hypot(bx - mx, by - my)
  const cross = (mx - ax) * (by - ay) - (my - ay) * (bx - ax)
  return {
    question: {
      type: 'short-text',
      prompt: `$A$ is $${pt(ax, ay)}$ and $B$ is $${pt(bx, by)}$. Find the coordinates of the midpoint of $AB$.`,
      solution: `Average the $x$-coordinates and the $y$-coordinates: $\\left(\\dfrac{${ax} + ${sub(bx)}}{2}, \\dfrac{${ay} + ${sub(by)}}{2}\\right) = ${pt(mx, my)}$.`,
      markScheme: scheme(slot, ['Averages both coordinates'], `$${pt(mx, my)}$`),
      accepted: both(mx, my),
    },
    check: { agrees: near(d1, d2) && cross === 0, detail: `AM ${d1}, MB ${d2}, on AB: ${cross === 0}` },
    values: { ax, ay, bx, by },
  }
}

/** q19: a line from a gradient and a point, then the triangle it cuts off the axes. */
function triangleFromGradient(r: Rng, slot: Question): Draft {
  const { m, c, x1 } = draw(
    r,
    (r) => ({ m: nonZero(r, 1, 4), c: nonZero(r, 1, 12), x1: int(r, 1, 6) }),
    ({ m, c, x1 }) => c % m === 0 && m * x1 + c !== 0 && Math.abs(m * x1 + c) <= 20,
  )
  const y1 = m * x1 + c
  const line = lineTex(m, 1, c)
  const X = -c / m
  const area = Math.abs(X * c) / 2
  // Second route: the intercepts read off the printed line, then the shoelace formula.
  const yInt = yOn(line, 0)
  const xInt = -yOn(line, 0) / (yOn(line, 1) - yOn(line, 0))
  const shoelace = Math.abs(xInt * yInt) / 2
  return {
    question: {
      type: 'numeric',
      prompt: `A line has gradient $${m}$ and passes through $${pt(x1, y1)}$. It crosses the $x$-axis at $A$ and the $y$-axis at $B$. Work out the area of triangle $OAB$, where $O$ is the origin.`,
      solution: `$y = ${coef(m, 'x')} + c$ with $${pt(x1, y1)}$: $${y1} = ${m * x1} + c$, so $c = ${c}$ and the line is $${line}$. On the $x$-axis $y = 0$: $x = ${X}$, so $A = ${pt(X, 0)}$. On the $y$-axis $x = 0$: $y = ${c}$, so $B = ${pt(0, c)}$. Area $= \\tfrac{1}{2} \\times ${Math.abs(X)} \\times ${Math.abs(c)} = ${show(area)}$.`,
      markScheme: scheme(slot, [`$c = ${c}$ or $${line}$`, `$A = ${pt(X, 0)}$`, `$B = ${pt(0, c)}$`], show(area)),
      answer: area,
      tolerance: 0,
    },
    check: { agrees: near(shoelace, area) && onLine(line, x1, y1), detail: `intercepts read from ${line}: ${xInt}, ${yInt}; area ${shoelace}` },
    values: { m, c, x1 },
  }
}

export const straightLineGenerators: Generator[] = [
  bySlot('line-read-off', LINES, { q1: readGradient, q2: readIntercept, q3: gradientFromPoints, q15: midpoint }),
  bySlot('line-equation', LINES, { q4: equationFromIntercept, q5: equationFromFractionGradient, q6: equationFromTwoPoints, q8: rearrangeToSlopeIntercept, q10: lineInGeneralForm }),
  bySlot('line-problem', LINES, { q9: interceptTriangle, q11: pointWithUnknown, q13: unknownGradientThenPoint, q14: sameIntercept, q19: triangleFromGradient }),
]

/* ------------------------------------------------------------------------------------------
 * Parallel and perpendicular lines
 * ---------------------------------------------------------------------------------------- */

/** m1 × m2 = −1, worked in whole numbers: (a/b)(c/d) = −1 when ac = −bd. */
function perpendicular(a: number, b: number, c: number, d: number): Check {
  return { agrees: a * c === -b * d, detail: `(${a}/${b}) × (${c}/${d}) = ${(a * c) / (b * d)}` }
}

/** Gradients whose negative reciprocal is a terminating decimal: the top made of 2s and 5s. */
const GIVEN_GRADIENTS: [number, number][] = [
  ...[1, 2, 4, 5, 8, 10].map((n) => [n, 1] as [number, number]),
  ...[1, 2, 4, 5, 8, 10].map((n) => [n, 1] as [number, number]),
  ...[2, 4, 5].flatMap((p) => [2, 3, 4, 5, 6, 7, 8, 9].filter((q) => gcd(p, q) === 1).map((q) => [p, q] as [number, number])),
]

const ASK = [
  (m: string) => `A line has gradient $${m}$. Write down the gradient of a line perpendicular to it.`,
  (m: string) => `Line $L$ has gradient $${m}$. Line $M$ is perpendicular to $L$. Write down the gradient of $M$.`,
  (m: string) => `Two lines are perpendicular. One has gradient $${m}$. What is the gradient of the other?`,
]

/** q2: the perpendicular gradient from a gradient. */
function perpendicularGradient(r: Rng, slot: Question): Draft {
  const [n, d] = pick(r, GIVEN_GRADIENTS)
  const s = pm(r)
  const [P, Q] = reduce(-d * s, n)
  const answer = P / Q
  const given = fracTex(s * n, d)
  const out = fracTex(P, Q)
  const decimal = Q === 1 ? '' : `, which is $${show(answer)}$`
  return {
    question: {
      type: 'numeric',
      prompt: pick(r, ASK)(given),
      solution: `Perpendicular gradients multiply to $-1$, so flip the gradient and change its sign: $${out}$${decimal}. Check: $${given} \\times ${out.startsWith('-') ? `\\left(${out}\\right)` : out} = -1$.`,
      markScheme: scheme(slot, [], `$${out.replace('\\tfrac', '\\frac')}$${Q === 1 ? '' : ` or ${minus(show(answer))}`}`),
      answer,
      tolerance: 0,
    },
    check: perpendicular(s * n, d, P, Q),
    values: { m: `${s * n}/${d}` },
  }
}

/** q3: the perpendicular gradient read from y = −⅓x + 2. */
function perpendicularToEquation(r: Rng, slot: Question): Draft {
  const unit = r() < 0.6
  const { a, b } = draw(
    r,
    (r) => ({ a: unit ? 1 : pick(r, [2, 4, 5]), b: int(r, 2, 9) }),
    ({ a, b }) => gcd(a, b) === 1 && a !== b,
  )
  const s = pm(r)
  const c = nonZero(r, 1, 9)
  const [P, Q] = reduce(-b * s, a)
  const answer = P / Q
  const line = r() < 0.7 ? lineTex(s * a, b, c) : `y = ${c} ${s < 0 ? '-' : '+'} ${fracTex(a, b)}x`
  const m = fracTex(s * a, b)
  const out = fracTex(P, Q)
  return {
    question: {
      type: 'numeric',
      prompt: `Write down the gradient of a line perpendicular to $${line}$.`,
      solution: `The gradient is $${m}$, and its negative reciprocal is $${out}$${Q === 1 ? '' : `, which is $${show(answer)}$`}. Check: $${m} \\times ${P < 0 ? `\\left(${out}\\right)` : out} = -1$.`,
      markScheme: scheme(slot, [], Q === 1 ? minus(String(P)) : `$${out.replace('\\tfrac', '\\frac')}$ or ${minus(show(answer))}`),
      answer,
      tolerance: 0,
    },
    check: { agrees: perpendicular(s * a, b, P, Q).agrees && near(slopeOf(line) * answer, -1), detail: `gradient read from ${line}: ${slopeOf(line)}; product ${slopeOf(line) * answer}` },
    values: { m: `${s * a}/${b}`, c },
  }
}

/** q4: parallel to y = 4x − 1 through a point. */
function parallelThroughPoint(r: Rng, slot: Question): Draft {
  const { m, c0, x1, c } = draw(
    r,
    (r) => ({ m: nonZero(r, 1, 6), c0: nonZero(r, 1, 9), x1: nonZero(r, 1, 5), c: nonZero(r, 1, 12) }),
    ({ m, c0, c, x1 }) => c !== c0 && Math.abs(m * x1 + c) <= 20,
  )
  const y1 = m * x1 + c
  const given = lineTex(m, 1, c0)
  const answer = lineTex(m, 1, c)
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line parallel to $${given}$ that passes through $${pt(x1, y1)}$.`,
      solution: `Same gradient, $${m}$. Substitute $${pt(x1, y1)}$: $${y1} = ${m * x1} + c$, so $c = ${c}$. $${answer}$.`,
      markScheme: scheme(slot, [`$y = ${coef(m, 'x')} + c$ with $${pt(x1, y1)}$ substituted`], `$${answer}$`),
      accepted: lineForms(m, 1, c),
    },
    check: { agrees: onLine(answer, x1, y1) && near(slopeOf(answer), slopeOf(given)), detail: `${pt(x1, y1)} on ${answer}; gradients ${slopeOf(answer)} and ${slopeOf(given)}` },
    values: { m, c0, x1, c },
  }
}

/** q5: perpendicular to y = 2x + 3 through a point. */
function perpendicularThroughPoint(r: Rng, slot: Question): Draft {
  const { m, c0, k, c } = draw(
    r,
    (r) => ({ m: nonZero(r, 2, 5), c0: nonZero(r, 1, 9), k: nonZero(r, 1, 3), c: nonZero(r, 1, 10) }),
    () => true,
  )
  const x1 = k * Math.abs(m)
  const [p, q] = reduce(-1, m)
  const y1 = (p * x1) / q + c
  const given = lineTex(m, 1, c0)
  const answer = lineTex(p, q, c)
  const px = (p * x1) / q
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line perpendicular to $${given}$ that passes through $${pt(x1, y1)}$.`,
      solution: `Perpendicular gradient $${fracTex(p, q)}$. Substitute $${pt(x1, y1)}$: $${y1} = ${px} + c$, so $c = ${c}$. $${answer}$.`,
      markScheme: scheme(slot, [`Gradient $${fracTex(p, q, '\\frac')}$`, `$${y1} = ${px} + c$`], `$${answer.replace('\\tfrac', '\\frac')}$`),
      accepted: lineForms(p, q, c),
    },
    check: { agrees: onLine(answer, x1, y1) && near(slopeOf(answer) * slopeOf(given), -1), detail: `${pt(x1, y1)} on ${answer}; gradient product ${slopeOf(answer) * slopeOf(given)}` },
    values: { m, c0, x1, c },
  }
}

/** q7: y = kx + 2 parallel to 3x + y = 7. */
function parallelUnknown(r: Rng, slot: Question): Draft {
  const k = nonZero(r, 1, 6)
  const B = pick(r, [1, 1, 2, 3])
  const A = -k * B
  const c = nonZero(r, 1, 9)
  const C = c * B
  const d = nonZero(r, 1, 9)
  const xFirst = r() < 0.7
  const given = `${xFirst ? sum([[A, 'x'], [B, 'y']]) : sum([[B, 'y'], [A, 'x']])} = ${C}`
  const steps = B === 1 ? `$${given}$ rearranges to $${lineTex(k, 1, c)}$` : `$${given}$ rearranges to $${B}y = ${sum([[-A, 'x'], [C, '']])}$, so $${lineTex(k, 1, c)}$`
  return {
    question: {
      type: 'numeric',
      prompt: `The lines $y = kx ${d < 0 ? '-' : '+'} ${Math.abs(d)}$ and $${given}$ are parallel. Find the value of $k$.`,
      solution: `${steps}, gradient $${k}$. Parallel means $k = ${k}$.`,
      markScheme: scheme(slot, [`$${lineTex(k, 1, c)}$`], `$k = ${k}$`),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: near(slopeOf(given), k), detail: `gradient read from ${given}: ${slopeOf(given)}` },
    values: { k, A, B, C },
  }
}

/** q9: the perpendicular bisector of AB. */
function perpendicularBisector(r: Rng, slot: Question): Draft {
  const v = draw(
    r,
    (r) => ({ ax: int(r, -4, 8), ay: int(r, -4, 10), dx: nonZero(r, 1, 4) * 2, dy: nonZero(r, 1, 4) * 2 }),
    ({ ax, ay, dx, dy }) => {
      const [p, q] = reduce(-dx, dy)
      const mx = ax + dx / 2
      const my = ay + dy / 2
      return Number.isInteger(my - (p * mx) / q) && my - (p * mx) / q !== 0 && Math.abs(dx) !== Math.abs(dy) && Math.abs(my - (p * mx) / q) <= 30
    },
  )
  const { ax, ay, dx, dy } = v
  const bx = ax + dx
  const by = ay + dy
  const mx = ax + dx / 2
  const my = ay + dy / 2
  const [p, q] = reduce(-dx, dy)
  const c = my - (p * mx) / q
  const answer = lineTex(p, q, c)
  const gAB = fracTex(dy, dx)
  const pmx = (p * mx) / q
  // Second route: points on the answer line are as far from A as from B.
  const equidistant = [-3, 1, 4].every((x) => {
    const y = yOn(answer, x)
    return near(Math.hypot(x - ax, y - ay), Math.hypot(x - bx, y - by))
  })
  return {
    question: {
      type: 'short-text',
      prompt: `$A$ is $${pt(ax, ay)}$ and $B$ is $${pt(bx, by)}$. Find the equation of the perpendicular bisector of $AB$.`,
      solution: `Midpoint $= \\left(\\tfrac{${ax} + ${sub(bx)}}{2}, \\tfrac{${ay} + ${sub(by)}}{2}\\right) = ${pt(mx, my)}$. Gradient of $AB = \\tfrac{${dy}}{${dx}} = ${gAB}$, so the perpendicular gradient is $${fracTex(p, q)}$. Through $${pt(mx, my)}$: $${my} = ${show(pmx)} + c$, $c = ${c}$. $${answer}$.`,
      markScheme: scheme(slot, [`Midpoint $${pt(mx, my)}$`, `Gradient of $AB$ is $${fracTex(dy, dx, '\\frac')}$`, `Perpendicular gradient $${fracTex(p, q, '\\frac')}$ used with the midpoint`], `$${answer.replace('\\tfrac', '\\frac')}$ or equivalent`),
      accepted: lineForms(p, q, c),
    },
    check: { agrees: equidistant && onLine(answer, mx, my), detail: `points of ${answer} equidistant from A and B: ${equidistant}` },
    values: { ax, ay, bx, by },
  }
}

/** q11: the y-intercept of a perpendicular line. */
function perpendicularIntercept(r: Rng, slot: Question): Draft {
  const m = nonZero(r, 2, 5)
  const c0 = nonZero(r, 1, 9)
  const k = nonZero(r, 1, 3)
  const x1 = k * Math.abs(m)
  const c = draw(r, (r) => int(r, -10, 12), (c) => c !== 0)
  const y1 = c - x1 / m
  const L = lineTex(m, 1, c0)
  const shift = -x1 / m
  return {
    question: {
      type: 'numeric',
      prompt: `Line $L$ has equation $${L}$. Line $M$ is perpendicular to $L$ and passes through $${pt(x1, y1)}$. Find the $y$-coordinate of the point where $M$ crosses the $y$-axis.`,
      solution: `Gradient of $M$ is $${fracTex(-1, m)}$. Substitute $${pt(x1, y1)}$: $${y1} = ${show(shift)} + c$, so $c = ${c}$. $M$ crosses at $${pt(0, c)}$.`,
      markScheme: scheme(slot, [`Gradient $${fracTex(-1, m, '\\frac')}$`, `$${y1} = ${show(shift)} + c$`], String(c)),
      answer: c,
      tolerance: 0,
    },
    check: { agrees: near(((y1 - c) / x1) * slopeOf(L), -1), detail: `gradient from (0, ${c}) to ${pt(x1, y1)} times ${m}: ${((y1 - c) / x1) * m}` },
    values: { m, c0, x1, y1 },
  }
}

/** q12: kx + 2y = 8 perpendicular to y = 4x + 1. */
function perpendicularUnknown(r: Rng, slot: Question): Draft {
  const { B, M } = draw(
    r,
    (r) => ({ B: int(r, 1, 6), M: nonZero(r, 1, 8) }),
    ({ B, M }) => terminates(B, M) && Math.abs(M) !== 1 && B % M !== 0,
  )
  const c = nonZero(r, 1, 6)
  const C = c * B
  const c0 = nonZero(r, 1, 9)
  const k = B / M
  const given = `kx + ${B === 1 ? '' : B}y = ${C}`
  const other = lineTex(M, 1, c0)
  const grad = B === 1 ? '-k' : `-\\tfrac{k}{${B}}`
  const rearranged = B === 1 ? `y = -kx ${C < 0 ? '-' : '+'} ${Math.abs(C)}` : `y = -\\tfrac{k}{${B}}x ${c < 0 ? '-' : '+'} ${Math.abs(c)}`
  const ktex = fracTex(B, M)
  const decimal = Number.isInteger(k) ? '' : ` = ${show(k)}`
  const withK = `${show(k)}x + ${B === 1 ? '' : B}y = ${C}`
  return {
    question: {
      type: 'numeric',
      prompt: `The lines $${given}$ and $${other}$ are perpendicular. Find the value of $k$.`,
      solution: `$${given}$ rearranges to $${rearranged}$, gradient $${grad}$. Perpendicular to gradient $${M}$ means $${grad} \\times ${sub(M)} = -1$, so $${coef(M, 'k')} = ${B}$ and $k = ${ktex}${decimal}$.`,
      markScheme: scheme(slot, [`Gradient $${grad.replace('\\tfrac', '\\frac')}$`, `$${grad.replace('\\tfrac', '\\frac')} \\times ${sub(M)} = -1$`], `$k = ${fracTex(B, M, '\\frac')}$${decimal ? ` or ${minus(show(k))}` : ''}`),
      answer: k,
      tolerance: 0,
    },
    check: { agrees: near(slopeOf(withK) * M, -1), detail: `gradient of ${withK}: ${slopeOf(withK)}, times ${M}` },
    values: { B, M, C },
  }
}

/** q13: perpendicular to 2x + y = 7 through its y-intercept. */
function perpendicularAtIntercept(r: Rng, slot: Question): Draft {
  const { A, B, c } = draw(
    r,
    (r) => ({ A: nonZero(r, 1, 6), B: pick(r, [1, 1, 1, 2, 3]), c: nonZero(r, 1, 9) }),
    ({ A, B }) => gcd(A, B) === 1 && Math.abs(A) !== 1,
  )
  const given = `${sum([[A, 'x'], [B, 'y']])} = ${B * c}`
  const [p, q] = reduce(B, A)
  const answer = lineTex(p, q, c)
  const own = lineTex(-A, B, c)
  return {
    question: {
      type: 'short-text',
      prompt: `A line is perpendicular to $${given}$ and passes through the point where $${given}$ crosses the $y$-axis. Find the equation of the line.`,
      solution: `$${given}$ is $${own}$: gradient $${fracTex(-A, B)}$, crossing at $${pt(0, c)}$. Perpendicular gradient $${fracTex(p, q)}$, and $c = ${c}$ straight away. $${answer}$.`,
      markScheme: scheme(slot, [`$${own.replace('\\tfrac', '\\frac')}$ or intercept $${pt(0, c)}$`, `Gradient $${fracTex(p, q, '\\frac')}$`], `$${answer.replace('\\tfrac', '\\frac')}$`),
      accepted: lineForms(p, q, c),
    },
    check: { agrees: onLine(given, 0, c) && onLine(answer, 0, c) && near(slopeOf(given) * slopeOf(answer), -1), detail: `(0, ${c}) on both; gradient product ${slopeOf(given) * slopeOf(answer)}` },
    values: { A, B, c },
  }
}

/** q14: the fourth corner of a rectangle. */
function rectangleCorner(r: Rng, slot: Question): Draft {
  const v = draw(
    r,
    (r) => {
      const p = nonZero(r, 1, 4)
      const q = nonZero(r, 1, 3)
      const t = pick(r, [1, 1, 2, -1])
      const bx = int(r, 0, 8)
      const by = int(r, 0, 8)
      return { p, q, t, bx, by, ax: bx - p, ay: by - q, cx: bx - t * q, cy: by + t * p }
    },
    ({ ax, ay, cx, cy, p, q }) => [ax, ay, cx, cy, ax + cx - (ax + p), ay + cy - (ay + q)].every((n) => n >= -3 && n <= 14) && Math.abs(p) !== Math.abs(q),
  )
  const { ax, ay, bx, by, cx, cy } = v
  const dx = ax + (cx - bx)
  const dy = ay + (cy - by)
  const sx = cx - bx
  const sy = cy - by
  const dot = (ux: number, uy: number, wx: number, wy: number) => ux * wx + uy * wy
  const square = [
    dot(bx - ax, by - ay, dx - ax, dy - ay),
    dot(ax - bx, ay - by, cx - bx, cy - by),
    dot(bx - cx, by - cy, dx - cx, dy - cy),
    dot(ax - dx, ay - dy, cx - dx, cy - dy),
  ].every((d) => d === 0)
  const shift = (n: number) => (n < 0 ? `${n}` : `+${n}`)
  const gAB = fracTex(by - ay, bx - ax)
  const gBC = fracTex(cy - by, cx - bx)
  return {
    question: {
      type: 'short-text',
      prompt: `$ABCD$ is a rectangle. $A$ is $${pt(ax, ay)}$, $B$ is $${pt(bx, by)}$ and $C$ is $${pt(cx, cy)}$. Find the coordinates of $D$.`,
      solution: `In a rectangle $\\vec{AD} = \\vec{BC}$. From $B$ to $C$ is $${shift(sx)}$ in $x$ and $${shift(sy)}$ in $y$, so $D = (${ax} ${sx < 0 ? '-' : '+'} ${Math.abs(sx)}, ${ay} ${sy < 0 ? '-' : '+'} ${Math.abs(sy)}) = ${pt(dx, dy)}$. Check: gradient $AB = ${gAB}$ and gradient $BC = ${gBC}$, product $-1$, so the corners are right angles.`,
      markScheme: scheme(slot, ['Uses $\\vec{AD} = \\vec{BC}$ or perpendicular gradients', `Shift of $(${shift(sx)}, ${shift(sy)})$ or equivalent`], `$${pt(dx, dy)}$`),
      accepted: both(dx, dy),
    },
    check: { agrees: square && perpendicular(by - ay, bx - ax, cy - by, cx - bx).agrees, detail: `right angles at all four corners: ${square}` },
    values: { ax, ay, bx, by, cx, cy },
  }
}

/** q15: perpendicular through a point, as ax + by + c = 0. */
function perpendicularGeneralForm(r: Rng, slot: Question): Draft {
  const { m, c0, k, c } = draw(
    r,
    (r) => ({ m: nonZero(r, 2, 5), c0: nonZero(r, 1, 9), k: nonZero(r, 1, 3), c: nonZero(r, 1, 9) }),
    () => true,
  )
  const x1 = k * Math.abs(m)
  const y1 = c - x1 / m
  const given = lineTex(m, 1, c0)
  // y = −x/m + c, times m: my = −x + mc, so x + my − mc = 0.
  const [A, B, C] = [1, m, -m * c]
  const answer = `${sum([[A, 'x'], [B, 'y'], [C, '']])} = 0`
  const slope = lineTex(-1, m, c)
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line perpendicular to $${given}$ that passes through $${pt(x1, y1)}$. Give your answer in the form $ax + by + c = 0$ where $a$, $b$ and $c$ are integers.`,
      solution: `Gradient $${fracTex(-1, m)}$. Through $${pt(x1, y1)}$: $${y1} = ${show(-x1 / m)} + c$, so $c = ${c}$ and $${slope}$. Multiply by ${Math.abs(m)}: $${Math.abs(m)}y = ${sum([[-Math.sign(m), 'x'], [Math.abs(m) * c, '']])}$, so $${answer}$.`,
      markScheme: scheme(slot, [`Gradient $${fracTex(-1, m, '\\frac')}$`, `$c = ${c}$`, `Multiplies through by ${Math.abs(m)}`], `$${answer}$ or any integer multiple`),
      accepted: zeroForms(A, B, C),
    },
    check: { agrees: onLine(answer, x1, y1) && near(slopeOf(answer) * m, -1), detail: `${pt(x1, y1)} on ${answer}; gradient product ${slopeOf(answer) * m}` },
    values: { m, c0, x1, y1 },
  }
}

/** q16: perpendicular to 3x − 4y = 8 through (0, 2). */
function perpendicularFromGeneral(r: Rng, slot: Question): Draft {
  const { A, B, s, c0, k } = draw(
    r,
    (r) => ({ A: int(r, 1, 6), B: int(r, 2, 6), s: pm(r), c0: nonZero(r, 1, 5), k: nonZero(r, 1, 9) }),
    ({ A, B }) => gcd(A, B) === 1,
  )
  // Ax − By = C has gradient A/B; Ax + By = C has −A/B.
  const given = `${A === 1 ? '' : A}x ${s > 0 ? '-' : '+'} ${B}y = ${s > 0 ? -B * c0 : B * c0}`
  const gradient: [number, number] = [s * A, B]
  const own = lineTex(s * A, B, c0)
  const [p, q] = reduce(-B, s * A)
  const answer = lineTex(p, q, k)
  return {
    question: {
      type: 'short-text',
      prompt: `Find the equation of the line perpendicular to $${given}$ that passes through $${pt(0, k)}$.`,
      solution: `$${given}$ rearranges to $${own}$: gradient $${fracTex(...gradient)}$. Perpendicular gradient $${fracTex(p, q)}$, and the line crosses at $${pt(0, k)}$: $${answer}$.`,
      markScheme: scheme(slot, [`Gradient $${fracTex(gradient[0], gradient[1], '\\frac')}$ after rearranging`, `Perpendicular gradient $${fracTex(p, q, '\\frac')}$`], `$${answer.replace('\\tfrac', '\\frac')}$`),
      accepted: lineForms(p, q, k),
    },
    check: { agrees: onLine(answer, 0, k) && near(slopeOf(given) * slopeOf(answer), -1) && near(yOn(given, 0), c0), detail: `gradients ${slopeOf(given)} and ${slopeOf(answer)}` },
    values: { A, B, s, c0, k },
  }
}

export const perpendicularGenerators: Generator[] = [
  bySlot('perpendicular-gradient', PERP, { q2: perpendicularGradient, q3: perpendicularToEquation, q7: parallelUnknown, q11: perpendicularIntercept, q12: perpendicularUnknown }),
  bySlot('parallel-perpendicular-equation', PERP, {
    q4: parallelThroughPoint,
    q5: perpendicularThroughPoint,
    q9: perpendicularBisector,
    q13: perpendicularAtIntercept,
    q14: rectangleCorner,
    q15: perpendicularGeneralForm,
    q16: perpendicularFromGeneral,
  }),
]

/* ------------------------------------------------------------------------------------------
 * The equation of a circle
 * ---------------------------------------------------------------------------------------- */

const PRIMITIVE: [number, number][] = [[3, 4], [5, 12], [8, 15], [7, 24], [20, 21], [12, 35], [9, 40]]
/** Whole-number points (a, b) with a² + b² = r², r at most 50, both coordinates non-zero. */
const LATTICE: { a: number; b: number; r: number }[] = PRIMITIVE.flatMap(([a, b]) => {
  const out: { a: number; b: number; r: number }[] = []
  const h = Math.hypot(a, b)
  for (let k = 1; k * h <= 50; k++) out.push({ a: k * a, b: k * b, r: k * h }, { a: k * b, b: k * a, r: k * h })
  return out
})
const signed = (r: Rng, { a, b, r: rad }: { a: number; b: number; r: number }) => ({ a: pm(r) * a, b: pm(r) * b, r: rad })
const sq = (n: number) => (n < 0 ? `(${n})^2` : `${n}^2`)

/** q3: is a point on the circle? */
function pointOnCircle(r: Rng, slot: Question): Draft {
  const p = signed(r, pick(r, LATTICE))
  const yes = r() < 0.5
  const [x, y] = yes ? [p.a, p.b] : pick(r, [[p.a + pm(r), p.b], [p.a, p.b + pm(r)]] as [number, number][])
  const R2 = p.r * p.r
  const total = x * x + y * y
  const answer = total === R2 ? 'yes' : 'no'
  const verdict = answer === 'yes' ? `which equals $r^2$, so **yes**, the point lies on the circle` : `which is not ${R2}, so **no**: the point lies ${total > R2 ? 'just outside' : 'just inside'} the circle`
  return {
    question: {
      type: 'short-text',
      prompt: `Does the point $${pt(x, y)}$ lie on the circle $x^2 + y^2 = ${R2}$? Answer yes or no.`,
      solution: `$${sq(x)} + ${sq(y)} = ${x * x} + ${y * y} = ${total}$, ${verdict}.`,
      markScheme: scheme(slot, [], answer),
      accepted: [answer],
    },
    check: { agrees: (Math.hypot(x, y) === p.r) === (answer === 'yes') && (answer === 'yes') === yes, detail: `distance from the centre ${Math.hypot(x, y)} against radius ${p.r}` },
    values: { x, y, R2, answer },
  }
}

/** q7: the missing coordinate of a point on x² + y² = r². */
function missingCoordinate(r: Rng, slot: Question): Draft {
  const p = pick(r, LATTICE)
  const a = pm(r) * p.a
  const k = p.b
  const negative = r() < 0.3
  const unknownFirst = r() < 0.3
  const R2 = p.r * p.r
  const answer = negative ? -k : k
  const point = unknownFirst ? `(k, ${a})` : `(${a}, k)`
  return {
    question: {
      type: 'numeric',
      prompt: `The circle $x^2 + y^2 = ${R2}$ passes through the point $${point}$, where $k$ is ${negative ? 'negative' : 'positive'}. Work out $k$.`,
      solution: `Substitute: ${unknownFirst ? `$k^2 + ${a * a} = ${R2}$` : `$${a * a} + k^2 = ${R2}$`}, so $k^2 = ${k * k}$ and $k = ${answer}$, taking the ${negative ? 'negative' : 'positive'} root as asked.`,
      markScheme: scheme(slot, [unknownFirst ? `k² + ${a * a} = ${R2}` : `${a * a} + k² = ${R2}`], `k = ${minus(String(answer))}`),
      answer,
      tolerance: 0,
    },
    check: { agrees: Math.hypot(a, answer) === p.r && (negative ? answer < 0 : answer > 0), detail: `distance of the point from the centre: ${Math.hypot(a, answer)}` },
    values: { a, k: answer, R2 },
  }
}

/** q8: the gradient of a radius, as a fraction. */
function radiusGradient(r: Rng, slot: Question): Draft {
  const p = signed(r, pick(r, LATTICE))
  const named = r() < 0.5
  const [n, d] = reduce(p.b, p.a)
  const answer = fracText(n, d)
  // The same gradient unsimplified, with the sign on top: 8/6 for 4/3, -8/6 for 8/-6.
  const unsimplified = `${p.a < 0 ? -p.b : p.b}/${Math.abs(p.a)}`
  const simplified = n === p.b && d === p.a ? '' : ` = ${fracTex(n, d, '\\dfrac')}`
  return {
    question: {
      type: 'short-text',
      prompt: `A radius runs from the origin to the point $${pt(p.a, p.b)}$ on ${named ? `the circle $x^2 + y^2 = ${p.r * p.r}$` : 'a circle'}. What is the gradient of that radius? Give your answer as a fraction.`,
      solution: `Gradient is the change in $y$ over the change in $x$, from $(0, 0)$ to $${pt(p.a, p.b)}$: $\\dfrac{${p.b} - 0}{${p.a} - 0} = \\dfrac{${p.b}}{${p.a}}${simplified}$.`,
      markScheme: scheme(slot, [], minus(answer)),
      accepted: [...new Set([answer, unsimplified])],
    },
    check: { agrees: near(n / d, p.b / p.a) && Math.hypot(p.a, p.b) === p.r && d !== 1 && gcd(n, d) === 1, detail: `rise over run ${p.b / p.a}; point on a circle of radius ${p.r}` },
    values: { a: p.a, b: p.b },
  }
}

/** Every chord of x² + y² = R² between two lattice points with a whole-number gradient and intercept. */
const CHORDS: { R: number; x1: number; y1: number; x2: number; y2: number; m: number; c: number }[] = []
for (const R of [5, 10, 13, 15, 17, 25]) {
  const pts: [number, number][] = []
  for (let x = -R; x <= R; x++) for (let y = -R; y <= R; y++) if (x * x + y * y === R * R) pts.push([x, y])
  for (const [x1, y1] of pts)
    for (const [x2, y2] of pts) {
      if (x2 <= x1) continue
      const m = (y2 - y1) / (x2 - x1)
      const c = y1 - m * x1
      if (Number.isInteger(m) && m !== 0 && Math.abs(m) <= 3 && Number.isInteger(c) && c !== 0 && Math.abs(c) <= 15) CHORDS.push({ R, x1, y1, x2, y2, m, c })
    }
}

/** q12: where a line meets a circle. */
function lineMeetsCircle(r: Rng, slot: Question): Draft {
  const { R, x1, y1, x2, y2, m, c } = pick(r, CHORDS)
  const larger = r() < 0.6
  const [x, y] = larger ? [x2, y2] : [x1, y1]
  const line = lineTex(m, 1, c)
  const a = 1 + m * m
  const b = 2 * m * c
  const k = c * c - R * R
  const full = `${sum([[a, 'x^2'], [b, 'x'], [k, '']])} = 0`
  const reduced = `${sum([[1, 'x^2'], [-(x1 + x2), 'x'], [x1 * x2, '']])} = 0`
  const factor = (root: number) => (root === 0 ? 'x' : `(x ${root < 0 ? '+' : '-'} ${Math.abs(root)})`)
  const factors = x2 === 0 ? `${factor(x2)}${factor(x1)}` : `${factor(x1)}${factor(x2)}`
  const sub2 = `x^2 + (${sum([[m, 'x'], [c, '']])})^2 = ${R * R}`
  const divide = a === 1 ? '' : ` and then $${reduced}$`
  return {
    question: {
      type: 'short-text',
      prompt: `The line $${line}$ meets the circle $x^2 + y^2 = ${R * R}$ at two points. Give the point with the ${larger ? 'larger' : 'smaller'} $x$ value, as a coordinate pair.`,
      solution: `Substituting gives $${sub2}$, so $${full}$${divide}, which factorises to $${factors} = 0$. So $x = ${x1}$ or $x = ${x2}$. The ${larger ? 'larger' : 'smaller'} is $x = ${x}$, and the **line** gives $y = ${m === 1 ? sub(x) : m === -1 ? `-${sub(x)}` : `${m}(${x})`} ${c < 0 ? '-' : '+'} ${Math.abs(c)} = ${y}$, so the point is $${pt(x, y)}$.`,
      markScheme: scheme(slot, [`${sub2.replace('x^2', 'x²').replace(')^2', ')²')} leading to ${reduced.replace('x^2', 'x²')}`], `${pt(x, y)}`),
      accepted: both(x, y),
    },
    check: { agrees: x * x + y * y === R * R && onLine(line, x, y) && (larger ? x > x1 : x < x2), detail: `${pt(x, y)} on the circle and on ${line}` },
    values: { R, m, c, larger: larger ? 'yes' : 'no' },
  }
}

export const circleGenerators: Generator[] = [bySlot('circle-points', CIRCLE, { q3: pointOnCircle, q7: missingCoordinate, q8: radiusGradient, q12: lineMeetsCircle })]

/** Generators for straight lines, parallel and perpendicular lines, the equation of a circle. */
export const linesGenerators: Generator[] = [...straightLineGenerators, ...perpendicularGenerators, ...circleGenerators]

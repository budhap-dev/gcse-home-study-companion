import type { Question } from '../../content/questions.ts'
import { clearOfHalf, fixed, money, roundTo, show } from '../format.ts'
import { draw, int, pick, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { bisect, bySlot, coef, evalEquation, evalTex, near, sub, sum } from './formulae.ts'

const SIM = 'simultaneous-equations'
const INEQ = 'inequalities-on-a-number-line'
const FUN = 'functions'
const ITER = 'iteration'

const pm = (r: Rng) => (r() < 0.5 ? -1 : 1)
const nonZero = (r: Rng, lo: number, hi: number) => pm(r) * int(r, lo, hi)
const minus = (s: string) => s.replace(/-/g, '−')

/* ------------------------------------------------------------------------------------------
 * Simultaneous equations
 * ---------------------------------------------------------------------------------------- */

/** Both printed equations hold at the solution: the second method for every pair. */
function solves(equations: string[], x: number, y: number) {
  const gaps = equations.map((e) => evalEquation(e, { x, y }))
  return { agrees: gaps.every((g) => near(g, 0)), detail: `(${x}, ${y}) in ${equations.join(' and ')}: ${gaps.join(', ')}` }
}

/** q3: x + y = 10 and x − y = 4. */
function sumAndDifference(r: Rng, slot: Question): Draft {
  const { x, y } = draw(r, (r) => ({ x: int(r, 2, 15), y: int(r, -5, 12) }), ({ x, y }) => x !== y && x !== -y && y !== 0)
  const ask = r() < 0.7 ? 'y' : 'x'
  const S = x + y
  const D = x - y
  const eqs = [`x + y = ${S}`, `x - y = ${D}`]
  const [e1, e2] = r() < 0.75 ? eqs : [eqs[1]!, eqs[0]!]
  const answer = ask === 'y' ? y : x
  return {
    question: {
      type: 'numeric',
      prompt: `Solve $${e1}$ and $${e2}$. What is $${ask}$?`,
      solution: `Adding gives $2x = ${S + D}$, so $x = ${x}$. Substituting: $${x} + y = ${S}$, so $y = ${y}$.`,
      markScheme: scheme(slot, ['eliminates one letter'], minus(String(answer))),
      answer,
      tolerance: 0,
    },
    check: solves(eqs, x, y),
    values: { x, y, ask },
  }
}

/** ax + by with the letters in order, as printed: 3x + 2y, x - 2y. */
const lhs = (a: number, b: number) => sum([[a, 'x'], [b, 'y']])

/** q5: matching coefficients with the same sign, so subtract. */
function subtractToEliminate(r: Rng, slot: Question): Draft {
  const v = draw(
    r,
    (r) => ({ a: int(r, 2, 7), d: int(r, 1, 6), b: nonZero(r, 1, 5), x: nonZero(r, 1, 9), y: nonZero(r, 1, 9) }),
    ({ a, d }) => a > d,
  )
  const { a, d, b, x, y } = v
  const c = a * x + b * y
  const e = d * x + b * y
  const eqs = [`${lhs(a, b)} = ${c}`, `${lhs(d, b)} = ${e}`]
  const k = a - d
  return {
    question: {
      type: 'numeric',
      prompt: `Solve $${eqs[0]}$ and $${eqs[1]}$. What is $x$?`,
      solution: `The $y$ terms match with the **same sign**, so **subtract**: $${coef(k, 'x')} = ${c - e}$, giving $x = ${x}$. Then $y = ${y}$.`,
      markScheme: scheme(slot, ['subtracts, since the signs match', `reaches ${minus(`${coef(k, 'x')} = ${c - e}`)}`], minus(String(x))),
      answer: x,
      tolerance: 0,
    },
    check: solves(eqs, x, y),
    values: { a, b, d, x, y },
  }
}

/** q6: coefficients with opposite signs, so add. */
function addToEliminate(r: Rng, slot: Question): Draft {
  const { a, d, b, x, y } = draw(
    r,
    (r) => ({ a: int(r, 1, 6), d: int(r, 1, 5), b: int(r, 1, 4), x: nonZero(r, 1, 9), y: nonZero(r, 1, 9) }),
    ({ a, d }) => a + d > 1,
  )
  const eqs = [`${lhs(a, b)} = ${a * x + b * y}`, `${lhs(d, -b)} = ${d * x - b * y}`]
  const k = a + d
  return {
    question: {
      type: 'numeric',
      prompt: `Solve $${eqs[0]}$ and $${eqs[1]}$. What is $x$?`,
      solution: `The $y$ terms have **opposite signs**, so **add**: $${k}x = ${k * x}$, giving $x = ${x}$, and $y = ${y}$.`,
      markScheme: scheme(slot, ['adds to eliminate y'], minus(String(x))),
      answer: x,
      tolerance: 0,
    },
    check: solves(eqs, x, y),
    values: { a, b, d, x, y },
  }
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven']
const SHOPS = [
  { one: 'pen', many: 'pens', two: 'ruler', twos: 'rulers', p: 'p', q: 'r', half: false },
  { one: 'coffee', many: 'coffees', two: 'tea', twos: 'teas', p: 'c', q: 't', half: true },
  { one: 'adult ticket', many: 'adult tickets', two: 'child ticket', twos: 'child tickets', p: 'a', q: 'c', half: false },
  { one: 'notebook', many: 'notebooks', two: 'pencil', twos: 'pencils', p: 'n', q: 'p', half: true },
  { one: 'burger', many: 'burgers', two: 'drink', twos: 'drinks', p: 'b', q: 'd', half: true },
] as const
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const an = (s: string) => (/^[aeiou]/.test(s) ? `an ${s}` : `a ${s}`)

/** q13: two prices from two shopping totals. */
function shoppingPrices(r: Rng, slot: Question): Draft {
  const shop = pick(r, SHOPS)
  const step = shop.half ? 0.5 : 1
  const { a, d, b, P, Q } = draw(
    r,
    (r) => ({ a: int(r, 2, 5), d: int(r, 1, 4), b: int(r, 1, 4), P: int(r, 2, 12) * step, Q: int(r, 1, 8) * step }),
    ({ a, d, P, Q }) => a !== d && P !== Q,
  )
  const T1 = a * P + b * Q
  const T2 = d * P + b * Q
  const items = (n: number, one: string, many: string) => `${NUMBER_WORDS[n]} ${n === 1 ? one : many}`
  const { p, q } = shop
  const eqs = [`${coef(a, p)} + ${coef(b, q)} = ${show(T1)}`, `${coef(d, p)} + ${coef(b, q)} = ${show(T2)}`]
  const k = a - d
  // Second route: the printed equations, read with p and q as their letters.
  const read = [`${a}P + ${b}Q = ${show(T1)}`, `${d}P + ${b}Q = ${show(T2)}`].map((e) => evalEquation(e, { P, Q }))
  return {
    question: {
      type: 'numeric',
      prompt: `${cap(items(a, shop.one, shop.many))} and ${items(b, shop.two, shop.twos)} cost ${money(T1)}. ${cap(items(d, shop.one, shop.many))} and ${items(b, shop.two, shop.twos)} cost ${money(T2)}. What is the cost of one ${shop.one}, in pounds?`,
      solution: `Let $${p}$ be the cost of ${an(shop.one)} and $${q}$ of ${an(shop.two)}. Then $${eqs[0]}$ and $${eqs[1]}$. The $${q}$ terms match with the **same sign**, so subtract: ${Math.abs(k) === 1 ? `$${p} = ${show(P)}$` : `$${Math.abs(k)}${p} = ${show(Math.abs(T1 - T2))}$, giving $${p} = ${show(P)}$`}. ${cap(an(shop.one))} costs **${money(P)}** — and checking against the words: $${a} \\times ${money(P).replace('£', '\\pounds')} + ${b} \\times ${money(Q).replace('£', '\\pounds')} = ${money(T1).replace('£', '\\pounds')}$ ✓.`,
      markScheme: scheme(slot, ['writes both equations from the words', `eliminates ${q}`], money(P)),
      answer: P,
      tolerance: 0,
    },
    check: { agrees: read.every((g) => near(g, 0)) && P > 0 && Q > 0, detail: `prices ${P} and ${Q} in both totals: ${read}` },
    values: { kind: shop.one, a, b, d, P, Q },
  }
}

export const simultaneousGenerators: Generator[] = [
  bySlot('simultaneous-linear', SIM, { q3: sumAndDifference, q5: subtractToEliminate, q6: addToEliminate, q13: shoppingPrices }),
]

/* ------------------------------------------------------------------------------------------
 * Inequalities
 * ---------------------------------------------------------------------------------------- */

type Sym = '<' | '>' | '<=' | '>='
const TEX: Record<Sym, string> = { '<': '<', '>': '>', '<=': '\\leqslant', '>=': '\\geqslant' }
const SHOWN: Record<Sym, string> = { '<': '<', '>': '>', '<=': '⩽', '>=': '⩾' }
const FLIP: Record<Sym, Sym> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=' }
const holds = (l: number, s: Sym, rr: number) => (s === '<' ? l < rr : s === '>' ? l > rr : s === '<=' ? l <= rr : l >= rr)

/** The typed forms of x < k, as the written lists give them. */
function inequalityForms(s: Sym, k: number): string[] {
  if (s === '<' || s === '>') return [`x ${s} ${k}`]
  const uni = s === '<=' ? ['⩽', '≤'] : ['⩾', '≥']
  return [`x ${s} ${k}`, `x ${uni[0]} ${k}`, `x${uni[1]}${k}`]
}

/**
 * The printed inequality and the printed answer agree at every test value: the second
 * method. Whole numbers and halves either side of the boundary, and the boundary itself,
 * so a symbol that should have turned round, or a strict one that should not, is caught.
 */
function sameSolutions(left: string, s: Sym, right: string, answer: Sym, k: number) {
  const tests = [-2, -1, -0.5, 0, 0.5, 1, 2, 7].map((d) => k + d)
  const bad = tests.filter((x) => holds(evalTex(left, { x }), s, evalTex(right, { x })) !== holds(x, answer, k))
  return { agrees: bad.length === 0, detail: `values where the question and x ${answer} ${k} disagree: ${bad.join(', ') || 'none'}` }
}

/** q4: 3x + 4 < 19, dividing by a positive. */
function solvePositive(r: Rng, slot: Question): Draft {
  const s = pick(r, ['<', '>', '<=', '>='] as const)
  const a = int(r, 2, 9)
  const b = nonZero(r, 1, 15)
  const k = int(r, -5, 12)
  const c = a * k + b
  const left = sum([[a, 'x'], [b, '']])
  return {
    question: {
      type: 'short-text',
      prompt: `Solve $${left} ${TEX[s]} ${c}$. Write your answer as an inequality in x.`,
      solution: `$${a}x ${TEX[s]} ${c - b}$, so $x ${TEX[s]} ${k}$. Dividing by a positive leaves the symbol alone.`,
      markScheme: scheme(slot, [], `x ${SHOWN[s]} ${minus(String(k))}`),
      accepted: inequalityForms(s, k),
    },
    check: sameSolutions(left, s, String(c), s, k),
    values: { s, a, b, k },
  }
}

/** q5: 5 − 2x ⩾ 1, dividing by a negative turns the symbol round. q11: x on both sides, collected on the left. */
function solveNegative(r: Rng, slot: Question): Draft {
  const s = pick(r, ['<', '>', '<=', '>='] as const)
  const flipped = FLIP[s]
  const k = int(r, -6, 9)
  if (slot.id === 'q11' && r() < 0.6) {
    const { p, q, b } = draw(r, (r) => ({ p: int(r, 1, 5), q: int(r, 2, 8), b: nonZero(r, 1, 12) }), ({ p, q }) => q > p)
    // px + b ? qx + c, with c chosen so that x = k is the boundary.
    const c = (p - q) * k + b
    const left = sum([[p, 'x'], [b, '']])
    const right = sum([[q, 'x'], [c, '']])
    const net = p - q
    return {
      question: {
        type: 'short-text',
        prompt: `Solve $${left} ${TEX[s]} ${right}$. Write your answer as an inequality in x.`,
        solution: `Subtract $${coef(q, 'x')}$ from both sides and ${b < 0 ? 'add' : 'subtract'} $${Math.abs(b)}$: $${coef(net, 'x')} ${TEX[s]} ${c - b}$, then divide by $${net}$ and **reverse**: $x ${TEX[flipped]} ${k}$.`,
        markScheme: scheme(slot, [], `x ${SHOWN[flipped]} ${minus(String(k))}`),
        accepted: inequalityForms(flipped, k),
      },
      check: sameSolutions(left, s, right, flipped, k),
      values: { s, kind: 'both sides', p, q, b, k },
    }
  }
  const a = int(r, 2, 7)
  const b = int(r, 1, 20)
  const c = b - a * k
  const left = `${b} - ${a}x`
  return {
    question: {
      type: 'short-text',
      prompt: `Solve $${left} ${TEX[s]} ${c}$. Write your answer as an inequality in x.`,
      solution: `$${-a}x ${TEX[s]} ${c - b}$, then divide by $${-a}$ and **reverse**: $x ${TEX[flipped]} ${k}$.`,
      markScheme: scheme(slot, [], `x ${SHOWN[flipped]} ${minus(String(k))}`),
      accepted: inequalityForms(flipped, k),
    },
    check: sameSolutions(left, s, String(c), flipped, k),
    values: { s, kind: 'one side', a, b, k },
  }
}

/** q7: −3 ⩽ 2x + 1 < 7. */
function doubleInequality(r: Rng, slot: Question): Draft {
  const [s1, s2] = r() < 0.7 ? (['<=', '<'] as const) : (['<', '<='] as const)
  const p = int(r, 2, 5)
  const q = nonZero(r, 1, 9)
  const { L, U } = draw(r, (r) => ({ L: int(r, -8, 5), U: int(r, -4, 12) }), ({ L, U }) => U - L >= 2 && U - L <= 10)
  const lo = p * L + q
  const hi = p * U + q
  const middle = sum([[p, 'x'], [q, '']])
  const form = `a ${SHOWN[s1]} x ${SHOWN[s2]} b`
  const answer = `${L} ${TEX[s1]} x ${TEX[s2]} ${U}`
  const typed = (a: string, b: string) => `${L} ${a} x ${b} ${U}`
  const asc: Record<string, string> = { '<': '<', '<=': '<=' }
  const uni: Record<string, string> = { '<': '<', '<=': '⩽' }
  const alt: Record<string, string> = { '<': '<', '<=': '≤' }
  const tests = [L - 1, L - 0.5, L, L + 0.5, U - 0.5, U, U + 0.5, U + 1]
  const bad = tests.filter((x) => (holds(lo, s1, p * x + q) && holds(p * x + q, s2, hi)) !== (holds(L, s1, x) && holds(x, s2, U)))
  return {
    question: {
      type: 'short-text',
      prompt: `Solve $${lo} ${TEX[s1]} ${middle} ${TEX[s2]} ${hi}$. Give your answer in the form ${form}.`,
      solution: `${q > 0 ? 'Subtract' : 'Add'} ${Math.abs(q)} ${q > 0 ? 'from' : 'to'} all three parts, then divide all three by ${p}: $${answer}$.`,
      markScheme: scheme(slot, [], minus(typed(SHOWN[s1], SHOWN[s2]))),
      accepted: [typed(asc[s1]!, asc[s2]!), typed(uni[s1]!, uni[s2]!), typed(alt[s1]!, alt[s2]!)],
    },
    check: { agrees: bad.length === 0, detail: `values where the two disagree: ${bad.join(', ') || 'none'}` },
    values: { s1, s2, p, q, L, U },
  }
}

/** q8: how many integers satisfy −2 ⩽ x < 3. */
function countIntegers(r: Rng, slot: Question): Draft {
  const s1 = pick(r, ['<', '<='] as const)
  const s2 = pick(r, ['<', '<='] as const)
  const { L, U } = draw(r, (r) => ({ L: int(r, -9, 4), U: int(r, -3, 10) }), ({ L, U }) => U - L >= 3 && U - L <= 12)
  const ints: number[] = []
  for (let x = L - 5; x <= U + 5; x++) if (holds(L, s1, x) && holds(x, s2, U)) ints.push(x)
  const count = U - L + 1 - (s1 === '<' ? 1 : 0) - (s2 === '<' ? 1 : 0)
  const why = [s1 === '<=' ? `$${L}$ is in because of $\\leqslant$` : `$${L}$ is out because of $<$`, s2 === '<=' ? `$${U}$ is in because of $\\leqslant$` : `$${U}$ is out because of $<$`].join(', and ')
  return {
    question: {
      type: 'numeric',
      prompt: `How many integer solutions does $${L} ${TEX[s1]} x ${TEX[s2]} ${U}$ have?`,
      solution: `$${ints.join(', ')}$, so there are **${ints.length}** of them. ${why}.`,
      markScheme: scheme(slot, [], String(ints.length)),
      answer: ints.length,
      tolerance: 0,
    },
    check: { agrees: count === ints.length, detail: `counted ${ints.length}; by the ends ${count}` },
    values: { s1, s2, L, U },
  }
}

/** q10: the largest integer below a bound. q15: the smallest integer above one. */
function extremeInteger(r: Rng, slot: Question): Draft {
  const largest = slot.id === 'q10'
  const kind = pick(r, ['strict', 'strict', 'strict', 'inclusive', 'decimal'] as const)
  // The written q15 is about negative bounds, where the smallest integer is the one students miss.
  const whole = largest ? int(r, -15, 30) : r() < 0.8 ? -int(r, 1, 20) : int(r, 0, 12)
  const b = kind === 'decimal' ? whole + pick(r, [0.5, 0.5, 0.25, 0.75]) : whole
  const s: Sym = largest ? (kind === 'inclusive' ? '<=' : '<') : kind === 'inclusive' ? '>=' : '>'
  const exact = largest ? (kind === 'inclusive' ? b : Number.isInteger(b) ? b - 1 : Math.floor(b)) : kind === 'inclusive' ? b : Number.isInteger(b) ? b + 1 : Math.ceil(b)
  // Math.ceil(-0.5) is -0, which prints as 0 but is not 0 to Object.is.
  const answer = exact === 0 ? 0 : exact
  // Second route: walk the integers towards the bound and keep the last one that works.
  let found = largest ? Math.ceil(b) + 5 : Math.floor(b) - 5
  if (largest) while (!holds(found, s, b)) found--
  else while (!holds(found, s, b)) found++
  const word = largest ? 'largest' : 'smallest'
  let why: string
  if (kind === 'decimal') why = `The integers ${largest ? 'below' : 'above'} $${show(b)}$ ${largest ? 'end' : 'start'} at $${answer}$, so the ${word} integer is **$${answer}$**.`
  else if (kind === 'inclusive') why = `$${b}$ itself is included by $${TEX[s]}$, so the ${word} integer is **$${answer}$**.`
  else why = `$${b}$ itself is excluded by the strict symbol, so the ${word} integer is ${largest ? `**$${answer}$**` : `$${answer}$`}.`
  if (!largest && answer <= 0) why += ' Forgetting that negative integers count is the usual error here.'
  return {
    question: {
      type: 'numeric',
      prompt: `What is the ${word} integer that satisfies $x ${TEX[s]} ${show(b)}$?`,
      solution: why,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: found === answer, detail: `walking the integers: ${found}` },
    values: { kind, s, bound: b },
  }
}

export const inequalityGenerators: Generator[] = [
  bySlot('inequality-solve', INEQ, { q4: solvePositive, q5: solveNegative, q11: solveNegative, q7: doubleInequality }),
  bySlot('inequality-integers', INEQ, { q8: countIntegers, q10: extremeInteger, q15: extremeInteger }),
]

/* ------------------------------------------------------------------------------------------
 * Functions
 * ---------------------------------------------------------------------------------------- */

const NAMES = ['f', 'g', 'h', 'p', 'q']

/** q3: g(3) for a quadratic g. */
function evaluateFunction(r: Rng, slot: Question): Draft {
  const name = pick(r, NAMES)
  const { a, b, c } = draw(
    r,
    (r) => ({ a: pick(r, [1, 1, 1, 2, 3]), b: pick(r, [0, 0, 0, nonZero(r, 1, 5)]), c: int(r, -9, 12) }),
    ({ b, c }) => b !== 0 || c !== 0,
  )
  const k = draw(r, (r) => int(r, -5, 7), (k) => k !== 0 && k !== 1)
  const body = sum([[a, 'x^2'], [b, 'x'], [c, '']])
  const answer = a * k * k + b * k + c
  const square = `${a === 1 ? '' : `${a} \\times `}${k < 0 ? `(${k})` : k}^2`
  const parts = sum([[a * k * k, ''], [b * k, ''], [c, '']])
  const linear = b === 0 ? '' : ` ${b < 0 ? '-' : '+'} ${Math.abs(b) === 1 ? sub(k) : `${Math.abs(b)}(${k})`}`
  return {
    question: {
      type: 'short-text',
      prompt: `For $${name}(x) = ${body}$, work out $${name}(${k})$.`,
      solution: `$${name}(${k}) = ${square}${linear}${c === 0 ? '' : ` ${c < 0 ? '-' : '+'} ${Math.abs(c)}`} = ${parts} = ${answer}$.`,
      markScheme: scheme(slot, [], minus(String(answer))),
      accepted: [String(answer)],
    },
    check: { agrees: evalTex(body, { x: k }) === answer, detail: `${body} read at x = ${k}: ${evalTex(body, { x: k })}` },
    values: { name, a, b, c, k },
  }
}

/** q5: f(x) = 3x − 2, solve f(x) = 13. */
function solveForInput(r: Rng, slot: Question): Draft {
  const name = pick(r, NAMES)
  const a = int(r, 2, 9)
  const b = nonZero(r, 1, 12)
  const x = int(r, -5, 15)
  const T = a * x + b
  const body = sum([[a, 'x'], [b, '']])
  return {
    question: {
      type: 'numeric',
      prompt: `For $${name}(x) = ${body}$, solve $${name}(x) = ${T}$.`,
      solution: `This gives the output and asks for the input, so solve $${body} = ${T}$. ${b < 0 ? 'Adding' : 'Subtracting'} $${Math.abs(b)}$ gives $${a}x = ${T - b}$, so $x = ${x}$. Check: $${name}(${x}) = ${a * x} ${b < 0 ? '-' : '+'} ${Math.abs(b)} = ${T}$.`,
      markScheme: scheme(slot, [minus(`${body} = ${T}`)], minus(`x = ${x}`)),
      answer: x,
      tolerance: 0,
    },
    check: { agrees: evalTex(body, { x }) === T, detail: `${name}(${x}) read from ${body}: ${evalTex(body, { x })}` },
    values: { name, a, b, x },
  }
}

/** q9: the inverse of a linear function. */
function inverseFunction(r: Rng, slot: Question): Draft {
  const name = pick(r, NAMES)
  const a = int(r, 2, 9)
  const b = draw(r, (r) => nonZero(r, 1, 15), (b) => b % a !== 0)
  const body = sum([[a, 'x'], [b, '']])
  const top = sum([[1, 'x'], [-b, '']])
  const answer = `\\dfrac{${top}}{${a}}`
  const xs = [-4, 0, 3, 11]
  // Second route: the function undoes its inverse, read from the printed text.
  const ok = xs.every((x) => near(evalTex(body, { x: evalTex(answer, { x }) }), x))
  return {
    question: {
      type: 'short-text',
      prompt: `For $${name}(x) = ${body}$, find $${name}^{-1}(x)$. Give your answer as a fraction in its simplest form.`,
      solution: `Write $y = ${body}$, swap the letters to get $x = ${sum([[a, 'y'], [b, '']])}$, then rearrange: $${top} = ${a}y$, so $y = ${answer}$. Hence $${name}^{-1}(x) = ${answer}$.`,
      markScheme: scheme(slot, [`x = ${minus(sum([[a, 'y'], [b, '']]))}`], `(${minus(top)})/${a}`),
      accepted: [`(${sum([[1, 'x'], [-b, '']], false)})/${a}`],
    },
    check: { agrees: ok, detail: `${name} of its inverse at x = ${xs.join(', ')} gives x back: ${ok}` },
    values: { name, a, b },
  }
}

/** The linear and quadratic functions of q12 and q15, and which letter each has. */
function compositePair(r: Rng) {
  const swap = r() < 0.35
  const [lin, quad] = swap ? ['g', 'f'] : ['f', 'g']
  return { lin, quad, swap }
}

/** q12: gf(x) with f linear and g quadratic, expanded. */
function compositeExpand(r: Rng, slot: Question): Draft {
  const { lin, quad } = compositePair(r)
  const { a, b, c } = draw(r, (r) => ({ a: nonZero(r, 1, 5), b: nonZero(r, 1, 6), c: nonZero(r, 1, 9) }), ({ a, b, c }) => Math.abs(a) !== 1 && b * b + c !== 0)
  const fBody = sum([[a, 'x'], [b, '']])
  const gBody = sum([[1, 'x^2'], [c, '']])
  const square = sum([[a * a, 'x^2'], [2 * a * b, 'x'], [b * b, '']])
  const result = sum([[a * a, 'x^2'], [2 * a * b, 'x'], [b * b + c, '']])
  const ask = `${quad}${lin}(x)`
  const xs = [-2, 0.5, 3]
  // Second route: put a number through the linear function, then the quadratic, and compare.
  const ok = xs.every((x) => near(evalTex(gBody, { x: evalTex(fBody, { x }) }), evalTex(result, { x })))
  return {
    question: {
      type: 'short-text',
      prompt: `For $${lin}(x) = ${fBody}$ and $${quad}(x) = ${gBody}$, find $${ask}$, giving your answer in its simplest form.`,
      solution: `$${ask} = ${quad}(${lin}(x)) = ${quad}(${fBody}) = (${fBody})^2 ${c < 0 ? '-' : '+'} ${Math.abs(c)}$. Expanding the square gives $${square}$, and ${c < 0 ? 'taking away' : 'adding'} the $${Math.abs(c)}$ gives $${result}$. The middle term $${coef(2 * a * b, 'x')}$ is the one that disappears if the bracket is dropped.`,
      markScheme: scheme(slot, [minus(`${quad}(${fBody}) = (${fBody})² ${c < 0 ? '-' : '+'} ${Math.abs(c)}`), minus(`(${fBody})² = ${square.replace('x^2', 'x²')}`)], minus(result.replace('x^2', 'x²'))),
      accepted: [sum([[a * a, 'x^2'], [2 * a * b, 'x'], [b * b + c, '']], false)],
    },
    check: { agrees: ok, detail: `${quad}(${lin}(x)) at x = ${xs.join(', ')} against ${result}` },
    values: { a, b, c, lin },
  }
}

/** q15: solve fg(x) = k for the positive x. */
function compositeSolve(r: Rng, slot: Question): Draft {
  const { lin, quad } = compositePair(r)
  const { a, b, c, X } = draw(
    r,
    (r) => ({ a: int(r, 2, 6), b: nonZero(r, 1, 9), c: nonZero(r, 1, 9), X: int(r, 2, 9) }),
    ({ a, b, c }) => a * c + b !== 0,
  )
  const fBody = sum([[a, 'x'], [b, '']])
  const gBody = sum([[1, 'x^2'], [c, '']])
  const constant = a * c + b
  const composed = sum([[a, 'x^2'], [constant, '']])
  const T = a * X * X + constant
  const ask = `${lin}${quad}(x)`
  const inner = X * X + c
  return {
    question: {
      type: 'numeric',
      prompt: `For $${lin}(x) = ${fBody}$ and $${quad}(x) = ${gBody}$, $${ask} = ${composed}$. Solve $${ask} = ${T}$, giving the positive value of $x$.`,
      solution: `Set $${composed} = ${T}$, so $${a}x^2 = ${T - constant}$ and $x^2 = ${X * X}$. That gives $x = ${X}$ or $x = -${X}$, and the question asks for the positive one, so $x = ${X}$. Check: $${quad}(${X}) = ${inner}$ and $${lin}(${inner}) = ${T}$.`,
      markScheme: scheme(slot, [minus(`${composed.replace('x^2', 'x²')} = ${T}`), `x² = ${X * X}`], `x = ${X}`),
      answer: X,
      tolerance: 0,
    },
    check: { agrees: evalTex(fBody, { x: evalTex(gBody, { x: X }) }) === T && evalTex(gBody, { x: X }) === inner, detail: `${quad}(${X}) = ${inner}, ${lin}(${inner}) = ${evalTex(fBody, { x: inner })}` },
    values: { a, b, c, X, lin },
  }
}

export const functionGenerators: Generator[] = [
  bySlot('function-notation', FUN, { q3: evaluateFunction, q5: solveForInput, q9: inverseFunction, q12: compositeExpand, q15: compositeSolve }),
]

/* ------------------------------------------------------------------------------------------
 * Iteration
 * ---------------------------------------------------------------------------------------- */

/** x_{n+1} = (x_n² + a)/b near its smaller root, where it converges: g'(x) = 2x/b < 1. */
const QUADRATIC_MAPS: { a: number; b: number; root: number }[] = []
for (const b of [4, 5, 8, 10])
  for (let a = 1; 4 * a < b * b; a++) {
    const root = (b - Math.sqrt(b * b - 4 * a)) / 2
    if (2 * root / b < 0.8) QUADRATIC_MAPS.push({ a, b, root })
  }

const quadraticStep = (x: number, a: number, b: number) => (x * x + a) / b
const QUAD_TEX = (a: number, b: number) => `x_{n+1} = \\dfrac{x_n^2 + ${a}}{${b}}`

/** Iterates of (x² + a)/b from x0, and x0 itself, drawn so the asked iterate is safe to round. */
function quadraticIteration(r: Rng, upTo: number) {
  return draw(
    r,
    (r) => {
      const m = pick(r, QUADRATIC_MAPS)
      const x0 = Math.max(1, Math.round(m.root * 10) + int(r, -3, 3)) / 10
      const xs = [x0]
      for (let i = 0; i < upTo; i++) xs.push(quadraticStep(xs.at(-1)!, m.a, m.b))
      return { ...m, x0, xs }
    },
    ({ x0, b, xs }) => x0 < b / 2 && xs.slice(2).every((x) => clearOfHalf(x, 4, 0.05)) && Math.abs(xs[1]! - x0) > 0.001,
  )
}

/** q2: x₁ exactly. q16: x₂ to 4 d.p. q11: x₃ to 4 d.p. */
function quadraticIterate(r: Rng, slot: Question): Draft {
  const steps = slot.id === 'q2' ? 1 : slot.id === 'q16' ? 2 : 3
  const { a, b, x0, xs } = quadraticIteration(r, steps)
  const rule = QUAD_TEX(a, b)
  const x1 = Number(show(xs[1]!))
  // Second route: x₁ in whole numbers, (10x₀)² + 100a over 100b, then the printed rule read for the rest.
  const X = Math.round(x0 * 10)
  const exact1 = (X * X + 100 * a) / (100 * b)
  let read = x0
  for (let i = 0; i < steps; i++) read = evalTex(`\\dfrac{x^2 + ${a}}{${b}}`, { x: read })
  const prompt = `An iteration is $${rule}$ with $x_0 = ${show(x0)}$. Work out $x_${steps}$${steps === 1 ? '' : ' to 4 decimal places'}.`
  if (steps === 1) {
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `$\\dfrac{${show(x0 * x0)} + ${a}}{${b}} = \\dfrac{${show(x0 * x0 + a)}}{${b}} = ${show(x1)}$.`,
        markScheme: scheme(slot, [`substitutes ${show(x0)}`], show(x1)),
        answer: x1,
        tolerance: 0,
      },
      check: { agrees: near(exact1, x1) && near(read, x1), detail: `in whole numbers ${X * X + 100 * a}/${100 * b} = ${exact1}` },
      values: { a, b, x0, steps },
    }
  }
  const answer = roundTo(xs[steps]!, 4)
  const solution = steps === 2
    ? `$x_1 = ${show(x1)}$, then $x_2 = \\dfrac{${show(x1)}^2 + ${a}}{${b}} = ${fixed(xs[2]!, 4)}$.`
    : `$x_1 = ${show(x1)}$, $x_2 = ${fixed(xs[2]!, 4)}$, $x_3 = ${fixed(xs[3]!, 4)}$, keeping the full value on the calculator each time.`
  const method = steps === 2 ? ['uses the unrounded x₁'] : [`finds x₁ = ${show(x1)}`, `finds x₂ = ${fixed(xs[2]!, 4)}`]
  return {
    question: {
      type: 'numeric',
      prompt,
      solution,
      markScheme: scheme(slot, method, fixed(xs[steps]!, 4)),
      answer,
      tolerance: 0.00005,
    },
    check: { agrees: roundTo(read, 4) === answer && near(exact1, x1), detail: `the printed rule run ${steps} times: ${read}` },
    values: { a, b, x0, steps },
  }
}

/** x³ = ax + b with one positive root, and the iteration x = ∛(ax + b) that finds it. */
function cubic(r: Rng) {
  return draw(
    r,
    (r) => {
      const a = int(r, 1, 12)
      const b = int(r, 1, 20)
      const root = bisect((x) => x ** 3 - a * x - b, 0, 10)
      return { a, b, root }
    },
    ({ root }) => clearOfHalf(root, 3, 0.1) && Math.abs(root - Math.round(root)) > 0.05,
  )
}
const CUBE_TEX = (a: number, b: number) => `x_{n+1} = \\sqrt[3]{${coef(a, 'x_n')} + ${b}}`

/** q5: one step of x = ∛(2x + 5) to 4 d.p. */
function cubeRootStep(r: Rng, slot: Question): Draft {
  const { a, b, x0, x1 } = draw(
    r,
    (r) => {
      const { a, b, root } = cubic(r)
      const x0 = Math.max(1, Math.round(root) + int(r, -1, 1))
      return { a, b, x0, x1: Math.cbrt(a * x0 + b) }
    },
    ({ x1 }) => clearOfHalf(x1, 4, 0.05) && !Number.isInteger(x1),
  )
  const inside = a * x0 + b
  const answer = roundTo(x1, 4)
  // Second route: cube the rounded value either side of the answer; the inside lies between.
  const brackets = (answer - 0.00005) ** 3 < inside && inside < (answer + 0.00005) ** 3
  return {
    question: {
      type: 'numeric',
      prompt: `An iteration is $${CUBE_TEX(a, b)}$ with $x_0 = ${x0}$. Work out $x_1$ to 4 decimal places.`,
      solution: `$\\sqrt[3]{${a === 1 ? '' : `${a} \\times `}${x0} + ${b}} = \\sqrt[3]{${inside}} = ${fixed(x1, 4)}$ to 4 decimal places.`,
      markScheme: scheme(slot, [`cube root of ${inside}`], fixed(x1, 4)),
      answer,
      tolerance: 0.00005,
    },
    check: { agrees: brackets, detail: `${fixed(answer - 0.00005, 5)}³ < ${inside} < ${fixed(answer + 0.00005, 5)}³: ${brackets}` },
    values: { a, b, x0 },
  }
}

/** q12: run x = ∛(ax + b) until two iterates agree to 3 d.p. */
function cubeRootSolve(r: Rng, slot: Question): Draft {
  // Two iterates can agree to 3 d.p. while the root rounds the other way (x³ = 8x + 15 settles
  // at 3.505 from above; its root is 3.5043), so only draws where the stopping rule is right.
  const { a, b, root, x0, xs } = draw(
    r,
    (r) => {
      const { a, b, root } = cubic(r)
      const x0 = Math.max(1, Math.round(root) + pick(r, [0, 0, -1, 1]))
      const xs = [x0]
      while (xs.length < 3 || fixed(xs.at(-1)!, 3) !== fixed(xs.at(-2)!, 3)) {
        xs.push(Math.cbrt(a * xs.at(-1)! + b))
        if (xs.length > 40) break
      }
      return { a, b, root, x0, xs }
    },
    ({ root, xs }) => xs.length <= 12 && fixed(xs.at(-1)!, 3) === fixed(root, 3),
  )
  const agreed = fixed(xs.at(-1)!, 3)
  const answer = Number(agreed)
  const n = xs.length - 1
  // Second route: the sign of x³ − ax − b changes across the 3 d.p. interval round the answer.
  const f = (x: number) => x ** 3 - a * x - b
  const change = f(answer - 0.0005) < 0 && f(answer + 0.0005) > 0
  return {
    question: {
      type: 'numeric',
      prompt: `An iteration is $${CUBE_TEX(a, b)}$ with $x_0 = ${x0}$. Give the solution to 3 decimal places.`,
      solution: `The iterates run ${xs.map((x, i) => (i === 0 ? String(x) : fixed(x, 4))).join(', ')}. The first pair to agree to 3 decimal places is x${n - 1} and x${n}, giving **${agreed}**.`,
      markScheme: scheme(slot, ['runs the iteration at least three times', 'consecutive iterates agree to 3 d.p.'], agreed),
      answer,
      tolerance: 0.0005,
    },
    check: { agrees: change && roundTo(root, 3) === answer && xs.length <= 40, detail: `x³ − ${a}x − ${b} changes sign across ${agreed} ± 0.0005: ${change}; root ${root}` },
    values: { a, b, x0 },
  }
}

/** A cubic x³ + px + q with a root between two tenths, and the tenth either side to evaluate at. */
function cubicNearRoot(r: Rng) {
  return draw(
    r,
    (r) => {
      const p = nonZero(r, 1, 6)
      const q = nonZero(r, 1, 12)
      const f = (x: number) => x ** 3 + p * x + q
      // The real root: f rises everywhere for p > 0, and for p < 0 search where f is past its turning points.
      const root = bisect(f, -10, 10)
      const X = Math.round(root * 10) + int(r, -1, 1)
      return { p, q, X, value: (X * X * X + 100 * p * X + 1000 * q) / 1000 }
    },
    ({ p, q, X, value }) => {
      const f = (x: number) => x ** 3 + p * x + q
      return f(-10) < 0 && f(10) > 0 && value !== 0 && X !== 0 && X % 10 !== 0 && Math.abs(value) < 5 && (p > 0 || 4 * p ** 3 + 27 * q * q > 0)
    },
  )
}

const cubicTex = (p: number, q: number) => sum([[1, 'x^3'], [p, 'x'], [q, '']])
const tolFor = (answer: number, half: number) => (Math.abs(answer) * 0.02 >= half ? half : 0)

/** q4: f(2) for f(x) = x³ − 2x − 5. */
function cubicAtInteger(r: Rng, slot: Question): Draft {
  const p = nonZero(r, 1, 6)
  const q = nonZero(r, 1, 9)
  const x = draw(r, (r) => int(r, -3, 4), (x) => x !== 0 && x !== 1 && x ** 3 + p * x + q !== 0)
  const f = cubicTex(p, q)
  const answer = x ** 3 + p * x + q
  return {
    question: {
      type: 'numeric',
      prompt: `For $f(x) = ${f}$, work out $f(${x})$.`,
      solution: `$${sum([[x ** 3, ''], [p * x, ''], [q, '']])} = ${answer}$.`,
      markScheme: scheme(slot, [], minus(String(answer))),
      answer,
      tolerance: 0,
    },
    check: { agrees: evalTex(f, { x }) === answer, detail: `${f} read at x = ${x}: ${evalTex(f, { x })}` },
    values: { p, q, x },
  }
}

/** q8: f(2.1) to 3 d.p. for a cubic, near its root. */
function cubicAtDecimal(r: Rng, slot: Question): Draft {
  const { p, q, X, value } = cubicNearRoot(r)
  const x = X / 10
  const f = cubicTex(p, q)
  const cube = (X * X * X) / 1000
  const px = (p * X) / 10
  return {
    question: {
      type: 'numeric',
      prompt: `For $f(x) = ${f}$, work out $f(${show(x)})$ to 3 decimal places.`,
      solution: `$${x < 0 ? `(${show(x)})` : show(x)}^3 ${p < 0 ? '-' : '+'} ${Math.abs(p) === 1 ? '' : Math.abs(p)}(${show(x)}) ${q < 0 ? '-' : '+'} ${Math.abs(q)} = ${sum([[cube, ''], [px, ''], [q, '']])} = ${show(value)}$.`,
      markScheme: scheme(slot, [`substitutes ${minus(show(x))}`], minus(fixed(value, 3))),
      answer: value,
      tolerance: tolFor(value, 0.0005),
    },
    check: { agrees: near(evalTex(f, { x }), value, 1e-9), detail: `${f} read at x = ${show(x)}: ${evalTex(f, { x })}` },
    values: { p, q, x },
  }
}

/** q14: f(0.7) to 2 d.p. for a quadratic, near its root. */
function quadraticAtDecimal(r: Rng, slot: Question): Draft {
  const { b, c, X, value } = draw(
    r,
    (r) => {
      const b = nonZero(r, 2, 9)
      const c = nonZero(r, 1, 9)
      const disc = b * b - 4 * c
      const root = disc > 0 ? (-b + pick(r, [-1, 1]) * Math.sqrt(disc)) / 2 : NaN
      const X = Math.round(root * 10) + int(r, -1, 1)
      return { b, c, X, value: (X * X + 10 * b * X + 100 * c) / 100 }
    },
    ({ b, c, X, value }) => b * b - 4 * c > 0 && Number.isFinite(X) && X % 10 !== 0 && value !== 0 && Math.abs(value) < 3,
  )
  const x = X / 10
  const f = sum([[1, 'x^2'], [b, 'x'], [c, '']])
  return {
    question: {
      type: 'numeric',
      prompt: `$f(x) = ${f}$. Work out $f(${show(x)})$ to 2 decimal places.`,
      solution: `$${sum([[(X * X) / 100, ''], [(b * X) / 10, ''], [c, '']])} = ${show(value)}$.`,
      markScheme: scheme(slot, [`substitutes ${minus(show(x))}`], minus(fixed(value, 2))),
      answer: value,
      tolerance: tolFor(value, 0.005),
    },
    check: { agrees: near(evalTex(f, { x }), value, 1e-9), detail: `${f} read at x = ${show(x)}: ${evalTex(f, { x })}` },
    values: { b, c, x },
  }
}

/** q6: x³ = 5x + 1 into x = ∛(…). q15: x³ − 4x − 9 = 0, moved across first. */
function cubeRootRearrangement(r: Rng, slot: Question): Draft {
  const a = int(r, 1, 12)
  const b = int(r, 1, 20)
  const kind = pick(r, ['ax + b', 'ax - b', 'b - ax', 'b + ax'] as const)
  const terms: [number, string][] = kind === 'ax + b' ? [[a, 'x'], [b, '']] : kind === 'ax - b' ? [[a, 'x'], [-b, '']] : kind === 'b - ax' ? [[b, ''], [-a, 'x']] : [[b, ''], [a, 'x']]
  const inside = sum(terms)
  const typed = sum(terms, false)
  const reversed = sum([...terms].reverse(), false)
  // x³ − inside = 0 as the zero form of q15, with the x term first.
  const zero = sum([[1, 'x^3'], [-terms.find(([, v]) => v === 'x')![0], 'x'], [-terms.find(([, v]) => v === '')![0], '']])
  const fromZero = slot.id === 'q15'
  const original = fromZero ? `${zero} = 0` : `x^3 = ${inside}`
  // Second route: x³ = inside and the printed original say the same thing at every x.
  const xs = [-2, 0.5, 1, 3]
  const same = xs.every((x) => near(evalEquation(original, { x }), x ** 3 - evalTex(inside, { x })))
  return {
    question: {
      type: 'short-text',
      prompt: fromZero
        ? `$${original}$. Rearrange it into the form $x = \\sqrt[3]{\\ldots}$ and write what goes inside the cube root.`
        : `Rearrange $${original}$ into the form $x = \\sqrt[3]{\\ldots}$. Write what goes inside the cube root.`,
      solution: fromZero
        ? `Move the terms across to get $x^3 = ${inside}$, then cube root both sides: $x = \\sqrt[3]{${inside}}$.`
        : `Taking the cube root of both sides gives $x = \\sqrt[3]{${inside}}$, so **$${inside}$** goes inside.`,
      markScheme: scheme(slot, [fromZero ? `reaches x³ = ${minus(inside)}` : 'cube roots both sides'], minus(inside)),
      accepted: [...new Set([typed, reversed])],
    },
    check: { agrees: same, detail: `x³ − (${inside}) against ${original} at x = ${xs.join(', ')}` },
    values: { a, b, kind },
  }
}

export const iterationGenerators: Generator[] = [
  bySlot('iteration-quadratic', ITER, { q2: quadraticIterate, q16: quadraticIterate, q11: quadraticIterate }),
  bySlot('iteration-cube-root', ITER, { q5: cubeRootStep, q12: cubeRootSolve, q6: cubeRootRearrangement, q15: cubeRootRearrangement }),
  bySlot('iteration-evaluate', ITER, { q4: cubicAtInteger, q8: cubicAtDecimal, q14: quadraticAtDecimal }),
]

/** Generators for simultaneous equations, inequalities, functions, iteration. */
export const equationsGenerators: Generator[] = [...simultaneousGenerators, ...inequalityGenerators, ...functionGenerators, ...iterationGenerators]

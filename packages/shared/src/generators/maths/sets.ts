import type { Question } from '../../content/questions.ts'
import { draw, int, pick, shuffle, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'
import { bySlot, gcd, reduce, terminates } from './formulae.ts'
import { NAMES, andList, eitherForm, range, tolFor, worked } from './probability.ts'

/* ------------------------------------------------------------------------------------------
 * Shared helpers. The second method for every Venn answer builds the people (or numbers)
 * themselves as arrays, puts each in the sets it belongs to, and counts members: the
 * regions the solution adds and subtracts are never used to check themselves.
 * ---------------------------------------------------------------------------------------- */

type Builder = (r: Rng, slot: Question, turn: number) => Draft

/** Two-set regions: only A, both, only B, neither. */
export interface Two {
  a: number
  c: number
  b: number
  d: number
}

/** The members of each set, built from the region counts: people numbered 1 to N. */
export function twoSets({ a, c, b, d }: Two) {
  const N = a + c + b + d
  const people = range(1, N)
  const A = people.filter((p) => p <= a + c)
  const B = people.filter((p) => p > a && p <= a + c + b)
  return { people, A, B, N }
}

/** Three-set regions, keyed by the sets a member is in: '1', '12', '123', '' for none. */
export type Three = Record<'1' | '2' | '3' | '12' | '13' | '23' | '123' | '', number>
export const THREE_KEYS = ['1', '2', '3', '12', '13', '23', '123', ''] as const

export function threeSets(regions: Three) {
  const people: string[] = []
  for (const k of THREE_KEYS) for (let i = 0; i < regions[k]; i++) people.push(k)
  const inSet = (s: '1' | '2' | '3') => people.map((k, i) => (k.includes(s) ? i : -1)).filter((i) => i >= 0)
  return { people, S1: inSet('1'), S2: inSet('2'), S3: inSet('3') }
}

const both = <T>(X: readonly T[], Y: readonly T[]) => X.filter((x) => Y.includes(x))
const either = <T>(X: readonly T[], Y: readonly T[]) => [...new Set([...X, ...Y])]
const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)

interface Context {
  intro: (N: number) => string
  people: string
  one: string
  /** Plural verb phrases: "play football". */
  A: string
  B: string
  /** Singular: "plays football". */
  A1: string
  B1: string
  both: string
  both1: string
  neither: string
  neither1: string
  /** Region names for a solution: "Football only". */
  An: string
  Bn: string
  atLeastOne1: string
  exactlyOne1: string
}

export const CONTEXTS: Context[] = [
  { intro: (N) => `In a class of ${N}`, people: 'students', one: 'student', A: 'play football', B: 'play tennis', A1: 'plays football', B1: 'plays tennis', both: 'play both', both1: 'plays both', neither: 'play neither', neither1: 'plays neither', An: 'football', Bn: 'tennis', atLeastOne1: 'plays at least one of the two sports', exactlyOne1: 'plays exactly one of the two sports' },
  { intro: (N) => `Of ${N} people asked`, people: 'people', one: 'person', A: 'have a cat', B: 'have a dog', A1: 'has a cat', B1: 'has a dog', both: 'have both', both1: 'has both', neither: 'have neither', neither1: 'has neither', An: 'cat', Bn: 'dog', atLeastOne1: 'has at least one of the two pets', exactlyOne1: 'has exactly one of the two pets' },
  { intro: (N) => `In a year group of ${N}`, people: 'students', one: 'student', A: 'study French', B: 'study Spanish', A1: 'studies French', B1: 'studies Spanish', both: 'study both', both1: 'studies both', neither: 'study neither', neither1: 'studies neither', An: 'French', Bn: 'Spanish', atLeastOne1: 'studies at least one of the two languages', exactlyOne1: 'studies exactly one of the two languages' },
  { intro: (N) => `Of ${N} people asked about two apps`, people: 'people', one: 'person', A: 'use app X', B: 'use app Y', A1: 'uses app X', B1: 'uses app Y', both: 'use both', both1: 'uses both', neither: 'use neither', neither1: 'uses neither', An: 'app X', Bn: 'app Y', atLeastOne1: 'uses at least one of the two apps', exactlyOne1: 'uses exactly one of the two apps' },
  { intro: (N) => `In a club of ${N} members`, people: 'members', one: 'member', A: 'go swimming', B: 'go cycling', A1: 'goes swimming', B1: 'goes cycling', both: 'do both', both1: 'does both', neither: 'do neither', neither1: 'does neither', An: 'swimming', Bn: 'cycling', atLeastOne1: 'does at least one of the two activities', exactlyOne1: 'does exactly one of the two activities' },
  { intro: (N) => `Of ${N} people at a café`, people: 'people', one: 'person', A: 'like tea', B: 'like coffee', A1: 'likes tea', B1: 'likes coffee', both: 'like both', both1: 'likes both', neither: 'like neither', neither1: 'likes neither', An: 'tea', Bn: 'coffee', atLeastOne1: 'likes at least one of the two drinks', exactlyOne1: 'likes exactly one of the two drinks' },
]

/** A two-set Venn with every region at least `min` (2, so no "1 study both"), from N people. */
function drawTwo(r: Rng, lo: number, hi: number, ok: (t: Two & { N: number }) => boolean = () => true, min = 2): Two & { N: number } {
  return draw(r, (r) => {
    const N = int(r, lo, hi)
    const a = int(r, min, Math.floor(N / 2))
    const c = int(r, min, Math.floor(N / 3))
    const b = int(r, min, Math.floor(N / 2))
    return { a, c, b, d: N - a - b - c, N }
  }, (t) => t.d >= min && t.a !== t.b && ok(t))
}

/* ------------------------------------------------------------------------------------------
 * Venn diagrams
 * ---------------------------------------------------------------------------------------- */

const VENN = 'venn-diagrams'

/** q1: one circle's total, less the overlap. */
const onlyOne: Builder = (r, slot, turn) => {
  const ctx = pick(r, CONTEXTS)
  const t = drawTwo(r, 20, 40)
  const nA = t.a + t.c
  const nB = t.b + t.c
  const askB = turn % 2 === 0
  const answer = askB ? t.b : t.a
  const { A, B } = twoSets(t)
  const counted = askB ? B.filter((p) => !A.includes(p)).length : A.filter((p) => !B.includes(p)).length
  const [whole, other, otherVerb] = askB ? [nB, ctx.Bn, ctx.A] : [nA, ctx.An, ctx.B]
  return {
    question: {
      type: 'numeric',
      prompt: `${ctx.intro(t.N)}, ${nA} ${ctx.A}, ${nB} ${ctx.B} and ${t.c} ${ctx.both}. How many ${askB ? ctx.B : ctx.A} only?`,
      solution: `The ${other} circle totals ${whole} and ${t.c} of those also ${otherVerb}, so ${other} only is $${whole} - ${t.c} = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `counted ${counted} members` },
    values: { N: t.N, nA, nB, both: t.c, ask: askB ? 'B only' : 'A only' },
  }
}

/** q2 and q10: neither, from the two circle totals and the overlap. */
const neitherFromTotals: Builder = (r, slot) => {
  const ctx = pick(r, CONTEXTS)
  const t = drawTwo(r, 20, 50)
  const nA = t.a + t.c
  const nB = t.b + t.c
  const inside = t.a + t.c + t.b
  const answer = t.d
  const { people, A, B } = twoSets(t)
  const counted = people.filter((p) => !A.includes(p) && !B.includes(p)).length
  return {
    question: {
      type: 'numeric',
      prompt: `${ctx.intro(t.N)}, ${nA} ${ctx.A}, ${nB} ${ctx.B} and ${t.c} ${ctx.both}. How many ${ctx.neither}?`,
      solution: `${cap(ctx.An)} only is $${nA} - ${t.c} = ${t.a}$ and ${ctx.Bn} only is $${nB} - ${t.c} = ${t.b}$. Inside the circles that is $${t.a} + ${t.c} + ${t.b} = ${inside}$, so neither is $${t.N} - ${inside} = ${answer}$.`,
      markScheme: scheme(slot, [`${inside} inside the circles`], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `counted ${counted} members outside both` },
    values: { N: t.N, nA, nB, both: t.c },
  }
}

const regionsText = (ctx: Context, t: Two) => `${t.a} ${ctx.A} only, ${t.c} ${ctx.both}, ${t.b} ${ctx.B} only and ${t.d} ${ctx.neither}`

/** q5: the probability of one region, in its simplest form. */
const regionProbability: Builder = (r, slot, turn) => {
  const ctx = pick(r, CONTEXTS)
  const regions = ['both', 'A only', 'B only', 'neither'] as const
  const which = regions[turn % 4]!
  const t = drawTwo(r, 20, 40, (t) => {
    const k = which === 'both' ? t.c : which === 'A only' ? t.a : which === 'B only' ? t.b : t.d
    return k > 0 && k < t.N
  })
  const k = which === 'both' ? t.c : which === 'A only' ? t.a : which === 'B only' ? t.b : t.d
  const phrase = which === 'both' ? ctx.both1 : which === 'A only' ? `${ctx.A1} only` : which === 'B only' ? `${ctx.B1} only` : ctx.neither1
  const where = which === 'both' ? 'in the overlap' : which === 'neither' ? 'outside both circles' : `in the ${which === 'A only' ? ctx.An : ctx.Bn}-only region`
  const [p, q] = reduce(k, t.N)
  const { people, A, B } = twoSets(t)
  const counted = people.filter((x) => {
    const a = A.includes(x)
    const b = B.includes(x)
    return which === 'both' ? a && b : which === 'A only' ? a && !b : which === 'B only' ? b && !a : !a && !b
  }).length
  return {
    question: {
      type: 'short-text',
      prompt: `From a group of ${t.N} ${ctx.people}, ${regionsText(ctx, t)}. What is the probability a ${ctx.one} chosen at random ${phrase}? Give your answer as a fraction in its simplest form.`,
      solution: `$${k}$ of the $${t.N}$ ${ctx.people} are ${where}, so $P = ${worked(k, t.N, false)}$.`,
      markScheme: scheme(slot, [`${k} out of ${t.N}`], `${p}/${q}`),
      accepted: [`${p}/${q}`],
    },
    check: { agrees: counted === k && gcd(p, q) === 1 && q > 1, detail: `counted ${counted} of ${people.length}` },
    values: { ...t, which, k },
  }
}

/** q6: at least one, or exactly one, as a fraction or a decimal. */
const atLeastOneRegion: Builder = (r, slot, turn) => {
  const ctx = pick(r, CONTEXTS)
  const exactly = turn % 2 === 1
  const t = drawTwo(r, 20, 50, (t) => terminates(exactly ? t.a + t.b : t.N - t.d, t.N) && t.N % 5 === 0)
  const k = exactly ? t.a + t.b : t.a + t.b + t.c
  const { people, A, B } = twoSets(t)
  const counted = people.filter((x) => (exactly ? A.includes(x) !== B.includes(x) : A.includes(x) || B.includes(x))).length
  const answer = k / t.N
  const solution = exactly
    ? `Exactly one means one circle but not the overlap: $${t.a} + ${t.b} = ${k}$ ${ctx.people}, so $P = ${worked(k, t.N)}$.`
    : `$${k}$ ${ctx.people} are inside a circle, so $P = ${worked(k, t.N)}$. Or use $1 - \\dfrac{${t.d}}{${t.N}}$.`
  return {
    question: {
      type: 'numeric',
      prompt: `Of ${t.N} ${ctx.people}, ${regionsText(ctx, t)}. What is the probability that a ${ctx.one} chosen at random ${exactly ? ctx.exactlyOne1 : ctx.atLeastOne1}? Give your answer as a fraction or a decimal.`,
      solution,
      markScheme: scheme(slot, [exactly ? `${t.a} + ${t.b} = ${k} in exactly one circle` : `${k} inside the circles, or uses the complement`], eitherForm(k, t.N)),
      answer,
      tolerance: tolFor(answer),
    },
    check: { agrees: counted === k && Math.abs(counted / people.length - answer) < 1e-12, detail: `counted ${counted} of ${people.length}` },
    values: { ...t, exactly: String(exactly), k },
  }
}

/** q11: given one set, the probability of the other: the circle is the whole sample. */
const conditional: Builder = (r, slot, turn) => {
  const ctx = pick(r, CONTEXTS)
  const givenB = turn % 2 === 1
  const t = drawTwo(r, 20, 50)
  const circle = givenB ? t.b + t.c : t.a + t.c
  const [p, q] = reduce(t.c, circle)
  const { A, B } = twoSets(t)
  const given = givenB ? B : A
  const other = givenB ? A : B
  const counted = both(given, other).length
  const [gv, gn] = givenB ? [ctx.B, ctx.Bn] : [ctx.A, ctx.An]
  const alsoVerb = givenB ? ctx.A : ctx.B
  return {
    question: {
      type: 'short-text',
      prompt: `Of ${t.N} ${ctx.people}, ${regionsText(ctx, t)}. A ${ctx.one} is chosen at random from those who ${gv}. What is the probability they also ${alsoVerb}? Give your answer as a fraction in its simplest form.`,
      solution: `'Given they ${gv}' makes the ${gn} circle the whole sample, and it holds $${givenB ? t.b : t.a} + ${t.c} = ${circle}$ ${ctx.people}. $${t.c}$ of them also ${alsoVerb}, so $P = ${worked(t.c, circle, false)}$.`,
      markScheme: scheme(slot, [`denominator is ${circle}, not ${t.N}`, `numerator is the overlap, ${t.c}`], `${p}/${q}`),
      accepted: [`${p}/${q}`],
    },
    check: { agrees: counted === t.c && given.length === circle && gcd(p, q) === 1 && q > 1, detail: `${counted} of the ${given.length} in the given circle` },
    values: { ...t, given: givenB ? 'B' : 'A' },
  }
}

const TRIPLES = [['A', 'B', 'C'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['E', 'F', 'G']] as const

/** q7: a pair's overlap less the middle. */
const pairNotThird: Builder = (r, slot) => {
  const letters = pick(r, TRIPLES)
  const pairs = [[0, 1, 2], [0, 2, 1], [1, 2, 0]] as const
  const [i, j, k] = pick(r, pairs)
  const { pair, middle } = draw(r, (r) => ({ pair: int(r, 5, 30), middle: int(r, 1, 15) }), ({ pair, middle }) => middle < pair)
  const answer = pair - middle
  const who = pick(r, ['people', 'students', 'members of a club'])
  // Second route: build the regions as members and count those in the pair but not the third.
  const key = (`${i + 1}${j + 1}`) as '12' | '13' | '23'
  const regions: Three = { '1': 3, '2': 4, '3': 5, '12': 0, '13': 0, '23': 0, '123': middle, '': 2 }
  regions[key] = answer
  const sets = threeSets(regions)
  const S = [sets.S1, sets.S2, sets.S3]
  const counted = both(S[i]!, S[j]!).filter((x) => !S[k]!.includes(x)).length
  const inBoth = both(S[i]!, S[j]!).length
  const [X, Y, Z] = [letters[i], letters[j], letters[k]]
  return {
    question: {
      type: 'numeric',
      prompt: `In a three-set Venn diagram of ${who}, ${pair} are in both ${X} and ${Y}, and ${middle} are in all three sets ${letters.join(', ').replace(/, (\w)$/, ' and $1')}. How many are in ${X} and ${Y} but not ${Z}?`,
      solution: `The ${pair} in both ${X} and ${Y} includes the ${middle} in all three, so $${pair} - ${middle} = ${answer}$ are in ${X} and ${Y} but not ${Z}.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer && inBoth === pair, detail: `counted ${counted}; ${inBoth} in both` },
    values: { pair, middle, X, Y },
  }
}

interface ThreeContext {
  v: string
  sets: [string, string, string]
  people: string
  exactlyOne: string
  exactlyTwo: string
}
const THREE_CONTEXTS: ThreeContext[] = [
  { v: 'play', sets: ['football', 'tennis', 'cricket'], people: 'people', exactlyOne: 'exactly one sport', exactlyTwo: 'exactly two sports' },
  { v: 'study', sets: ['French', 'Spanish', 'German'], people: 'students', exactlyOne: 'exactly one language', exactlyTwo: 'exactly two languages' },
  { v: 'like', sets: ['tea', 'coffee', 'hot chocolate'], people: 'people', exactlyOne: 'exactly one of the three drinks', exactlyTwo: 'exactly two of the three drinks' },
  { v: 'enjoy', sets: ['swimming', 'cycling', 'running'], people: 'members of a sports club', exactlyOne: 'exactly one of the three activities', exactlyTwo: 'exactly two of the three activities' },
]

function drawThree(r: Rng): Three {
  return {
    '1': int(r, 1, 12), '2': int(r, 1, 12), '3': int(r, 1, 12),
    '12': int(r, 1, 9), '13': int(r, 1, 9), '23': int(r, 1, 9),
    '123': int(r, 1, 6), '': int(r, 0, 9),
  }
}

function threeText(ctx: ThreeContext, g: Three, N: number) {
  const [x, y, z] = ctx.sets
  return `Of ${N} ${ctx.people}, ${g['1']} ${ctx.v} ${x} only, ${g['2']} ${y} only, ${g['3']} ${z} only, ${g['12']} ${x} and ${y} only, ${g['13']} ${x} and ${z} only, ${g['23']} ${y} and ${z} only, ${g['123']} ${ctx.v} all three and ${g['']} ${ctx.v} none.`
}

/** q12: exactly one (or, on alternate turns, exactly two) of three sets. */
const exactlyInThree: Builder = (r, slot, turn) => {
  const ctx = pick(r, THREE_CONTEXTS)
  const two = turn % 2 === 1
  const g = drawThree(r)
  const N = THREE_KEYS.reduce((s, k) => s + g[k], 0)
  const keys = two ? (['12', '13', '23'] as const) : (['1', '2', '3'] as const)
  const parts = keys.map((k) => g[k])
  const answer = parts.reduce((s, x) => s + x, 0)
  const { people, S1, S2, S3 } = threeSets(g)
  const counted = people.filter((_, i) => [S1, S2, S3].filter((S) => S.includes(i)).length === (two ? 2 : 1)).length
  return {
    question: {
      type: 'numeric',
      prompt: `${threeText(ctx, g, N)} How many ${ctx.v} ${two ? ctx.exactlyTwo : ctx.exactlyOne}?`,
      solution: two
        ? `Exactly two means the three regions where just two circles overlap: $${parts.join(' + ')} = ${answer}$. The single regions and the middle are excluded.`
        : `Exactly one means the three outer single regions: $${parts.join(' + ')} = ${answer}$. The pairs and the middle are excluded.`,
      markScheme: scheme(slot, two ? ['identifies the three two-only regions', 'excludes the single regions and the middle'] : ['identifies the three single regions', 'excludes the pairs and the middle'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer && people.length === N, detail: `counted ${counted} of ${people.length}` },
    values: { ...g, none: g[''], N, two: String(two) },
  }
}

/** q18: one whole circle of three, from its four regions. */
const wholeCircle: Builder = (r, slot) => {
  const ctx = pick(r, THREE_CONTEXTS)
  const g = drawThree(r)
  const N = THREE_KEYS.reduce((s, k) => s + g[k], 0)
  const s = int(r, 1, 3)
  const keys = THREE_KEYS.filter((k) => k.includes(String(s)))
  const parts = keys.map((k) => g[k])
  const answer = parts.reduce((x, y) => x + y, 0)
  const sets = threeSets(g)
  const counted = [sets.S1, sets.S2, sets.S3][s - 1]!.length
  const name = ctx.sets[s - 1]!
  return {
    question: {
      type: 'numeric',
      prompt: `${threeText(ctx, g, N)} How many ${ctx.v} ${name} altogether?`,
      solution: `The whole ${name} circle is its four regions: $${parts.join(' + ')} = ${answer}$.`,
      markScheme: scheme(slot, ['adds all four regions of the circle'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `counted ${counted} members of the circle` },
    values: { ...g, none: g[''], N, set: s },
  }
}

/** q14: a region's size from its probability. */
const fromProbability: Builder = (r, slot, turn) => {
  const ctx = pick(r, CONTEXTS)
  const which = (['both', 'neither', 'A only'] as const)[turn % 3]!
  const t = drawTwo(r, 20, 60, (t) => {
    const k = which === 'both' ? t.c : which === 'neither' ? t.d : t.a
    return gcd(k, t.N) > 1 && k < t.N
  })
  const k = which === 'both' ? t.c : which === 'neither' ? t.d : t.a
  const [p, q] = reduce(k, t.N)
  const answer = (p * t.N) / q
  const phrase1 = which === 'both' ? ctx.both1 : which === 'neither' ? ctx.neither1 : `${ctx.A1} only`
  const phrase = which === 'both' ? ctx.both : which === 'neither' ? ctx.neither : `${ctx.A} only`
  const region = which === 'both' ? 'overlap' : which === 'neither' ? 'region outside both circles' : `${ctx.An}-only region`
  const { people, A, B } = twoSets(t)
  const counted = people.filter((x) => (which === 'both' ? A.includes(x) && B.includes(x) : which === 'neither' ? !A.includes(x) && !B.includes(x) : A.includes(x) && !B.includes(x))).length
  return {
    question: {
      type: 'numeric',
      prompt: `${t.N} ${ctx.people} were asked whether they ${ctx.A} and whether they ${ctx.B}. The probability that a ${ctx.one} chosen at random ${phrase1} is $\\dfrac{${p}}{${q}}$. How many of the ${t.N} ${phrase}?`,
      solution: `The ${region} is $\\dfrac{${p}}{${q}}$ of the total: $\\dfrac{${p}}{${q}} \\times ${t.N} = ${answer}$.`,
      markScheme: scheme(slot, ['multiplies the probability by the total'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer && Number.isInteger(answer), detail: `counted ${counted} of ${people.length}` },
    values: { N: t.N, k, p, q, which },
  }
}

/** Venn q15 and set notation q13: the overlap from the totals and neither. */
function overlapFromNeither(contexts: readonly Context[], style: 'venn' | 'sets'): Builder {
  return (r, slot) => {
    const ctx = pick(r, contexts)
    const t = drawTwo(r, 20, 45, (t) => t.c >= 2)
    const nA = t.a + t.c
    const nB = t.b + t.c
    const inside = t.N - t.d
    const sum = nA + nB
    const answer = sum - inside
    const { people, A, B } = twoSets(t)
    const counted = both(A, B).length
    const solution = style === 'venn'
      ? `Inside the circles there are $${t.N} - ${t.d} = ${inside}$. Adding the circles gives $${nA} + ${nB} = ${sum}$, which counts the overlap twice, so the overlap is $${sum} - ${inside} = ${answer}$.`
      : `At least one is $${t.N} - ${t.d} = ${inside}$. Adding the circles gives $${nA} + ${nB} = ${sum}$, so the overlap counted twice is $${sum} - ${inside} = ${answer}$.`
    const method = style === 'venn' ? [`${inside} inside the circles`, `${nA} + ${nB} double counts the overlap`] : [`${inside} in at least one`, `${nA} + ${nB} counts the overlap twice`]
    return {
      question: {
        type: 'numeric',
        prompt: `${ctx.intro(t.N)}, ${nA} ${ctx.A}, ${nB} ${ctx.B} and ${t.d} ${ctx.neither}. How many ${ctx.both}?`,
        solution,
        markScheme: scheme(slot, method, String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: counted === answer && people.length === t.N && either(A, B).length === inside, detail: `counted ${counted} in both` },
      values: { N: t.N, nA, nB, neither: t.d },
    }
  }
}

const vennGenerators: Generator[] = [
  bySlot('venn-filling', VENN, { q1: onlyOne, q2: neitherFromTotals, q10: neitherFromTotals, q7: pairNotThird, q12: exactlyInThree, q18: wholeCircle }),
  bySlot('venn-probability', VENN, { q5: regionProbability, q6: atLeastOneRegion, q11: conditional }),
  bySlot('venn-working-backwards', VENN, { q14: fromProbability, q15: overlapFromNeither(CONTEXTS, 'venn') }),
]

/* ------------------------------------------------------------------------------------------
 * Sets and set notation
 * ---------------------------------------------------------------------------------------- */

const SETS = 'sets-and-set-notation'

/** Words with a repeated letter, so the set is smaller than the word. */
const WORDS_WITH_REPEATS = [
  'LEVEL', 'BANANA', 'MISSISSIPPI', 'LETTER', 'COFFEE', 'BALLOON', 'COMMITTEE', 'PEPPER', 'ASSESS', 'TATTOO', 'PARALLEL', 'REFERENCE',
  'NINETEEN', 'CHEESE', 'GIGGLE', 'BUBBLE', 'PUPPY', 'KAYAK', 'RACECAR', 'STATISTICS', 'MATHEMATICS', 'ADDRESS', 'SUCCESS', 'BOOKKEEPER',
  'ELEVEN', 'SEVENTEEN', 'DIFFERENCE', 'ESSENCE', 'PROBABILITY', 'GEOMETRY', 'ALGEBRA', 'INTERSECTION', 'ELEMENT', 'PARABOLA', 'TOMORROW',
  'BOOKSHOP', 'APPLE', 'COOKBOOK', 'GRAMMAR', 'HAPPINESS', 'BEGINNING', 'ASSISTANT', 'DINNER', 'SUMMER', 'MESSAGE', 'BOTTLE', 'CALCULATOR',
]

/** q1: elements in the set of letters of a word, or of digits of a number. */
const distinctMembers: Builder = (r, slot) => {
  const useWord = r() < 0.5
  let source: string
  let prompt: string
  if (useWord) {
    source = pick(r, WORDS_WITH_REPEATS)
    prompt = `How many elements are in the set formed by the letters of the word ${source}?`
  } else {
    const pool = shuffle(r, range(0, 9)).slice(0, int(r, 2, 5))
    source = draw(r, (r) => {
      const len = int(r, 6, 9)
      const ds = Array.from({ length: len }, () => pick(r, pool))
      return ds.join('')
    }, (s) => s[0] !== '0')
    prompt = `How many elements are in the set formed by the digits of the number ${source}?`
  }
  const set = [...new Set(source)]
  const answer = set.length
  // Second route: sort the characters and count where each run starts.
  const sorted = [...source].sort()
  const runs = sorted.filter((c, i) => i === 0 || c !== sorted[i - 1]).length
  const kind = useWord ? 'letters' : 'digits'
  const shown = useWord ? set : [...set].sort()
  return {
    question: {
      type: 'numeric',
      prompt,
      solution: `The ${kind} are ${andList(shown)}. Repeats count once, so the set is $\\{${shown.join(', ')}\\}$ and $n = ${answer}$.`,
      markScheme: scheme(slot, [], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: runs === answer && answer < source.length, detail: `${runs} runs after sorting` },
    values: { source },
  }
}

interface Prop {
  name: string
  is: string
  test: (x: number) => boolean
}
const isPrime = (x: number) => x > 1 && range(2, x - 1).every((d) => x % d !== 0)
const factorsOf = (n: number): Prop => ({ name: `the factors of ${n}`, is: `a factor of ${n}`, test: (x) => n % x === 0 })
const multiplesOf = (n: number): Prop => ({ name: `the multiples of ${n}`, is: `a multiple of ${n}`, test: (x) => x % n === 0 })
export const PROPS: Prop[] = [
  { name: 'the even numbers', is: 'even', test: (x) => x % 2 === 0 },
  { name: 'the odd numbers', is: 'odd', test: (x) => x % 2 === 1 },
  multiplesOf(3), multiplesOf(4), multiplesOf(5),
  { name: 'the prime numbers', is: 'prime', test: isPrime },
  { name: 'the square numbers', is: 'a square number', test: (x) => Number.isInteger(Math.sqrt(x)) },
  factorsOf(12), factorsOf(18), factorsOf(20), factorsOf(24),
]

const setTex = (xs: readonly number[]) => `\\{${xs.join(', ')}\\}`
/** A list answer as the written q10 accepts it: in order, and in reverse. */
const listForms = (xs: readonly number[]) => [...new Set([xs.join(', '), [...xs].reverse().join(', ')])]

/**
 * ξ = lo..n with two properties, and the members of each as explicit lists. ξ starts at 1,
 * as written, unless `anyStart` lets it start anywhere from 1 to 12.
 */
function universe(r: Rng, ok: (A: number[], B: number[], xi: number[]) => boolean, anyStart = false) {
  return draw(r, (r) => {
    const lo = anyStart && r() < 0.6 ? int(r, 2, 12) : 1
    const n = int(r, lo + 9, lo + 19)
    const [PA, PB] = shuffle(r, PROPS).slice(0, 2) as [Prop, Prop]
    const xi = range(lo, n)
    return { lo, n, PA, PB, xi, A: xi.filter(PA.test), B: xi.filter(PB.test) }
  }, ({ A, B, xi }) => A.length > 0 && B.length > 0 && ok(A, B, xi))
}

/** q5: list A ∩ B. */
const listIntersection: Builder = (r, slot) => {
  const { n, PA, PB, xi, A, B } = universe(r, (A, B) => {
    const I = A.filter((x) => B.includes(x))
    return I.length >= 1 && I.length <= 6 && I.length < A.length && I.length < B.length
  })
  // The answer from the two properties; the check from the two written-out lists.
  const answer = xi.filter((x) => PA.test(x) && PB.test(x))
  const fromLists = both(A, B)
  const listed = answer.length === 1 ? `The only element in both is **${answer[0]}**.` : `The elements in both are **${answer.join(', ')}**.`
  return {
    question: {
      type: 'short-text',
      prompt: `With ξ the numbers 1 to ${n}, A ${PA.name} and B ${PB.name}, list the elements of A ∩ B. Give them separated by commas.`,
      solution: `$A = ${setTex(A)}$ and $B = ${setTex(B)}$. ${listed}`,
      markScheme: scheme(slot, ['lists both sets'], answer.join(', ')),
      accepted: listForms(answer),
    },
    check: { agrees: fromLists.join() === answer.join(), detail: `from the lists: ${fromLists.join(', ')}` },
    values: { n, A: PA.name, B: PB.name, answer: answer.join(',') },
  }
}

/** q10: list A′. */
const listComplement: Builder = (r, slot) => {
  const { lo, n, PA, xi, A } = universe(r, (A, _B, xi) => xi.length - A.length >= 2 && xi.length - A.length <= 8, true)
  const answer = xi.filter((x) => !PA.test(x))
  const fromLists = xi.filter((x) => !A.includes(x))
  return {
    question: {
      type: 'short-text',
      prompt: `With ξ the numbers ${lo} to ${n} and A ${PA.name}, list the elements of A′. Give them separated by commas.`,
      solution: `$A = ${setTex(A)}$. $A'$ is everything in $\\xi$ that is not in $A$, the numbers that are not ${PA.is}: **${answer.join(', ')}**.`,
      markScheme: scheme(slot, ['everything in the universal set not in A'], answer.join(', ')),
      accepted: listForms(answer),
    },
    check: { agrees: fromLists.join() === answer.join() && fromLists.length + A.length === xi.length, detail: `from the lists: ${fromLists.join(', ')}` },
    values: { lo, n, A: PA.name, answer: answer.join(',') },
  }
}

/** q11: list A ∩ B′ (or A′ ∩ B on alternate turns): one circle without the overlap. */
const listOneOnly: Builder = (r, slot, turn) => {
  const flip = turn % 2 === 1
  const { n, PA, PB, xi, A, B } = universe(r, (A, B) => {
    const [X, Y] = flip ? [B, A] : [A, B]
    const only = X.filter((x) => !Y.includes(x))
    return only.length >= 1 && only.length <= 7 && only.length < X.length
  })
  const [PX, PY, X, Y, x, y] = flip ? [PB, PA, B, A, 'B', 'A'] : [PA, PB, A, B, 'A', 'B']
  const answer = xi.filter((v) => PX.test(v) && !PY.test(v))
  const notY = xi.filter((v) => !Y.includes(v))
  const fromLists = both(X, notY)
  const expr = flip ? "A′ ∩ B" : "A ∩ B′"
  const tex = flip ? "A' \\cap B" : "A \\cap B'"
  return {
    question: {
      type: 'short-text',
      prompt: `With ξ the numbers 1 to ${n}, A ${PA.name} and B ${PB.name}, list the elements of ${expr}. Give them separated by commas.`,
      solution: `$${y}'$ is everything that is not ${PY.is}. $${tex}$ is therefore the elements of ${x}, ${PX.name}, that are **not** ${PY.is}: **${answer.join(', ')}**. This is the ${x}-only region.`,
      markScheme: scheme(slot, [`finds ${y}′ first`, `intersects it with ${x}`], answer.join(', ')),
      accepted: listForms(answer),
    },
    check: { agrees: fromLists.join() === answer.join(), detail: `from the lists: ${fromLists.join(', ')}` },
    values: { n, A: PA.name, B: PB.name, flip: String(flip), answer: answer.join(',') },
  }
}

const PAIRS = [['A', 'B'], ['P', 'Q'], ['X', 'Y'], ['E', 'F'], ['C', 'D']] as const

/** q7: n(A ∪ B) from the three inner regions. */
const unionFromRegions: Builder = (r, slot) => {
  const [P, Q] = pick(r, PAIRS)
  const t = { a: int(r, 1, 20), c: int(r, 1, 15), b: int(r, 1, 20), d: int(r, 0, 10) }
  const answer = t.a + t.c + t.b
  const { A, B } = twoSets(t)
  const counted = either(A, B).length
  return {
    question: {
      type: 'numeric',
      prompt: `A Venn diagram has ${t.a} in ${P} only, ${t.c} in the overlap and ${t.b} in ${Q} only. What is $n(${P} \\cup ${Q})$?`,
      solution: `The union is everything inside either circle: $${t.a} + ${t.c} + ${t.b} = ${answer}$.`,
      markScheme: scheme(slot, ['adds all three inner regions'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `counted ${counted} members of the union` },
    values: { a: t.a, c: t.c, b: t.b },
  }
}

/** q8: n(A′) (or n(B′) on alternate turns), which includes the outside region. */
const complementCount: Builder = (r, slot, turn) => {
  const [P, Q] = pick(r, PAIRS)
  const ofQ = turn % 2 === 1
  const t = draw(r, (r) => ({ a: int(r, 1, 20), c: int(r, 1, 15), b: int(r, 1, 20), d: int(r, 1, 12) }), (t) => t.a !== t.b)
  const [S, O, other] = ofQ ? [Q, P, t.a] : [P, Q, t.b]
  const answer = other + t.d
  const { people, A, B } = twoSets(t)
  const counted = people.filter((x) => !(ofQ ? B : A).includes(x)).length
  return {
    question: {
      type: 'numeric',
      prompt: `A Venn diagram has ${t.a} in ${P} only, ${t.c} in the overlap, ${t.b} in ${Q} only and ${t.d} outside. What is $n(${S}')$?`,
      solution: `$${S}'$ is everything not in ${S}, which is ${O} only plus the outside region: $${other} + ${t.d} = ${answer}$.`,
      markScheme: scheme(slot, ['includes the outside region'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer, detail: `counted ${counted} outside ${S}` },
    values: { ...t, of: S },
  }
}

/** q12: the union rule n(A) + n(B) − n(A ∩ B). */
const unionRule: Builder = (r, slot) => {
  const [P, Q] = pick(r, PAIRS)
  const t = draw(r, (r) => ({ a: int(r, 1, 25), c: int(r, 1, 15), b: int(r, 1, 25), d: 0 }), (t) => t.a !== t.b)
  const nA = t.a + t.c
  const nB = t.b + t.c
  const answer = nA + nB - t.c
  const { A, B } = twoSets(t)
  const counted = either(A, B).length
  const group = pick(r, ['In a group', 'In a survey', 'In a class', 'In a sports club'])
  return {
    question: {
      type: 'numeric',
      prompt: `${group}, $n(${P}) = ${nA}$, $n(${Q}) = ${nB}$ and $n(${P} \\cap ${Q}) = ${t.c}$. What is $n(${P} \\cup ${Q})$?`,
      solution: `$n(${P} \\cup ${Q}) = n(${P}) + n(${Q}) - n(${P} \\cap ${Q}) = ${nA} + ${nB} - ${t.c} = ${answer}$. Adding the circles counts the overlap twice, so subtract it once.`,
      markScheme: scheme(slot, ['uses the union rule', 'subtracts the overlap'], String(answer)),
      answer,
      tolerance: 0,
    },
    check: { agrees: counted === answer && A.length === nA && B.length === nB, detail: `counted ${counted} members of the union` },
    values: { nA, nB, both: t.c },
  }
}

/** No P: P(P ∩ Q) reads as nonsense. */
const APP_PAIRS = [['C', 'D'], ['X', 'Y'], ['E', 'F'], ['G', 'H']] as const

/** q15 (P(C ∩ D), or P(C ∪ D) on alternate turns) and q16 (P(C′) or P(D′)): from the regions. */
function appProbability(kind: 'overlap' | 'complement'): Builder {
  return (r, slot, turn) => {
    const [C, D] = pick(r, APP_PAIRS)
    const variant = turn % 2 === 1
    const t = drawTwo(r, 20, 50, (t) => {
      const k = kind === 'overlap' ? (variant ? t.a + t.b + t.c : t.c) : variant ? t.a + t.d : t.b + t.d
      return t.N % 5 === 0 && terminates(k, t.N) && k < t.N
    })
    const { people, A, B } = twoSets(t)
    const name = pick(r, NAMES)
    const intro = r() < 0.5 ? `From a group of ${t.N} people` : `${name} asks ${t.N} people about two apps. Of them`
    const prompt0 = `${intro}, ${t.a} use only app ${C}, ${t.c} use both apps, ${t.b} use only app ${D} and ${t.d} use neither.`
    let k: number
    let tex: string
    let solution: string
    let method: string[]
    let counted: number
    if (kind === 'overlap') {
      if (variant) {
        k = t.a + t.b + t.c
        tex = `P(${C} \\cup ${D})`
        solution = `$${C} \\cup ${D}$ is everyone who uses at least one app: $${t.a} + ${t.c} + ${t.b} = ${k}$ people out of $${t.N}$, so $P = ${worked(k, t.N)}$.`
        method = [`${k} out of ${t.N}`]
        counted = either(A, B).length
      } else {
        k = t.c
        tex = `P(${C} \\cap ${D})`
        solution = `$${C} \\cap ${D}$ is the overlap, which holds $${k}$ people out of $${t.N}$, so $P = ${worked(k, t.N)}$.`
        method = [`${k} out of ${t.N}`]
        counted = both(A, B).length
      }
    } else {
      const [S, inS, rest] = variant ? [D, t.b + t.c, `${t.b} + ${t.c}`] : [C, t.a + t.c, `${t.a} + ${t.c}`]
      k = t.N - inS
      tex = `P(${S}')`
      solution = `$${S}$ holds $${rest} = ${inS}$ people, so $${S}'$ holds $${t.N} - ${inS} = ${k}$. That gives $${tex} = ${worked(k, t.N)}$.`
      method = [`n(${S}) = ${inS}`, 'subtracts from the total, or from 1']
      counted = people.filter((x) => !(variant ? B : A).includes(x)).length
    }
    const answer = k / t.N
    return {
      question: {
        type: 'numeric',
        prompt: `${prompt0} What is $${tex}$? Give your answer as a fraction or a decimal.`,
        solution,
        markScheme: scheme(slot, method, eitherForm(k, t.N)),
        answer,
        tolerance: tolFor(answer),
      },
      check: { agrees: counted === k && Math.abs(counted / people.length - answer) < 1e-12, detail: `counted ${counted} of ${people.length}` },
      values: { ...t, kind, variant: String(variant), k },
    }
  }
}

const SET_CONTEXTS = CONTEXTS.filter((c) => c.An !== 'app X')

const setGenerators: Generator[] = [
  bySlot('set-listing', SETS, { q1: distinctMembers, q5: listIntersection, q10: listComplement, q11: listOneOnly }),
  bySlot('set-counting', SETS, { q7: unionFromRegions, q8: complementCount, q12: unionRule, q13: overlapFromNeither(SET_CONTEXTS, 'sets') }),
  bySlot('set-probability', SETS, { q15: appProbability('overlap'), q16: appProbability('complement') }),
]

/** Generators for Venn diagrams and set notation. */
export const setsGenerators: Generator[] = [...vennGenerators, ...setGenerators]


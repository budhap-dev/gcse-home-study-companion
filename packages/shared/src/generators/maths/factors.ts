import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const TOPIC = 'factors-multiples-and-primes'
const PRIMES = [2, 3, 5, 7, 11, 13]

/** Prime factorisation as [prime, power] pairs, smallest prime first. */
export function factorise(n: number): [number, number][] {
  const out: [number, number][] = []
  let m = n
  for (let p = 2; p * p <= m; p++) {
    let e = 0
    while (m % p === 0) {
      m /= p
      e++
    }
    if (e) out.push([p, e])
  }
  if (m > 1) out.push([m, 1])
  return out
}

/** As the pack prints it in maths: 2^{3} \times 3 \times 5. */
export const primeForm = (pairs: [number, number][]) => pairs.map(([p, e]) => (e === 1 ? `${p}` : `${p}^{${e}}`)).join(' \\times ')
const plainForm = (pairs: [number, number][]) => pairs.map(([p, e]) => (e === 1 ? `${p}` : `${p}${String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]!)}`)).join(' × ')
const value = (pairs: [number, number][]) => pairs.reduce((v, [p, e]) => v * p ** e, 1)
/** A product of prime powers and its value, without '5 = 5' when there is nothing to work out. */
const equals = (pairs: [number, number][]) => (pairs.length === 1 && pairs[0]![1] === 1 ? `${value(pairs)}` : `${primeForm(pairs)} = ${value(pairs)}`)

/** HCF and LCM by prime factors: the lower power of each shared prime, the higher of every prime. */
export function byPrimes(a: number, b: number) {
  const fa = new Map(factorise(a))
  const fb = new Map(factorise(b))
  const primes = [...new Set([...fa.keys(), ...fb.keys()])].sort((x, y) => x - y)
  const shared = primes.filter((p) => fa.has(p) && fb.has(p)).map((p) => [p, Math.min(fa.get(p)!, fb.get(p)!)] as [number, number])
  const every = primes.map((p) => [p, Math.max(fa.get(p) ?? 0, fb.get(p) ?? 0)] as [number, number])
  return { shared, every, hcf: value(shared), lcm: value(every) }
}

/** HCF and LCM by brute force: count down from the smaller for a common factor, step up through multiples. */
export function byBruteForce(a: number, b: number) {
  let hcf = Math.min(a, b)
  while (a % hcf !== 0 || b % hcf !== 0) hcf--
  let lcm = a
  while (lcm % b !== 0) lcm += a
  return { hcf, lcm }
}

const factorsOf = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0)
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))

/**
 * HCF or LCM of two numbers by listing: written as q4 (HCF of 24 and 36) and q5 (LCM of 9 and
 * 12), both 2 marks on the core sheet. Each slot keeps its own task.
 */
export const hcfAndLcm: Generator = {
  id: 'hcf-and-lcm',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q4', 'q5'],
  build(r, slot): Draft {
    const lcmTask = slot.id === 'q5'
    const [a, b] = draw(
      r,
      (r) => (lcmTask ? [int(r, 4, 30), int(r, 4, 30)] : [int(r, 12, 100), int(r, 12, 100)]),
      ([a, b]) => {
        if (a === b || a % b === 0 || b % a === 0) return false
        const g = gcd(a, b)
        return lcmTask ? g > 1 && (a * b) / g <= 180 : g >= 4
      },
    )
    const primes = byPrimes(a, b)
    const brute = byBruteForce(a, b)
    const answer = lcmTask ? primes.lcm : primes.hcf
    const bold = (list: number[]) => list.map((x) => (x === answer ? `**${x}**` : String(x))).join(', ')
    let solution: string
    if (lcmTask) {
      const upTo = (n: number) => Array.from({ length: answer / n }, (_, i) => n * (i + 1))
      solution = `Multiples of ${a}: ${bold(upTo(a))}. Multiples of ${b}: ${bold(upTo(b))}. The first in both is **${answer}**. Not $${a} \\times ${b} = ${a * b}$, because ${a} and ${b} share the factor ${primes.hcf}.`
    } else {
      solution = `Factors of ${a}: ${bold(factorsOf(a))}. Factors of ${b}: ${bold(factorsOf(b))}. The highest in both lists is **${answer}**.`
    }
    return {
      question: {
        type: 'numeric',
        prompt: lcmTask ? `What is the lowest common multiple of ${a} and ${b}?` : `What is the highest common factor of ${a} and ${b}?`,
        solution,
        markScheme: scheme(slot, [lcmTask ? 'lists multiples of both, or uses prime factors' : 'lists factors of both, or uses prime factors'], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: (lcmTask ? brute.lcm : brute.hcf) === answer, detail: `brute force: HCF ${brute.hcf}, LCM ${brute.lcm}; prime factors: HCF ${primes.hcf}, LCM ${primes.lcm}` },
      values: { task: lcmTask ? 'LCM' : 'HCF', a, b },
    }
  },
}

/** A number built from prime powers, each power drawn up to its cap. */
function fromPowers(r: () => number, caps: [number, number][]): [number, number][] {
  return caps.map(([p, cap]) => [p, int(r, 0, cap)] as [number, number]).filter(([, e]) => e > 0)
}

const FROM_PRIMES: Record<string, 'HCF' | 'LCM'> = { q8: 'HCF', q9: 'LCM', q14: 'HCF' }

/**
 * HCF and LCM from given prime factorisations: written as q8 (HCF of 120 and 126) and q9 (their
 * LCM), on the higher sheet, and q14 (HCF of A = 2⁴ × 3² × 5 and B = 2² × 3⁵ × 7, 8-9, as an
 * ordinary number). Each slot keeps its own task.
 */
export const hcfLcmFromPrimes: Generator = {
  id: 'hcf-lcm-from-primes',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q8', 'q9', 'q14'],
  build(r, slot): Draft {
    const task = FROM_PRIMES[slot.id] ?? 'HCF'
    const big = slot.id === 'q14'
    const { fa, fb } = draw(
      r,
      (r) => {
        if (big) {
          // Two primes in both at different powers, and one prime each of their own.
          const [x, y] = pick(r, [[2, 3], [2, 5], [3, 5], [2, 7]] as const)
          const others = PRIMES.filter((p) => p !== x && p !== y && p <= 11)
          const [p, q] = [pick(r, others), pick(r, others)]
          const fa: [number, number][] = [[x, int(r, 1, 5)], [y, int(r, 1, 5)], [p, int(r, 1, 2)]]
          const fb: [number, number][] = [[x, int(r, 1, 5)], [y, int(r, 1, 5)], [q, int(r, 1, 2)]]
          return { fa: fa.sort((m, n) => m[0] - n[0]), fb: fb.sort((m, n) => m[0] - n[0]) }
        }
        const caps: [number, number][] = [[2, 4], [3, 3], [5, 2], [7, 1], [11, 1]]
        return { fa: fromPowers(r, caps), fb: fromPowers(r, caps) }
      },
      ({ fa, fb }) => {
        const a = value(fa)
        const b = value(fb)
        if (a === b || a % b === 0 || b % a === 0) return false
        const p = byPrimes(a, b)
        const ownA = fa.some(([q]) => !fb.some(([s]) => s === q))
        const ownB = fb.some(([q]) => !fa.some(([s]) => s === q))
        const lowerMatters = p.shared.some(([q]) => fa.find(([s]) => s === q)![1] !== fb.find(([s]) => s === q)![1])
        if (big) return new Set(fa.map(([q]) => q)).size === 3 && new Set(fb.map(([q]) => q)).size === 3 && fa[0]![1] !== fb[0]![1] && p.hcf <= 2000 && ownA && ownB && lowerMatters
        return a >= 40 && b >= 40 && a <= 800 && b <= 800 && fa.length >= 3 && fb.length >= 2 && p.shared.length >= 2 && ownA && ownB && lowerMatters
      },
    )
    const a = value(fa)
    const b = value(fb)
    const p = byPrimes(a, b)
    // Second route: multiply the numbers out, Euclid's algorithm for the HCF, and the LCM from it.
    const euclid = gcd(a, b)
    const viaEuclid = task === 'HCF' ? euclid : (a / euclid) * b
    const answer = task === 'HCF' ? p.hcf : p.lcm
    const sharedNames = p.shared.map(([q]) => q)
    const names = (xs: number[]) => (xs.length === 1 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
    let prompt: string, solution: string, method: string
    if (big) {
      const left = [...fa, ...fb].map(([q]) => q).filter((q) => !sharedNames.includes(q))
      const powers = p.shared.map(([q, e]) => (e === 1 ? `${q}` : `${q ** e}`))
      prompt = `$A = ${primeForm(fa)}$ and $B = ${primeForm(fb)}$. Find the highest common factor of $A$ and $B$, as an ordinary number.`
      solution = `Only the primes in both, each at its lower power: $${primeForm(p.shared)} = ${powers.join(' \\times ')} = ${answer}$. ${names(left)} ${left.length === 1 ? 'is' : 'are each'} in only one number, so ${left.length === 1 ? 'it is' : 'they are'} left out.`
      method = `takes ${names(sharedNames)} at their lower powers`
    } else {
      prompt = `$${a} = ${primeForm(fa)}$ and $${b} = ${primeForm(fb)}$. Find the ${task === 'HCF' ? 'highest common factor' : 'lowest common multiple'} of ${a} and ${b}.`
      if (task === 'HCF') {
        solution = `The shared primes, each at its lower power: ${names(sharedNames)}. HCF $= ${equals(p.shared)}$.`
        method = `identifies the shared primes ${names(sharedNames)}`
      } else {
        solution = `Every prime, each at its higher power: $${primeForm(p.every)} = ${answer}$. Check: $${p.hcf} \\times ${answer} = ${p.hcf * answer} = ${a} \\times ${b}$ ✓.`
        method = 'takes every prime at its highest power'
      }
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [method], String(answer)), answer, tolerance: 0 },
      check: { agrees: viaEuclid === answer && p.hcf * p.lcm === a * b, detail: `${a} and ${b} multiplied out; Euclid: HCF ${euclid}, LCM ${(a / euclid) * b}` },
      values: { task, a, b },
    }
  },
}

const clock = (mins: number) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`
}

/** Two numbers sharing a factor, neither dividing the other. */
const pair = (r: () => number, lo: number, hi: number, ok: (a: number, b: number) => boolean) =>
  draw(r, (r) => [int(r, lo, hi), int(r, lo, hi)] as [number, number], ([a, b]) => a < b && b % a !== 0 && gcd(a, b) > 1 && ok(a, b))

const GROUPS: { items: [string, string]; groups: string; maker: string; range: [number, number] }[] = [
  { items: ['pencils', 'rubbers'], groups: 'party bags', maker: 'A teacher has', range: [12, 96] },
  { items: ['roses', 'tulips'], groups: 'bunches', maker: 'A florist has', range: [12, 120] },
  { items: ['apples', 'oranges'], groups: 'fruit bowls', maker: 'A shop has', range: [12, 90] },
  { items: ['red counters', 'blue counters'], groups: 'bags', maker: 'A teacher has', range: [12, 120] },
  { items: ['stickers', 'badges'], groups: 'gift packs', maker: 'A club has', range: [12, 96] },
]
const PACKS: { items: [string, string]; range: [number, number] }[] = [
  { items: ['hot dogs', 'buns'], range: [4, 12] },
  { items: ['cups', 'lids'], range: [6, 24] },
  { items: ['burgers', 'burger buns'], range: [4, 12] },
  { items: ['candles', 'candle holders'], range: [4, 18] },
  { items: ['paper plates', 'napkins'], range: [6, 24] },
]
const SQUARES: { text: (a: number, b: number) => string; unit: string; ask: string; range: [number, number]; step: number }[] = [
  { text: (a, b) => `A rectangular floor measures ${a} cm by ${b} cm. It is to be covered with identical square tiles, with no gaps and no cutting.`, unit: 'cm', ask: 'the largest tile that can be used', range: [12, 96], step: 5 },
  { text: (a, b) => `A rectangular sheet of card measures ${a} cm by ${b} cm. It is to be cut into identical squares, with none left over.`, unit: 'cm', ask: 'the largest square that can be cut', range: [12, 72], step: 1 },
  { text: (a, b) => `A rectangular field measures ${a} m by ${b} m. It is to be split into identical square plots, with no land left over.`, unit: 'm', ask: 'the largest plot possible', range: [12, 90], step: 2 },
]
const TIMERS: { text: (a: number, b: number) => string; verb: string; range: [number, number] }[] = [
  { text: (a, b) => `Two lighthouse lamps flash at the same moment. One then flashes every ${a} seconds and the other every ${b} seconds.`, verb: 'flash', range: [6, 60] },
  { text: (a, b) => `Two warning lights blink at the same moment. One then blinks every ${a} seconds and the other every ${b} seconds.`, verb: 'blink', range: [4, 45] },
  { text: (a, b) => `Two church bells ring at the same moment. One then rings every ${a} seconds and the other every ${b} seconds.`, verb: 'ring', range: [8, 60] },
]

const CONTEXT_KIND: Record<string, 'leave' | 'group' | 'packs' | 'squares' | 'count'> = { q10: 'leave', q11: 'group', q12: 'packs', q13: 'squares', q20: 'count' }

/**
 * HCF and LCM in context: written as q10 (buses every 14 and 21 minutes), q11 (pencils and
 * rubbers in party bags), q12 (packs of hot dogs and buns), q13 (the largest square tile), all
 * on the higher sheet, and q20 (how often two lamps flash together in 10 minutes, 3 marks).
 * Each slot keeps its own story, so the sheet still asks for an LCM twice and an HCF twice.
 */
export const hcfLcmInContext: Generator = {
  id: 'hcf-lcm-in-context',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q10', 'q11', 'q12', 'q13', 'q20'],
  build(r, slot): Draft {
    const kind = CONTEXT_KIND[slot.id] ?? 'leave'
    if (kind === 'group') {
      const c = pick(r, GROUPS)
      const [a, b] = pair(r, ...c.range, (a, b) => gcd(a, b) >= 3)
      const [x, y] = r() < 0.5 ? [a, b] : [b, a]
      const h = byPrimes(x, y).hcf
      const brute = byBruteForce(x, y).hcf
      return {
        question: {
          type: 'numeric',
          prompt: `${c.maker} ${x} ${c.items[0]} and ${y} ${c.items[1]}. They are all put into identical ${c.groups}, with nothing left over. What is the largest number of ${c.groups} that can be made?`,
          solution: `Shared equally into the biggest number of groups, so find the HCF. HCF(${x}, ${y}) = **${h}** ${c.groups}, each holding ${x / h} ${c.items[0]} and ${y / h} ${c.items[1]}.`,
          markScheme: scheme(slot, ['recognises an HCF, or lists common factors'], String(h)),
          answer: h,
          tolerance: 0,
          units: c.groups,
        },
        check: { agrees: brute === h && x % h === 0 && y % h === 0, detail: `counting down from ${Math.min(x, y)}: ${brute}` },
        values: { kind, a: x, b: y },
      }
    }
    if (kind === 'squares') {
      const c = pick(r, SQUARES)
      const [a0, b0] = pair(r, ...c.range, (a, b) => gcd(a * c.step, b * c.step) >= 4)
      const [a, b] = [b0 * c.step, a0 * c.step]
      const p = byPrimes(a, b)
      const brute = byBruteForce(a, b).hcf
      return {
        question: {
          type: 'numeric',
          prompt: `${c.text(a, b)} What is the side length of ${c.ask}?`,
          solution: `The side must divide both ${a} and ${b} exactly, and be as big as possible, so it is the HCF. $${a} = ${primeForm(factorise(a))}$ and $${b} = ${primeForm(factorise(b))}$ share $${equals(p.shared)}$. So **${p.hcf} ${c.unit}** squares: ${a / p.hcf} along one side and ${b / p.hcf} along the other.`,
          markScheme: scheme(slot, [`recognises an HCF of ${a} and ${b}`], String(p.hcf)),
          answer: p.hcf,
          tolerance: 0,
          units: c.unit,
        },
        check: { agrees: brute === p.hcf, detail: `counting down from ${b}: ${brute}` },
        values: { kind, a, b },
      }
    }
    if (kind === 'packs') {
      const c = pick(r, PACKS)
      const [a, b] = pair(r, ...c.range, () => true)
      const [x, y] = r() < 0.5 ? [a, b] : [b, a]
      const first = r() < 0.6
      const l = byPrimes(x, y).lcm
      const answer = l / (first ? x : y)
      // Second route: buy packs of the first one at a time until the second's packs can match.
      let packs = 1
      while ((packs * (first ? x : y)) % (first ? y : x) !== 0) packs++
      const [mine, other] = first ? [0, 1] : [1, 0]
      const size = [x, y]
      return {
        question: {
          type: 'numeric',
          prompt: `${cap(c.items[0])} are sold in packs of ${x} and ${c.items[1]} in packs of ${y}. Sam wants exactly the same number of ${c.items[0]} as ${c.items[1]}. What is the smallest number of packs of ${c.items[mine]} he can buy?`,
          solution: `The totals must line up, so find LCM(${x}, ${y}) = ${l}. That is $${l} \\div ${size[mine]} = ${answer}$ packs of ${c.items[mine]} (and $${l} \\div ${size[other]} = ${l / size[other]!}$ packs of ${c.items[other]}). The answer is **${answer}**, not ${l}, which is the number of ${c.items[mine]}.`,
          markScheme: scheme(slot, [`finds LCM(${x}, ${y}) = ${l}`], String(answer)),
          answer,
          tolerance: 0,
          units: 'packs',
        },
        check: { agrees: packs === answer, detail: `one pack at a time: ${packs} packs` },
        values: { kind, a: x, b: y, asked: c.items[mine]! },
      }
    }
    if (kind === 'count') {
      const c = pick(r, TIMERS)
      const { a, b, T } = draw(
        r,
        (r) => {
          const [a, b] = pair(r, ...c.range, () => true)
          return { a, b, T: int(r, 2, 20) }
        },
        ({ a, b, T }) => {
          const l = byPrimes(a, b).lcm
          return (T * 60) % l !== 0 && Math.floor((T * 60) / l) >= 2 && Math.floor((T * 60) / l) <= 12
        },
      )
      const l = byPrimes(a, b).lcm
      const total = T * 60
      const times = Array.from({ length: Math.floor(total / l) }, (_, i) => l * (i + 1))
      const answer = times.length
      // Second route: tick through every second and count the ones both land on.
      let together = 0
      for (let t = 1; t <= total; t++) if (t % a === 0 && t % b === 0) together++
      const { verb } = c
      return {
        question: {
          type: 'numeric',
          prompt: `${c.text(a, b)} In the next ${T} minutes, how many more times do they ${verb} at the same moment?`,
          solution: `They ${verb} together every LCM(${a}, ${b}) = ${l} seconds. ${T} minutes is ${total} seconds, and the multiples of ${l} up to ${total} are ${listWords(times)}. That is **${answer}** more times.`,
          markScheme: scheme(slot, [`finds LCM(${a}, ${b}) = ${l} seconds`, `converts ${T} minutes to ${total} seconds`], String(answer)),
          answer,
          tolerance: 0,
        },
        check: { agrees: together === answer, detail: `second by second: ${together} times` },
        values: { kind, a, b, T },
      }
    }
    // Buses or trains leaving together, or runners lapping a track.
    const runners = r() < 0.3
    if (runners) {
      const [a, b] = pair(r, 60, 100, (a, b) => byPrimes(a, b).lcm <= 900)
      const [x, y] = r() < 0.5 ? [a, b] : [b, a]
      const l = byPrimes(x, y).lcm
      const brute = byBruteForce(x, y).lcm
      return {
        question: {
          type: 'numeric',
          prompt: `Two runners start together from the start line of a track. One completes a lap every ${x} seconds and the other every ${y} seconds. After how many seconds are they next at the start line together?`,
          solution: `They repeat and must line up, so find the LCM. $${x} = ${primeForm(factorise(x))}$ and $${y} = ${primeForm(factorise(y))}$, so LCM $= ${primeForm(byPrimes(x, y).every)} = ${l}$ seconds. Not $${x} \\times ${y} = ${x * y}$.`,
          markScheme: scheme(slot, [`recognises an LCM, or lists multiples of ${x} and ${y}`], String(l)),
          answer: l,
          tolerance: 0,
          units: 'seconds',
        },
        check: { agrees: brute === l, detail: `stepping through multiples of ${x}: ${brute}` },
        values: { kind, a: x, b: y, story: 'runners' },
      }
    }
    const vehicle = pick(r, ['buses', 'trains', 'coaches'])
    const place = vehicle === 'trains' ? 'a station' : vehicle === 'buses' ? 'a bus station' : 'a coach station'
    const [a, b] = pair(r, 6, 30, (a, b) => byPrimes(a, b).lcm <= 150)
    const [x, y] = r() < 0.5 ? [a, b] : [b, a]
    const start = int(r, 24, 39) * 15
    const l = byPrimes(x, y).lcm
    const brute = byBruteForce(x, y).lcm
    return {
      question: {
        type: 'numeric',
        prompt: `Two ${vehicle} leave ${place} together at ${clock(start)}. One leaves every ${x} minutes and the other every ${y} minutes. How many minutes later do they next leave the station together?`,
        solution: `They repeat and must line up, so find the LCM. $${x} = ${primeForm(factorise(x))}$ and $${y} = ${primeForm(factorise(y))}$, so LCM $= ${primeForm(byPrimes(x, y).every)} = ${l}$ minutes, at ${clock(start + l)}. Not $${x} \\times ${y} = ${x * y}$.`,
        markScheme: scheme(slot, [`recognises an LCM, or lists multiples of ${x} and ${y}`], String(l)),
        answer: l,
        tolerance: 0,
        units: 'minutes',
      },
      check: { agrees: brute === l, detail: `stepping through multiples of ${x}: ${brute}` },
      values: { kind, a: x, b: y, story: vehicle },
    }
  },
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
const listWords = (xs: number[]) => (xs.length === 1 ? `${xs[0]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** How many factors from the prime factorisation: written as q19 (360 has 24 factors, 2 marks). */
export const numberOfFactors: Generator = {
  id: 'number-of-factors',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q19'],
  build(r, slot): Draft {
    const pairs = draw(
      r,
      (r) => fromPowers(r, [[2, 5], [3, 3], [5, 2], [7, 2], [11, 1], [13, 1]]),
      (f) => f.length >= 2 && f.some(([, e]) => e >= 2) && value(f) >= 48 && value(f) <= 5000,
    )
    const n = value(pairs)
    const letters = ['a', 'b', 'c', 'd', 'e']
    const choices = pairs.map(([, e]) => e + 1)
    const answer = choices.reduce((s, x) => s * x, 1)
    const term = pairs.map(([p], i) => `${p}^${letters[i]}`).join(' \\times ')
    const each = pairs.map(([, e], i) => `${e + 1} for $${letters[i]}$ (${e === 1 ? '0 or 1' : `0 to ${e}`})`)
    const listed = each.length === 2 ? `${each[0]} and ${each[1]}` : `${each.slice(0, -1).join(', ')} and ${each[each.length - 1]}`
    // Second route: try every whole number up to n.
    const brute = factorsOf(n).length
    return {
      question: {
        type: 'numeric',
        prompt: `$${n} = ${primeForm(pairs)}$. How many factors does ${n} have, including 1 and ${n}?`,
        solution: `Each factor is $${term}$, with ${listed}. That gives $${choices.join(' \\times ')} = ${answer}$ factors.`,
        markScheme: scheme(slot, ['counts the choices of power for each prime'], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: brute === answer, detail: `dividing ${n} by every number up to it: ${brute} factors` },
      values: { n, form: plainForm(pairs) },
    }
  },
}

const MORE = ['', 'one more', 'two more']

/** The smallest k making nk a cube: written as q18 (360k, k = 75, 2 marks). */
export const smallestCubeMultiplier: Generator = {
  id: 'smallest-cube-multiplier',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q18'],
  build(r, slot): Draft {
    const pairs = draw(
      r,
      (r) => fromPowers(r, [[2, 6], [3, 5], [5, 3], [7, 2], [11, 1]]),
      (f) => {
        const need = f.map(([p, e]) => p ** ((3 - (e % 3)) % 3)).reduce((s, x) => s * x, 1)
        return f.length >= 2 && f.length <= 3 && need > 1 && need <= 600 && value(f) >= 24 && value(f) <= 30000
      },
    )
    const n = value(pairs)
    const extra = pairs.map(([p, e]) => [p, (3 - (e % 3)) % 3] as [number, number]).filter(([, e]) => e > 0)
    const k = value(extra)
    const cube = n * k
    const root = Math.round(Math.cbrt(cube))
    const notes = pairs.map(([p, e]) => {
      const shown = e === 1 ? `$${p}$` : `$${p}^{${e}}$`
      const more = (3 - (e % 3)) % 3
      return more === 0 ? `${shown} is already fine` : `${shown} needs ${MORE[more]} ${p}${more > 1 ? 's' : ''}`
    })
    const said = notes.length === 2 ? `${notes[0]}; ${notes[1]}` : `${notes.slice(0, -1).join('; ')}; ${notes[notes.length - 1]}`
    // Second route: try k = 1, 2, 3, … until nk is a cube.
    let tried = 1
    const isCube = (x: number) => {
      const c = Math.round(Math.cbrt(x))
      return c * c * c === x
    }
    while (!isCube(n * tried)) tried++
    return {
      question: {
        type: 'numeric',
        prompt: `$${n} = ${primeForm(pairs)}$. Find the smallest positive whole number $k$ such that $${n}k$ is a cube number.`,
        solution: `A cube has every prime to a power that is a multiple of 3. ${cap(said)}. So $k = ${primeForm(extra)}${extra.length > 1 || extra[0]![1] > 1 ? ` = ${k}` : ''}$, and $${n} \\times ${k} = ${cube} = ${root}^{3}$.`,
        markScheme: scheme(slot, ['powers must be multiples of 3'], String(k)),
        answer: k,
        tolerance: 0,
      },
      check: { agrees: tried === k && root ** 3 === cube, detail: `trying k = 1, 2, 3, …: first cube at k = ${tried}` },
      values: { n, form: plainForm(pairs) },
    }
  },
}

/** The other number from its HCF and LCM with a known one: written as q16 (24 and n, HCF 8, LCM 120). */
export const otherNumberFromHcfLcm: Generator = {
  id: 'other-number-from-hcf-lcm',
  subjectId: 'maths',
  topicId: TOPIC,
  replaces: ['q16'],
  build(r, slot): Draft {
    const { a, n } = draw(
      r,
      (r) => ({ a: int(r, 12, 60), n: int(r, 6, 120) }),
      ({ a, n }) => a !== n && a % n !== 0 && n % a !== 0 && gcd(a, n) >= 2 && (a * n) / gcd(a, n) <= 720 && [a, n].every((x) => factorise(x).every(([p]) => p <= 13)),
    )
    const p = byPrimes(a, n)
    const { hcf: h, lcm: l } = p
    // Second route: search every candidate up to the LCM for the one with that HCF and LCM.
    const found = Array.from({ length: l }, (_, i) => i + 1).filter((m) => gcd(a, m) === h && (a * m) / gcd(a, m) === l)
    return {
      question: {
        type: 'numeric',
        prompt: `The highest common factor of ${a} and a number $n$ is ${h}. The lowest common multiple of ${a} and $n$ is ${l}. Find $n$.`,
        solution: `For two numbers, HCF × LCM equals their product: $${a}n = ${h} \\times ${l} = ${h * l}$, so $n = ${n}$. Check: $${a} = ${primeForm(factorise(a))}$ and $${n} = ${primeForm(factorise(n))}$, with HCF ${h} and LCM ${l} ✓.`,
        markScheme: scheme(slot, [`uses ${a}n = ${h} × ${l}, or builds n from the prime factors`], String(n)),
        answer: n,
        tolerance: 0,
      },
      check: { agrees: found.length === 1 && found[0] === n, detail: `searching 1 to ${l}: ${found.join(', ')}` },
      values: { a, n, h, l },
    }
  },
}

export const factorsGenerators: Generator[] = [hcfAndLcm, hcfLcmFromPrimes, hcfLcmInContext, numberOfFactors, smallestCubeMultiplier, otherNumberFromHcfLcm]

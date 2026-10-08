import { money as poundsText, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
/** Whether `x` has at most `dp` decimal places, allowing for binary residue. */
const places = (x: number, dp: number) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))

type Relation = 'square' | 'inverse' | 'inverse-square' | 'root' | 'cube'

/** Each written slot's relation, kept as written: the sheet spreads them deliberately. */
const RELATION: Record<string, Relation> = { q5: 'square', q7: 'inverse', q11: 'inverse-square', q12: 'root', q14: 'cube' }

const PHRASE: Record<Relation, string> = {
  square: 'proportional to the square of $x$',
  inverse: 'inversely proportional to $x$',
  'inverse-square': 'inversely proportional to the square of $x$',
  root: 'proportional to the square root of $x$',
  cube: 'proportional to the cube of $x$',
}
const FORMULA: Record<Relation, string> = {
  square: 'y = kx^2',
  inverse: 'y = \\dfrac{k}{x}',
  'inverse-square': 'y = \\dfrac{k}{x^2}',
  root: 'y = k\\sqrt{x}',
  cube: 'y = kx^3',
}
const PLAIN: Record<Relation, string> = { square: 'y = kx²', inverse: 'y = k/x', 'inverse-square': 'y = k/x²', root: 'y = k√x', cube: 'y = kx³' }
const POWER: Record<Relation, number> = { square: 2, inverse: 1, 'inverse-square': 2, root: 0.5, cube: 3 }

/**
 * Proportion to a power: written as q5 (y ∝ x², find y), q7 (y ∝ 1/x, find y), q11
 * (y ∝ 1/x², find y), q12 (y ∝ √x, find x, 4 marks) and q14 (y ∝ x³, find y). Each slot keeps
 * its relation; q5 and q7 share the higher sheet, q11, q12 and q14 the advanced one.
 */
export const proportionToAPower: Generator = {
  id: 'proportion-to-a-power',
  subjectId: 'maths',
  topicId: 'direct-and-inverse-proportion',
  replaces: ['q5', 'q7', 'q11', 'q12', 'q14'],
  build(r, slot): Draft {
    const rel = RELATION[slot.id] ?? 'square'
    const n = POWER[rel]
    const stem = `$y$ is ${PHRASE[rel]}`

    if (rel === 'root') {
      const { k, s1, s2 } = draw(r, (r) => ({ k: int(r, 2, 12), s1: int(r, 2, 12), s2: int(r, 2, 15) }), ({ s1, s2 }) => s1 !== s2)
      const x1 = s1 * s1
      const y1 = k * s1
      const y2 = k * s2
      const answer = s2 * s2
      // Second route: y scales with √x, so x scales with the square of y's scale factor.
      const scaled = (x1 * y2 * y2) / (y1 * y1)
      return {
        question: {
          type: 'numeric',
          prompt: `${stem}, and $y = ${y1}$ when $x = ${x1}$. Work out $x$ when $y = ${y2}$.`,
          solution: `$${FORMULA.root}$, so $${y1} = k\\sqrt{${x1}} = ${s1}k$ and $k = ${k}$, giving $y = ${k}\\sqrt{x}$. Now $${y2} = ${k}\\sqrt{x}$, so $\\sqrt{x} = ${s2}$ and squaring both sides gives $x = ${answer}$.`,
          markScheme: scheme(slot, [PLAIN.root, `k = ${k}`, `√x = ${s2}`], String(answer)),
          answer,
          tolerance: 0,
        },
        check: { agrees: answer * y1 * y1 === x1 * y2 * y2 && near(scaled, answer), detail: `x scales by (${y2}/${y1})²: ${x1} × ${show((y2 / y1) ** 2)} = ${show(scaled)}` },
        values: { relation: rel, k, x1, y1, y2 },
      }
    }

    const inverse = rel === 'inverse' || rel === 'inverse-square'
    const { k, x1, x2, y1 } = draw(
      r,
      (r) => {
        if (rel === 'inverse') {
          const x1 = int(r, 2, 12)
          const y1 = int(r, 2, 20)
          const k = x1 * y1
          return { k, x1, y1, x2: int(r, 2, 24) }
        }
        if (rel === 'inverse-square') {
          const x1 = int(r, 2, 6)
          const y1 = int(r, 1, 20)
          return { k: y1 * x1 * x1, x1, y1, x2: int(r, 2, 12) }
        }
        const k = int(r, 2, 12)
        const x1 = int(r, 2, rel === 'cube' ? 5 : 6)
        return { k, x1, y1: k * x1 ** n, x2: int(r, 2, rel === 'cube' ? 7 : 10) }
      },
      ({ k, x1, x2 }) => {
        if (x1 === x2) return false
        if (rel === 'inverse') return k % x2 === 0
        // q11 is the 8-9 slot, whose written answer is a decimal: a terminating one.
        if (rel === 'inverse-square') return places(k / x2 ** 2, 2) && k / x2 ** 2 >= 0.05
        return true
      },
    )
    const value = inverse ? k / x2 ** n : k * x2 ** n
    const answer = Number(show(value))
    const xn1 = n === 1 ? `${x1}` : `${x1 ** n}`
    const xn2 = n === 1 ? `${x2}` : `${x2 ** n}`
    let solution: string
    if (inverse) {
      solution = `$${FORMULA[rel]}$, so $${y1} = \\dfrac{k}{${xn1}}$ and $k = ${k}$. Then $y = \\dfrac{${k}}{${xn2}} = ${show(answer)}$.`
      if (rel === 'inverse') {
        solution += ` The answer ${x2 > x1 ? 'fell because $x$ rose' : 'rose because $x$ fell'}, which is the right direction.`
      } else if (x2 % x1 === 0 || x1 % x2 === 0) {
        const up = x2 > x1
        const f = up ? x2 / x1 : x1 / x2
        const xWord = up ? (f === 2 ? 'doubled' : f === 3 ? 'trebled' : `was multiplied by ${f}`) : f === 2 ? 'halved' : `was divided by ${f}`
        solution += ` Since $x$ ${xWord} and the power is $2$, $y$ became ${f * f} times ${up ? 'smaller' : 'larger'}, which checks out.`
      } else {
        solution += ` $x$ went ${x2 > x1 ? 'up, so $y$ went down' : 'down, so $y$ went up'}, as it must.`
      }
    } else {
      const power = rel === 'square' ? '^2' : '^3'
      solution = `$${FORMULA[rel]}$, so $${y1} = k \\times ${xn1}$ and $k = ${k}$. The formula is $y = ${k}x${power}$, so at $x = ${x2}$, $y = ${k} \\times ${xn2} = ${show(answer)}$.`
    }
    // Second route: no k at all. y scales by (x₂/x₁)ⁿ, or by its reciprocal when inverse.
    const ratio = (x2 / x1) ** n
    const scaled = inverse ? y1 / ratio : y1 * ratio
    return {
      question: {
        type: 'numeric',
        prompt: `${stem}, and $y = ${y1}$ when $x = ${x1}$. Work out $y$ when $x = ${x2}$.`,
        solution,
        markScheme: scheme(slot, [PLAIN[rel], `k = ${k}`], show(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(scaled, answer), detail: `scale factor (${x2}/${x1})^${n} = ${show(ratio)}; y = ${show(scaled)}` },
      values: { relation: rel, k, x1, y1, x2 },
    }
  },
}

const RP = 'ratio-and-proportion'

const PEOPLE: [string, string][] = [['Ali', 'Beth'], ['Priya', 'Tom'], ['Sam', 'Aisha'], ['Leo', 'Maya'], ['Jess', 'Omar'], ['Ella', 'Kofi'], ['Noah', 'Zara'], ['Mo', 'Lily']]

/**
 * Sharing a total in a ratio: written as q1 (540 in the ratio 4 : 5, the smaller share) and q2
 * (96 in the ratio 1 : 3 : 4, the largest share), both on the core sheet. q1 keeps two parts
 * and q2 three; either asks for the smallest or the largest share.
 */
export const shareOfATotal: Generator = {
  id: 'share-of-a-total',
  subjectId: 'maths',
  topicId: RP,
  replaces: ['q1', 'q2'],
  build(r, slot): Draft {
    const three = slot.id === 'q2'
    const ratio = draw(
      r,
      (r) => (three ? [int(r, 1, 7), int(r, 1, 9), int(r, 1, 9)] : [int(r, 1, 9), int(r, 2, 11)]),
      (p) => new Set(p).size === p.length && p.reduce(gcd) === 1 && p.reduce((s, x) => s + x, 0) <= (three ? 20 : 15),
    )
    const parts = ratio.reduce((s, x) => s + x, 0)
    const part = int(r, 3, three ? 40 : 80)
    const total = part * parts
    const largest = r() < 0.5
    const want = largest ? Math.max(...ratio) : Math.min(...ratio)
    const answer = want * part
    const word = three ? (largest ? 'largest' : 'smallest') : largest ? 'larger' : 'smaller'
    const money = r() < 0.4
    const prompt = money
      ? `${poundsText(total)} is shared in the ratio ${ratio.join(' : ')}. What is the ${word} share, in pounds?`
      : `Share ${total} in the ratio ${ratio.join(' : ')}. What is the ${word} share?`
    // Second route: each share as a fraction of the total, multiplying before dividing.
    const shares = ratio.map((p) => (total * p) / parts)
    const viaFraction = (total * want) / parts
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `There are $${ratio.join(' + ')} = ${parts}$ parts, so one part is $${total} \\div ${parts} = ${part}$, and the ${word} share is $${want} \\times ${part} = ${answer}$.`,
        markScheme: scheme(slot, [`one part is ${part}`], String(answer)),
        answer,
        tolerance: 0,
        ...(money ? { units: '£' } : {}),
      },
      check: {
        agrees: viaFraction === answer && shares.reduce((s, x) => s + x, 0) === total && shares.every(Number.isInteger) && answer === (largest ? Math.max(...shares) : Math.min(...shares)),
        detail: `as fractions of ${total}: ${shares.join(', ')}`,
      },
      values: { ratio: ratio.join(':'), part, asked: word },
    }
  },
}

const SHARE_RATIOS: [number, number][] = [[2, 3], [3, 4], [3, 5], [2, 5], [3, 7], [4, 5], [4, 7], [5, 7], [2, 7], [5, 8], [3, 8], [1, 4], [1, 3], [5, 9], [4, 9], [7, 9], [2, 9]]

/**
 * A total from one share or from the difference: written as q5 (3 : 7, the smaller share is
 * £24) and q11 (3 : 7, the difference is £24), both 3 marks. Each slot keeps its own task.
 */
export const totalFromAShare: Generator = {
  id: 'total-from-a-share',
  subjectId: 'maths',
  topicId: RP,
  replaces: ['q5', 'q11'],
  build(r, slot): Draft {
    const [a, b] = pick(r, SHARE_RATIOS)
    const parts = a + b
    const part = int(r, 3, 40)
    const total = part * parts
    const [p, q] = pick(r, PEOPLE)
    const named = r() < 0.5
    const who = named ? `${p} and ${q} share money` : 'Two people share money'
    let prompt: string, solution: string, method: string[], viaTotal: boolean
    if (slot.id === 'q11') {
      const diff = (b - a) * part
      prompt = `${who} in the ratio ${a} : ${b}. The difference between their shares is ${poundsText(diff)}. What is the total, in pounds?`
      solution = `The difference in parts is $${b} - ${a} = ${b - a}$, so one part is $${diff} \\div ${b - a} = £${part}$. The total is $${parts} \\times ${part} = £${total}$.`
      method = [`divides by the difference of ${b - a}`, `one part is ${part}`]
      // Second route: the two shares rebuilt from the total, then their difference.
      viaTotal = (total * b) / parts - (total * a) / parts === diff
    } else {
      const smaller = r() < 0.6
      const k = smaller ? a : b
      const share = k * part
      const given = named ? `${smaller ? p : q} gets ${poundsText(share)}` : `The ${smaller ? 'smaller' : 'larger'} share is ${poundsText(share)}`
      prompt = `${who} in the ratio ${a} : ${b}. ${given}. What is the total, in pounds?`
      solution = `The £${share} is ${k} parts, so one part is £${part}. The total is $${parts} \\times ${part} = £${total}$.`
      method = [`one part is ${part}`, `${parts} parts altogether`]
      viaTotal = (total * k) / parts === share
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, method, String(total)), answer: total, tolerance: 0, units: '£' },
      check: { agrees: viaTotal, detail: `£${total} in the ratio ${a} : ${b} is £${(total * a) / parts} and £${(total * b) / parts}` },
      values: { a, b, part, task: slot.id === 'q11' ? 'difference' : 'one share' },
    }
  },
}

/**
 * Direct proportion, y = kx: written as q6 (x = 6, y = 21, find y when x = 10) and q12 (the same
 * pair, find x when y = 56). k is often a half, as in the written 3.5.
 */
export const directProportion: Generator = {
  id: 'direct-proportion',
  subjectId: 'maths',
  topicId: RP,
  replaces: ['q6', 'q12'],
  build(r, slot): Draft {
    const findX = slot.id === 'q12'
    const { k2, x1, x2 } = draw(
      r,
      (r) => ({ k2: int(r, 3, 25), x1: int(r, 2, 12), x2: int(r, 2, findX ? 30 : 20) }),
      ({ k2, x1, x2 }) => x1 !== x2 && (k2 * x1) % 2 === 0 && (!findX || (k2 * x2) % 2 === 0) && k2 !== 2,
    )
    const k = k2 / 2
    const y1 = (k2 * x1) / 2
    const y2 = Number(show((k2 * x2) / 2))
    const ks = show(k)
    // Second route: scale by the ratio of the x values (or of the y values), no k.
    if (findX) {
      const viaRatio = (x1 * y2) / y1
      return {
        question: {
          type: 'numeric',
          prompt: `$y$ is directly proportional to $x$. When $x = ${x1}$, $y = ${y1}$. Find $x$ when $y = ${show(y2)}$.`,
          solution: `$${y1} = ${x1}k$ gives $k = ${ks}$, so $${show(y2)} = ${ks}x$ and $x = ${show(y2)} \\div ${ks} = ${x2}$.`,
          markScheme: scheme(slot, [`k = ${ks}`, 'solves for x'], String(x2)),
          answer: x2,
          tolerance: 0,
        },
        check: { agrees: near(viaRatio, x2), detail: `x = ${x1} × ${show(y2)}/${y1} = ${show(viaRatio)}` },
        values: { k: ks, x1, y1, find: 'x' },
      }
    }
    const viaRatio = (y1 * x2) / x1
    return {
      question: {
        type: 'numeric',
        prompt: `$y$ is directly proportional to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
        solution: `$${y1} = ${x1}k$ gives $k = ${ks}$, so $y = ${ks} \\times ${x2} = ${show(y2)}$.`,
        markScheme: scheme(slot, ['y = kx substituted', `k = ${ks}`], show(y2)),
        answer: y2,
        tolerance: 0,
      },
      check: { agrees: near(viaRatio, y2), detail: `y = ${y1} × ${x2}/${x1} = ${show(viaRatio)}` },
      values: { k: ks, x1, y1, find: 'y' },
    }
  },
}


/**
 * Inverse proportion, y = k/x: written as q7 (x = 4, y = 15, find y when x = 10: a whole
 * number) and q13 (find y when x = 8: a decimal, 8-9).
 */
export const inverseProportion: Generator = {
  id: 'inverse-proportion',
  subjectId: 'maths',
  topicId: RP,
  replaces: ['q7', 'q13'],
  build(r, slot): Draft {
    const decimal = slot.id === 'q13'
    const { x1, y1, x2 } = draw(
      r,
      (r) => ({ x1: int(r, 2, 12), y1: int(r, 2, 30), x2: int(r, 2, 20) }),
      ({ x1, y1, x2 }) => {
        const y2 = (x1 * y1) / x2
        return x1 !== x2 && (decimal ? !Number.isInteger(y2) && places(y2, 2) : Number.isInteger(y2))
      },
    )
    const k = x1 * y1
    const y2 = Number(show(k / x2))
    let note = ''
    if (decimal) {
      const up = x2 > x1
      const f = up ? x2 / x1 : x1 / x2
      const xs = `from ${x1} to ${x2}`
      const ys = `from ${y1} to ${show(y2)}`
      note = !Number.isInteger(f)
        ? ` $x$ went ${up ? 'up' : 'down'} ${xs}, so $y$ went ${up ? 'down' : 'up'} ${ys}, as inverse proportion requires.`
        : f === 2
          ? ` ${up ? 'Doubling' : 'Halving'} $x$ ${xs} has ${up ? 'halved' : 'doubled'} $y$ ${ys}, as inverse proportion requires.`
          : ` ${up ? 'Multiplying' : 'Dividing'} $x$ by ${f}, ${xs}, has ${up ? 'divided' : 'multiplied'} $y$ by ${f}, ${ys}, as inverse proportion requires.`
    }
    // Second route: scale y by the reciprocal of x's scale factor, and the direction must flip.
    const viaRatio = y1 * (x1 / x2)
    const direction = x2 > x1 ? y2 < y1 : y2 > y1
    return {
      question: {
        type: 'numeric',
        prompt: `$y$ is inversely proportional to $x$. When $x = ${x1}$, $y = ${y1}$. Find $y$ when $x = ${x2}$.`,
        solution: `$k = ${x1} \\times ${y1} = ${k}$, so $y = \\dfrac{${k}}{${x2}} = ${show(y2)}$.${note}`,
        markScheme: scheme(slot, [`k = ${k}`, `divides by ${x2}`], show(y2)),
        answer: y2,
        tolerance: 0,
      },
      check: { agrees: near(viaRatio, y2) && direction, detail: `y = ${y1} × ${x1}/${x2} = ${show(viaRatio)}; moves against x: ${direction}` },
      values: { x1, y1, x2, kind: decimal ? 'decimal' : 'whole' },
    }
  },
}

const MACHINES: { many: string; one: string; verb: string; things: string; rate: [number, number] }[] = [
  { many: 'machines', one: 'machine', verb: 'fill', things: 'boxes', rate: [5, 40] },
  { many: 'printers', one: 'printer', verb: 'print', things: 'leaflets', rate: [40, 200] },
  { many: 'workers', one: 'worker', verb: 'pack', things: 'parcels', rate: [6, 30] },
  { many: 'ovens', one: 'oven', verb: 'bake', things: 'loaves', rate: [8, 24] },
  { many: 'pumps', one: 'pump', verb: 'fill', things: 'barrels', rate: [3, 15] },
]

/**
 * Machines working at the same rate: written as q9 (5 machines fill 300 boxes in 4 hours; how
 * many do 8 fill in an hour) and q15 (how many hours 8 machines take to fill 600 boxes).
 */
export const machinesAtWork: Generator = {
  id: 'machines-at-work',
  subjectId: 'maths',
  topicId: RP,
  replaces: ['q9', 'q15'],
  build(r, slot): Draft {
    const c = pick(r, MACHINES)
    const { u, m1, h1, m2 } = draw(r, (r) => ({ u: int(r, ...c.rate), m1: int(r, 2, 9), h1: int(r, 2, 8), m2: int(r, 2, 12) }), ({ m1, m2 }) => m1 !== m2)
    const total1 = u * m1 * h1
    const machineHours = m1 * h1
    const opening = `${m1} ${c.many} ${c.verb} ${total1} ${c.things} in ${h1} hours.`
    if (slot.id === 'q15') {
      const T = int(r, 2, 10)
      const B = u * m2 * T
      const perHour = u * m2
      // Second route: scale the first job by machines and by the amount, no rate per machine.
      const viaScaling = (h1 * m1 * B) / (m2 * total1)
      return {
        question: {
          type: 'numeric',
          prompt: `${opening} How many hours would ${m2} ${c.many} take to ${c.verb} ${B} ${c.things}?`,
          solution: `One ${c.one} ${c.verb}s $${total1} \\div ${machineHours} = ${u}$ ${c.things} an hour, so ${m2} ${c.verb} $${m2} \\times ${u} = ${perHour}$ an hour. $${B} \\div ${perHour} = ${T}$ hours.`,
          markScheme: scheme(slot, [`${u} ${c.things} per ${c.one} per hour`, `${perHour} ${c.things} an hour for ${m2} ${c.many}`], String(T)),
          answer: T,
          tolerance: 0,
          units: 'hours',
        },
        check: { agrees: near(viaScaling, T), detail: `${h1} h × ${m1}/${m2} × ${B}/${total1} = ${show(viaScaling)}` },
        values: { context: c.things, u, m1, h1, m2, amount: B, ask: 'time' },
      }
    }
    const h2 = r() < 0.5 ? 1 : int(r, 2, 6)
    const answer = u * m2 * h2
    const viaScaling = (total1 * m2 * h2) / (m1 * h1)
    const when = h2 === 1 ? 'in one hour' : `in ${h2} hours`
    return {
      question: {
        type: 'numeric',
        prompt: `${opening} How many ${c.things} do ${m2} ${c.many} ${c.verb} ${when}?`,
        solution: `One ${c.one} ${c.verb}s $${total1} \\div ${machineHours} = ${u}$ ${c.things} an hour, so ${m2} ${c.many} ${c.verb} $${m2} \\times ${u}${h2 === 1 ? '' : ` \\times ${h2}`} = ${answer}$${h2 === 1 ? '' : ` in ${h2} hours`}.`,
        markScheme: scheme(slot, [`${u} ${c.things} per ${c.one} per hour`, h2 === 1 ? `multiplies by ${m2}` : `multiplies by ${m2} and by ${h2}`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(viaScaling, answer), detail: `${total1} × ${m2}/${m1} × ${h2}/${h1} = ${show(viaScaling)}` },
      values: { context: c.things, u, m1, h1, m2, h2, ask: 'amount' },
    }
  },
}

export const proportionGenerators: Generator[] = [proportionToAPower, shareOfATotal, totalFromAShare, directProportion, inverseProportion, machinesAtWork]

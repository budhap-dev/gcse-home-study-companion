import { roundTo, show } from '../format.ts'
import { draw, int, pick, shuffle } from '../random.ts'
import type { Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Draft, Generator } from '../types.ts'

/** Generators for similarity, area and volume scale factors, congruency, transformations, constructions. */

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b))
const near = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
/** Whether `x` has at most `dp` decimal places, allowing for binary residue. */
const places = (x: number, dp: number) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6
/** A product with no binary residue: 1.5 × 1.5 is 2.25, not 2.2500000000000004. */
const clean = (x: number) => Number(show(x))

// ---------------------------------------------------------------- area and volume scale factors

const AVSF = 'area-and-volume-scale-factors'

const AREA_LEADS = ['A shape has area', 'A photograph has area', 'A logo on a poster has area', 'A badge has area', 'A triangle has area', 'A flag has area']
const VOLUME_LEADS = ['A solid has volume', 'A model boat has volume', 'A toy brick has volume', 'A wax candle has volume', 'A box has volume', 'A statue has volume']

/** Decimal length factors for the 8-9 slot, each with the factor every side of its rectangle must have. */
const DECIMAL_K: { k: number; f: number }[] = [
  { k: 1.5, f: 2 },
  { k: 2.5, f: 2 },
  { k: 3.5, f: 2 },
  { k: 0.5, f: 2 },
  { k: 1.2, f: 5 },
  { k: 0.4, f: 5 },
  { k: 0.8, f: 5 },
]

/**
 * A rectangle (or cuboid) whose sides are whole multiples of `f`, so its area is a multiple of
 * f² (its volume of f³): the concrete shape the second route enlarges side by side. A factor
 * of 2.5 needs an area that is a multiple of 4 for a whole answer, and of 1.2 a multiple of 25.
 */
function box(r: Rng, dims: number, f: number, max: number): number[] {
  return draw(
    r,
    (r) => Array.from({ length: dims }, () => f * int(r, f === 1 ? 2 : 1, dims === 2 ? 15 : 8)),
    (s) => s.reduce((a, b) => a * b, 1) <= max && s.reduce((a, b) => a * b, 1) >= 4,
  )
}

/**
 * An area or a volume after an enlargement: written as q5 (24 cm³, k 3, volume, k³), q6
 * (52 cm², k 3, area, k²) and q16 (20 cm², k 2.5, area). q5 and q6 share the higher sheet
 * and keep their own kind; q16 has a decimal factor, sometimes a reduction. The second route
 * enlarges a rectangle or cuboid of that area or volume side by side and works it out again.
 */
export const enlargedAreaVolume: Generator = {
  id: 'enlarged-area-volume',
  subjectId: 'maths',
  topicId: AVSF,
  replaces: ['q5', 'q6', 'q16'],
  build(r, slot): Draft {
    const volume = slot.id === 'q5'
    const power = volume ? 3 : 2
    const decimal = slot.id === 'q16'
    const { k, f } = decimal ? pick(r, DECIMAL_K) : { k: int(r, 2, volume ? 4 : 6), f: 1 }
    const sides = box(r, power, f, volume ? 400 : 200)
    const before = sides.reduce((a, b) => a * b, 1)
    const factor = clean(k ** power)
    const answer = clean(before * factor)
    const unit = volume ? 'cm³' : 'cm²'
    const what = volume ? 'volume' : 'area'
    const lead = pick(r, volume ? VOLUME_LEADS : AREA_LEADS)
    let prompt: string
    if (decimal) {
      prompt = k > 1
        ? `${lead} ${before} ${unit}. It is enlarged so its lengths are ${show(k)} times bigger. What is the new ${what}, in ${unit}?`
        : `${lead} ${before} ${unit}. It is reduced so each of its lengths is ${show(k)} times what it was. What is the new ${what}, in ${unit}?`
    } else {
      prompt = `${lead} ${before} ${unit} and is enlarged by scale factor ${k}. What is the new ${what}, in ${unit}?`
    }
    const word = volume ? 'cube' : 'square'
    const solution = `${volume ? 'Volumes' : 'Areas'} scale by the **${word}** of the length scale factor: $${before} \\times ${show(k)}^${power} = ${before} \\times ${show(factor)} = ${show(answer)}$ ${unit}.${decimal ? '' : ` Multiplying by ${k} alone would give ${before * k} ${unit}.`}`
    // Second route: a rectangle or cuboid of that size, each side multiplied by k.
    const enlarged = clean(sides.reduce((a, s) => a * s * k, 1))
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [decimal ? `squares ${show(k)}` : `uses k${volume ? '³' : '²'}`], show(answer)),
        answer,
        tolerance: 0,
        units: unit,
      },
      check: { agrees: near(enlarged, answer) && !near(before * k, answer), detail: `${sides.join(' × ')} enlarged side by side: ${sides.map((s) => show(s * k)).join(' × ')} = ${show(enlarged)}` },
      values: { kind: what, k, power, before, wrong: clean(before * k) },
    }
  },
}

/** Coprime pairs m < n for a length ratio. */
const COPRIME: [number, number][] = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 5], [3, 4], [3, 5], [4, 5], [1, 5], [3, 7], [5, 6], [2, 7], [4, 7], [5, 7], [5, 8], [3, 8]]
const SIMILAR = ['shapes', 'triangles', 'flags', 'photographs', 'rectangles', 'picture frames']
const SIMILAR_SOLIDS = ['solids', 'jugs', 'statues', 'tins', 'vases', 'model cars']

/**
 * A length from an area ratio (q11: areas 9 : 25, side 6, find 10) and the length scale factor
 * from two volumes (q13: 27 and 216 cm³, find 2), both grade 8-9 on the advanced sheet. Each
 * slot keeps its task. The second routes undo the root: the answer squared (or cubed) must
 * rebuild the area (or volume) ratio, in whole numbers.
 */
export const scaleFromRatio: Generator = {
  id: 'scale-from-ratio',
  subjectId: 'maths',
  topicId: AVSF,
  replaces: ['q11', 'q13'],
  build(r, slot): Draft {
    if (slot.id === 'q13') {
      const up = r() < 0.65
      const { m, n, c } = draw(
        r,
        (r) => {
          const [m, n] = pick(r, COPRIME)
          return { m, n, c: int(r, 1, 12) }
        },
        ({ m, n, c }) => places(up ? n / m : m / n, 2) && c * n ** 3 <= 3000,
      )
      const Vs = c * m ** 3
      const Vl = c * n ** 3
      const answer = clean(up ? n / m : m / n)
      const things = pick(r, SIMILAR_SOLIDS)
      const order = r() < 0.5
      const listed = order ? `${Vs} cm³ and ${Vl} cm³` : `${Vl} cm³ and ${Vs} cm³`
      const verb = things === 'jugs' || things === 'tins' ? 'hold' : 'have volumes'
      const prompt = `Two similar ${things} ${verb} ${listed}. What is the length scale factor from ${up ? 'smaller to larger' : 'larger to smaller'}?`
      const [a, b, ra, rb] = up ? [Vs, Vl, m ** 3, n ** 3] : [Vl, Vs, n ** 3, m ** 3]
      const [la, lb] = up ? [m, n] : [n, m]
      const sf = la === 1 ? `${lb}` : `$\\frac{${lb}}{${la}} = ${show(answer)}$`
      const solution = `$${a} : ${b} = ${ra} : ${rb}$, and the cube root gives $${la} : ${lb}$, so the scale factor is ${sf}.${up ? '' : ' Going from larger to smaller, it is less than 1.'}`
      return {
        question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`simplifies the ratio to ${ra} : ${rb}`, 'cube roots it'], show(answer)), answer, tolerance: 0 },
        check: { agrees: near(a * answer ** 3, b) && near(Math.cbrt(b / a), answer), detail: `${a} × ${show(answer)}³ = ${show(clean(a * answer ** 3))}` },
        values: { direction: up ? 'up' : 'down', m, n, c },
      }
    }
    const up = r() < 0.6
    const asAreas = r() < 0.4
    const { m, n, c, t } = draw(
      r,
      (r) => {
        const [m, n] = pick(r, COPRIME.filter(([, n]) => n <= 6))
        return { m, n, c: int(r, 2, 6), t: int(r, 1, 6) }
      },
      ({ m, n, t }) => (up ? m * t : n * t) >= 2 && (up ? n * t : m * t) <= 40,
    )
    const [As, Al] = asAreas ? [c * m * m, c * n * n] : [m * m, n * n]
    const given = up ? m * t : n * t
    const answer = up ? n * t : m * t
    const things = pick(r, SIMILAR)
    const ratio = asAreas ? `areas of ${As} cm² and ${Al} cm²` : `areas in the ratio ${As} : ${Al}`
    const prompt = `Two similar ${things} have ${ratio}. A side of the ${up ? 'smaller' : 'larger'} is ${given} cm. What is the matching side of the ${up ? 'larger' : 'smaller'}, in cm?`
    const simplify = asAreas ? `$${As} : ${Al} = ${m * m} : ${n * n}$, and ` : ''
    const frac = up ? (m === 1 ? `${n}` : `\\tfrac{${n}}{${m}}`) : `\\tfrac{${m}}{${n}}`
    const solution = `${simplify}$\\sqrt{${m * m}} : \\sqrt{${n * n}} = ${m} : ${n}$, so the side is $${given} \\times ${frac} = ${answer}$ cm. Using the area ratio itself would scale the side by the square of the right factor.`
    // Second route: the two sides squared must be in the ratio of the areas.
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['square roots the area ratio', 'applies the length scale factor'], `${answer} cm`), answer, tolerance: 0, units: 'cm' },
      check: { agrees: (up ? given * given * Al === answer * answer * As : answer * answer * Al === given * given * As), detail: `${given}² : ${answer}² against ${As} : ${Al}` },
      values: { direction: up ? 'up' : 'down', m, n, t, asAreas: asAreas ? 'areas' : 'ratio' },
    }
  },
}

// ---------------------------------------------------------------- similarity and linear scale factors

const SLSF = 'similarity-and-linear-scale-factors'

const SHAPES = ['triangles', 'rectangles', 'pentagons', 'kites', 'parallelograms', 'trapeziums']

/**
 * The linear scale factor: written as q4 (matching sides 4 and 12, 1 mark) and q2 (a 6, 8, 10
 * triangle enlarged to 9, 12, 15), both on the core sheet. The second route divides every
 * pair of matching sides and finds the same factor each time.
 */
export const linearScaleFactor: Generator = {
  id: 'linear-scale-factor',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q2', 'q4'],
  build(r, slot): Draft {
    if (slot.id === 'q4') {
      const { s, k } = draw(r, (r) => ({ s: int(r, 2, 15), k: r() < 0.75 ? int(r, 2, 6) : pick(r, [1.5, 2.5]) }), ({ s, k }) => Number.isInteger(s * k) && s * k <= 60)
      const big = clean(s * k)
      const shapes = pick(r, SHAPES)
      return {
        question: {
          type: 'numeric',
          prompt: `Two similar ${shapes} have matching sides of ${s} cm and ${big} cm. What is the scale factor from the small one to the large one?`,
          solution: `Divide the large side by the small one: $${big} \\div ${s} = ${show(k)}$.`,
          markScheme: scheme(slot, [], show(k)),
          answer: k,
          tolerance: 0,
        },
        check: { agrees: near(s * k, big), detail: `${s} × ${show(k)} = ${show(big)}` },
        values: { s, k, shapes },
      }
    }
    const { sides, k } = draw(
      r,
      (r) => {
        const a = int(r, 2, 12)
        const b = int(r, a + 1, a + 8)
        const c = int(r, b + 1, a + b - 1)
        return { sides: [a, b, c], k: pick(r, [1.5, 2, 2.5, 3, 4, 0.5, 1.25]) }
      },
      ({ sides, k }) => sides[2]! < sides[0]! + sides[1]! && sides[2]! > sides[1]! && sides.every((x) => places(x * k, 1)),
    )
    const image = sides.map((x) => clean(x * k))
    const verb = k > 1 ? 'enlarged' : 'reduced'
    const [first, ...rest] = sides.map((x, i) => [x, image[i]!] as const)
    // Second route: each pair of matching sides divided on its own.
    const ratios = sides.map((x, i) => image[i]! / x)
    return {
      question: {
        type: 'numeric',
        prompt: `A triangle with sides ${sides.slice(0, 2).join(', ')} and ${sides[2]} cm is ${verb} to one with sides ${image.slice(0, 2).map(show).join(', ')} and ${show(image[2]!)} cm. What is the linear scale factor?`,
        solution: `$${show(first![1])} \\div ${first![0]} = ${show(k)}$, and ${rest.map(([x, y]) => `${show(y)} ÷ ${x}`).join(' and ')} give ${show(k)} as well.${k < 1 ? ' A reduction has a scale factor less than 1.' : ''}`,
        markScheme: scheme(slot, ['divides matching sides'], show(k)),
        answer: k,
        tolerance: 0,
      },
      check: { agrees: ratios.every((q) => near(q, k)), detail: `matching sides: ${ratios.map((q) => show(roundTo(q, 6))).join(', ')}` },
      values: { sides: sides.join(','), k },
    }
  },
}

/** Reductions as a fraction p/q < 1, in lowest terms. */
const REDUCTIONS: [number, number][] = [[3, 4], [2, 3], [1, 2], [2, 5], [3, 5], [4, 5], [5, 6], [1, 3], [1, 4], [5, 8], [3, 8]]
const REDUCED = ['A shape is reduced', 'A photograph is reduced', 'A plan is reduced on a photocopier', 'A logo is reduced', 'A drawing is reduced']

/**
 * A missing side of a similar shape: written as q5 (sides 5 and 15, so 7 becomes 21), q6 (a
 * reduction, 12 becomes 9, so 16 becomes 12) and q8 (8 and 20, so 6 becomes 15, a factor of
 * 2.5), all on the higher sheet. Each slot keeps its own kind of factor. The second route is
 * the ratio within one shape: the unknown over the other side must equal the matching
 * ratio in the other shape, cross-multiplied in whole numbers.
 */
export const similarMissingSide: Generator = {
  id: 'similar-missing-side',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q5', 'q6', 'q8'],
  build(r, slot): Draft {
    if (slot.id === 'q6') {
      const [p, q] = pick(r, REDUCTIONS)
      const { t, u } = draw(r, (r) => ({ t: int(r, 1, 10), u: int(r, 1, 10) }), ({ t, u }) => t !== u && q * t <= 60 && q * u <= 60 && q * t >= 4)
      const [from, to, other, answer] = [q * t, p * t, q * u, p * u]
      const lead = pick(r, REDUCED)
      return {
        question: {
          type: 'numeric',
          prompt: `${lead} so a side of ${from} cm becomes ${to} cm. Another side is ${other} cm. What does it become, in cm?`,
          solution: `The scale factor is $\\dfrac{${to}}{${from}} = \\dfrac{${p}}{${q}}$, so $${other} \\times \\dfrac{${p}}{${q}} = ${answer}$ cm. It is a reduction, so the answer must be smaller than ${other}.`,
          markScheme: scheme(slot, [`scale factor of ${p}/${q}`], String(answer)),
          answer,
          tolerance: 0,
          units: 'cm',
        },
        check: { agrees: answer * from === other * to && answer < other, detail: `within the shape: ${answer}/${other} = ${to}/${from}` },
        values: { p, q, from, other },
      }
    }
    const decimal = slot.id === 'q8'
    const shapes = pick(r, SHAPES)
    const { s1, k, s2, toSmall } = draw(
      r,
      (r) => ({
        s1: int(r, 2, 12),
        k: decimal ? pick(r, [1.5, 2.5, 1.25, 3.5, 1.2, 1.75]) : int(r, 2, 5),
        s2: int(r, 2, 15),
        toSmall: !decimal && r() < 0.3,
      }),
      ({ s1, k, s2 }) => s1 !== s2 && Number.isInteger(s1 * k) && places(s2 * k, 1) && (decimal ? !Number.isInteger(k) : true),
    )
    const L1 = s1 * k
    const L2 = clean(s2 * k)
    const answer = toSmall ? s2 : L2
    let prompt: string, solution: string
    if (decimal) {
      prompt = `Two similar ${shapes} have sides of ${s1} cm and ${L1} cm as a matching pair. A side of ${s2} cm on the small ${shapes.replace(/s$/, '')} matches which length on the large one, in cm?`
      solution = `The scale factor is $${L1} \\div ${s1} = ${show(k)}$, so $${s2} \\times ${show(k)} = ${show(L2)}$ cm.`
    } else if (toSmall) {
      prompt = `Two similar ${shapes} have matching sides of ${s1} cm and ${L1} cm. A second side on the large one is ${show(L2)} cm. What is the matching side on the small one, in cm?`
      solution = `The scale factor from small to large is $${L1} \\div ${s1} = ${k}$, so going back to the small one divides: $${show(L2)} \\div ${k} = ${s2}$ cm.`
    } else {
      prompt = `Two similar ${shapes} have matching sides of ${s1} cm and ${L1} cm. A second side on the small one is ${s2} cm. What is the matching side on the large one, in cm?`
      solution = `The scale factor is $${L1} \\div ${s1} = ${k}$, so $${s2} \\times ${k} = ${show(L2)}$ cm.`
    }
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`scale factor of ${show(k)}`], show(answer)), answer, tolerance: 0, units: 'cm' },
      check: { agrees: near(L2 * s1, s2 * L1), detail: `within the shapes: ${s2}/${s1} = ${show(L2)}/${show(L1)}` },
      values: { s1, k, s2, direction: toSmall ? 'to small' : 'to large' },
    }
  },
}

/**
 * A side of the big triangle from a line parallel to its base: written as q11 (the line 4 cm
 * from the apex, the base 10 cm, a side of 6 becomes 15). Sometimes the line's distance is
 * given from the base, so the two must be added first; sometimes the small side is asked.
 * The second route cross-multiplies the side ratio against the distance ratio.
 */
export const parallelLineTriangle: Generator = {
  id: 'parallel-line-triangle',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q11'],
  build(r, slot): Draft {
    const fromBase = r() < 0.4
    const toSmall = r() < 0.3
    const { d1, d2, s } = draw(
      r,
      (r) => {
        const d1 = int(r, 2, 12)
        return { d1, d2: int(r, d1 + 1, d1 + 15), s: int(r, 2, 20) }
      },
      ({ d1, d2, s }) => places(d2 / d1, 2) && places((toSmall ? s * d1 / d2 : s * d2 / d1), 1) && s * Math.max(d2 / d1, d1 / d2) <= 60,
    )
    const k = clean(d2 / d1)
    const answer = clean(toSmall ? (s * d1) / d2 : s * k)
    const gap = d2 - d1
    const distances = fromBase
      ? `The line is ${d1} cm from the apex and ${gap} cm from the base.`
      : `From the apex, that line is ${d1} cm away and the base is ${d2} cm away.`
    const prompt = `A triangle has a line parallel to its base, cutting off a small triangle at the apex. ${distances} A side of the ${toSmall ? 'large' : 'small'} triangle is ${s} cm. What is the matching side of the ${toSmall ? 'small' : 'large'} triangle, in cm?`
    const both = fromBase ? `The scale factor needs both distances measured from the apex: the base is $${d1} + ${gap} = ${d2}$ cm from it, not ${gap}. ` : 'Both distances are measured from the apex, so '
    const solution = `${both}the scale factor from small to large is $\\dfrac{${d2}}{${d1}} = ${show(k)}$ and ${toSmall ? `$${s} \\div ${show(k)} = ${show(answer)}$` : `$${s} \\times ${show(k)} = ${show(answer)}$`} cm.`
    const small = toSmall ? answer : s
    const large = toSmall ? s : answer
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [fromBase ? `apex to base is ${d1} + ${gap} = ${d2}` : 'both lengths from the apex', `scale factor of ${show(k)}`], show(answer)),
        answer,
        tolerance: 0,
        units: 'cm',
      },
      check: { agrees: near(large * d1, small * d2), detail: `${show(large)} × ${d1} = ${show(small)} × ${d2}` },
      values: { d1, d2, s, fromBase: fromBase ? 'base' : 'apex', direction: toSmall ? 'to small' : 'to large' },
    }
  },
}

/** Length factors with the factor each side must have for a whole area (k²) or volume (k³). */
const AREA_K: { k: number; f: number }[] = [{ k: 1.5, f: 2 }, { k: 2.5, f: 2 }, { k: 1.2, f: 5 }, { k: 2, f: 1 }, { k: 3, f: 1 }, { k: 3.5, f: 2 }]
const VOLUME_K: { k: number; f: number }[] = [{ k: 1.5, f: 2 }, { k: 2.5, f: 2 }, { k: 2, f: 1 }, { k: 3, f: 1 }, { k: 0.5, f: 2 }, { k: 1.2, f: 5 }]

/**
 * An area or a volume from the linear scale factor: written as q12 (k 1.5, area 20 becomes
 * 45) and q16 (k 1.5, volume 16 becomes 54), both 3 marks on the advanced sheet. Each slot
 * keeps its kind; sometimes the larger shape's figure is given and the smaller's asked. The
 * second route enlarges a rectangle or cuboid of that size side by side.
 */
export const similarAreaVolume: Generator = {
  id: 'similar-area-volume',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q12', 'q16'],
  build(r, slot): Draft {
    const volume = slot.id === 'q16'
    const power = volume ? 3 : 2
    const { k, f } = pick(r, volume ? VOLUME_K : AREA_K)
    const down = r() < 0.3 && k > 1
    const sides = box(r, power, f, volume ? (f === 5 ? 1000 : 500) : 300)
    const small = sides.reduce((a, b) => a * b, 1)
    const factor = clean(k ** power)
    const large = clean(small * factor)
    const answer = down ? small : large
    const unit = volume ? 'cm³' : 'cm²'
    const what = volume ? 'volume' : 'area'
    const things = pick(r, volume ? SIMILAR_SOLIDS : SIMILAR)
    const smaller = k > 1 ? 'smaller' : 'first'
    const larger = k > 1 ? 'larger' : 'second'
    const prompt = down
      ? `Two similar ${things} have a linear scale factor of ${show(k)} from the smaller to the larger. ${volume ? 'A volume' : 'An area'} of ${show(large)} ${unit} on the larger is what on the smaller, in ${unit}?`
      : k > 1
        ? `Two similar ${things} have a linear scale factor of ${show(k)}. ${volume ? 'A volume' : 'An area'} of ${small} ${unit} on the smaller becomes what, in ${unit}?`
        : `Two similar ${things} have a linear scale factor of ${show(k)} from the ${smaller} to the ${larger}. ${volume ? 'A volume' : 'An area'} of ${small} ${unit} on the ${smaller} becomes what on the ${larger}, in ${unit}?`
    const step1 = `The ${what} scale factor is $${show(k)}^${power} = ${show(factor)}$`
    const solution = down
      ? `${step1}, and going from the larger to the smaller divides: $${show(large)} \\div ${show(factor)} = ${show(small)}$ ${unit}.`
      : `${step1}, so $${small} \\times ${show(factor)} = ${show(large)}$ ${unit}.`
    const enlarged = clean(sides.reduce((a, s) => a * s * k, 1))
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [`${volume ? 'cubes' : 'squares'} the linear scale factor`, show(factor)], show(answer)),
        answer,
        tolerance: 0,
        units: unit,
      },
      check: { agrees: near(enlarged, large) && !near(small * k, large), detail: `${sides.join(' × ')} enlarged side by side: ${sides.map((s) => show(s * k)).join(' × ')} = ${show(enlarged)}` },
      values: { kind: what, k, power, small, direction: down ? 'down' : 'up' },
    }
  },
}

/**
 * A side ratio from an area ratio: written as q13 (areas 9 : 4, sides n : 2, so n = 3). The
 * unknown sits on either side, the areas may be given unsimplified, and the side ratio may
 * be a multiple. The second route squares the side ratio back to the areas.
 */
export const sideRatioFromArea: Generator = {
  id: 'side-ratio-from-area',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q13'],
  build(r, slot): Draft {
    const { a, b, c, j } = draw(
      r,
      (r) => ({ a: int(r, 1, 7), b: int(r, 1, 7), c: r() < 0.35 ? int(r, 2, 5) : 1, j: r() < 0.35 ? int(r, 2, 4) : 1 }),
      ({ a, b, j }) => a !== b && gcd(a, b) === 1 && a * j >= 2 && b * j >= 2,
    )
    const left = r() < 0.5
    const A1 = c * a * a
    const A2 = c * b * b
    const answer = (left ? a : b) * j
    const known = (left ? b : a) * j
    const sides = left ? `$n$ : ${known}` : `${known} : $n$`
    const things = pick(r, ['triangles', 'shapes', 'pentagons', 'rectangles'])
    const simplify = c > 1 ? `$${A1} : ${A2} = ${a * a} : ${b * b}$. ` : ''
    const scaleUp = j > 1 ? `, which is $${a * j} : ${b * j}$` : ''
    const solution = `${simplify}The linear ratio is the square root of the area ratio: $\\sqrt{${a * a}} : \\sqrt{${b * b}} = ${a} : ${b}$${scaleUp}, so $n = ${answer}$.`
    return {
      question: {
        type: 'numeric',
        prompt: `Two similar ${things} have areas in the ratio ${A1} : ${A2}. Their sides are in the ratio ${sides}. Find $n$.`,
        solution,
        markScheme: scheme(slot, ['square roots the area ratio', `√${a * a} : √${b * b}`], String(answer)),
        answer,
        tolerance: 0,
      },
      check: { agrees: left ? answer * answer * A2 === known * known * A1 : known * known * A2 === answer * answer * A1, detail: `squared sides against ${A1} : ${A2}` },
      values: { a, b, c, j, unknown: left ? 'left' : 'right' },
    }
  },
}

/**
 * A height from two volumes: written as q14 (54 and 16 cm³, the larger 9 cm tall, so the
 * smaller is 6). Sometimes the smaller's height is given and the larger's asked. The second
 * route cubes the two heights and compares them with the volumes, in whole numbers.
 */
export const heightFromVolumes: Generator = {
  id: 'height-from-volumes',
  subjectId: 'maths',
  topicId: SLSF,
  replaces: ['q14'],
  build(r, slot): Draft {
    const toSmall = r() < 0.6
    const { m, n, c, t } = draw(
      r,
      (r) => {
        const [n, m] = pick(r, COPRIME.filter(([, x]) => x <= 5))
        return { m, n, c: int(r, 1, 10), t: int(r, 1, 6) }
      },
      ({ m, n, c, t }) => c * m ** 3 <= 2500 && m * t <= 40 && n * t >= 2,
    )
    const Vl = c * m ** 3
    const Vs = c * n ** 3
    const Hl = m * t
    const Hs = n * t
    const things = pick(r, ['solids', 'vases', 'bottles', 'statues', 'cones', 'candles'])
    const answer = toSmall ? Hs : Hl
    const prompt = toSmall
      ? `Two similar ${things} have volumes ${Vl} cm³ and ${Vs} cm³. The larger has a height of ${Hl} cm. What is the height of the smaller, in cm?`
      : `Two similar ${things} have volumes ${Vs} cm³ and ${Vl} cm³. The smaller has a height of ${Hs} cm. What is the height of the larger, in cm?`
    const over = (a: number, b: number) => (b === 1 ? `${a}` : `\\dfrac{${a}}{${b}}`)
    const ratio = `$\\dfrac{${Vl}}{${Vs}} = ${over(m ** 3, n ** 3)}$, whose cube root is $${over(m, n)}$.`
    const solution = toSmall
      ? `${ratio} So the smaller height is $${Hl} \\div ${over(m, n)} = ${Hs}$ cm.`
      : `${ratio} So the larger height is $${Hs} \\times ${over(m, n)} = ${Hl}$ cm.`
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, ['cube roots the volume ratio', `linear ratio of ${m} : ${n}`], `${answer}`), answer, tolerance: 0, units: 'cm' },
      check: { agrees: Hl ** 3 * Vs === Hs ** 3 * Vl, detail: `${Hl}³ × ${Vs} = ${Hs}³ × ${Vl}` },
      values: { m, n, c, t, direction: toSmall ? 'to small' : 'to large' },
    }
  },
}

// ---------------------------------------------------------------- congruency

const LETTERS: [string[], string[]][] = [
  [['A', 'B', 'C'], ['P', 'Q', 'R']],
  [['D', 'E', 'F'], ['X', 'Y', 'Z']],
  [['L', 'M', 'N'], ['X', 'Y', 'Z']],
  [['A', 'B', 'C'], ['D', 'E', 'F']],
  [['J', 'K', 'L'], ['P', 'Q', 'R']],
  [['F', 'G', 'H'], ['U', 'V', 'W']],
]

/** A matching of one triangle's vertices to another's, not always in alphabetical order. */
function matching(r: Rng): { from: string[]; to: string[]; map: Map<string, string> } {
  const [from, names] = pick(r, LETTERS)
  const to = shuffle(r, names)
  return { from, to, map: new Map(from.map((v, i) => [v, to[i]!])) }
}

/** The vertex two sides share: AB and AC meet at A. */
const shared = (s: string, t: string) => [...s].find((ch) => t.includes(ch))!

/**
 * The angle matching the missing one in a congruent triangle: written as q7 (AB = PQ, BC = QR,
 * AC = PR; A 48°, B 71°, find R). The matching is not always in alphabetical order, so it
 * must be read from the equal sides. The second route finds the matching vertex as the one
 * shared by the two matching sides, and the angle from the other triangle's angles.
 */
export const congruentAngle: Generator = {
  id: 'congruent-angle',
  subjectId: 'maths',
  topicId: 'congruency',
  replaces: ['q7'],
  build(r, slot): Draft {
    const { from, map } = matching(r)
    const [X, Y, Z] = from as [string, string, string]
    const angles = draw(r, (r) => [int(r, 25, 110), int(r, 25, 110)], ([a, b]) => a !== b && a! + b! <= 155 && 180 - a! - b! !== a && 180 - a! - b! !== b)
    const [a, b] = angles as [number, number]
    const c = 180 - a - b
    // Which vertex is unknown varies: the two given are the others.
    const order = shuffle(r, [0, 1, 2])
    const verts = order.map((i) => from[i]!)
    const value: Record<string, number> = { [X]: a, [Y]: b, [Z]: c }
    const [g1, g2, missing] = verts as [string, string, string]
    const target = map.get(missing)!
    const sides = [[X, Y], [Y, Z], [X, Z]].map(([p, q]) => `$${p}${q} = ${map.get(p!)}${map.get(q!)}$`)
    const prompt = `Triangles $${from.join('')}$ and $${[...map.values()].sort().join('')}$ are congruent with ${sides[0]}, ${sides[1]} and ${sides[2]}. Angle $${g1} = ${value[g1]}°$ and angle $${g2} = ${value[g2]}°$. Work out angle $${target}$.`
    const [s1, s2] = [[X, Y], [Y, Z], [X, Z]].filter((pair) => pair.includes(missing))
    const m1 = `${map.get(s1![0]!)}${map.get(s1![1]!)}`
    const m2 = `${map.get(s2![0]!)}${map.get(s2![1]!)}`
    const answer = value[missing]!
    const solution = `$${target}$ corresponds to $${missing}$: $${missing}$ is where $${s1!.join('')}$ and $${s2!.join('')}$ meet, and $${target}$ is where the matching sides $${m1}$ and $${m2}$ meet. Angle $${missing} = 180 - ${value[g1]} - ${value[g2]} = ${answer}°$, so angle $${target} = ${answer}°$.`
    // Second route: the matching vertex as the letter the two matching sides share, and the
    // angle read from the image triangle, whose angles are the same three.
    const viaSides = shared(m1, m2)
    const image: Record<string, number> = Object.fromEntries(from.map((v) => [map.get(v)!, value[v]!]))
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [`matches $${target}$ with $${missing}$ or finds the third angle`], `${answer}°`), answer, tolerance: 0 },
      check: { agrees: viaSides === target && image[viaSides] === answer && a + b + c === 180, detail: `${m1} and ${m2} meet at ${viaSides}, angle ${image[viaSides]}` },
      values: { letters: from.join('') + [...map.values()].join(''), missing, answer },
    }
  },
}

/**
 * Which side matches: written as q8 (LMN to XYZ, L → X, M → Y, N → Z; MN is 9 cm, so YZ). The
 * matching is shuffled, so it must be read from the arrows. Accepted: the side's letters in
 * either order, as written. The second route finds the side opposite the matching vertex.
 */
export const congruentSide: Generator = {
  id: 'congruent-side',
  subjectId: 'maths',
  topicId: 'congruency',
  replaces: ['q8'],
  build(r, slot): Draft {
    const { from, to, map } = matching(r)
    const pairs: [number, number][] = [[0, 1], [1, 2], [0, 2]]
    const [i, j] = pick(r, pairs)
    const p = from[i]!, q = from[j]!
    const length = int(r, 3, 15)
    const answer = `${map.get(p)}${map.get(q)}`
    const other = `${map.get(q)}${map.get(p)}`
    const arrows = from.map((v) => `$${v} \\to ${map.get(v)}$`).join(', ')
    const imageName = [...to].sort().join('')
    // Second route: the side is opposite the vertex not on it; its match is opposite that vertex's image.
    const opposite = from.find((v) => v !== p && v !== q)!
    const viaOpposite = to.filter((v) => v !== map.get(opposite)).sort().join('')
    return {
      question: {
        type: 'short-text',
        prompt: `Triangle $${from.join('')}$ is congruent to triangle $${imageName}$, with ${arrows}. $${p}${q} = ${length}$ cm. Which side of $${imageName}$ is ${length} cm?`,
        solution: `$${p} \\to ${map.get(p)}$ and $${q} \\to ${map.get(q)}$, so $${p}${q}$ corresponds to $${answer}$.`,
        markScheme: scheme(slot, [], `$${answer}$`),
        accepted: [answer, other],
      },
      check: { agrees: viaOpposite === [...answer].sort().join(''), detail: `${p}${q} is opposite ${opposite}, which maps to ${map.get(opposite)}; the side opposite that is ${viaOpposite}` },
      values: { letters: from.join('') + to.join(''), side: `${p}${q}`, length },
    }
  },
}

const RIGHT_TRIPLES: [number, number, number][] = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [12, 35, 37]]

/**
 * A side from RHS congruence: written as q12 (PQ 8, QR 6, right angle at Q; XYZ has XZ 10,
 * YZ 6, right angle at Y; find XY = 8). The hypotenuse comes by Pythagoras, then RHS gives
 * the matching side. Which leg is given in the second triangle varies. The second route is
 * Pythagoras in the second triangle itself.
 */
export const congruentRhs: Generator = {
  id: 'congruent-rhs',
  subjectId: 'maths',
  topicId: 'congruency',
  replaces: ['q12'],
  build(r, slot): Draft {
    const [x, y, z] = pick(r, RIGHT_TRIPLES)
    const k = draw(r, (r) => int(r, 1, 4), (k) => k * z <= 60)
    const flip = r() < 0.5
    const a = k * (flip ? y : x) // PQ
    const b = k * (flip ? x : y) // QR
    const c = k * z
    const [[P, Q, R], [X, Y, Z]] = pick(r, LETTERS) as [[string, string, string], [string, string, string]]
    // In the second triangle, the given leg matches QR (so XY matches PQ) or PQ (so XY matches QR).
    const givenMatchesQR = r() < 0.6
    const givenLeg = givenMatchesQR ? b : a
    const answer = givenMatchesQR ? a : b
    const matchName = givenMatchesQR ? `${P}${Q}` : `${Q}${R}`
    const prompt = `Triangle $${P}${Q}${R}$ has $${P}${Q} = ${a}$ cm, $${Q}${R} = ${b}$ cm and angle $${P}${Q}${R} = 90°$. Triangle $${X}${Y}${Z}$ has $${X}${Z} = ${c}$ cm, $${Y}${Z} = ${givenLeg}$ cm and angle $${X}${Y}${Z} = 90°$. The triangles are congruent. Work out the length of $${X}${Y}$ in cm.`
    const solution = `In $${P}${Q}${R}$ the hypotenuse is $${P}${R} = \\sqrt{${a}^2 + ${b}^2} = ${c}$ cm. $${X}${Y}${Z}$ has hypotenuse $${X}${Z} = ${c}$ and side $${Y}${Z} = ${givenLeg}$, which matches $${givenMatchesQR ? `${Q}${R}` : `${P}${Q}`}$, so it matches by RHS and $${X}${Y}$ corresponds to $${matchName} = ${answer}$ cm.`
    return {
      question: {
        type: 'numeric',
        prompt,
        solution,
        markScheme: scheme(slot, [`$${P}${R} = ${c}$ by Pythagoras`, `RHS identified, $${X}${Y}$ corresponds to $${matchName}$`], `${answer} cm`),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(Math.sqrt(c * c - givenLeg * givenLeg), answer) && a * a + b * b === c * c, detail: `in ${X}${Y}${Z}: √(${c}² − ${givenLeg}²) = ${show(Math.sqrt(c * c - givenLeg * givenLeg))}` },
      values: { a, b, c, given: givenMatchesQR ? 'QR' : 'PQ' },
    }
  },
}

// ---------------------------------------------------------------- transformations

/** A coordinate pair as the content prints it, (7, 3), and as the accepted answer, (7,3). */
const point = (x: number, y: number) => `(${show(x)}, ${show(y)})`
const typed = (x: number, y: number) => `(${show(x)},${show(y)})`
const across = (d: number) => (d > 0 ? `${show(d)} right` : d < 0 ? `${show(-d)} left` : '0 across')
const upDown = (d: number) => (d > 0 ? `${show(d)} up` : d < 0 ? `${show(-d)} down` : '0 up')
const SCALE_WORD: Record<string, string> = { 2: 'Doubling', 3: 'Trebling', 4: 'Multiplying by 4', 0.5: 'Halving' }

/**
 * One point moved: written as q3 (translate (4, 1) by (3, 2)), q7 (enlarge (4, 1) by 2 from
 * the origin) and q12 (enlarge (4, 1) by 2 from (1, 1), grade 8-9). Each slot keeps its
 * transformation. The second route undoes it: the image moved back, or shrunk back towards
 * the centre, must land on the starting point.
 */
export const transformAPoint: Generator = {
  id: 'transform-a-point',
  subjectId: 'maths',
  topicId: 'transformations',
  replaces: ['q3', 'q7', 'q12'],
  build(r, slot): Draft {
    if (slot.id === 'q3') {
      const { x, y, p, q } = draw(r, (r) => ({ x: int(r, -6, 9), y: int(r, -6, 9), p: int(r, -6, 6), q: int(r, -6, 6) }), ({ p, q }) => p !== 0 || q !== 0)
      const [ix, iy] = [x + p, y + q]
      const step = (d: number, axis: string) => (d >= 0 ? `add $${d}$ to the $${axis}$ coordinate` : `subtract $${-d}$ from the $${axis}$ coordinate`)
      const text = `${step(p, 'x')} and ${step(q, 'y')}`
      return {
        question: {
          type: 'short-text',
          prompt: `The point $${point(x, y)}$ is translated by $\\begin{pmatrix} ${p} \\\\ ${q} \\end{pmatrix}$. Give the coordinates of the image.`,
          solution: `${text[0]!.toUpperCase()}${text.slice(1)}: $${point(ix, iy)}$.`,
          markScheme: scheme(slot, [], typed(ix, iy)),
          accepted: [typed(ix, iy)],
        },
        check: { agrees: ix - p === x && iy - q === y, detail: `moved back by (${-p}, ${-q}) lands on (${ix - p}, ${iy - q})` },
        values: { kind: 'translation', x, y, p, q },
      }
    }
    const origin = slot.id === 'q7'
    const { k, cx, cy, dx, dy } = draw(
      r,
      (r) => {
        const k = pick(r, origin ? [2, 2, 3, 3, 4, 0.5] : [2, 2, 3, 3, 0.5])
        return { k, cx: origin ? 0 : int(r, -3, 4), cy: origin ? 0 : int(r, -3, 4), dx: int(r, -5, 6), dy: int(r, -5, 6) }
      },
      ({ k, cx, cy, dx, dy }) => (dx !== 0 || dy !== 0) && (origin || cx !== 0 || cy !== 0) && (k !== 0.5 || (dx % 2 === 0 && dy % 2 === 0)),
    )
    const [x, y] = [cx + dx, cy + dy]
    const [ix, iy] = [cx + k * dx, cy + k * dy]
    // Second route: shrink the image back towards the centre by the reciprocal factor.
    const [bx, by] = [cx + (ix - cx) / k, cy + (iy - cy) / k]
    if (origin) {
      return {
        question: {
          type: 'short-text',
          prompt: `The point $${point(x, y)}$ is enlarged by scale factor ${show(k)}, centre the origin. Give the coordinates of the image.`,
          solution: `With the centre at the origin, multiply both coordinates by the scale factor: $${point(ix, iy)}$.`,
          markScheme: scheme(slot, [], typed(ix, iy)),
          accepted: [typed(ix, iy)],
        },
        check: { agrees: near(bx, x) && near(by, y), detail: `scaled back by 1/${show(k)}: (${show(bx)}, ${show(by)})` },
        values: { kind: 'enlargement from the origin', x, y, k },
      }
    }
    const word = SCALE_WORD[String(k)]!
    const wrong = [k * x, k * y]
    return {
      question: {
        type: 'short-text',
        prompt: `Triangle $A$ has a vertex at $${point(x, y)}$. It is enlarged by scale factor ${show(k)} with centre $${point(cx, cy)}$. Give the coordinates of the image of that vertex.`,
        solution: `Measure from the **centre**, not the origin. The vertex is ${across(dx)} and ${upDown(dy)} from $${point(cx, cy)}$. ${word} gives ${across(k * dx)} and ${upDown(k * dy)}, so the image is at $(${cx} + ${show(k * dx)}, ${cy} + ${show(k * dy)}) = ${point(ix, iy)}$.`.replace(/\+ -/g, '- '),
        markScheme: scheme(slot, [`measures ${across(dx)} and ${upDown(dy)} from the centre and ${word.toLowerCase().replace(/ing\b/, 'es').replace('multiplyes', 'multiplies')} it`], typed(ix, iy)),
        accepted: [typed(ix, iy)],
      },
      check: { agrees: near(bx, x) && near(by, y) && (wrong[0] !== ix || wrong[1] !== iy), detail: `scaled back towards (${cx}, ${cy}) by 1/${show(k)}: (${show(bx)}, ${show(by)}); from the origin it would be (${wrong.map(show).join(', ')})` },
      values: { kind: 'enlargement from a centre', x, y, k, cx, cy },
    }
  },
}

// ---------------------------------------------------------------- constructing triangles

const CT = 'constructing-triangles'
const TRIANGLE_NAMES = [['A', 'B', 'C'], ['D', 'E', 'F'], ['P', 'Q', 'R'], ['X', 'Y', 'Z'], ['L', 'M', 'N'], ['K', 'L', 'M']]

/**
 * The third angle of a triangle: written as q5 (A 50°, B 60°, so C 70°). Which angle is
 * missing varies. The second route goes through the exterior angle at the missing vertex,
 * which equals the two given angles added.
 */
export const thirdAngle: Generator = {
  id: 'triangle-third-angle',
  subjectId: 'maths',
  topicId: CT,
  replaces: ['q5'],
  build(r, slot): Draft {
    const names = pick(r, TRIANGLE_NAMES)
    const [g1, g2, m] = shuffle(r, names) as [string, string, string]
    const { a, b } = draw(r, (r) => ({ a: int(r, 20, 120), b: int(r, 20, 120) }), ({ a, b }) => a + b <= 160)
    const answer = 180 - a - b
    const [first, second] = [g1, g2].sort()
    const [va, vb] = first === g1 ? [a, b] : [b, a]
    const exterior = va + vb
    return {
      question: {
        type: 'numeric',
        prompt: `In triangle $${names.join('')}$, angle $${first} = ${va}°$ and angle $${second} = ${vb}°$. Work out angle $${m}$.`,
        solution: `Angles in a triangle add to $180°$: $180 - ${va} - ${vb} = ${answer}°$.`,
        markScheme: scheme(slot, [], `${answer}°`),
        answer,
        tolerance: 0,
      },
      check: { agrees: 180 - exterior === answer && answer > 0, detail: `the exterior angle at ${m} is ${va} + ${vb} = ${exterior}, so ${m} = 180 − ${exterior}` },
      values: { missing: m, a: va, b: vb },
    }
  },
}

const PLOTS = ['A triangular garden', 'A triangular field', 'A triangular playground', 'A triangular car park', 'A triangular plot of land', 'A triangular patio']

/**
 * A length from a scale drawing: written as q7 (1 cm to 2 m, 4.5 cm drawn, so 9 m). Sometimes
 * the real length is given and the drawing asked. The second route goes through centimetres:
 * the drawn length times the scale's centimetres, then back to metres.
 */
export const scaleDrawingLength: Generator = {
  id: 'scale-drawing-length',
  subjectId: 'maths',
  topicId: CT,
  replaces: ['q7'],
  build(r, slot): Draft {
    const n = pick(r, [2, 4, 5, 10, 20, 25, 50])
    const drawn = int(r, 3, 24) / 2
    const real = clean(drawn * n)
    const toReal = r() < 0.7
    const plot = pick(r, PLOTS)
    const answer = toReal ? real : drawn
    const prompt = toReal
      ? `A scale drawing uses 1 cm to represent ${n} m. ${plot} has one side drawn ${show(drawn)} cm long. How long is that side in real life, in metres?`
      : `A scale drawing uses 1 cm to represent ${n} m. ${plot} has a side ${show(real)} m long in real life. How long is that side on the drawing, in centimetres?`
    const solution = toReal ? `$${show(drawn)} \\times ${n} = ${show(real)}$ m.` : `Each ${n} m is 1 cm, so $${show(real)} \\div ${n} = ${show(drawn)}$ cm.`
    // Second route: in centimetres throughout. 1 cm on the drawing is n × 100 cm.
    const viaCm = toReal ? (drawn * n * 100) / 100 : (real * 100) / (n * 100)
    return {
      question: { type: 'numeric', prompt, solution, markScheme: scheme(slot, [], `${show(answer)} ${toReal ? 'm' : 'cm'}`), answer, tolerance: 0, units: toReal ? 'm' : 'cm' },
      check: { agrees: near(viaCm, answer), detail: `in centimetres: 1 cm stands for ${n * 100} cm, giving ${show(viaCm)}` },
      values: { n, drawn, direction: toReal ? 'to real' : 'to drawing' },
    }
  },
}

/**
 * The area of a triangle given by three sides that make a right angle: written as q13 (XY 10,
 * XZ 6, YZ 8, so 24 cm², grade 8-9). Pythagoras' converse finds the right angle; the sides
 * come in any order. The second route is Heron's formula, which needs no right angle.
 */
export const rightTriangleArea: Generator = {
  id: 'right-triangle-area',
  subjectId: 'maths',
  topicId: CT,
  replaces: ['q13'],
  build(r, slot): Draft {
    const [x, y, z] = pick(r, RIGHT_TRIPLES.slice(0, 5))
    const k = draw(r, (r) => int(r, 1, 4), (k) => k * z <= 50)
    const legs = [k * x, k * y]
    const hyp = k * z
    const names = pick(r, TRIANGLE_NAMES) as [string, string, string]
    // The right angle sits at a random vertex: the hypotenuse is the side opposite it.
    const right = int(r, 0, 2)
    const R = names[right]!
    const others = names.filter((_, i) => i !== right) as [string, string]
    const [l1, l2] = shuffle(r, legs) as [number, number]
    const sideList = shuffle(r, [
      [`${others[0]}${others[1]}`, hyp],
      [`${others[0]}${R}`.split('').sort().join(''), l1],
      [`${others[1]}${R}`.split('').sort().join(''), l2],
    ] as [string, number][])
    const answer = (l1 * l2) / 2
    const s = (l1 + l2 + hyp) / 2
    const heron = Math.sqrt(s * (s - l1) * (s - l2) * (s - hyp))
    return {
      question: {
        type: 'numeric',
        prompt: `Triangle $${names.join('')}$ is constructed with ${sideList.map(([n, v], i) => `${i === 2 ? 'and ' : ''}$${n} = ${v}$ cm`).join(', ').replace(', and', ' and')}. Calculate its area in cm².`,
        solution: `$${l1}^2 + ${l2}^2 = ${l1 * l1 + l2 * l2} = ${hyp}^2$, so by the converse of Pythagoras the angle at $${R}$ is $90°$. The two shorter sides are the base and the perpendicular height: area $= \\tfrac{1}{2} \\times ${l1} \\times ${l2} = ${answer}$ cm².`,
        markScheme: scheme(slot, [`right angle at $${R}$ shown by Pythagoras`, `$\\frac{1}{2} \\times ${l1} \\times ${l2}$`], `${answer} cm²`),
        answer,
        tolerance: 0,
      },
      check: { agrees: near(heron, answer), detail: `Heron: s = ${show(s)}, area = ${show(roundTo(heron, 6))}` },
      values: { legs: `${l1},${l2}`, hyp, right: R },
    }
  },
}

export const similarityGenerators: Generator[] = [
  enlargedAreaVolume,
  scaleFromRatio,
  linearScaleFactor,
  similarMissingSide,
  parallelLineTriangle,
  similarAreaVolume,
  sideRatioFromArea,
  heightFromVolumes,
  congruentAngle,
  congruentSide,
  congruentRhs,
  transformAPoint,
  thirdAngle,
  scaleDrawingLength,
  rightTriangleArea,
]

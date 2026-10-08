import { clearOfHalf, fixed, roundTo, show } from '../format.ts'
import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Generator } from '../types.ts'

type Side = 'opposite' | 'adjacent' | 'hypotenuse'
type Ratio = 'sin' | 'cos' | 'tan'

const LETTER: Record<Side, string> = { opposite: 'O', adjacent: 'A', hypotenuse: 'H' }
const RULE: Record<Ratio, string> = { sin: 'SOH', cos: 'CAH', tan: 'TOA' }
/** Each ratio as top over bottom. */
const FRACTION: Record<Ratio, [Side, Side]> = { sin: ['opposite', 'hypotenuse'], cos: ['adjacent', 'hypotenuse'], tan: ['opposite', 'adjacent'] }
const RAD = Math.PI / 180
const fn = (ratio: Ratio, deg: number) => Math[ratio](deg * RAD)

/**
 * Every way of finding one side from another and an angle. With the unknown on top of the
 * ratio it is a multiplication; on the bottom, a division, the step students get wrong, which
 * is why the written 3-mark question (q5) gives a method mark for dividing.
 */
const CASES: { known: Side; want: Side; ratio: Ratio }[] = [
  { known: 'hypotenuse', want: 'opposite', ratio: 'sin' },
  { known: 'hypotenuse', want: 'adjacent', ratio: 'cos' },
  { known: 'adjacent', want: 'opposite', ratio: 'tan' },
  { known: 'opposite', want: 'hypotenuse', ratio: 'sin' },
  { known: 'adjacent', want: 'hypotenuse', ratio: 'cos' },
  { known: 'opposite', want: 'adjacent', ratio: 'tan' },
]
const onTop = (c: (typeof CASES)[number]) => FRACTION[c.ratio][0] === c.want

const NAME: Record<Side, string> = { opposite: 'the side opposite that angle', adjacent: 'the side adjacent to that angle', hypotenuse: 'the hypotenuse' }

function sidePrompt(known: Side, want: Side, k: string, deg: number, unit: string) {
  const ask = `Find ${NAME[want]}, in ${unit} to 2 decimal places.`
  if (known === 'hypotenuse') return `A right-angled triangle has hypotenuse ${k} ${unit} and an angle of ${deg}°. ${ask}`
  if (known === 'adjacent') return `A right-angled triangle has an angle of ${deg}° with an adjacent side of ${k} ${unit}. ${ask}`
  return `In a right-angled triangle, the side opposite an angle of ${deg}° is ${k} ${unit}. ${ask}`
}

/** All three sides from one side and the angle, worked by Pythagoras rather than by the ratio the question uses. */
function otherRoute(known: Side, k: number, deg: number): Record<Side, number> {
  if (known === 'hypotenuse') {
    const adjacent = k * fn('cos', deg)
    return { hypotenuse: k, adjacent, opposite: Math.sqrt(k * k - adjacent * adjacent) }
  }
  if (known === 'adjacent') {
    const hypotenuse = k / fn('cos', deg)
    return { adjacent: k, hypotenuse, opposite: Math.sqrt(hypotenuse * hypotenuse - k * k) }
  }
  const hypotenuse = k / fn('sin', deg)
  return { opposite: k, hypotenuse, adjacent: Math.sqrt(hypotenuse * hypotenuse - k * k) }
}

/**
 * A missing side: written as q3 (hypotenuse to opposite, 2 marks), q5 (opposite to
 * hypotenuse, 3 marks) and q6 (adjacent to opposite, 2 marks). A 2-mark slot gets one of the
 * three multiplying cases, a 3-mark slot one of the three dividing cases.
 */
export const trigFindingASide: Generator = {
  id: 'trig-finding-a-side',
  subjectId: 'maths',
  topicId: 'trigonometric-ratios',
  replaces: ['q3', 'q5', 'q6'],
  build(r, slot) {
    const c = pick(r, CASES.filter((x) => onTop(x) === (slot.marks < 3)))
    const unit = pick(r, ['cm', 'cm', 'm'])
    const { deg, k, exact } = draw(
      r,
      (r) => {
        const deg = int(r, 15, 75)
        const k = r() < 0.7 ? int(r, 3, 25) : int(r, 30, 250) / 10
        const exact = onTop(c) ? k * fn(c.ratio, deg) : k / fn(c.ratio, deg)
        return { deg, k, exact }
      },
      ({ exact }) => clearOfHalf(exact, 2) && exact >= 0.5 && exact <= 200,
    )
    const answer = roundTo(exact, 2)
    const [top, bottom] = FRACTION[c.ratio]
    const ks = show(k)
    const unknown = LETTER[c.want]
    const num = top === c.want ? unknown : ks
    const den = bottom === c.want ? unknown : ks
    const pair = `${LETTER[c.known]} and ${unknown}`.split(' and ').sort((x, y) => 'OAH'.indexOf(x) - 'OAH'.indexOf(y)).join(' and ')
    const fraction = `\\${c.ratio} ${deg}^\\circ = \\frac{${num}}{${den}}`
    let solution: string
    const method: string[] = []
    if (onTop(c)) {
      solution = `${pair} means **${RULE[c.ratio]}**: $${fraction}$. The unknown is on top, so multiply: $${unknown} = ${ks} \\${c.ratio} ${deg}^\\circ = ${fixed(exact, 2)}$ ${unit}.`
      method.push(`uses ${ks} ${c.ratio} ${deg}°`)
    } else {
      const wrong = k * fn(c.ratio, deg)
      const why = c.want === 'hypotenuse' ? `, shorter than the ${c.known} side and so impossible for a hypotenuse` : ''
      solution = `${pair} means **${RULE[c.ratio]}**: $${fraction}$. The unknown is on the **bottom**, so **divide**: $${unknown} = \\frac{${ks}}{\\${c.ratio} ${deg}^\\circ} = ${fixed(exact, 2)}$ ${unit}. Multiplying instead would give ${fixed(wrong, 2)} ${unit}${why}.`
      method.push(`forms ${c.ratio} ${deg}° = ${num}/${den}`, 'divides rather than multiplies')
    }
    const sides = otherRoute(c.known, k, deg)
    const longest = sides.hypotenuse > sides.opposite && sides.hypotenuse > sides.adjacent
    return {
      question: {
        type: 'numeric',
        prompt: sidePrompt(c.known, c.want, ks, deg, unit),
        solution,
        markScheme: scheme(slot, method, fixed(exact, 2)),
        answer,
        tolerance: 0.01,
        units: unit,
      },
      check: {
        agrees: roundTo(sides[c.want], 2) === answer && longest,
        detail: `Pythagoras with the third side: ${c.want} ${sides[c.want].toFixed(4)}; hypotenuse longest: ${longest}`,
      },
      values: { case: `${c.known} to ${c.want} by ${c.ratio}`, deg, k },
    }
  },
}

const INVERSE: Record<Ratio, (x: number) => number> = { sin: Math.asin, cos: Math.acos, tan: Math.atan }

/**
 * A missing angle from two sides: written as q7 (opposite and adjacent), q8 (hypotenuse and
 * opposite) and q10 (adjacent and hypotenuse), all 2 marks.
 */
export const trigFindingAnAngle: Generator = {
  id: 'trig-finding-an-angle',
  subjectId: 'maths',
  topicId: 'trigonometric-ratios',
  replaces: ['q7', 'q8', 'q10'],
  build(r, slot) {
    const ratio = pick(r, ['sin', 'cos', 'tan'] as const)
    const [top, bottom] = FRACTION[ratio]
    const { t, b, deg } = draw(
      r,
      (r) => {
        const b = int(r, 3, 20)
        const t = ratio === 'tan' ? int(r, 2, 20) : int(r, 2, b - 1)
        return { t, b, deg: INVERSE[ratio](t / b) / RAD }
      },
      ({ t, b, deg }) => t !== b && deg >= 10 && deg <= 80 && clearOfHalf(deg, 1),
    )
    const answer = roundTo(deg, 1)
    const unit = pick(r, ['cm', 'm'])
    const words: Record<Side, string> = { opposite: 'an opposite side', adjacent: 'an adjacent side', hypotenuse: 'a hypotenuse' }
    const given = pick(r, [[top, t, bottom, b], [bottom, b, top, t]] as const)
    // A terminating ratio is worth printing as a decimal; 5/13 is not.
    const decimal = Number.isInteger((t / b) * 10000) ? ` = ${show(t / b)}` : ''
    // Second route: the third side by Pythagoras, then a different inverse ratio.
    const third = ratio === 'tan' ? Math.hypot(t, b) : Math.sqrt(b * b - t * t)
    const other = ratio === 'tan' ? Math.asin(t / third) : ratio === 'sin' ? Math.atan(t / third) : Math.atan(third / t)
    return {
      question: {
        type: 'numeric',
        prompt: `A right-angled triangle has ${words[given[0]]} of ${given[1]} ${unit} and ${words[given[2]]} of ${given[3]} ${unit}. Find the angle, in degrees to 1 decimal place.`,
        solution: `**${RULE[ratio]}**: $\\${ratio}\\theta = \\frac{${t}}{${b}}${decimal}$, so $\\theta = \\${ratio}^{-1}\\left(\\frac{${t}}{${b}}\\right) = ${fixed(deg, 1)}^\\circ$.`,
        markScheme: scheme(slot, [`uses ${ratio}⁻¹`], fixed(deg, 1)),
        answer,
        tolerance: 0.1,
      },
      check: { agrees: roundTo(other / RAD, 1) === answer, detail: `third side ${third.toFixed(4)}, another inverse ratio: ${(other / RAD).toFixed(4)}°` },
      values: { ratio, [top]: t, [bottom]: b },
    }
  },
}

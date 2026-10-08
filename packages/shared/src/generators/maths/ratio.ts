import { draw, int, pick } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Generator } from '../types.ts'

const RATIOS: [number, number][] = [[2, 3], [3, 2], [3, 4], [4, 3], [3, 5], [5, 3], [2, 5], [5, 2], [4, 5], [5, 4], [2, 7], [7, 2], [3, 7], [7, 3], [5, 6], [6, 5], [4, 7], [7, 4], [5, 7], [7, 5]]
const PEOPLE: [string, string][] = [['Mo', 'Lily'], ['Priya', 'Tom'], ['Sam', 'Aisha'], ['Leo', 'Maya'], ['Jess', 'Omar'], ['Ella', 'Kofi'], ['Noah', 'Zara']]
const GROUPS = [
  { place: 'a class of', whole: 'students', names: ['boys', 'girls'], size: [24, 36] },
  { place: 'a club of', whole: 'members', names: ['adults', 'children'], size: [20, 90] },
  { place: 'a choir of', whole: 'singers', names: ['sopranos', 'altos'], size: [20, 60] },
  { place: 'a car park holding', whole: 'cars', names: ['red cars', 'cars of other colours'], size: [40, 200] },
] as const

/**
 * Sharing in a ratio: written as q2 (£120 between Mo and Lily, 5 : 3) and q5 (boys to girls
 * in a class of 32, 3 : 5). On one sheet the two slots get one kind each, in either order,
 * and either share is asked for.
 */
export const sharingInARatio: Generator = {
  id: 'sharing-in-a-ratio',
  subjectId: 'maths',
  topicId: 'ratio-notation-and-sharing',
  replaces: ['q2', 'q5'],
  build(r, slot, turn) {
    const [a, b] = pick(r, RATIOS)
    const parts = a + b
    const k = r() < 0.5 ? 1 : 0
    const ratio = [a, b]
    let part: number, prompt: string, last: (share: number[]) => string
    if (turn % 2 === 0) {
      const names = pick(r, PEOPLE)
      part = int(r, 3, 60)
      prompt = `Share £${part * parts} between ${names[0]} and ${names[1]} in the ratio ${a} : ${b}. How much does ${names[k]} get, in pounds?`
      last = (share) => `${names[k]} gets $${ratio[k]} \\times ${part} = ${share[k]}$, which is £${share[k]}, and ${names[1 - k]} gets £${share[1 - k]}.`
    } else {
      const g = pick(r, GROUPS)
      part = draw(r, (r) => int(r, 2, 40), (n) => n * parts >= g.size[0] && n * parts <= g.size[1])
      prompt = `In ${g.place} ${part * parts} ${g.whole}, the ratio of ${g.names[0]} to ${g.names[1]} is ${a} : ${b}. How many ${g.names[k]} are there?`
      last = (share) => `There are $${ratio[k]} \\times ${part} = ${share[k]}$ ${g.names[k]}, and ${share[1 - k]} ${g.names[1 - k]}.`
    }
    const total = part * parts
    const share = [part * a, part * b]
    const answer = share[k]!
    return {
      question: {
        type: 'numeric',
        prompt,
        solution: `There are $${a} + ${b} = ${parts}$ parts, so one part is $${total} \\div ${parts} = ${part}$. ${last(share)}`,
        markScheme: scheme(slot, [`${total} ÷ ${parts} = ${part}`], String(answer)),
        answer,
        tolerance: 0,
      },
      // The two shares must make the whole and stay in the ratio: a × share₂ = b × share₁.
      check: { agrees: share[0]! + share[1]! === total && share[0]! * b === share[1]! * a, detail: `${share[0]} + ${share[1]} = ${total}; ${share[0]} : ${share[1]} is ${a} : ${b}` },
      values: { a, b, part, asked: k ? 'second' : 'first' },
    }
  },
}

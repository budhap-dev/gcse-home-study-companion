import type { Question } from '../../content/questions.ts'
import { int, pick, shuffle, weighted, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, limits, numericDraft } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for 3.1.1, representing algorithms ("use a systematic
 * approach to problem solving and algorithm creation representing those algorithms using
 * pseudo-code, program code and flowcharts"), traced as the lesson's s4 traces its doubling loop.
 *
 * - q7: a WHILE loop that doubles (or triples) n while n is below a limit, then outputs n. The test
 *   comes before the body, so the loop stops at the first value at or above the limit, not the last
 *   one below it. The limit is never a value n takes, so the answer is never a printed figure, and
 *   the loop runs 2 to 8 times.
 * - q10: a total from 0, adding each of three or four small numbers in turn.
 *
 * q3 (how many exits a decision symbol has) stays written: it is a fact to recall, not a calculation.
 */


// ---------------------------------------------------------------------------------------------
// q7: a loop that multiplies until it reaches a limit
// ---------------------------------------------------------------------------------------------

/** Runs WHILE n < limit: n ← n × by, recording every value n takes. */
export function grow(start: number, by: number, limit: number) {
  const values = [start]
  let n = start
  while (n < limit) {
    n *= by
    values.push(n)
  }
  return { n, values, runs: values.length - 1 }
}


const VERB = { 2: 'doubles', 3: 'triples' } as const

const GROW_PROMPTS = [
  (v: string, s: number, verb: string, L: number) => `An algorithm sets ${v} to ${s} and ${verb} it while ${v} < ${L}, then outputs ${v}. What is output?`,
  (v: string, s: number, verb: string, L: number) => `An algorithm starts with ${v} = ${s}. While ${v} < ${L} it ${verb} ${v}, and after the loop it outputs ${v}. What is output?`,
  (v: string, s: number, verb: string, L: number) => `A WHILE loop ${verb} ${v} for as long as ${v} < ${L}. ${v} starts at ${s}, and the algorithm outputs ${v} once the loop ends. What is output?`,
]

/**
 * q7: 2 marks. Written: n from 1, doubling while n < 50, outputs 64. Doubling three times in four;
 * the start 1 to 9 and the number of passes (2 to 8 doubling, 2 to 5 tripling) drawn first, with
 * the output 16 to 1000, then a limit between the last two values.
 */
function growth(r: Rng, slot: Question): Draft {
  const by = r() < 0.75 ? 2 : 3
  const start = int(r, 1, 9)
  const most = Math.min(by === 2 ? 8 : 5, Math.floor(Math.log(1000 / start) / Math.log(by) + 1e-9))
  // At least two passes and an output of at least 16, so the trace has some length (2, 4, 8 in a
  // loop to 5 is over before it starts).
  let fewest = 2
  while (start * by ** fewest < 16) fewest++
  const runs = int(r, fewest, most)
  const answer = start * by ** runs
  const below = answer / by
  const limit = pick(r, limits(below, answer))
  const v = pick(r, ['n', 'n', 'x', 'k'])
  const verb = VERB[by]
  const t = grow(start, by, limit)
  const shown = t.values.join(', ')
  return numericDraft(
    slot,
    {
      prompt: pick(r, GROW_PROMPTS)(v, start, verb, limit),
      solution: `${v} takes ${shown}. At ${below} the condition ${below} < ${limit} is still true, so it ${by === 2 ? 'doubles' : 'triples'} again; at **${t.n}** it fails. The output is ${t.n}.`,
      method: [`traces past ${below}`],
      answer: t.n,
    },
    // Second route: the value built from the drawn number of passes, against the loop run.
    { agrees: t.n === answer && t.runs === runs, detail: `${start} × ${by}^${runs} = ${answer}; the loop ran ${t.runs} times` },
    { start, by, limit, runs, answer: t.n },
  )
}

// ---------------------------------------------------------------------------------------------
// q10: a running total
// ---------------------------------------------------------------------------------------------

const TOTAL_PROMPTS = [
  (v: string, xs: string) => `An algorithm sets ${v} to 0, then for each of the numbers ${xs} adds it to ${v}. What is ${v} at the end?`,
  (v: string, xs: string) => `Starting from ${v} = 0, an algorithm adds each of the numbers ${xs} to ${v} in turn. What is ${v} at the end?`,
  (v: string, xs: string) => `An algorithm sets ${v} ← 0 and then adds the numbers ${xs} to ${v} one at a time. What is ${v} at the end?`,
]

/** q10: 2 marks. Written: 3, 5 and 8 make 16. Three numbers (four one time in four), distinct, from 2 to 15. */
function total(r: Rng, slot: Question): Draft {
  const len = weighted(r, [[3, 3], [4, 1]] as const)
  const xs = shuffle(r, Array.from({ length: 14 }, (_, i) => i + 2)).slice(0, len)
  const v = pick(r, ['t', 't', 'total', 'sum'])
  const running = [0]
  for (const x of xs) running.push(running.at(-1)! + x)
  const answer = running.at(-1)!
  const steps = running.slice(1, -1).map((x) => `then ${x}`)
  return numericDraft(
    slot,
    {
      prompt: pick(r, TOTAL_PROMPTS)(v, andList(xs)),
      solution: `${v} goes 0, ${steps.join(', ')}, then **${answer}**. A trace table with one row per addition makes this immediate.`,
      method: ['adds each number in turn'],
      answer,
    },
    // Second route: added from the last number back to the first.
    { agrees: [...xs].reverse().reduce((s, x) => s + x, 0) === answer, detail: `${[...xs].reverse().join(' + ')}` },
    { numbers: xs.join(','), answer },
  )
}

export const flowchartGenerators: Generator[] = [
  csBySlot('cs-flowchart-growth', 'flow-charts-and-pseudo-code', { q7: growth }),
  csBySlot('cs-flowchart-total', 'flow-charts-and-pseudo-code', { q10: total }),
]

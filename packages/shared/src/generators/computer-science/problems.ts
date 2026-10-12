import type { Question } from '../../content/questions.ts'
import { int, pick, shuffle, type Rng } from '../random.ts'
import type { Draft, Generator } from '../types.ts'
import { andList, csBySlot, numericDraft } from './build.ts'

/**
 * Computer Science (AQA 8525) generators for 3.1.1, explaining simple algorithms in terms of their
 * inputs, processing and outputs: following the lesson's averaging algorithm (s3), which adds the
 * marks and divides by 3.
 *
 * - q4: three different marks with a whole-number mean. The mean is never one of the marks, so it
 *   is never the middle mark: "the average is the one in the middle" never pays.
 * - q7: a mark given twice and one far from it (written 10, 10 and 40), so the mean is neither the
 *   repeated mark (the middle and the most common) nor the mean of the two different marks (the
 *   repeat counted once).
 *
 * Both divide by 3, as the written algorithm does; dividing by the number of marks rather than a
 * fixed 3 is asked about in words on the advanced sheet (q13).
 */


const MEAN_PROMPTS = [
  (marks: string) => `An algorithm adds the marks ${marks}, then divides by 3. What does it output?`,
  (marks: string) => `An algorithm totals the marks ${marks} and divides the total by 3. What does it output?`,
  (marks: string) => `A student's three test marks are ${marks}. An algorithm adds them up and then divides by 3. What does it output?`,
]

/** The working the written solutions print: "$12 + 15 + 18 = 45$, and $45 \div 3 = $ **15**." */
function meanDraft(slot: Question, marks: number[], prompt: string, extra: string, method: string[], values: Draft['values']): Draft {
  // The algorithm, run as written: a running total, then one division.
  let total = 0
  for (const m of marks) total += m
  const answer = total / 3
  // Second route: the mean as the first mark plus the average of how far the others sit from it.
  const first = marks[0]!
  const viaGaps = first + marks.reduce((s, m) => s + (m - first), 0) / 3
  return numericDraft(
    slot,
    { prompt, solution: `$${marks.join(' + ')} = ${total}$, and $${total} \\div 3 = $ **${answer}**.${extra}`, method, answer },
    { agrees: Number.isInteger(answer) && viaGaps === answer, detail: `${first} + (${marks.map((m) => m - first).join(' + ')}) ÷ 3 = ${viaGaps}` },
    values,
  )
}

/**
 * q4: 1 mark. Written: 12, 15 and 18 give 15. The mean is drawn first, 8 to 30, then one mark p
 * below it and one q above it (1 to 10 each, p ≠ q), and the third mark makes the total: it is
 * never the mean, nor equal to another mark, and every mark is 2 to 40. Ascending as written half the time, mixed otherwise.
 */
function threeMarks(r: Rng, slot: Question): Draft {
  const mean = int(r, 8, 30)
  const [p, q] = (() => {
    for (;;) {
      const p = int(r, 1, 10)
      const q = int(r, 1, 10)
      // b = mean + p − q differs from the mean (p ≠ q), from mean − p (2p ≠ q) and from mean + q
      // (p ≠ 2q); every mark is at least 2; and halfway between the lowest and highest mark is at
      // least 1 from the mean, so that slip is wrong even rounded.
      const marks = [mean - p, mean + q, mean + p - q].sort((x, y) => x - y)
      const halfway = (marks[0]! + marks[2]!) / 2
      if (p !== q && 2 * p !== q && p !== 2 * q && marks[0]! >= 2 && Math.abs(halfway - mean) >= 1) return [p, q]
    }
  })()
  const set = [mean - p, mean + q, mean + p - q]
  const marks = r() < 0.5 ? [...set].sort((a, b) => a - b) : shuffle(r, set)
  return meanDraft(slot, marks, pick(r, MEAN_PROMPTS)(andList(marks)), '', [], { marks: marks.join(','), answer: mean })
}

/**
 * q7: 2 marks. Written: 10, 10 and 40 give 20. The repeated mark a (5 to 30) and the distance t
 * (4 to 12) from it to the mean; the odd mark is a + 3t (higher, three times in four, as written)
 * or a − 3t, from 1 to 50. Printed with the odd mark last (as written), first or between.
 */
function repeatedMark(r: Rng, slot: Question): Draft {
  const high = r() < 0.75
  const [a, t] = (() => {
    for (;;) {
      const a = int(r, 5, 30)
      const t = int(r, 4, 12)
      const odd = high ? a + 3 * t : a - 3 * t
      if (odd >= 1 && odd <= 50) return [a, t]
    }
  })()
  const odd = high ? a + 3 * t : a - 3 * t
  const marks = pick(r, [[a, a, odd], [a, a, odd], [odd, a, a], [a, odd, a]])
  const mean = high ? a + t : a - t
  const sum = 2 * a + odd
  return meanDraft(
    slot,
    marks,
    pick(r, MEAN_PROMPTS)(andList(marks)),
    ' Running the same algorithm on different inputs is how you check it works in general.',
    [`totals ${sum}`],
    { marks: marks.join(','), answer: mean },
  )
}

export const problemGenerators: Generator[] = [csBySlot('cs-problem-mean', 'problem-solving-and-algorithms', { q4: threeMarks, q7: repeatedMark })]

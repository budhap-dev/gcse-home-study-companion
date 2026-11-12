import { describe, expect, it } from 'vitest'
import { groupParts } from './parts.ts'
import { printedNumbers } from '../routes/student/WorksheetPrint.tsx'

const q = (id: string, stemId?: string) => ({ id, type: 'numeric' as const, marks: 1, skill: 's', gradeBand: '6-7' as const, ...(stemId ? { stemId } : {}) })
// t1: q1, then parts q2 to q4 of stem s, then q5. t2: plain questions.
const topics = [
  { id: 't1', questions: [q('q1'), q('q2', 's'), q('q3', 's'), q('q4', 's'), q('q5')] },
  { id: 't2', questions: [q('q1'), q('q2')] },
]
const item = (topicId: string, questionId: string) => ({ topicId, questionId })

describe('groupParts', () => {
  it('moves the drawn parts of a stem together, in letter order, to where the first was drawn', () => {
    const drawn = [item('t1', 'q4'), item('t2', 'q1'), item('t1', 'q2'), item('t1', 'q5')]
    expect(groupParts(drawn, topics)).toEqual([item('t1', 'q2'), item('t1', 'q4'), item('t2', 'q1'), item('t1', 'q5')])
  })

  it('brings every part of a stem when asked for the whole problem', () => {
    expect(groupParts([item('t2', 'q2'), item('t1', 'q4')], topics, { whole: true }))
      .toEqual([item('t2', 'q2'), item('t1', 'q2'), item('t1', 'q3'), item('t1', 'q4')])
  })

  it('leaves a set without parts as it was', () => {
    const drawn = [item('t2', 'q2'), item('t1', 'q5'), item('t1', 'q1')]
    expect(groupParts(drawn, topics)).toEqual(drawn)
  })
})

describe('printedNumbers', () => {
  const stem = (id: string, part: string) => ({ stem: { id, part, parts: 2, body: 'b' } })
  it('numbers a stem once and its parts (a), (b) beneath it', () => {
    expect(printedNumbers([{}, stem('s', 'a'), stem('s', 'b'), {}, stem('t', 'a'), stem('t', 'b')]).map((x) => `${x.n}${x.label}`))
      .toEqual(['11.', '2(a)', '2(b)', '33.', '4(a)', '4(b)'])
  })
})

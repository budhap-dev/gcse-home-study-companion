import { mark, sheetQuestions, type Question } from '@study/shared'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Feedback } from '../../components/questions/Feedback.tsx'
import { getFullTopic } from '../../content/all.ts'
import type { AttemptRecord } from '../../progress/store.ts'
import { asSeen } from '../parent/TopicBreakdown.tsx'
import { triedBefore } from './Worksheet.tsx'

/**
 * New numbers on a worksheet retry (WKP-2). The first attempt is the written sheet; every
 * attempt after it draws the questions that have a generator fresh from the attempt's seed.
 */
const attempt = (over: Partial<AttemptRecord>): AttemptRecord => ({
  id: 'a1', topicId: 'trigonometric-ratios', kind: 'worksheet', level: 'higher', marksScored: 5, marksAvailable: 10, markedHow: 'auto', completedAt: '2026-10-08T10:00:00Z', ...over,
})

describe('a worksheet retry', () => {
  it('is a retry only after an attempt at the same topic and level', () => {
    expect(triedBefore([], 'trigonometric-ratios', 'higher')).toBe(false)
    expect(triedBefore([attempt({ level: 'core' })], 'trigonometric-ratios', 'higher')).toBe(false)
    expect(triedBefore([attempt({ kind: 'quiz', level: undefined })], 'trigonometric-ratios', 'higher')).toBe(false)
    expect(triedBefore([attempt({ topicId: 'surds' })], 'trigonometric-ratios', 'higher')).toBe(false)
    expect(triedBefore([attempt({})], 'trigonometric-ratios', 'higher')).toBe(true)
  })
})

describe('the parent breakdown of a generated attempt', () => {
  const topic = getFullTopic('maths', 'trigonometric-ratios')!
  const byId = new Map(topic.questions.map((q) => [q.id, q]))
  const ids = topic.worksheets.higher.questionIds
  const results = ids.map((id) => ({ id, skill: byId.get(id)!.skill, gradeBand: byId.get(id)!.gradeBand, marksScored: 0, marksAvailable: byId.get(id)!.marks, correct: false }))

  it('shows the questions the student saw, rebuilt from the seed', () => {
    const seen = asSeen(attempt({ questions: results, seed: 'retry-seed' }), byId, 'maths')
    const fresh = sheetQuestions('maths', topic.id, ids.map((id) => byId.get(id)!), 'retry-seed')
    expect(seen.map(([, q]) => q?.prompt)).toEqual(fresh.map((s) => s.question.prompt))
    expect(seen.some(([, q]) => q?.prompt !== byId.get(q!.id)!.prompt)).toBe(true)
  })

  it('shows the written questions for an attempt without a seed', () => {
    const seen = asSeen(attempt({ questions: results }), byId, 'maths')
    expect(seen.map(([, q]) => q)).toEqual(ids.map((id) => byId.get(id)))
  })
})

describe('a wrong option a generator built', () => {
  const slot = getFullTopic('maths', 'compound-interest-growth-and-decay')!.questions.find((q) => q.id === 'q14')!
  const [item] = sheetQuestions('maths', 'compound-interest-growth-and-decay', [slot], 'slip-seed')
  const q = item!.question as Extract<Question, { type: 'multiple-choice' }>
  const wrong = q.options.findIndex((_, i) => i !== q.correct[0])

  it('names the slip, worded as something the student did', () => {
    const slip = item!.generated!.mistakes![wrong]!
    const html = renderToStaticMarkup(<Feedback question={q} result={mark(q, [wrong])} slip={slip} />)
    expect(html).toContain(`The likely slip: you <strong>${slip}</strong>.`)
  })

  it('says nothing about a slip when the answer is right', () => {
    const html = renderToStaticMarkup(<Feedback question={q} result={mark(q, q.correct)} slip="took 20% off the new price" />)
    expect(html).not.toContain('likely slip')
  })
})

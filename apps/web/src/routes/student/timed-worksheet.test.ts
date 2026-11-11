import type { Question, Topic } from '@study/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })

const { recordTimedWorksheet, timedPath } = await import('./TimedWorksheet.tsx')
const { clearProgress, evidenceFor, getState } = await import('../../progress/store.ts')
const { paperAnswers, methodTotal } = await import('../../components/paper/PaperSession.tsx')

const base = { prompt: 'p', skill: 's', calculator: 'either', tags: [], solution: 's', discriminators: [] }
const q = (id: string, band: string, marks: number, scheme = [{ code: 'M1', marks: 1, description: 'm' }, { code: 'A1', marks: marks - 1, description: 'a' }]) =>
  ({ ...base, id, type: 'numeric', answer: 1, tolerance: 0, unitsRequired: false, gradeBand: band, marks, markScheme: scheme }) as unknown as Question
const questions = [q('a', '6-7', 2), q('b', '8-9', 3), q('c', '8-9', 1, [{ code: 'B1', marks: 1, description: 'b' }])]
const topic = { id: 't', subjectId: 'maths' } as Topic
const item = (id: string) => ({ topicId: 't', questionId: id })
const right = (marks: number) => ({ answer: 1, result: { correct: true, marksScored: marks, marksAvailable: marks } })
const wrong = (marks: number) => ({ answer: 9, result: { correct: false, marksScored: 0, marksAvailable: marks } })

describe('a timed worksheet (WKP-4)', () => {
  beforeEach(() => clearProgress())

  it('records as the worksheet it is, so it moves the topic as the sheet would', () => {
    const answers = { 't/a': right(2), 't/b': right(3), 't/c': right(1) }
    recordTimedWorksheet(topic, 'higher', questions, { id: 'p1', answers, finishedAt: '2026-11-11T10:00:00Z', timed: { allowedSeconds: 420, usedSeconds: 300 } })
    const a = getState().attempts[0]!
    expect(a).toMatchObject({ kind: 'worksheet', level: 'higher', marksScored: 6, marksAvailable: 6, grade89Scored: 4, grade89Available: 4, markedHow: 'auto', timed: { allowedSeconds: 420, usedSeconds: 300 } })
    expect(evidenceFor('t', getState()).higherPct).toBe(100)
  })

  it('calls an attempt with method marks mixed, as the worksheet does', () => {
    const state = { path: '/p', id: 'p2', index: 0, texts: {}, onPaper: {}, spent: {}, viewSince: 0, startedAt: 0, ticks: {}, answers: { 't/a': wrong(2), 't/b': wrong(3), 't/c': right(1) }, method: { 't/b': 2 } }
    const pqs = questions.map((x) => ({ item: item(x.id), question: x }))
    const answers = paperAnswers(state, pqs)
    expect(answers['t/b']?.result.marksScored).toBe(1)
    recordTimedWorksheet(topic, 'advanced', questions, { id: 'p2', answers, finishedAt: '2026-11-11T10:00:00Z' })
    expect(getState().attempts[0]).toMatchObject({ marksScored: 2, markedHow: 'mixed' })
  })

  it('offers method marks one short of the whole, and none on a one-mark answer', () => {
    expect(questions.map(methodTotal)).toEqual([1, 1, 0])
  })

  it('has a link that carries a sheet code only on a retry', () => {
    expect(timedPath('maths', 't', 'core')).toBe('/subjects/maths/topics/t/worksheet/core/timed')
    expect(timedPath('maths', 't', 'core', 'abc123')).toBe('/subjects/maths/topics/t/worksheet/core/timed?sheet=abc123')
  })
})

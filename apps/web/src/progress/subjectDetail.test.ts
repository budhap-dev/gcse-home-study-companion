import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { topicsForSubject } from '../content/index.ts'
import { mergeProgress } from './merge.ts'
import { emptyState, parseTimeKey, timeKey, type AttemptRecord, type ProgressState } from './store.ts'
import { STUDY_KINDS, minutesBySubject, subjectDetail, topicDays, unsplitMinutes } from './subjectDetail.ts'

const KE = 'kinetic-and-gravitational-potential-energy'
const MOM = 'momentum'

const quiz = (topicId: string, pct: number, at: string): AttemptRecord => ({
  id: `${topicId}-q-${at}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: at,
})
const sheet = (topicId: string, level: 'core' | 'higher' | 'advanced', pct: number, at: string): AttemptRecord => ({
  id: `${topicId}-${level}-${at}`, topicId, kind: 'worksheet', level, marksScored: pct, marksAvailable: 100, markedHow: 'self', completedAt: at,
})

/** An evening of physics: a lesson, two quizzes and a deck on one topic, a cheat sheet on another. */
const evening = (): ProgressState => ({
  ...emptyState(),
  attempts: [quiz(KE, 40, '2026-09-21T18:00:00.000Z'), quiz(KE, 70, '2026-09-22T18:30:00.000Z'), sheet(KE, 'higher', 55, '2026-09-22T19:00:00.000Z')],
  lessons: { [KE]: { topicId: KE, stepIndex: 7, completedAt: '2026-09-21T17:40:00.000Z', updatedAt: '2026-09-21T17:40:00.000Z' } },
  activities: [
    { id: `${KE}:flashcards:2026-09-22`, topicId: KE, subjectId: 'physics', kind: 'flashcards', at: '2026-09-22T19:20:00.000Z', cards: 12, turns: 15 },
    { id: `${MOM}:cheat-sheet:2026-09-23`, topicId: MOM, subjectId: 'physics', kind: 'cheat-sheet', at: '2026-09-23T08:00:00.000Z' },
    { id: 'physics:exam-technique:2026-09-23', subjectId: 'physics', kind: 'exam-technique', at: '2026-09-23T08:10:00.000Z' },
  ],
  minutes: { '2026-09-20': 30, '2026-09-21': 30, '2026-09-22': 27, '2026-09-23': 9 },
  time: {
    [timeKey('2026-09-21', { subjectId: 'physics', topicId: KE, kind: 'lesson' })]: 20,
    [timeKey('2026-09-21', { subjectId: 'physics', topicId: KE, kind: 'quiz' })]: 10,
    [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'quiz' })]: 8,
    [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'worksheet' })]: 12,
    [timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'flashcards' })]: 7,
    [timeKey('2026-09-23', { subjectId: 'physics', topicId: MOM, kind: 'cheat-sheet' })]: 3,
    [timeKey('2026-09-23', { subjectId: 'physics', kind: 'exam-technique' })]: 4,
    [timeKey('2026-09-23', { subjectId: 'maths', topicId: 'surds', kind: 'flashcards' })]: 2,
  },
})

describe('where a minute was spent', () => {
  it('files a minute by day, subject, topic and kind, and reads it back', () => {
    const place = { subjectId: 'physics', topicId: KE, kind: 'flashcards' as const }
    expect(parseTimeKey(timeKey('2026-09-22', place))).toEqual({ day: '2026-09-22', ...place })
    // The subject-wide page has no topic, and must come back without one rather than as ''.
    expect(parseTimeKey(timeKey('2026-09-22', { subjectId: 'physics', kind: 'exam-technique' })).topicId).toBeUndefined()
  })

  it('merges two devices by the larger count per place, never the sum', () => {
    const k = timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'quiz' })
    const other = timeKey('2026-09-22', { subjectId: 'physics', topicId: KE, kind: 'lesson' })
    expect(mergeProgress({ time: { [k]: 8 } }, { time: { [k]: 5, [other]: 3 } }).time).toEqual({ [k]: 8, [other]: 3 })
  })

  /**
   * Every kind a parent can see time for has to be timed somewhere. Until this change four
   * of the seven screens — flashcards, cheat sheet, why and exam technique — counted no
   * minutes at all, so an evening of flashcards added nothing to the week.
   */
  it('has a study screen timing every kind', () => {
    const dir = join(__dirname, '../routes/student')
    const source = readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.includes('test')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n')
    for (const kind of STUDY_KINDS) {
      expect(source, kind).toMatch(new RegExp(`useActivityTimer\\([^)]*kind: '${kind}'`))
    }
  })
})

describe('one subject, for a parent', () => {
  const d = subjectDetail(evening(), 'physics')!

  it('adds up the time on the subject by kind, and leaves another subject out', () => {
    expect(d.minutes).toBe(64)
    const by = Object.fromEntries(d.byKind.map((k) => [k.kind, k.minutes]))
    expect(by).toEqual({ lesson: 20, quiz: 18, worksheet: 12, flashcards: 7, 'cheat-sheet': 3, why: 0, 'exam-technique': 4 })
    // Fixed order with zeros kept, so "no Where you meet it at all" is visible as a row.
    expect(d.byKind.map((k) => k.kind)).toEqual(STUDY_KINDS)
    expect(minutesBySubject(evening())).toEqual({ physics: 64, maths: 2 })
  })

  it('lists the topics worked on, most recent first, with what was done on each', () => {
    expect(d.topics.map((t) => t.topicId)).toEqual([MOM, KE])
    const ke = d.topics[1]!
    expect(ke.minutes).toBe(57)
    expect(ke.lesson).toEqual({ done: true, step: 8, steps: 8 })
    expect(ke.quizzes).toEqual({ count: 2, latestPct: 70, bestPct: 70 })
    expect(ke.worksheets).toEqual([{ level: 'higher', count: 1, latestPct: 55, bestPct: 55 }])
    expect(ke.flashcards).toEqual({ days: 1, cards: 12 })
    expect(d.topics[0]!.cheatSheet).toBe(1)
  })

  it('keeps the untouched topics, in the course order, rather than dropping them', () => {
    const order = topicsForSubject('physics').map((t) => t.id).filter((id) => id !== KE && id !== MOM)
    expect(d.notStarted.map((t) => t.topicId)).toEqual(order)
    expect(d.topics.length + d.notStarted.length).toBe(d.total)
  })

  it('counts the exam technique page, which belongs to no topic', () => {
    expect(d.examTechnique).toEqual({ days: 1, minutes: 4, last: '2026-09-23' })
    expect(d.quizCount).toBe(2)
    expect(d.averageQuizPct).toBe(55)
  })

  /** Minutes from before places were recorded are real study, just not attributable. */
  it('reports the minutes no place accounts for', () => {
    // 20 Sept has 30 minutes and no places; the other days are fully filed.
    expect(unsplitMinutes(evening())).toBe(30)
    expect(d.unsplitMinutes).toBe(30)
  })

  it('gives nothing for a subject that does not exist', () => {
    expect(subjectDetail(evening(), 'astrology')).toBeUndefined()
  })
})

describe('a topic day by day', () => {
  it('groups each day by kind, with the minutes and what came of them, newest first', () => {
    const days = topicDays(evening(), KE)
    expect(days.map((x) => x.day)).toEqual(['2026-09-22', '2026-09-21'])
    expect(days[0]!.entries).toEqual([
      { kind: 'quiz', minutes: 8, results: ['70/100 (70%)'] },
      { kind: 'worksheet', minutes: 12, results: ['Higher, 55/100 (55%)'] },
      { kind: 'flashcards', minutes: 7, results: ['12 cards in 15 turns'] },
    ])
    expect(days[1]!.entries).toEqual([
      { kind: 'lesson', minutes: 20, results: ['finished'] },
      { kind: 'quiz', minutes: 10, results: ['40/100 (40%)'] },
    ])
  })

  it('says a page was opened when that is all there is to say', () => {
    expect(topicDays(evening(), MOM)).toEqual([{ day: '2026-09-23', entries: [{ kind: 'cheat-sheet', minutes: 3, results: ['opened'] }] }])
  })
})

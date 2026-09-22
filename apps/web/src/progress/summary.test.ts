import { describe, expect, it } from 'vitest'
import { activeDates, parentSummary, recentActivity } from './summary.ts'
import { emptyState, type ActivityRecord, type AttemptRecord, type ProgressState } from './store.ts'

const q = (skill: string, correct: boolean) => ({ id: skill, skill, gradeBand: '6-7' as const, correct, marksScored: correct ? 2 : 0, marksAvailable: 2 })
const quiz = (topicId: string, pct: number, day: string, questions = [q('s', pct >= 50)]): AttemptRecord => ({
  id: `${topicId}-${day}-${pct}`, topicId, kind: 'quiz', marksScored: pct, marksAvailable: 100, markedHow: 'auto', completedAt: `${day}T10:00:00.000Z`, questions,
})
const lesson = (topicId: string, day: string, done = true) => ({ topicId, stepIndex: 5, completedAt: done ? `${day}T09:00:00.000Z` : undefined, updatedAt: `${day}T09:00:00.000Z` })
const state = (over: Partial<ProgressState>): ProgressState => ({ ...emptyState(), ...over })

describe('activeDates', () => {
  it('counts attempts, finished lessons and days with study minutes', () => {
    const s = state({
      attempts: [quiz('surds', 70, '2026-09-01')],
      lessons: { surds: lesson('surds', '2026-09-02') },
      minutes: { '2026-09-03': 20, '2026-09-04': 0 },
    })
    expect(activeDates(s)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03'])
  })

  /** An evening of flashcards is a day the student worked, and used to count as nothing. */
  it('counts a day spent on unmarked revision', () => {
    const s = state({ activities: [{ id: 'x', topicId: 'surds', subjectId: 'maths', kind: 'flashcards', at: '2026-09-07T20:00:00.000Z' }] })
    expect(activeDates(s)).toEqual(['2026-09-07'])
  })
})

const KGPE = 'kinetic-and-gravitational-potential-energy'
const act = (kind: ActivityRecord['kind'], day: string, over: Partial<ActivityRecord> = {}): ActivityRecord => ({
  id: `${KGPE}:${kind}:${day}`, topicId: KGPE, subjectId: 'physics', kind, at: `${day}T11:00:00.000Z`, ...over,
})

/**
 * Recent work used to read `state.attempts` alone, so three of the seven things a topic
 * offers left no trace and the fourth was recorded but never shown. A parent could open
 * this page after an evening of lessons and flashcards and read "Nothing done yet."
 */
describe('recentActivity', () => {
  it('shows every kind of work, not only the marked ones', () => {
    const s = state({
      attempts: [quiz(KGPE, 80, '2026-09-01')],
      lessons: { [KGPE]: lesson(KGPE, '2026-09-02') },
      activities: [act('flashcards', '2026-09-03', { cards: 12, turns: 15 }), act('cheat-sheet', '2026-09-04'), act('why', '2026-09-05')],
    })
    expect(recentActivity(s).map((e) => e.kind)).toEqual(['why', 'cheat-sheet', 'flashcards', 'lesson', 'quiz'])
  })

  it('scores what was marked and leaves the rest without a percentage', () => {
    const s = state({ attempts: [quiz(KGPE, 80, '2026-09-01')], activities: [act('cheat-sheet', '2026-09-02')] })
    const [sheet, marked] = recentActivity(s)
    expect(sheet!.pct).toBeUndefined()
    expect(sheet!.detail).toBe('Opened')
    expect(marked!.pct).toBe(80)
    expect(marked!.detail).toBe('80 of 100 marks')
  })

  it('says how far through an unfinished lesson is, and names the finished one as finished', () => {
    const open = state({ lessons: { [KGPE]: lesson(KGPE, '2026-09-02', false) } })
    // stepIndex 5 is the sixth step, of the eight this topic has.
    expect(recentActivity(open)[0]!.detail).toBe('Step 6 of 8')
    const done = state({ lessons: { [KGPE]: lesson(KGPE, '2026-09-02') } })
    expect(recentActivity(done)[0]!.detail).toBe('Finished')
  })

  it('reports a flashcard deck by its size, and says when every card was known first time', () => {
    const hard = state({ activities: [act('flashcards', '2026-09-03', { cards: 12, turns: 15 })] })
    expect(recentActivity(hard)[0]!.detail).toBe('12 cards, 15 turns')
    const clean = state({ activities: [act('flashcards', '2026-09-03', { cards: 12, turns: 12 })] })
    expect(recentActivity(clean)[0]!.detail).toBe('12 cards, all known first time')
  })

  /** Exam technique is one page per subject, so it carries the subject and no topic. */
  it('titles a subject-wide page by its subject and gives it no topic to expand', () => {
    const s = state({ activities: [{ id: 'physics:exam-technique:2026-09-06', subjectId: 'physics', kind: 'exam-technique', at: '2026-09-06T11:00:00.000Z' }] })
    const [entry] = recentActivity(s)
    expect(entry!.topicId).toBeUndefined()
    expect(entry!.title).toBe('Physics')
    expect(entry!.label).toBe('Exam technique')
  })

  it('ignores a record whose topic is no longer in the pack', () => {
    const s = state({ activities: [act('why', '2026-09-03', { id: 'gone:why:2026-09-03', topicId: 'a-deleted-topic' })] })
    expect(recentActivity(s)).toEqual([])
  })

  it('keeps the feed short and newest first', () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    const s = state({ attempts: days.map((d, i) => quiz(KGPE, 50 + i, d)) })
    const feed = recentActivity(s)
    expect(feed).toHaveLength(12)
    expect(feed[0]!.at.slice(0, 10)).toBe('2026-09-20')
  })
})

describe('parentSummary', () => {
  it('reports when the student last did anything, in days', () => {
    const s = state({ attempts: [quiz('surds', 70, '2026-09-10')] })
    const out = parentSummary(s, '2026-09-18')
    expect(out.lastActive).toBe('2026-09-10')
    expect(out.daysSinceActive).toBe(8)
  })

  it('leaves last active undefined when nothing has been done', () => {
    const out = parentSummary(emptyState(), '2026-09-18')
    expect(out.lastActive).toBeUndefined()
    expect(out.daysSinceActive).toBeUndefined()
    expect(out.averageQuizPct).toBeUndefined()
    expect(out.stuck).toEqual([])
  })

  it('averages the last ten quizzes and shows no trend until there are six', () => {
    const five = ['01', '02', '03', '04', '05'].map((d) => quiz('surds', 40, `2026-09-${d}`))
    expect(parentSummary(state({ attempts: five }), '2026-09-18').trend).toBeUndefined()
    // A sixth quiz gives the last five something to be compared against.
    const six = [...five, quiz('surds', 90, '2026-09-06')]
    const out = parentSummary(state({ attempts: six }), '2026-09-18')
    // Last five are 40, 40, 40, 40, 90 (mean 50) against the one before them, 40.
    expect(out.trend).toBe(10)
    expect(out.averageQuizPct).toBe(Math.round((40 * 5 + 90) / 6))
    expect(out.quizCount).toBe(6)
  })

  /**
   * The list a parent acts on. A topic is only stuck if work went in and did not come
   * good; a topic never opened is not stuck, and letting those in would bury the few
   * that need a conversation under the whole syllabus.
   */
  it('lists topics where work went in and the score stayed low', () => {
    const s = state({
      attempts: [quiz('surds', 30, '2026-09-10'), quiz('laws-of-indices', 95, '2026-09-11')],
      lessons: { surds: lesson('surds', '2026-09-09'), 'standard-form': lesson('standard-form', '2026-09-12') },
    })
    const out = parentSummary(s, '2026-09-18')
    expect(out.stuck.map((x) => [x.topicId, x.reason])).toEqual([
      ['surds', 'low-score'],
      ['standard-form', 'no-quiz'],
    ])
    expect(out.stuck[0]!.pct).toBe(30)
    // The topic that went well is not on the list, and nor is anything untouched.
    expect(out.stuck.some((x) => x.topicId === 'laws-of-indices')).toBe(false)
  })

  it('counts a part-read lesson as started but never as stuck', () => {
    const s = state({ lessons: { surds: lesson('surds', '2026-09-10', false) } })
    const out = parentSummary(s, '2026-09-18')
    expect(out.topicsStarted).toBe(1)
    expect(out.stuck).toEqual([])
  })

  it('counts this week against the goal, and days actually studied', () => {
    // 2026-09-18 is a Friday, so its week runs Monday the 14th to Sunday the 20th.
    const s = state({ minutes: { '2026-09-14': 30, '2026-09-16': 45, '2026-09-07': 60 }, goalMinutes: 180 })
    const out = parentSummary(s, '2026-09-18')
    expect(out.weekMinutes).toBe(75)
    expect(out.activeDays).toBe(2)
    expect(out.goalMinutes).toBe(180)
  })

  it('breaks the syllabus down by subject, counting only subjects with content', () => {
    const s = state({ attempts: [quiz('surds', 95, '2026-09-10')] })
    const maths = parentSummary(s, '2026-09-18').subjects.find((x) => x.id === 'maths')!
    expect(maths.total).toBeGreaterThan(40)
    expect(maths.started).toBe(1)
    expect(maths.lastActive).toBe('2026-09-10')
    // Only started topics are given a status; the rest are counted as not started, so an
    // untouched subject does not read as a subject that is going badly.
    expect(maths.notStarted).toBe(maths.total - 1)
    expect(Object.values(maths.counts).reduce((a, b) => a + b, 0)).toBe(maths.started)
    expect(maths.counts['not-secure']).toBe(0)
    const physics = parentSummary(s, '2026-09-18').subjects.find((x) => x.id === 'physics')!
    expect(physics.started).toBe(0)
    expect(Object.values(physics.counts).every((n) => n === 0)).toBe(true)
  })
})

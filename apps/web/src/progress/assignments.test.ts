import { describe, expect, it } from 'vitest'
import { assignedTasks, doneAt, doneBefore, historyFor, outstanding, statusOf, upcoming, type Assignment } from './assignments.ts'
import { emptyState, type AttemptRecord, type ProgressState } from './store.ts'

const SET = '2026-09-10T09:00:00.000Z'
const a = (over: Partial<Assignment> = {}): Assignment => ({
  id: 'a1', studentEmail: 'kid@example.com', setBy: 'parent@example.com',
  topicId: 'surds', kind: 'worksheet', level: 'higher', createdAt: SET, ...over,
})
const attempt = (over: Partial<AttemptRecord> = {}): AttemptRecord => ({
  id: 'x', topicId: 'surds', kind: 'worksheet', level: 'higher', marksScored: 8, marksAvailable: 10,
  markedHow: 'auto', completedAt: '2026-09-12T10:00:00.000Z', ...over,
})
const state = (over: Partial<ProgressState>): ProgressState => ({ ...emptyState(), ...over })

describe('doneAt', () => {
  it('finds the matching attempt', () => {
    expect(doneAt(a(), state({ attempts: [attempt()] }))).toBe('2026-09-12T10:00:00.000Z')
  })

  /**
   * The rule that stops a task looking done the instant it is set: work from before the
   * request does not discharge it. A student who did the Higher sheet last month still
   * has to do it again when asked.
   */
  it('ignores work finished before the task was set', () => {
    expect(doneAt(a(), state({ attempts: [attempt({ completedAt: '2026-09-01T10:00:00.000Z' })] }))).toBeUndefined()
  })

  it('takes the earliest qualifying attempt, not the latest', () => {
    const s = state({ attempts: [attempt({ id: 'late', completedAt: '2026-09-20T10:00:00.000Z' }), attempt({ id: 'early', completedAt: '2026-09-11T10:00:00.000Z' })] })
    expect(doneAt(a(), s)).toBe('2026-09-11T10:00:00.000Z')
  })

  it('wants the right worksheet level, not just any worksheet', () => {
    expect(doneAt(a(), state({ attempts: [attempt({ level: 'core' })] }))).toBeUndefined()
    expect(doneAt(a({ level: 'core' }), state({ attempts: [attempt({ level: 'core' })] }))).toBeDefined()
  })

  it('wants the right kind, and the right topic', () => {
    expect(doneAt(a({ kind: 'quiz', level: undefined }), state({ attempts: [attempt()] }))).toBeUndefined()
    expect(doneAt(a(), state({ attempts: [attempt({ topicId: 'laws-of-indices' })] }))).toBeUndefined()
  })

  it('reads a lesson from the lesson record, not from attempts', () => {
    const lesson = { topicId: 'surds', stepIndex: 9, completedAt: '2026-09-11T08:00:00.000Z', updatedAt: '2026-09-11T08:00:00.000Z' }
    expect(doneAt(a({ kind: 'lesson', level: undefined }), state({ lessons: { surds: lesson } }))).toBe('2026-09-11T08:00:00.000Z')
    // Part-read counts for nothing: there is no completedAt.
    expect(doneAt(a({ kind: 'lesson', level: undefined }), state({ lessons: { surds: { ...lesson, completedAt: undefined } } }))).toBeUndefined()
  })
})

describe('statusOf', () => {
  it('reports overdue, due today and open against the due date', () => {
    expect(statusOf(a({ dueOn: '2026-09-15' }), undefined, '2026-09-18')).toBe('overdue')
    expect(statusOf(a({ dueOn: '2026-09-18' }), undefined, '2026-09-18')).toBe('due-today')
    expect(statusOf(a({ dueOn: '2026-09-20' }), undefined, '2026-09-18')).toBe('open')
    expect(statusOf(a(), undefined, '2026-09-18')).toBe('open')
  })

  it('never calls a finished task overdue', () => {
    expect(statusOf(a({ dueOn: '2026-09-01' }), '2026-09-12T10:00:00.000Z', '2026-09-18')).toBe('done')
  })
})

describe('a start date', () => {
  it('makes a task upcoming until the day it opens', () => {
    expect(statusOf(a({ startsOn: '2026-09-20', dueOn: '2026-09-25' }), undefined, '2026-09-18')).toBe('upcoming')
    expect(statusOf(a({ startsOn: '2026-09-18', dueOn: '2026-09-25' }), undefined, '2026-09-18')).toBe('open')
  })

  /** A window that has closed is overdue, not upcoming: the start date is behind us. */
  it('does not shield a task whose window has closed', () => {
    expect(statusOf(a({ startsOn: '2026-09-10', dueOn: '2026-09-15' }), undefined, '2026-09-18')).toBe('overdue')
  })

  it('still reports done for a task finished after its window closed', () => {
    expect(statusOf(a({ startsOn: '2026-09-10', dueOn: '2026-09-15' }), '2026-09-17T10:00:00.000Z', '2026-09-18')).toBe('done')
  })

  it('works on its own, without a finish date', () => {
    expect(statusOf(a({ startsOn: '2026-09-25' }), undefined, '2026-09-18')).toBe('upcoming')
    expect(statusOf(a({ startsOn: '2026-09-10' }), undefined, '2026-09-18')).toBe('open')
  })

  it('sorts upcoming tasks after live ones but before finished ones', () => {
    const list = [
      a({ id: 'later', topicId: 'box-plots', kind: 'quiz', level: undefined, startsOn: '2026-09-28' }),
      a({ id: 'soon', topicId: 'standard-form', kind: 'quiz', level: undefined, startsOn: '2026-09-21' }),
      a({ id: 'live', dueOn: '2026-09-22' }),
      a({ id: 'done', topicId: 'laws-of-indices', kind: 'quiz', level: undefined }),
    ]
    const s = state({ attempts: [attempt({ topicId: 'laws-of-indices', kind: 'quiz', level: undefined })] })
    // Live first, then the upcoming pair ordered by when they open, then the finished one.
    expect(assignedTasks(list, s, '2026-09-18').map((t) => t.assignment.id)).toEqual(['live', 'soon', 'later', 'done'])
  })
})

describe('assignedTasks', () => {
  it('routes each one to its activity, with the time it should take', () => {
    const [t] = assignedTasks([a()], emptyState(), '2026-09-18')
    expect(t!.task!.to).toBe('/subjects/maths/topics/surds/worksheet/higher')
    expect(t!.task!.title).toBe('Higher worksheet')
    expect(t!.task!.minutes).toBeGreaterThan(0)
    expect(t!.topicTitle).toBe('Surds')
  })

  it('uses the parent’s note as the reason when there is one', () => {
    const [t] = assignedTasks([a({ note: 'You scored 42% last time' })], emptyState(), '2026-09-18')
    expect(t!.task!.reason).toBe('You scored 42% last time')
  })

  /** A build that does not carry the topic must still render the row, not crash. */
  it('survives an assignment naming a topic this build does not have', () => {
    const [t] = assignedTasks([a({ topicId: 'not-a-real-topic' })], emptyState(), '2026-09-18')
    expect(t!.task).toBeNull()
    expect(t!.topicTitle).toBe('not-a-real-topic')
  })

  it('puts overdue first and finished last', () => {
    const list = [
      a({ id: 'open', dueOn: '2026-09-25' }),
      a({ id: 'done', topicId: 'laws-of-indices', kind: 'quiz', level: undefined }),
      a({ id: 'late', topicId: 'standard-form', kind: 'lesson', level: undefined, dueOn: '2026-09-12' }),
      a({ id: 'today', topicId: 'box-plots', kind: 'quiz', level: undefined, dueOn: '2026-09-18' }),
    ]
    const s = state({ attempts: [attempt({ topicId: 'laws-of-indices', kind: 'quiz', level: undefined })] })
    expect(assignedTasks(list, s, '2026-09-18').map((t) => t.assignment.id)).toEqual(['late', 'today', 'open', 'done'])
  })

  it('counts what is still to do', () => {
    const list = [a({ id: 'one' }), a({ id: 'two', topicId: 'laws-of-indices', kind: 'quiz', level: undefined })]
    const s = state({ attempts: [attempt({ topicId: 'laws-of-indices', kind: 'quiz', level: undefined })] })
    expect(outstanding(assignedTasks(list, s, '2026-09-18'))).toBe(1)
  })

  /**
   * A whole term's work set in advance must not read as sixteen things due today. The
   * parent screen promises a future start date does not count as outstanding, and this is
   * the code that has to keep that promise.
   */
  it('does not count a task that has not started yet', () => {
    const list = [
      a({ id: 'live', dueOn: '2026-09-25' }),
      a({ id: 'later', topicId: 'laws-of-indices', kind: 'quiz', level: undefined, startsOn: '2026-10-05', dueOn: '2026-10-25' }),
      a({ id: 'later2', topicId: 'standard-form', kind: 'quiz', level: undefined, startsOn: '2026-10-05' }),
    ]
    const tasks = assignedTasks(list, emptyState(), '2026-09-18')
    expect(outstanding(tasks)).toBe(1)
    expect(upcoming(tasks)).toBe(2)
  })

  it('counts nothing as upcoming once every start date has passed', () => {
    const list = [a({ id: 'live', startsOn: '2026-09-10', dueOn: '2026-09-25' })]
    const tasks = assignedTasks(list, emptyState(), '2026-09-18')
    expect(upcoming(tasks)).toBe(0)
    expect(outstanding(tasks)).toBe(1)
  })
})

describe('historyFor', () => {
  it('reports the latest attempt per activity, with no cut-off date', () => {
    const s = state({
      attempts: [
        attempt({ id: 'old', completedAt: '2026-08-01T10:00:00.000Z', marksScored: 4 }),
        attempt({ id: 'new', completedAt: '2026-09-05T10:00:00.000Z', marksScored: 9 }),
        attempt({ id: 'q', kind: 'quiz', level: undefined, marksScored: 7, completedAt: '2026-09-02T10:00:00.000Z' }),
      ],
      lessons: { surds: { topicId: 'surds', stepIndex: 9, completedAt: '2026-07-01T09:00:00.000Z', updatedAt: '2026-07-01T09:00:00.000Z' } },
    })
    const h = historyFor('surds', s)
    // The later of the two Higher sheets, not the first.
    expect(h.worksheets.higher).toEqual({ pct: 90, at: '2026-09-05T10:00:00.000Z' })
    expect(h.quiz?.pct).toBe(70)
    expect(h.lesson?.at).toBe('2026-07-01T09:00:00.000Z')
    expect(h.untouched).toBe(false)
  })

  it('calls a topic untouched only when nothing at all has happened', () => {
    expect(historyFor('surds', emptyState()).untouched).toBe(true)
    const part = state({ lessons: { surds: { topicId: 'surds', stepIndex: 2, updatedAt: '2026-09-01T09:00:00.000Z' } } })
    expect(historyFor('surds', part).untouched).toBe(false)
  })

  it('picks out the one activity being set', () => {
    const s = state({ attempts: [attempt({ level: 'core', marksScored: 6 })] })
    const h = historyFor('surds', s)
    expect(doneBefore(h, 'worksheet', 'core')?.pct).toBe(60)
    expect(doneBefore(h, 'worksheet', 'higher')).toBeUndefined()
    expect(doneBefore(h, 'quiz')).toBeUndefined()
  })
})

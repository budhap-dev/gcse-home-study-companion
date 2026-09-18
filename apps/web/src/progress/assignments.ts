import type { TopicStatus, WorksheetLevel } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { buildTask, type Task } from './recommend.ts'
import { evidenceFor, isoDate, type ProgressState } from './store.ts'

/** One task a parent has set, as stored. */
export interface Assignment {
  id: string
  studentEmail: string
  setBy: string
  topicId: string
  kind: 'lesson' | 'quiz' | 'worksheet'
  level?: WorksheetLevel
  /** The window to do it in. Either end may be absent. */
  startsOn?: string
  dueOn?: string
  note?: string
  createdAt: string
}

export type AssignmentStatus = 'done' | 'overdue' | 'due-today' | 'open' | 'upcoming'

export interface AssignedTask {
  assignment: Assignment
  /** Null when the assignment names a topic this build does not carry. */
  task: Task | null
  topicTitle: string
  doneAt?: string
  status: AssignmentStatus
}

const byId = new Map(TOPICS.map((t) => [t.id, t]))

/**
 * When this assignment was completed, or undefined if it has not been.
 *
 * Completion is derived from what the student actually did rather than stored, so a task
 * cannot be ticked off without doing it. It has to have happened **after** the task was
 * set: a worksheet finished last month does not discharge a request made today, and
 * counting it would let a parent's task appear done the moment they set it.
 */
export function doneAt(a: Assignment, state: ProgressState): string | undefined {
  if (a.kind === 'lesson') {
    const at = state.lessons[a.topicId]?.completedAt
    return at && at >= a.createdAt ? at : undefined
  }
  const matches = state.attempts
    .filter((x) => x.topicId === a.topicId && x.kind === a.kind && (a.kind !== 'worksheet' || x.level === a.level))
    .map((x) => x.completedAt)
    .filter((at) => at >= a.createdAt)
    .sort()
  // The earliest qualifying attempt: the moment the request was actually met.
  return matches[0]
}

/**
 * Finished beats everything, including a window that has already closed: a task done late
 * is done, and calling it overdue afterwards would be both wrong and dispiriting.
 *
 * A start date in the future makes a task `upcoming`. It is still shown, and still
 * openable — a keen student may start early — but it is not something they are behind on.
 */
export function statusOf(a: Assignment, done: string | undefined, today = isoDate()): AssignmentStatus {
  if (done) return 'done'
  if (a.startsOn && a.startsOn > today) return 'upcoming'
  if (!a.dueOn) return 'open'
  if (a.dueOn < today) return 'overdue'
  return a.dueOn === today ? 'due-today' : 'open'
}

const REASON: Record<Assignment['kind'], string> = {
  lesson: 'Set for you to work through.',
  quiz: 'Set for you, to show what has stuck.',
  worksheet: 'Set for you.',
}

/**
 * Assignments paired with the card each one routes to, newest first among the ones still
 * to do. Finished tasks sort to the bottom: they are worth showing, so the student sees
 * what they have cleared, but they are not what the screen is for.
 */
export function assignedTasks(list: Assignment[], state: ProgressState, today = isoDate()): AssignedTask[] {
  const rank: Record<AssignmentStatus, number> = { overdue: 0, 'due-today': 1, open: 2, upcoming: 3, done: 4 }
  return list
    .map((assignment) => {
      const topic = byId.get(assignment.topicId)
      const done = doneAt(assignment, state)
      return {
        assignment,
        topicTitle: topic?.title ?? assignment.topicId,
        task: topic ? buildTask(topic, assignment.kind, assignment.note?.trim() || REASON[assignment.kind], assignment.level) : null,
        doneAt: done,
        status: statusOf(assignment, done, today),
      }
    })
    // Within a status, the one that runs out soonest comes first; an upcoming task sorts
    // by when it opens instead, since that is the date that matters for it.
    .sort((x, y) => rank[x.status] - rank[y.status]
      || (x.status === 'upcoming'
        ? (x.assignment.startsOn ?? '9999').localeCompare(y.assignment.startsOn ?? '9999')
        : (x.assignment.dueOn ?? '9999').localeCompare(y.assignment.dueOn ?? '9999'))
      || y.assignment.createdAt.localeCompare(x.assignment.createdAt))
}

export interface ActivityDone {
  /** Percentage, absent for a lesson where there is no score. */
  pct?: number
  at: string
}

/**
 * What this student has already done on a topic, for a parent choosing what to set.
 *
 * Unlike an assignment's own completion this looks at the **whole** history, with no
 * cut-off date: the question here is "have they met this before?", which is exactly the
 * thing a parent wants to know before asking for it again.
 */
export interface TopicHistory {
  status: TopicStatus
  lesson?: ActivityDone
  quiz?: ActivityDone
  worksheets: Partial<Record<WorksheetLevel, ActivityDone>>
  /** True when nothing at all has been done on this topic. */
  untouched: boolean
}

const latest = (state: ProgressState, topicId: string, kind: 'quiz' | 'worksheet', level?: WorksheetLevel): ActivityDone | undefined => {
  const hit = state.attempts
    .filter((a) => a.topicId === topicId && a.kind === kind && (kind !== 'worksheet' || a.level === level))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0]
  return hit ? { pct: hit.marksAvailable > 0 ? Math.round((100 * hit.marksScored) / hit.marksAvailable) : 0, at: hit.completedAt } : undefined
}

export function historyFor(topicId: string, state: ProgressState): TopicHistory {
  const lessonAt = state.lessons[topicId]?.completedAt
  const worksheets: TopicHistory['worksheets'] = {}
  for (const level of ['core', 'higher', 'advanced'] as const) {
    const done = latest(state, topicId, 'worksheet', level)
    if (done) worksheets[level] = done
  }
  const quiz = latest(state, topicId, 'quiz')
  const lesson = lessonAt ? { at: lessonAt } : undefined
  return {
    status: evidenceFor(topicId, state).status,
    lesson,
    quiz,
    worksheets,
    untouched: !lesson && !quiz && Object.keys(worksheets).length === 0 && !state.lessons[topicId],
  }
}

/** What the student has already done for one specific activity, or undefined. */
export function doneBefore(h: TopicHistory, kind: Assignment['kind'], level?: WorksheetLevel): ActivityDone | undefined {
  if (kind === 'lesson') return h.lesson
  if (kind === 'quiz') return h.quiz
  return level ? h.worksheets[level] : undefined
}

/**
 * How many are live and still to do.
 *
 * A task that has not reached its start date is deliberately not counted. The parent
 * screen promises exactly this — "a start date in the future shows the task but does not
 * count it as outstanding until then" — and counting them anyway turned a term's work
 * set in advance into sixteen things apparently due today, which is the nagging the start
 * date exists to prevent.
 */
export function outstanding(tasks: AssignedTask[]): number {
  return tasks.filter((t) => t.status !== 'done' && t.status !== 'upcoming').length
}

/** Set, but not started yet. Worth saying, so an empty "to do" does not read as "all done". */
export function upcoming(tasks: AssignedTask[]): number {
  return tasks.filter((t) => t.status === 'upcoming').length
}

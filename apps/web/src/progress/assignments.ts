import type { WorksheetLevel } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { buildTask, type Task } from './recommend.ts'
import { isoDate, type ProgressState } from './store.ts'

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

/** How many are still to do, for a count beside a heading. */
export function outstanding(tasks: AssignedTask[]): number {
  return tasks.filter((t) => t.status !== 'done').length
}

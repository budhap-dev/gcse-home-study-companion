import type { TopicSummary as Topic } from '../content/index.ts'
import type { AssignedTask } from './assignments.ts'
import { recapDoneToday, recapItems, RECAP_SIZE } from './recap.ts'
import { recommend } from './recommend.ts'
import { attemptName, evidenceFor, isoDate, type ProgressState } from './store.ts'

export interface PlanItem {
  /** Why it is on the plan, as the card's small heading. */
  label: 'Set for you' | 'Recap' | 'Next up'
  title: string
  topicTitle?: string
  reason: string
  minutes: number
  to: string
}

/**
 * Today's plan (UXI-1): up to three things, each one tap away, so a student opening the app
 * knows what to do in ten seconds.
 *
 *   1. a task a parent set, the most pressing first (overdue, then due today, then open);
 *   2. a recap: a topic whose status has faded after six weeks untouched, else the daily
 *      recap when it is not done yet today, else Redo my mistakes when there is anything
 *      to redo;
 *   3. the next step the app recommends.
 *
 * Anything short is filled from the recommendation's alternatives, and nothing appears
 * twice. It is worked out afresh from progress, so it moves on as items are done.
 */
export function todayPlan(topics: Topic[], state: ProgressState, assigned: AssignedTask[], mistakes: number, now = new Date()): PlanItem[] {
  const plan: PlanItem[] = []
  const has = (to: string) => plan.some((p) => p.to === to)
  const add = (p: PlanItem) => { if (plan.length < 3 && !has(p.to)) plan.push(p) }

  const pressing = ['overdue', 'due-today', 'open'] as const
  const set = assigned
    .filter((t) => t.task && (pressing as readonly string[]).includes(t.status))
    .sort((a, b) => pressing.indexOf(a.status as (typeof pressing)[number]) - pressing.indexOf(b.status as (typeof pressing)[number]))[0]
  if (set?.task) {
    add({ label: 'Set for you', title: set.task.title, topicTitle: set.topicTitle, reason: set.status === 'overdue' ? 'Overdue: set by a parent.' : set.status === 'due-today' ? 'Due today: set by a parent.' : 'Set by a parent.', minutes: set.task.minutes, to: set.task.to })
  }

  const { next, alternatives } = recommend(topics, state, now)
  const faded = [next, ...alternatives].find((t) => t && t.kind === 'quiz' && evidenceFor(t.topic.id, state, now).decayedFrom)
  const recap = faded || recapDoneToday(state, isoDate(now)) ? [] : recapItems(topics, state, now)
  const spread = new Set(recap.map((i) => i.topicId)).size
  if (faded) add({ label: 'Recap', title: faded.title, topicTitle: faded.topic.title, reason: faded.reason, minutes: faded.minutes, to: faded.to })
  else if (recap.length) add({ label: 'Recap', title: 'Daily recap', reason: `${recap.length} questions from ${spread} topics you have studied, a new mix each day.`, minutes: RECAP_SIZE, to: '/recap' })
  else if (mistakes > 0) add({ label: 'Recap', title: 'Redo my mistakes', reason: `${mistakes} question${mistakes === 1 ? '' : 's'} you got wrong, newest first.`, minutes: Math.max(5, Math.round(mistakes * 1.5)), to: '/mistakes' })

  for (const t of [next, ...alternatives]) {
    if (t) add({ label: 'Next up', title: t.title, topicTitle: t.topic.title, reason: t.reason, minutes: t.minutes, to: t.to })
  }
  return plan
}

export interface DoneItem { what: string; topicTitle: string; detail?: string }

/** What was finished today, so the plan shows progress as well as what is left. */
export function doneToday(topics: Topic[], state: ProgressState, today = isoDate()): DoneItem[] {
  const title = new Map(topics.map((t) => [t.id, t.title]))
  const out: DoneItem[] = []
  for (const a of state.attempts) {
    if (a.completedAt.slice(0, 10) !== today) continue
    const what = attemptName(a)
    out.push({ what, topicTitle: title.get(a.topicId) ?? a.topicId, detail: a.marksAvailable ? `${Math.round((100 * a.marksScored) / a.marksAvailable)}%` : undefined })
  }
  for (const l of Object.values(state.lessons)) {
    if (l.completedAt?.slice(0, 10) === today) out.push({ what: 'Lesson', topicTitle: title.get(l.topicId) ?? l.topicId })
  }
  return out
}

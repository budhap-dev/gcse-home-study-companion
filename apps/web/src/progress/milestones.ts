import { getSubject } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { evidenceFor, type ProgressState } from './store.ts'

export interface Milestone {
  id: string
  kind: 'mastered' | 'unit'
  subjectId: string
  /** "Quadratic curves", or "Algebra" for a unit. */
  title: string
  /** One line under the title. */
  detail: string
}

const SECURE_OR_BETTER = new Set(['secure', 'grade-9-ready'])

/**
 * The milestones reached in a state (MTV-3): each topic at Mastered, and each unit whose
 * every topic is Secure or better. The caller records the ones not reached before, which
 * are the ones to celebrate now.
 */
export function milestonesIn(state: ProgressState, now = new Date()): Milestone[] {
  const status = new Map(TOPICS.map((t) => [t.id, evidenceFor(t.id, state, now).status]))
  const out: Milestone[] = []
  for (const t of TOPICS) {
    if (status.get(t.id) === 'grade-9-ready') {
      out.push({ id: `mastered:${t.id}`, kind: 'mastered', subjectId: t.subjectId, title: t.title, detail: `Mastered in ${getSubject(t.subjectId)?.name ?? t.subjectId}` })
    }
  }
  const units = new Map<string, typeof TOPICS>()
  for (const t of TOPICS) units.set(`${t.subjectId}/${t.unitId}`, [...(units.get(`${t.subjectId}/${t.unitId}`) ?? []), t])
  for (const [key, topics] of units) {
    if (!topics.every((t) => SECURE_OR_BETTER.has(status.get(t.id)!))) continue
    const [subjectId, unitId] = key.split('/') as [string, string]
    const subject = getSubject(subjectId)
    const name = subject?.units.find((u) => u.id === unitId)?.name ?? unitId
    out.push({ id: `unit:${key}`, kind: 'unit', subjectId, title: name, detail: `${subject?.name ?? subjectId} unit finished: all ${topics.length} topics Secure or better` })
  }
  return out
}

/** A milestone recorded earlier, rebuilt from its id for the Progress page. */
export function describeMilestone(id: string): Milestone | undefined {
  const [kind, rest = ''] = id.split(':') as [string, string]
  if (kind === 'mastered') {
    const t = TOPICS.find((x) => x.id === rest)
    return t && { id, kind: 'mastered', subjectId: t.subjectId, title: t.title, detail: `Mastered in ${getSubject(t.subjectId)?.name ?? t.subjectId}` }
  }
  if (kind === 'unit') {
    const [subjectId = '', unitId = ''] = rest.split('/')
    const subject = getSubject(subjectId)
    const name = subject?.units.find((u) => u.id === unitId)?.name
    return name ? { id, kind: 'unit', subjectId, title: name, detail: `${subject!.name} unit finished` } : undefined
  }
  return undefined
}

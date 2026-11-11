import type { GradeBand } from '@study/shared'
import { useId } from 'react'
import type { TopicSummary } from '../content/index.ts'
import { rangeLabel, workingAt, workingAtNote, type WorkingAt } from '../progress/grade.ts'
import { TARGET_GRADES, setTarget, targetFor, type ProgressState } from '../progress/store.ts'

/** The band whose questions carry the marks a target needs. */
function bandFor(target: number): GradeBand {
  return target >= 8 ? '8-9' : target >= 6 ? '6-7' : '4-5'
}

const WORKSHEET: Record<GradeBand, string> = { '4-5': 'Core', '6-7': 'Higher', '8-9': 'Advanced' }

/** Where the student stands against the target, in a line. */
export function targetLine(w: WorkingAt, target: number | undefined, you = true): string | undefined {
  const own = you ? 'your' : 'the'
  if (target === undefined || w.kind !== 'estimate') return undefined
  if (w.low >= target) return `At or above ${own} target of ${target}.`
  if (w.high >= target) return `Within reach of ${own} target of ${target}: it sits in the range.`
  const band = bandFor(target)
  const gap = target - w.high
  return `${gap} ${gap === 1 ? 'grade' : 'grades'} below ${own} target of ${target}. The marks to win are on grade ${band.replace('-', '–')} questions, as in the ${WORKSHEET[band]} worksheets.`
}

/**
 * Working-at grade beside the target, for one subject (MTV-2, LRN-6). The student sets the
 * target here; a parent's copy (`readOnly`) shows it without the choice.
 */
export function GradePanel({ subjectId, topics, progress, readOnly = false, now }: { subjectId: string; topics: TopicSummary[]; progress: ProgressState; readOnly?: boolean; now?: Date }) {
  const w = workingAt(topics, progress, now)
  const target = targetFor(progress, subjectId)
  const id = useId()
  const line = targetLine(w, target, !readOnly)
  return (
    <section aria-label="Grade" className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Working at</span>
          <span className="text-3xl font-bold leading-tight" data-working-at={w.kind === 'estimate' ? rangeLabel(w) : ''}>
            {w.kind === 'estimate' ? rangeLabel(w) : <span className="text-ink-3">Not yet</span>}
          </span>
        </div>
        <div className="flex flex-col">
          <label htmlFor={id} className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Target</label>
          {readOnly ? (
            <span className="text-3xl font-bold leading-tight">{target ?? <span className="text-ink-3">None set</span>}</span>
          ) : (
            <select
              id={id}
              value={target ?? ''}
              onChange={(e) => setTarget(subjectId, e.target.value ? Number(e.target.value) : undefined)}
              className="h-11 min-w-28 rounded-lg border border-rule bg-surface px-3 text-lg font-bold"
            >
              <option value="">None set</option>
              {TARGET_GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          )}
        </div>
      </div>
      {line && <p className="text-sm font-bold">{line}</p>}
      <p className="text-sm text-ink-2">{workingAtNote(w)}</p>
    </section>
  )
}

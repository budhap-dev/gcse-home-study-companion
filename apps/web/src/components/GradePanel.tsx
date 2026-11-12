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
 * Working-at grade beside the target, for one subject (MTV-2, LRN-6), as two matching columns:
 * a label and a value of the same size on one line, so the pair reads at a glance. Until there
 * are enough answers for an estimate, the working-at side shows how far there is to go, with a
 * bar, rather than a grey "Not yet". The target is grade 9 unless the student picks another;
 * a parent's copy (`readOnly`) shows it without the choice.
 */
export function GradePanel({ subjectId, topics, progress, readOnly = false, now }: { subjectId: string; topics: TopicSummary[]; progress: ProgressState; readOnly?: boolean; now?: Date }) {
  const w = workingAt(topics, progress, now)
  const target = targetFor(progress, subjectId)
  const id = useId()
  const line = targetLine(w, target, !readOnly)
  const label = 'text-xs font-bold uppercase tracking-[0.08em] text-ink-2'
  const value = 'flex h-12 items-center text-3xl font-bold leading-none'
  return (
    <section aria-label="Grade" className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className={label}>Working at</span>
          {w.kind === 'estimate' ? (
            <span className={value} data-working-at={rangeLabel(w)}>{rangeLabel(w)}</span>
          ) : (
            <div className="flex h-12 flex-col justify-center gap-1.5" data-working-at="">
              <span className="text-base font-bold leading-none">{w.answers} of {w.answers + w.need} answers</span>
              <span className="h-2 w-full max-w-40 overflow-hidden rounded-full bg-panel" role="progressbar" aria-label="Answers towards an estimate" aria-valuemin={0} aria-valuemax={w.answers + w.need} aria-valuenow={w.answers}>
                <span className="block h-full rounded-full bg-[color:var(--subject)]" style={{ width: `${Math.round((100 * w.answers) / (w.answers + w.need))}%` }} />
              </span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label htmlFor={id} className={label}>Target</label>
          {readOnly ? (
            <span className={value}>{target}</span>
          ) : (
            <span className="relative w-fit">
              <select
                id={id}
                value={target}
                onChange={(e) => setTarget(subjectId, Number(e.target.value))}
                className="h-12 appearance-none rounded-xl border border-rule bg-surface py-0 pl-3 pr-9 text-3xl font-bold leading-none"
              >
                {TARGET_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"><path d="M6 9l6 6 6-6" /></svg>
            </span>
          )}
        </div>
      </div>
      {line && <p className="text-sm font-bold">{line}</p>}
      <p className="text-sm text-ink-2">{workingAtNote(w)}</p>
    </section>
  )
}

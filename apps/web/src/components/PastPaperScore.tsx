import { gradeFor, lowestGrade, type PastPaper, type PastSeries } from '@study/shared'
import { useId, useState } from 'react'
import { logPastPaper, removePastPaper, type PastPaperLog } from '../progress/store.ts'
import { useProgress } from '../progress/useProgress.ts'

function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** The student's live (not taken back) scores on one paper, newest first. */
export function logsFor(logs: PastPaperLog[], subjectId: string, seriesId: string, paperId: string): PastPaperLog[] {
  return logs.filter((x) => !x.removed && x.subjectId === subjectId && x.seriesId === seriesId && x.paperId === paperId).sort((a, b) => b.at.localeCompare(a.at))
}

function gradeLine(score: number, paper: PastPaper, series: PastSeries): string {
  if (!paper.grades) {
    return series.boundaries
      ? 'No grade: the board gives no boundaries for this paper on its own.'
      : 'No grade: the board’s boundaries for this series could not be found on its site.'
  }
  const g = gradeFor(score, paper.grades)
  return g === null ? `Below grade ${lowestGrade(paper.grades)} on the board’s boundary for this paper` : `Grade ${g} on the board’s boundary for this paper`
}

/**
 * Log a score on a board past paper (section 14, box 6): the student marks the paper with the
 * board's mark scheme and enters the total here; the board's own notional boundary for this
 * paper in this series turns it into a grade, an estimate the page says is one.
 */
export function PastPaperScore({ subjectId, series, paper }: { subjectId: string; series: PastSeries; paper: PastPaper }) {
  const state = useProgress()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputId = useId()
  const max = paper.marks
  if (max === undefined) return null
  const logs = logsFor(state.pastPapers, subjectId, series.id, paper.id)
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isInteger(n) && n >= 0 && n <= max

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    logPastPaper({ subjectId, seriesId: series.id, paperId: paper.id, score: n })
    setValue('')
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {logs.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm" aria-label={`Your scores on ${paper.name}`}>
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-bold tabular-nums">{l.score} / {max}</span>
              <span className="text-ink-2">{gradeLine(l.score, paper, series)} · {day(l.at)}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => removePastPaper(l.id)}>Remove<span className="sr-only"> this score</span></button>
            </li>
          ))}
        </ul>
      )}
      {open ? (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <label htmlFor={inputId} className="flex flex-col gap-1 text-sm">
            <span>Your mark out of {max}, from the board’s mark scheme</span>
            <input id={inputId} inputMode="numeric" pattern="[0-9]*" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
              className="w-28 rounded-lg border border-rule bg-surface px-3 py-2 text-base tabular-nums" aria-describedby={`${inputId}-hint`} />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!valid}>Save</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setOpen(false); setValue('') }}>Cancel</button>
          <p id={`${inputId}-hint`} className="w-full text-xs text-ink-2">{value !== '' && !valid ? `A whole number from 0 to ${max}.` : 'Kept with the rest of your progress.'}</p>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm w-fit" onClick={() => setOpen(true)}>{logs.length ? 'Log another score' : 'Log your score'}</button>
      )}
    </div>
  )
}

/**
 * The real grade, once every paper of a series has a score: the latest score on each, added,
 * against the board's boundaries for the whole subject. Only where the papers listed make up
 * the subject (the schema holds that), so Music, with its coursework, never shows one.
 */
export function SeriesGrade({ subjectId, series }: { subjectId: string; series: PastSeries }) {
  const state = useProgress()
  const subject = series.boundaries?.subject
  if (!subject) return null
  const latest = series.papers.map((p) => logsFor(state.pastPapers, subjectId, series.id, p.id)[0])
  if (latest.some((l) => !l)) return null
  const total = latest.reduce((t, l) => t + l!.score, 0)
  const g = gradeFor(total, subject.grades)
  return (
    <p className="rounded-xl border border-rule bg-panel px-4 py-3 text-sm">
      <span className="font-bold">All {series.papers.length} papers: {total} / {subject.max}.</span>{' '}
      {g === null ? `Below grade ${lowestGrade(subject.grades)}` : `Grade ${g}`} on the board’s boundaries for the whole subject in {series.label}, the grade you would have been given.
    </p>
  )
}

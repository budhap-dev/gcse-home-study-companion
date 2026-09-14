import { getSubject, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { Link, useParams } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { topicsForSubject, topicsForUnit, topicsForYear, yearsForSubject } from '../../content/index.ts'
import { evidenceFor } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

export function TopicMap() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const progress = useProgress()
  if (!subject) return <p>Unknown subject.</p>
  const all = topicsForSubject(subject.id)
  const ready = all.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
  const years = yearsForSubject(subject.id)
  const latestYear = years[years.length - 1] ?? 0
  const yearless = subject.units.filter((u) => topicsForUnit(subject.id, u.id).length === 0)

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{subject.board}</p>
        <h1 className="text-3xl font-bold leading-tight">{subject.name}</h1>
        <p className="text-ink-2">
          {all.length === 0 ? 'No topics written yet.' : <><strong className="text-ink">{ready} of {all.length}</strong> topics Grade 9 ready</>}
        </p>
      </header>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {TOPIC_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} size={12} />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>

      {/*
        Topics are grouped by the school year the class meets them in, then by
        specification unit inside the year. A year the student has already had is
        still here, because the synoptic tests and milestones keep re-testing it.
      */}
      <section className="flex flex-col gap-8">
        {years.map((year) => {
          const inYear = topicsForYear(subject.id, year)
          const units = subject.units.filter((u) => inYear.some((t) => t.unitId === u.id))
          const readyInYear = inYear.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
          return (
            <div key={year} className="flex flex-col gap-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule pb-2">
                <h2 className="text-xl font-bold">Year {year}</h2>
                <p className="text-sm text-ink-2">
                  {inYear.length} {inYear.length === 1 ? 'topic' : 'topics'} · {readyInYear} Grade 9 ready
                  {year < latestYear && ' · taught in an earlier year, kept for recap'}
                </p>
              </div>
              {units.map((unit) => (
                <div key={unit.id} className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{unit.name}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {inYear.filter((t) => t.unitId === unit.id).map((t) => {
                      const status = evidenceFor(t.id, progress).status
                      return (
                        <li key={t.id}>
                          <Link
                            to={`/subjects/${subject.id}/topics/${t.id}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rule bg-surface px-3 py-2 text-sm hover:border-[color:var(--subject)]"
                          >
                            <StatusIcon status={status} />
                            <span>{t.title}</span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )
        })}
        {yearless.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">Not yet written</h2>
            <p className="text-sm text-ink-3">{yearless.map((u) => u.name).join(' · ')}</p>
          </div>
        )}
        <Link to={`/subjects/${subject.id}/exam-technique`} className="w-fit text-sm font-bold underline">Exam technique guide</Link>
      </section>
    </article>
  )
}

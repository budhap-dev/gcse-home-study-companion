import { getSubject, STATUS_LABEL, SYLLABUS, TOPIC_STATUSES } from '@study/shared'
import { Link, useParams } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { evidenceFor } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

const YEAR_NOTE: Record<number, string> = {
  9: 'Taught before the app existed. These are here as recap, because the milestones and synoptic tests keep coming back to them.',
  10: 'This year’s work.',
  11: 'Next year’s work.',
}

export function TopicMap() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const progress = useProgress()
  if (!subject) return <p>Unknown subject.</p>
  const written = topicsForSubject(subject.id)
  const ready = written.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
  const blocks = SYLLABUS[subject.id] ?? []
  const years = [...new Set(blocks.map((b) => b.year))].sort((a, b) => a - b)
  const planned = blocks.reduce((n, b) => n + b.topics.length, 0)

  return (
    <article className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{subject.board}</p>
        <h1 className="text-3xl font-bold leading-tight">{subject.name}</h1>
        <p className="text-ink-2">
          <strong className="text-ink">{ready} of {written.length}</strong> written topics Grade 9 ready
          {planned > written.length && <> · <strong className="text-ink">{written.length} of {planned}</strong> topics written so far</>}
        </p>
      </header>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {TOPIC_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} size={12} />
            {STATUS_LABEL[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-dashed border-ink-3" />
          Coming soon
        </li>
      </ul>

      {/*
        The whole syllabus, not only what is written: a topic still to be written shows
        as Coming soon rather than being absent, so it is clear what is left. Years come
        from the school's curriculum overview, terms from its half terms.
      */}
      <section className="flex flex-col gap-8">
        {years.map((year) => {
          const inYear = blocks.filter((b) => b.year === year)
          const total = inYear.reduce((n, b) => n + b.topics.length, 0)
          const done = inYear.reduce((n, b) => n + b.topics.filter((t) => t.topicId).length, 0)
          return (
            <div key={year} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 border-b border-rule pb-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl font-bold">Year {year}</h2>
                  <p className="text-sm text-ink-2">{done} of {total} written</p>
                </div>
                {YEAR_NOTE[year] && <p className="max-w-[70ch] text-sm text-ink-3">{YEAR_NOTE[year]}</p>}
              </div>

              {inYear.map((block) => (
                <div key={`${year}-${block.term}`} className="flex flex-col gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{block.term}</h3>
                  <ul className="flex flex-wrap gap-2">
                    {block.topics.map((entry) => {
                      if (!entry.topicId) {
                        return (
                          <li key={entry.title}>
                            <span className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-rule bg-transparent px-3 py-2 text-sm text-ink-3">
                              <span>{entry.title}</span>
                              <span className="rounded-full bg-panel px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">Soon</span>
                            </span>
                          </li>
                        )
                      }
                      const status = evidenceFor(entry.topicId, progress).status
                      return (
                        <li key={entry.topicId}>
                          <Link
                            to={`/subjects/${subject.id}/topics/${entry.topicId}`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-rule bg-surface px-3 py-2 text-sm hover:border-[color:var(--subject)]"
                          >
                            <StatusIcon status={status} />
                            <span>{entry.title}</span>
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
        <Link to={`/subjects/${subject.id}/exam-technique`} className="w-fit text-sm font-bold underline">Exam technique guide</Link>
      </section>
    </article>
  )
}

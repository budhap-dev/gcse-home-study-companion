import { getSubject, STATUS_LABEL, SYLLABUS, TOPIC_STATUSES } from '@study/shared'
import type { SyllabusBlock } from '@study/shared'
import { Link, useParams } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { SpecNumber } from '../../components/SpecNumber.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { evidenceFor } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { ResetProgress } from '../../components/ResetProgress.tsx'

const YEAR_NOTE: Record<number, string> = {
  9: 'Taught before the app existed. Kept as recap, because the milestones and synoptic tests keep coming back to it.',
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
  const blocks: SyllabusBlock[] = SYLLABUS[subject.id] ?? []
  const years = [...new Set(blocks.map((b) => b.year))].sort((a, b) => a - b)
  const planned = blocks.reduce((n, b) => n + b.topics.length, 0)
  // Open the year the student is working through: the latest one that has any topic
  // written. Earlier years are recap and later ones are not started, so both stay shut.
  const current = years.filter((y) => blocks.some((b) => b.year === y && b.topics.some((t) => t.topicId))).pop() ?? years[0]
  /** Has the student done anything on any of these topics? Drives whether a reset is offered. */
  const studied = (ids: string[]) => ids.some((id) => progress.attempts.some((a) => a.topicId === id) || Boolean(progress.lessons[id]))
  const subjectTopicIds = written.map((t) => t.id)
  // Where the board numbers its sections, the number goes in front of the title.
  const specCodes = new Map(written.map((t) => [t.id, t.specCode]))

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{subject.board}</p>
        <h1 className="text-3xl font-bold leading-tight">{subject.name}</h1>
        <p className="text-ink-2">
          <strong className="text-ink">{ready} of {written.length}</strong> written topics mastered
          {planned > written.length && <> · <strong className="text-ink">{written.length} of {planned}</strong> topics available</>}
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
        One accordion per school year, holding the whole syllabus for that year as a
        list. Native details and summary, so it opens without JavaScript and a keyboard
        reaches it. The year in progress starts open; recap and future years start shut.
      */}
      <section className="flex flex-col gap-3">
        {years.map((year) => {
          const inYear = blocks.filter((b) => b.year === year)
          const total = inYear.reduce((n, b) => n + b.topics.length, 0)
          const done = inYear.reduce((n, b) => n + b.topics.filter((t) => t.topicId).length, 0)
          return (
            <details key={year} open={year === current} className="accordion group rounded-xl border border-rule bg-surface">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">▶</span>
                <span className="text-lg font-bold">Year {year}</span>
                <span className="ml-auto shrink-0 text-sm text-ink-2">{done} of {total} available</span>
              </summary>

              {/* The clipped box carries no border or padding of its own: a border on it
                  would still paint a hairline when the row has collapsed to nothing. */}
              <div className="accordion-panel">
                <div className="flex flex-col gap-5 border-t border-rule px-4 pb-4 pt-3">
                {YEAR_NOTE[year] && <p className="text-sm text-ink-3">{YEAR_NOTE[year]}</p>}
                {inYear.map((block) => (
                  <div key={`${year}-${block.term}`} className="flex flex-col gap-1.5">
                    <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{block.term}</h3>
                    <ul className="flex flex-col">
                      {block.topics.map((entry) =>
                        entry.topicId ? (
                          <li key={entry.topicId} className="border-b border-rule/60 last:border-b-0">
                            <Link
                              to={`/subjects/${subject.id}/topics/${entry.topicId}`}
                              className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-panel"
                            >
                              <StatusIcon status={evidenceFor(entry.topicId, progress).status} />
                              <SpecNumber code={specCodes.get(entry.topicId)} />
                              <span>{entry.title}</span>
                            </Link>
                          </li>
                        ) : (
                          <li key={entry.title} className="border-b border-rule/60 last:border-b-0">
                            <span className="flex min-h-11 items-center gap-3 px-2 py-2 text-sm text-ink-3">
                              <span aria-hidden className="inline-block h-4 w-4 shrink-0 rounded-full border border-dashed border-ink-3" />
                              <span>{entry.title}</span>
                              <span className="ml-auto shrink-0 rounded-full bg-panel px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                                Coming soon
                              </span>
                            </span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                ))}
                {(() => {
                  const yearTopicIds = inYear.flatMap((b) => b.topics.map((t) => t.topicId).filter((id): id is string => Boolean(id)))
                  return (
                    <ResetProgress
                      label={`Reset Year ${year}`}
                      what={`Year ${year} ${subject.name}`}
                      topicIds={yearTopicIds}
                      hasProgress={studied(yearTopicIds)}
                    />
                  )
                })()}
                </div>
              </div>
            </details>
          )
        })}
        {/* A standalone link, so it needs a thumb-sized target rather than the 20px a bare line of text gives. */}
        <Link to={`/subjects/${subject.id}/exam-technique`} className="flex w-fit items-center py-2 text-sm font-bold underline">Exam technique guide</Link>
        <ResetProgress
          label={`Reset all ${subject.name}`}
          what={`all of ${subject.name}`}
          topicIds={subjectTopicIds}
          hasProgress={studied(subjectTopicIds)}
        />
      </section>
    </article>
  )
}

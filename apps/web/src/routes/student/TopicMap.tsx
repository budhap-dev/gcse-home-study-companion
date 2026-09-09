import { getSubject, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { Link, useParams } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { topicsForSubject, topicsForUnit } from '../../content/index.ts'
import { evidenceFor } from '../../progress/store.ts'
import { useProgress } from '../../progress/useProgress.ts'

export function TopicMap() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const progress = useProgress()
  if (!subject) return <p>Unknown subject.</p>
  const all = topicsForSubject(subject.id)
  const ready = all.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length

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

      <section className="flex flex-col gap-5">
        {subject.units.map((unit) => {
          const topics = topicsForUnit(subject.id, unit.id)
          return (
            <div key={unit.id} className="flex flex-col gap-2">
              <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{unit.name}</h2>
              {topics.length === 0 ? (
                <p className="text-sm text-ink-3">Coming soon</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {topics.map((t) => {
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
              )}
            </div>
          )
        })}
        <Link to={`/subjects/${subject.id}/exam-technique`} className="w-fit text-sm font-bold underline">Exam technique guide</Link>
      </section>
    </article>
  )
}

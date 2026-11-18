import { covers, getSubject, NO_TOPIC, specPoints, UNTAUGHT_POINTS } from '@study/shared'
import { Link, useParams } from 'react-router'
import { BackLink } from '../../components/BackLink.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { MAP_LEVEL_LABEL, square } from '../../progress/map.ts'
import { useProgress } from '../../progress/useProgress.ts'

/**
 * The specification checklist (specification order, step 3, 18 November 2026): every
 * numbered point of the board's specification, in the board's words, with the topics that
 * teach it and how far the student is with each. A point no topic teaches is listed all the
 * same, with the reason, so the whole specification is visible and a gap is never a silence.
 */
export function Specification() {
  const { subjectId = '' } = useParams()
  const subject = getSubject(subjectId)
  const progress = useProgress()
  if (!subject) return <p>Unknown subject.</p>
  const sections = specPoints(subject.id)
  const topics = topicsForSubject(subject.id)
  const squares = new Map(topics.map((t) => [t.id, square(t, progress)]))
  const teaching = (code: string) => topics.filter((t) => covers(t.specPoints, code))
  const untaught = (topicId: string, code: string) => UNTAUGHT_POINTS[topicId]?.[code]
  const points = sections.flatMap((s) => s.points)
  const withTopic = points.filter((p) => teaching(p.code).length > 0).length
  const secure = points.filter((p) => teaching(p.code).some((t) => (squares.get(t.id)?.level ?? 0) >= 3)).length

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <BackLink to={`/subjects/${subject.id}`} label={`Back to ${subject.name}`} />
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{subject.name} · {subject.board}</p>
        <h1 className="text-3xl font-bold leading-tight">Specification checklist</h1>
        {points.length === 0 ? (
          <p className="text-ink-2">The {subject.board} specification has no numbered points to check off here yet.</p>
        ) : (
          <>
            <p className="text-ink-2">
              Every numbered point of the {subject.board} specification, in the board’s own words, with the topics that teach it and how far you are with each.
            </p>
            <p className="font-bold">
              {withTopic} of {points.length} points have a topic · {secure} secure or mastered
            </p>
          </>
        )}
      </header>

      {sections.map((s) => (
        <section key={s.id} aria-labelledby={`spec-${s.id}`} className="flex flex-col gap-3">
          <h2 id={`spec-${s.id}`} className="text-xl font-bold">{s.name}</h2>
          <ol className="flex flex-col divide-y divide-rule rounded-2xl border border-rule bg-surface">
            {s.points.map((p) => {
              const ts = teaching(p.code)
              const why = NO_TOPIC[subject.id]?.[p.code]
              return (
                <li key={p.code} id={`point-${p.code}`} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:gap-4">
                  <span className="w-16 shrink-0 font-bold tabular-nums accent-ink">{p.code}</span>
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="text-[15px] leading-snug">{p.text}</p>
                    {ts.length > 0 ? (
                      <ul className="flex flex-wrap gap-2" aria-label={`Topics for ${p.code}`}>
                        {ts.map((t) => {
                          const level = squares.get(t.id)?.level ?? 0
                          const gap = untaught(t.id, p.code)
                          return (
                            <li key={t.id}>
                              <Link to={`/subjects/${subject.id}/topics/${t.id}`} className="flex items-center gap-1.5 rounded-full border border-rule px-3 py-1 text-[13px] font-bold">
                                <span aria-hidden className={`map-sq map-l${level} inline-block h-3 w-3 shrink-0 rounded-[3px]`} />
                                {t.title}
                                <span className="font-normal text-ink-2">· {gap ? 'listed, not yet taught' : MAP_LEVEL_LABEL[level].toLowerCase()}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="text-sm text-ink-2"><span className="font-bold text-ink">No topic.</span> {why}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
    </article>
  )
}

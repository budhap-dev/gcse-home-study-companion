import { getSubject, STATUS_COLOUR, STATUS_LABEL, TOPIC_STATUSES } from '@study/shared'
import { Link, useParams } from 'react-router'
import { Placeholder } from '../../components/Placeholder.tsx'

export function TopicMap() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  return (
    <Placeholder
      area={subject?.name ?? 'Subject'}
      title={'Topic map'}
      description="Topics grouped by unit in specification order, coloured and shaped by status. Tap a topic for the evidence behind it."
      stories={["LRN-1", "PRG-1"]}
      blocks={["Grade 9 ready count out of total", "Status legend with shapes", "Units with topic chips", "Evidence sheet for the selected topic"]}
    >
      <ul className="flex flex-wrap gap-4 text-xs text-ink-2">
        {TOPIC_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLOUR[s] }} aria-hidden />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ul>
      <section className="flex flex-col gap-4">
        {(subject?.units ?? []).map((unit) => (
          <div key={unit} className="flex flex-col gap-2">
            <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{unit}</h2>
            <Link
              to={`/subjects/${subject?.id}/topics/${encodeURIComponent(unit.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}-1`}
              className="w-fit rounded-lg border border-dashed border-rule bg-surface px-3 py-2 text-sm text-ink-2"
            >
              Topics for {unit} will appear here
            </Link>
          </div>
        ))}
        <Link to={`/subjects/${subject?.id}/exam-technique`} className="w-fit text-sm font-bold underline">Exam technique guide</Link>
      </section>
    </Placeholder>
  )
}

import { SUBJECTS } from '@study/shared'
import { Link } from 'react-router'
import { topicsForSubject } from '../../content/index.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { evidenceFor } from '../../progress/store.ts'

export function Subjects() {
  const progress = useProgress()
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Subjects</h1>
        <p className="max-w-[65ch] text-ink-2">Eight subjects at Higher tier, pitched at grade 9. Topics appear here as they are written.</p>
      </header>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUBJECTS.map((s) => {
          const topics = topicsForSubject(s.id)
          const ready = topics.filter((t) => evidenceFor(t.id, progress).status === 'grade-9-ready').length
          return (
            <li key={s.id}>
              <Link
                to={`/subjects/${s.id}`}
                style={{ '--subject': s.colour } as React.CSSProperties}
                className="flex items-center gap-3 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]"
              >
                <span className="h-3 w-3 rounded-sm" style={{ background: s.colour }} aria-hidden />
                <span className="flex flex-col">
                  <span className="font-bold">{s.name}</span>
                  <span className="text-xs text-ink-2">
                    {s.board} · {topics.length === 0 ? 'no topics yet' : `${ready} of ${topics.length} Grade 9 ready`}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </article>
  )
}

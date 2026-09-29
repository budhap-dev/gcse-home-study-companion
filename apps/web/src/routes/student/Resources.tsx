import { SUBJECTS, isComingSoon } from '@study/shared'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { ResourceBadges, StatusBadge } from '../../components/resources/ResourceParts.tsx'
import { RESOURCES } from '../../content/resources.ts'
import { BackToTop } from '../../components/BackToTop.tsx'

/** How long an entrance waits, in seconds: a step for each place in the list, up to a cap, so the last is not kept waiting. */
export const stagger = (index: number, step = 0.05, from = 0, cap = 0.6) => `${Math.min(from + index * step, cap).toFixed(2)}s`

/**
 * Every formula sheet, table and chart, grouped by subject. `?subject=` narrows it to one,
 * which is where each subject page's Resources button lands. The planned ones are listed
 * as Coming soon rather than left out, so the whole plan is visible from the start.
 */
export function Resources() {
  const [params, setParams] = useSearchParams()
  const subjectId = params.get('subject') ?? ''
  const subjects = useMemo(() => SUBJECTS.filter((s) => RESOURCES.some((r) => r.subjectId === s.id)), [])
  const shown = subjects.filter((s) => !subjectId || s.id === subjectId)
  const ready = RESOURCES.filter((r) => !isComingSoon(r)).length

  const pick = (id: string) => setParams(id && id !== subjectId ? { subject: id } : {}, { replace: true })

  return (
    <article className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="anim-rise flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Resources</h1>
        <p className="text-ink-2">
          Formula sheets, the periodic table, symbols and charts, each redrawn from the exam board’s own documents, with a link to the original.
          {ready < RESOURCES.length && <>{' '}{ready} of {RESOURCES.length} are ready; the rest are on their way.</>}
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-2" aria-label="What the badges mean">
          <li className="flex items-center gap-1.5"><StatusBadge status="given" /> printed in the exam paper</li>
          <li className="flex items-center gap-1.5"><StatusBadge status="learn" /> not in the paper</li>
          <li className="flex items-center gap-1.5"><StatusBadge status="reference" /> a map of the course</li>
        </ul>
      </header>

      <div className="flex flex-wrap gap-1.5">
        <Chip on={subjectId === ''} onClick={() => pick('')}>All subjects</Chip>
        {subjects.map((s) => (
          <Chip key={s.id} on={subjectId === s.id} colour={s.colour} onClick={() => pick(s.id)}>{s.name}</Chip>
        ))}
      </div>

      {shown.map((subject, si) => (
        <section key={subject.id} className="anim-rise flex flex-col gap-3" style={{ '--subject': subject.colour, '--subject-soft': `${subject.colour}1a`, '--d': stagger(si, 0.06, 0.05, 0.35) } as React.CSSProperties}>
          <h2 className="flex flex-wrap items-baseline gap-x-3 border-b border-rule pb-1">
            <span className="text-2xl font-bold">{subject.name}</span>
            <span className="text-sm font-bold uppercase tracking-[0.08em] accent-ink">{subject.board}</span>
          </h2>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RESOURCES.filter((r) => r.subjectId === subject.id).map((r, ri) => {
              const soon = isComingSoon(r)
              return (
                // The entrance is on the item and the lift on the link inside it: an entrance
                // holds its last frame, which would pin the link flat under the pointer.
                <li key={r.id} className="anim-rise" style={{ '--d': stagger(ri, 0.05, 0.12 + Math.min(si, 5) * 0.06) } as React.CSSProperties}>
                  <Link
                    to={`/resources/${r.subjectId}/${r.id}`}
                    className={`lift flex h-full flex-col gap-2 rounded-2xl border p-4 ${soon ? 'border-dashed border-rule bg-transparent' : 'border-rule bg-surface'}`}
                    style={soon ? undefined : { borderTop: `4px solid ${subject.colour}` }}
                  >
                    <ResourceBadges resource={r} />
                    <span className="text-lg font-bold leading-snug">{r.title}</span>
                    <RichText source={r.summary} className={`text-sm ${soon ? 'text-ink-3' : 'text-ink-2'}`} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <BackToTop />
    </article>
  )
}

function Chip({ on, colour, onClick, children }: { on: boolean; colour?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 rounded-full border px-3 text-sm font-bold ${on ? 'border-transparent' : 'border-rule bg-surface text-ink-2'}`}
      // As on the glossary: a subject accent takes white, the theme's ink takes the surface.
      style={on ? { background: colour ?? 'var(--color-ink)', color: colour ? '#fff' : 'var(--color-surface)' } : undefined}
    >
      {children}
    </button>
  )
}

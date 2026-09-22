import { Link } from 'react-router'
import { getSubject } from '@study/shared'
import { TOPICS } from '../content/index.ts'
import { termByName, type Term } from '../content/glossary.ts'
import { Highlight } from './Highlight.tsx'
import { RichText } from './RichText.tsx'

function titleOf(id: string): string {
  return TOPICS.find((t) => t.id === id)?.title ?? id
}

/**
 * A glossary term in full: what it means, then a concrete instance of it, then where it
 * is taught and what to read next. The example is not decoration — a definition alone
 * rarely settles what a term means, which is why the schema requires one.
 */
export function TermCard({ term, query = '', id }: { term: Term; query?: string; id?: string }) {
  const subject = getSubject(term.subjectId)
  const related = term.related.map((name) => termByName(name, term.subjectId)).filter((t): t is Term => Boolean(t))
  return (
    <div id={id} className="flex scroll-mt-20 flex-col gap-2 rounded-xl border border-rule bg-surface p-4" style={{ '--subject': subject?.colour } as React.CSSProperties}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-lg font-bold leading-tight"><Highlight text={term.term} query={query} /></h3>
        <span className="text-xs font-bold accent-ink">{subject?.name ?? term.subjectId}</span>
      </div>

      <RichText source={term.definition} className="text-sm" />

      <div className="rounded-lg bg-panel px-3 py-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">Example</span>
        <RichText source={term.example} className="mt-1 text-sm" />
      </div>

      {term.topics.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <span>Taught in</span>
          {term.topics.map((topicId) => (
            <Link key={topicId} to={`/subjects/${term.subjectId}/topics/${topicId}`} className="inline-block py-1 font-bold text-ink underline">
              {titleOf(topicId)}
            </Link>
          ))}
        </p>
      )}

      {related.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
          <span>See also</span>
          {related.map((r) => (
            <Link key={r.slug} to={`/glossary?term=${r.slug}`} className="rounded-full border border-rule px-2 py-1 font-bold text-ink">
              {r.term}
            </Link>
          ))}
        </p>
      )}
    </div>
  )
}

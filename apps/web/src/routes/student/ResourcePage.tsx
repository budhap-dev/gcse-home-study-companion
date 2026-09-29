import { getSubject, isComingSoon, type ResourceLink } from '@study/shared'
import { Link, useParams } from 'react-router'
import { SectionLabel } from '../../components/KindChip.tsx'
import { Blocks, Prose, ResourceBadges } from '../../components/resources/ResourceParts.tsx'
import { TOPICS } from '../../content/index.ts'
import { getResource } from '../../content/resources.ts'

/**
 * One resource: the sheet or chart itself, then where it turns up outside the exam, the
 * topics that use it, and the board's own document it was redrawn from.
 *
 * It prints, and in colour: `print-colour` exempts it from the rule that turns every
 * other printed page black on white, because on a periodic table or a spectrum the
 * colour is the information.
 */
export function ResourcePage() {
  const { subjectId, resourceId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const resource = subjectId && resourceId ? getResource(subjectId, resourceId) : undefined
  if (!subject || !resource) return <p>Unknown resource. <Link to="/resources" className="font-bold underline">See every resource</Link>.</p>
  const soon = isComingSoon(resource)
  const topics = resource.topics.map((id) => TOPICS.find((t) => t.id === id)).filter((t) => t !== undefined)

  return (
    <article className="print-sheet print-colour mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">
          <Link to="/resources" className="inline-block -my-1 py-1 hover:underline">Resources</Link>
          {' · '}
          <Link to={`/resources?subject=${subject.id}`} className="inline-block -my-1 py-1 hover:underline">{subject.name}</Link>
          {' · '}{subject.board}
        </p>
        <h1 className="text-3xl font-bold leading-tight">{resource.title}</h1>
        <ResourceBadges resource={resource} />
        <Prose source={resource.summary} className="max-w-3xl text-ink-2" />
        {resource.statusNote && (
          <div className="max-w-3xl rounded-xl border-l-4 border-rule bg-surface px-4 py-2 text-sm" style={{ borderLeftColor: 'var(--subject)' }}>
            <Prose source={resource.statusNote} />
          </div>
        )}
      </header>

      {soon ? (
        <p className="rounded-2xl border border-dashed border-rule p-5 text-ink-2">
          This one is on its way. Until it is ready, the board’s own document below has everything it will cover.
        </p>
      ) : (
        <>
          <div className="no-print flex flex-wrap gap-2">
            <button type="button" onClick={() => window.print()} className="h-11 rounded-lg bg-ink px-4 font-bold text-surface">Print this sheet</button>
          </div>
          <Blocks blocks={resource.blocks} />
        </>
      )}

      {resource.applications.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel colour="#c27a00" emoji="🌍">Where you meet it</SectionLabel>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {resource.applications.map((a) => (
              <li key={a.title} className="break-inside-avoid flex flex-col gap-1 rounded-xl border border-rule bg-surface px-4 py-3">
                <span className="font-bold">{a.title}</span>
                <Prose source={a.body} className="text-sm" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {topics.length > 0 && (
        <section className="no-print flex flex-col gap-3">
          <SectionLabel colour="#2e8b57" emoji="📚">Used in these topics</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <li key={t.id}>
                {/* Not a full pill: a long title wraps to two lines on a phone, and a pill's
                    round ends then cut across the corners of the text. */}
                <Link to={`/subjects/${t.subjectId}/topics/${t.id}`} className="flex min-h-11 items-center rounded-[1.375rem] border border-rule bg-surface px-4 py-1.5 text-sm font-bold leading-snug hover:border-[color:var(--subject)]">
                  {t.specCode ? `${t.specCode} ` : ''}{t.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#1f5fbf" emoji="🔗">Where this comes from</SectionLabel>
        <Links links={resource.sources} />
        {resource.furtherReading.length > 0 && (
          <>
            <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-ink-3">Further reading</h3>
            <Links links={resource.furtherReading} />
          </>
        )}
      </section>
    </article>
  )
}

function Links({ links }: { links: ResourceLink[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {links.map((l) => (
        // The place in the document goes under the link, not after it: on a phone the
        // link filled the line and the place began the next with its own dot.
        <li key={l.url} className="flex flex-col text-[15px]">
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="w-fit py-1 font-bold underline decoration-rule underline-offset-2 hover:decoration-current">
            {l.name}<span className="sr-only"> (opens in a new tab)</span>
          </a>
          {l.where && <span className="-mt-0.5 text-sm text-ink-2">{l.where}</span>}
        </li>
      ))}
    </ul>
  )
}

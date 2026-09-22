import { searchGlossary } from '@study/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Highlight } from '../../components/Highlight.tsx'
import { SectionLabel } from '../../components/KindChip.tsx'
import { TermCard } from '../../components/TermCard.tsx'
import { GLOSSARY, type Term } from '../../content/glossary.ts'
import { search, searchIndex, type SearchHit } from '../../search/index.ts'
import { BackToTop } from '../../components/BackToTop.tsx'

const KIND_LABEL: Record<SearchHit['record']['kind'], string> = {
  topic: 'Topic',
  lesson: 'Lesson step',
  'exam-technique': 'Exam technique',
  question: 'Questions',
}

/**
 * The full results page. Glossary terms are shown in full, with their definition and
 * example, because for most searches that *is* the answer; the topic results underneath
 * say where to go and read more.
 */
export function Search() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Keep ?q= in step so a search is shareable and survives back and forward.
  useEffect(() => {
    const trimmed = query.trim()
    setParams(trimmed ? { q: trimmed } : {}, { replace: true })
  }, [query, setParams])

  const trimmed = query.trim()
  const ready = trimmed.length > 1
  const terms = useMemo(() => (ready ? searchGlossary(GLOSSARY, trimmed).map((h) => h.entry as Term) : []), [ready, trimmed])
  const hits = useMemo(() => (ready ? search(trimmed) : []), [ready, trimmed])
  const total = searchIndex().length

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Search</h1>
        <p className="text-ink-2">Every lesson step, exam note and question bank across all subjects, plus {GLOSSARY.length} glossary terms with a definition and an example each.</p>
      </header>

      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="upthrust, surd, break-even, momentum, validation…"
        aria-label="Search topics and glossary"
        className="h-14 w-full rounded-xl border border-rule bg-surface px-4 text-lg focus:border-[color:var(--subject)]"
      />

      {!ready && <p className="text-sm text-ink-3">Type two or more letters. {total} places to look.</p>}

      {ready && terms.length === 0 && hits.length === 0 && (
        <p className="rounded-xl border border-rule bg-surface p-4 text-ink-2">
          Nothing matched “{trimmed}”. Try a single word, or browse the <Link to="/glossary" className="font-bold underline">glossary</Link>.
        </p>
      )}

      {terms.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel colour="#6B4E9B" emoji="📖">{`Glossary · ${terms.length} term${terms.length > 1 ? 's' : ''}`}</SectionLabel>
          <ul className="flex flex-col gap-3">
            {terms.slice(0, 8).map((term) => <li key={term.slug}><TermCard term={term} query={trimmed} /></li>)}
          </ul>
          {terms.length > 8 && (
            <Link to={`/glossary?q=${encodeURIComponent(trimmed)}`} className="w-fit py-1 text-sm font-bold underline">
              {terms.length - 8} more in the glossary →
            </Link>
          )}
        </section>
      )}

      {hits.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel colour="#0f766e" emoji="🔎">{`In the content · ${hits.length} result${hits.length > 1 ? 's' : ''}`}</SectionLabel>
          <ul className="flex flex-col gap-2">
            {hits.slice(0, 40).map((hit) => (
              <li key={hit.record.key}>
                <Link to={hit.record.to} className="flex flex-col gap-1 rounded-xl border border-rule bg-surface px-4 py-3 hover:border-[color:var(--subject)]">
                  <span className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-bold accent-ink" style={{ '--subject': hit.record.subjectColour } as React.CSSProperties}>{hit.record.subjectName}</span>
                    <span className="rounded bg-panel px-1.5 py-0.5 text-[11px] text-ink-2">{KIND_LABEL[hit.record.kind]}</span>
                  </span>
                  <span className="font-bold leading-snug"><Highlight text={hit.record.topicTitle} query={trimmed} /></span>
                  {hit.record.heading && <span className="text-sm text-ink-2"><Highlight text={hit.record.heading} query={trimmed} /></span>}
                  <span className="text-sm text-ink-2"><Highlight text={hit.snippet} query={trimmed} /></span>
                </Link>
              </li>
            ))}
          </ul>
          {hits.length > 40 && <p className="text-sm text-ink-3">Showing the best 40 of {hits.length}. Add another word to narrow it.</p>}
        </section>
      )}
      <BackToTop />
    </article>
  )
}

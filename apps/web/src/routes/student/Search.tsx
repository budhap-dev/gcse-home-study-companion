import { SUBJECTS, searchGlossary } from '@study/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Highlight } from '../../components/Highlight.tsx'
import { SectionLabel } from '../../components/KindChip.tsx'
import { TermCard } from '../../components/TermCard.tsx'
import { GLOSSARY, type Term } from '../../content/glossary.ts'
import { search, useSearchIndex, type SearchHit } from '../../search/index.ts'
import { BackToTop } from '../../components/BackToTop.tsx'
import { keyboardToHand } from '../../components/keyboardToHand.ts'
import { FilterChip, knownSubject } from '../../components/FilterChip.tsx'
import { topicsForSubject } from '../../content/index.ts'

/** Every subject with content, in the app's order, whatever the query: chips that came and went as letters were typed would move under the finger. */
const FILTERS = SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0)

const KIND_LABEL: Record<SearchHit['record']['kind'], string> = {
  topic: 'Topic',
  lesson: 'Lesson step',
  'exam-technique': 'Exam technique',
  question: 'Questions',
}

/**
 * The full results page. Glossary terms are shown in full, with their definition and
 * example, because for most searches that *is* the answer; the topic results underneath
 * say where to go and read more. `?subject=` narrows both to one subject, and each subject
 * chip says how many results it holds for the query.
 */
export function Search() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const subjectId = knownSubject(params.get('subject'))
  const inputRef = useRef<HTMLInputElement>(null)
  const chipsRef = useRef<HTMLDivElement>(null)

  // On a phone the results arrive from the search box above the page, already typed: a
  // keyboard raised here would cover them.
  useEffect(() => { if (keyboardToHand()) inputRef.current?.focus() }, [])

  // Keep ?q= in step so a search is shareable and survives back and forward, carrying the
  // subject along. Only when it is out of step, so a chip's own change is not undone.
  useEffect(() => {
    const trimmed = query.trim()
    const next = new URLSearchParams(trimmed ? { q: trimmed } : {})
    if (subjectId) next.set('subject', subjectId)
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [query, subjectId, params, setParams])

  const pick = (id: string) => {
    const next = new URLSearchParams(params)
    if (id && id !== subjectId) next.set('subject', id)
    else next.delete('subject')
    setParams(next, { replace: true })
  }

  const trimmed = query.trim()
  const ready = trimmed.length > 1
  const allTerms = useMemo(() => (ready ? searchGlossary(GLOSSARY, trimmed).map((h) => h.entry as Term) : []), [ready, trimmed])
  const index = useSearchIndex(true)
  const allHits = useMemo(() => (ready && index ? search(trimmed, index) : []), [ready, trimmed, index])
  const total = index?.length
  // How many of each subject's terms and places match, for its chip.
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const id of [...allTerms.map((t) => t.subjectId), ...allHits.map((h) => h.record.subjectId)]) n.set(id, (n.get(id) ?? 0) + 1)
    return n
  }, [allTerms, allHits])
  const terms = subjectId ? allTerms.filter((t) => t.subjectId === subjectId) : allTerms
  const hits = subjectId ? allHits.filter((h) => h.record.subjectId === subjectId) : allHits
  const subjectName = FILTERS.find((s) => s.id === subjectId)?.name
  const elsewhere = allTerms.length + allHits.length
  const counted = ready && Boolean(index)

  // On a phone the chips are one row that scrolls sideways. A subject chosen before the
  // page opened, from a subject's own search box, may sit past the right edge: bring it in.
  // Again once the counts arrive, since they widen every chip before it.
  useEffect(() => {
    const row = chipsRef.current
    const chip = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !chip) return
    const c = chip.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (c.right > r.right) row.scrollLeft += c.left - r.left - 16
  }, [subjectId, counted])

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

      {/* Twelve chips wrapped to six rows on a phone and pushed every result below the
          fold, so there they make one row that scrolls sideways, running to the screen's
          edges; from tablet width they wrap as on the glossary. */}
      <div ref={chipsRef} role="group" aria-label="Search one subject" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
        <FilterChip on={subjectId === ''} onClick={() => pick('')}>
          All subjects{counted && <Count n={elsewhere} />}
        </FilterChip>
        {FILTERS.map((s) => (
          <FilterChip key={s.id} on={subjectId === s.id} colour={s.colour} quiet={counted && !counts.get(s.id)} onClick={() => pick(s.id)}>
            {s.name}{counted && <Count n={counts.get(s.id) ?? 0} />}
          </FilterChip>
        ))}
      </div>

      {!ready && <p className="text-sm text-ink-3">Type two or more letters.{total ? ` ${total} places to look.` : ''}</p>}
      {ready && !index && <p className="text-sm text-ink-3">Loading the search…</p>}

      {counted && terms.length === 0 && hits.length === 0 && (
        subjectName && elsewhere > 0 ? (
          <p className="rounded-xl border border-rule bg-surface p-4 text-ink-2">
            Nothing in {subjectName} matched “{trimmed}”, but other subjects have {elsewhere} result{elsewhere > 1 ? 's' : ''}.{' '}
            <button type="button" onClick={() => pick('')} className="font-bold underline">Search all subjects</button>
          </p>
        ) : (
          <p className="rounded-xl border border-rule bg-surface p-4 text-ink-2">
            Nothing matched “{trimmed}”. Try a single word, or browse the <Link to="/glossary" className="font-bold underline">glossary</Link>.
          </p>
        )
      )}

      {terms.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel colour="#6B4E9B" emoji="📖">{`Glossary · ${terms.length} term${terms.length > 1 ? 's' : ''}`}</SectionLabel>
          <ul className="flex flex-col gap-3">
            {terms.slice(0, 8).map((term) => <li key={term.slug}><TermCard term={term} query={trimmed} /></li>)}
          </ul>
          {terms.length > 8 && (
            <Link to={`/glossary?q=${encodeURIComponent(trimmed)}${subjectId ? `&subject=${subjectId}` : ''}`} className="w-fit py-1 text-sm font-bold underline">
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

/** A chip's result count, lighter than its name. */
function Count({ n }: { n: number }) {
  return <span className="ml-1.5 font-normal tabular-nums">{n}</span>
}

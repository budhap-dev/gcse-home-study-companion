import { GLOSSARY_LETTERS, SUBJECTS, letterOf, searchGlossary } from '@study/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { TermCard } from '../../components/TermCard.tsx'
import { GLOSSARY, termBySlug, type Term } from '../../content/glossary.ts'
import { topicsForSubject } from '../../content/index.ts'

/**
 * An A to Z of every term the app teaches, each with a definition, a worked example and
 * a link to the topic that covers it. `?q=` searches, `?term=slug` deep-links to one
 * entry, which is where the header search and every "see also" chip land.
 */
export function Glossary() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [subjectId, setSubjectId] = useState('')
  const focusSlug = params.get('term')
  const inputRef = useRef<HTMLInputElement>(null)

  // Keep the URL in step so a search or a term is shareable.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed) setParams({ q: trimmed }, { replace: true })
    else if (focusSlug) setParams({ term: focusSlug }, { replace: true })
    else setParams({}, { replace: true })
  }, [query, focusSlug, setParams])

  // A deep link scrolls its term into view and flashes it, so it is obvious which one.
  useEffect(() => {
    if (!focusSlug || query) { if (!focusSlug) inputRef.current?.focus(); return }
    const el = document.getElementById(`term-${focusSlug}`)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el.classList.add('anim-pop')
    const t = setTimeout(() => el.classList.remove('anim-pop'), 1200)
    return () => clearTimeout(t)
  }, [focusSlug, query])

  const subjects = useMemo(() => SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0), [])
  const scoped = useMemo(() => (subjectId ? GLOSSARY.filter((t) => t.subjectId === subjectId) : GLOSSARY), [subjectId])
  const searching = query.trim().length > 0
  const shown: Term[] = useMemo(
    () => (searching ? (searchGlossary(scoped, query).map((h) => h.entry) as Term[]) : scoped),
    [searching, query, scoped],
  )

  const byLetter = useMemo(() => {
    const map = new Map<string, Term[]>()
    for (const term of shown) {
      const letter = letterOf(term)
      map.set(letter, [...(map.get(letter) ?? []), term])
    }
    return map
  }, [shown])

  const focused = focusSlug ? termBySlug(focusSlug) : undefined

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Glossary</h1>
        <p className="max-w-[65ch] text-ink-2">
          {GLOSSARY.length} terms from every subject, each with what it means, a worked example, and the topic that teaches it.
          Looking for a topic instead? <Link to="/search" className="font-bold underline">Search everything</Link>.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the glossary"
          aria-label="Search the glossary"
          className="h-12 w-full rounded-xl border border-rule bg-surface px-4 focus:border-[color:var(--subject)]"
        />
        <div className="flex flex-wrap gap-1.5">
          <Chip on={subjectId === ''} onClick={() => setSubjectId('')}>All subjects</Chip>
          {subjects.map((s) => (
            <Chip key={s.id} on={subjectId === s.id} colour={s.colour} onClick={() => setSubjectId(subjectId === s.id ? '' : s.id)}>
              {s.name}
            </Chip>
          ))}
        </div>
      </div>

      {!searching && (
        <nav aria-label="Jump to a letter" className="flex flex-wrap gap-1">
          {GLOSSARY_LETTERS.filter((l) => byLetter.has(l)).map((letter) => (
            <a key={letter} href={`#letter-${letter}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-rule bg-surface text-sm font-bold hover:border-[color:var(--subject)]">
              {letter}
            </a>
          ))}
        </nav>
      )}

      {focused && !searching && (
        <section className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">You looked up</span>
          <TermCard term={focused} />
        </section>
      )}

      <p className="text-sm text-ink-3">
        {shown.length} {shown.length === 1 ? 'term' : 'terms'}{subjectId ? ` in ${subjects.find((s) => s.id === subjectId)?.name}` : ''}{searching ? ` matching “${query.trim()}”` : ''}
      </p>

      {shown.length === 0 && (
        <p className="rounded-xl border border-rule bg-surface p-4 text-ink-2">
          No term matches. Try a shorter word, or <button type="button" onClick={() => { setQuery(''); setSubjectId('') }} className="font-bold underline">clear the filters</button>.
        </p>
      )}

      {searching ? (
        <ul className="flex flex-col gap-3">
          {shown.map((term) => <li key={term.slug}><TermCard term={term} query={query} id={`term-${term.slug}`} /></li>)}
        </ul>
      ) : (
        GLOSSARY_LETTERS.filter((l) => byLetter.has(l)).map((letter) => (
          <section key={letter} id={`letter-${letter}`} className="flex scroll-mt-6 flex-col gap-3">
            <h2 className="border-b border-rule pb-1 text-2xl font-bold">{letter}</h2>
            <ul className="flex flex-col gap-3">
              {byLetter.get(letter)!.map((term) => <li key={term.slug}><TermCard term={term} id={`term-${term.slug}`} /></li>)}
            </ul>
          </section>
        ))
      )}
    </article>
  )
}

function Chip({ on, colour, onClick, children }: { on: boolean; colour?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 rounded-full border px-3 text-sm font-bold ${on ? 'border-transparent text-white' : 'border-rule bg-surface text-ink-2'}`}
      style={on ? { background: colour ?? 'var(--color-ink)' } : undefined}
    >
      {children}
    </button>
  )
}

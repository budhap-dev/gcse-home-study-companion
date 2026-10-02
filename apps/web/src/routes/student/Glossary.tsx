import { GLOSSARY_LETTERS, SUBJECTS, letterOf, searchGlossary } from '@study/shared'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { TermCard } from '../../components/TermCard.tsx'
import { GLOSSARY, termBySlug, type Term } from '../../content/glossary.ts'
import { topicsForSubject } from '../../content/index.ts'
import { BackToTop } from '../../components/BackToTop.tsx'
import { keyboardToHand } from '../../components/keyboardToHand.ts'

/**
 * The glossary in the order the page lists it: by the letter each term files under, then
 * alphabetically. The two differ for a term that opens with an accent, which sorts beside
 * its plain letter and files under '#'; in this order every letter's terms sit together.
 */
const A_TO_Z = [...GLOSSARY].sort((a, b) => GLOSSARY_LETTERS.indexOf(letterOf(a)) - GLOSSARY_LETTERS.indexOf(letterOf(b)))

/** How many cards are drawn at first, and how many more each time the reader nears the end. */
const BATCH = 30

/**
 * An A to Z of every term the app teaches, each with a definition, a worked example and
 * a link to the topic that covers it. `?q=` searches, `?term=slug` deep-links to one
 * entry, which is where the header search and every "see also" chip land.
 *
 * The cards are drawn a batch at a time as the reader scrolls. All 559 at once was 23,600
 * elements and a page 240 phone screens tall, which took three times as long to open as
 * any other page and as long again whenever a filter was cleared.
 */
export function Glossary() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [subjectId, setSubjectId] = useState('')
  // The letter the A to Z starts from, once one is pressed. `tick` makes a second press of
  // the same letter scroll again.
  const [jump, setJump] = useState<{ letter: string; tick: number } | null>(null)
  const focusSlug = params.get('term')
  const inputRef = useRef<HTMLInputElement>(null)
  const lookedUpRef = useRef<HTMLElement>(null)

  // A term linked to while a search is typed ends the search. The field's text outranks the
  // term in the URL, so without this a "see also" pressed in a search result did nothing.
  const [seenSlug, setSeenSlug] = useState(focusSlug)
  if (focusSlug !== seenSlug) {
    setSeenSlug(focusSlug)
    if (focusSlug) setQuery('')
  }

  // Keep the URL in step so a search or a term is shareable. Only when it is out of step:
  // each change is a navigation, and the shell answers a navigation by scrolling to the top,
  // which took the page away from a looked-up term the moment it had been scrolled to.
  useEffect(() => {
    const trimmed = query.trim()
    const next = new URLSearchParams(trimmed ? { q: trimmed } : focusSlug ? { term: focusSlug } : {})
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [query, focusSlug, params, setParams])

  /**
   * A linked term is shown above the list, and the page is scrolled to it: on a phone the
   * search field, the subjects and the letters fill the first screen, so without the scroll
   * the term asked for opened out of sight. A frame late, so that it follows the shell's own
   * scroll to the top of a new page instead of being undone by it.
   */
  useEffect(() => {
    // Opened to browse, the field takes the cursor only where that raises no keyboard.
    if (!focusSlug || query) { if (!focusSlug && keyboardToHand()) inputRef.current?.focus(); return }
    let live = true
    let landed = -1
    const land = () => {
      lookedUpRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
      landed = window.scrollY
    }
    const frame = requestAnimationFrame(land)
    // The page's own fonts change how the lines above the card wrap. Once they are in, land
    // again, unless the reader has moved the page since.
    const fonts = document.fonts
    if (fonts && fonts.status !== 'loaded') void fonts.ready.then(() => { if (live && Math.abs(window.scrollY - landed) < 2) land() })
    return () => {
      live = false
      cancelAnimationFrame(frame)
    }
  }, [focusSlug, query])

  // A pressed letter puts its heading at the top of the screen, as a link to it once did.
  useEffect(() => {
    if (jump) document.getElementById(`letter-${jump.letter}`)?.scrollIntoView({ block: 'start', behavior: 'auto' })
  }, [jump])

  const subjects = useMemo(() => SUBJECTS.filter((s) => topicsForSubject(s.id).length > 0), [])
  const scoped = useMemo(() => (subjectId ? A_TO_Z.filter((t) => t.subjectId === subjectId) : A_TO_Z), [subjectId])
  // The list follows the field a moment behind. One letter matches nearly every term, and
  // drawing them all held the letter itself off the screen for half a second on a phone;
  // deferred, the field shows what was typed at once and the list catches up, giving way
  // to the next letter if one arrives first.
  const listQuery = useDeferredValue(query)
  const searching = listQuery.trim().length > 0
  const shown: Term[] = useMemo(
    () => (searching ? (searchGlossary(scoped, listQuery).map((h) => h.entry) as Term[]) : scoped),
    [searching, listQuery, scoped],
  )
  const letters = useMemo(() => {
    const present = new Set(shown.map(letterOf))
    return GLOSSARY_LETTERS.filter((l) => present.has(l))
  }, [shown])

  // The A to Z runs from the pressed letter on; the letters before it are a press away.
  const from = !searching && jump && letters.includes(jump.letter) && jump.letter !== letters[0] ? jump.letter : ''
  const listed = useMemo(() => (from ? shown.slice(shown.findIndex((t) => letterOf(t) === from)) : shown), [shown, from])

  const focused = focusSlug ? termBySlug(focusSlug) : undefined

  return (
    <article className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold leading-tight">Glossary</h1>
        <p className="text-ink-2">
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
          {letters.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setJump((j) => ({ letter, tick: (j?.tick ?? 0) + 1 }))}
              aria-label={`Terms from ${letter === '#' ? 'numbers and symbols' : letter}`}
              aria-current={from === letter || undefined}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${from === letter ? 'border-transparent bg-ink text-surface' : 'border-rule bg-surface hover:border-[color:var(--subject)]'}`}
            >
              {letter}
            </button>
          ))}
        </nav>
      )}

      {focused && !searching && (
        // Keyed, so that following a "see also" to another term fades the new card in.
        <section key={focused.slug} ref={lookedUpRef} className="anim-fade-up flex scroll-mt-32 flex-col gap-2 md:scroll-mt-24">
          <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">You looked up</span>
          <TermCard term={focused} />
        </section>
      )}

      <p className="text-sm text-ink-3">
        {shown.length} {shown.length === 1 ? 'term' : 'terms'}{subjectId ? ` in ${subjects.find((s) => s.id === subjectId)?.name}` : ''}{searching ? ` matching “${listQuery.trim()}”` : ''}
      </p>

      {shown.length === 0 && (
        <p className="rounded-xl border border-rule bg-surface p-4 text-ink-2">
          No term matches. Try a shorter word, or <button type="button" onClick={() => { setQuery(''); setSubjectId('') }} className="font-bold underline">clear the filters</button>.
        </p>
      )}

      <TermList terms={listed} query={searching ? listQuery : ''} />
      <BackToTop />
    </article>
  )
}

/**
 * The cards: search results in rank order, or the A to Z under its letters when `query` is
 * empty. Its own memoised component so that what the page re-renders for and the list does
 * not need (the field's own text, the URL keeping in step) leaves the cards alone.
 *
 * It draws the first batch, and another whenever the end of what is drawn comes within a
 * couple of screens of the window, so the page only ever grows downwards, under the reader.
 * The button says the same thing by hand, for a keyboard and for a browser that cannot watch.
 */
const TermList = memo(function TermList({ terms, query }: { terms: Term[]; query: string }) {
  // Counted against the list it was counted for: a new search or filter starts again at one batch.
  const [drawn, setDrawn] = useState({ terms, count: BATCH })
  if (drawn.terms !== terms) setDrawn({ terms, count: BATCH })
  const count = drawn.terms === terms ? drawn.count : BATCH
  const more = useCallback(() => setDrawn((d) => ({ terms, count: (d.terms === terms ? d.count : BATCH) + BATCH })), [terms])
  const left = terms.length - count
  const endRef = useRef<HTMLDivElement>(null)

  // Watched afresh after each batch: an observer reports a change, and an end that is still
  // near the window after one batch has not changed.
  useEffect(() => {
    const end = endRef.current
    if (!end || left <= 0 || typeof IntersectionObserver === 'undefined') return
    const watch = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) more() }, { rootMargin: '0px 0px 1600px 0px' })
    watch.observe(end)
    return () => watch.disconnect()
  }, [left, more])

  const visible = useMemo(() => terms.slice(0, count), [terms, count])
  const sections = useMemo(() => {
    const out: { letter: string; terms: Term[] }[] = []
    for (const term of visible) {
      const letter = letterOf(term)
      const last = out[out.length - 1]
      if (last?.letter === letter) last.terms.push(term)
      else out.push({ letter, terms: [term] })
    }
    return out
  }, [visible])

  return (
    <>
      {query ? (
        <ul className="flex flex-col gap-3">
          {visible.map((term) => <li key={term.slug}><TermCard term={term} query={query} id={`term-${term.slug}`} /></li>)}
        </ul>
      ) : (
        sections.map(({ letter, terms: under }) => (
          <section key={letter} id={`letter-${letter}`} className="flex scroll-mt-28 flex-col gap-3 md:scroll-mt-20">
            <h2 className="border-b border-rule pb-1 text-2xl font-bold">{letter}</h2>
            <ul className="flex flex-col gap-3">
              {under.map((term) => <li key={term.slug}><TermCard term={term} id={`term-${term.slug}`} /></li>)}
            </ul>
          </section>
        ))
      )}
      {left > 0 && (
        <div ref={endRef} className="flex justify-center">
          <button type="button" onClick={more} className="press min-h-12 rounded-full border border-rule bg-surface px-5 text-sm font-bold">
            Show more terms ({left} left)
          </button>
        </div>
      )}
    </>
  )
})

function Chip({ on, colour, onClick, children }: { on: boolean; colour?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-9 rounded-full border px-3 text-sm font-bold ${on ? 'border-transparent' : 'border-rule bg-surface text-ink-2'}`}
      // A subject accent is a mid-dark colour and takes white. The fallback is the theme's
      // own ink, which is near-white on a dark theme, so that one takes the surface
      // instead -- pinning white on both put white on white.
      style={on ? { background: colour ?? 'var(--color-ink)', color: colour ? '#fff' : 'var(--color-surface)' } : undefined}
    >
      {children}
    </button>
  )
}

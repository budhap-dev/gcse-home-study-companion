import { entrySlug, searchGlossary } from '@study/shared'
import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { GLOSSARY } from '../content/glossary.ts'
import { search } from '../search/index.ts'
import { Highlight } from './Highlight.tsx'
import { SearchIcon } from './icons.tsx'

const MAX_TERMS = 3
const MAX_TOPICS = 5

/**
 * The header search. Glossary terms come first, because "what does upthrust mean" is the
 * commonest thing to want and the answer is a definition, not a lesson. Below them are
 * the places in the content that mention it. Fully keyboard-driven: up, down, enter, escape.
 */
export function SearchBox({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  // Matches the width at which the header shows the wordmark and space gets tight.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const read = () => setNarrow(mq.matches)
    read()
    mq.addEventListener('change', read)
    return () => mq.removeEventListener('change', read)
  }, [])

  const trimmed = query.trim()
  const ready = trimmed.length > 1
  const terms = ready ? searchGlossary(GLOSSARY, trimmed).slice(0, MAX_TERMS) : []
  const topics = ready ? search(trimmed).slice(0, MAX_TOPICS) : []

  // Every row the arrow keys can land on, in the order they are drawn.
  const rows: { to: string; label: string }[] = [
    ...terms.map((h) => ({ to: `/glossary?term=${entrySlug(h.entry)}`, label: h.entry.term })),
    ...topics.map((h) => ({ to: h.record.to, label: h.record.topicTitle })),
  ]

  useEffect(() => {
    function away(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  // Slash focuses the box from anywhere, the way every search does. The shell renders
  // one box in the sidebar and one above the content on phones, and only one of the two
  // is ever on screen, so each ignores the shortcut unless it is the visible one.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      if (e.key !== '/' || typing) return
      const input = inputRef.current
      if (!input || input.offsetParent === null) return
      e.preventDefault()
      input.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const go = (to: string) => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    onNavigate?.()
    navigate(to)
  }
  const seeAll = () => go(`/search?q=${encodeURIComponent(trimmed)}`)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); setOpen(true) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0 && rows[active]) go(rows[active]!.to); else if (ready) seeAll() }
  }

  return (
    <div ref={boxRef} role="search" className="relative">
      <label htmlFor={listId + '-input'} className="sr-only">Search topics and glossary</label>
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"><SearchIcon /></span>
      <input
        id={listId + '-input'}
        ref={inputRef}
        type="search"
        value={query}
        // The full phrase does not fit beside the wordmark on a phone.
        placeholder={narrow ? 'Search' : 'Search topics and terms'}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && rows.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setActive(-1); setOpen(true) }}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-lg border border-rule bg-surface pl-9 pr-3 text-sm focus:border-[color:var(--subject)]"
      />

      {open && ready && (
        <ul id={listId} role="listbox" className="absolute z-40 mt-1 flex max-h-[70vh] w-full min-w-72 flex-col overflow-auto rounded-xl border border-rule bg-surface py-1 shadow-lg">
          {rows.length === 0 && <li className="px-3 py-3 text-sm text-ink-2">No matches for “{trimmed}”</li>}

          {terms.length > 0 && <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">Glossary</li>}
          {terms.map((hit, i) => (
            <li key={hit.entry.term} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); go(rows[i]!.to) }}
                className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${i === active ? 'bg-panel' : ''}`}
              >
                <span className="text-sm font-bold"><Highlight text={hit.entry.term} query={trimmed} /></span>
                <span className="line-clamp-1 text-xs text-ink-2">{hit.entry.definition.replace(/[*$\\]/g, '').slice(0, 90)}</span>
              </button>
            </li>
          ))}

          {topics.length > 0 && <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">In the topics</li>}
          {topics.map((hit, i) => {
            const index = terms.length + i
            return (
              <li key={hit.record.key} role="option" aria-selected={index === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => { e.preventDefault(); go(hit.record.to) }}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left ${index === active ? 'bg-panel' : ''}`}
                >
                  <span className="text-sm font-bold"><Highlight text={hit.record.topicTitle} query={trimmed} /></span>
                  <span className="line-clamp-1 text-xs text-ink-2">
                    <span style={{ color: hit.record.subjectColour }}>{hit.record.subjectName}</span>
                    {hit.record.heading ? ` · ${hit.record.heading}` : ''}
                  </span>
                </button>
              </li>
            )
          })}

          {rows.length > 0 && (
            <li role="option" aria-selected={false} className="border-t border-rule">
              <button type="button" onMouseDown={(e) => { e.preventDefault(); seeAll() }} className="w-full px-3 py-2 text-left text-sm font-bold text-[color:var(--subject)]">
                See all results for “{trimmed}” →
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

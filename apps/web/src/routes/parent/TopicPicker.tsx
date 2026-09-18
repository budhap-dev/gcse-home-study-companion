import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { SYLLABUS, type SubjectId } from '@study/shared'
import { TOPICS } from '../../content/index.ts'
import { doneBefore, historyFor, type Assignment, type TopicHistory } from '../../progress/assignments.ts'
import type { ProgressState } from '../../progress/store.ts'

export interface PickableTopic {
  id: string
  /** The name the school's plan uses, which is what the subject map shows. */
  title: string
  /** The written topic's own title, when it differs from the row's. */
  topicTitle?: string
  year: number
  /** Position within this school year, counting every row the subject map lists. */
  number: number
  label: string
  history: TopicHistory
}

const titleOf = new Map(TOPICS.map((t) => [t.id, t.title]))

/**
 * The rows of one subject's plan, numbered within each school year.
 *
 * Taken from the syllabus rather than from the written topics, because a year revisits
 * work first taught earlier: Surds is authored as a Year 10 topic but is also a Year 11
 * row, and a parent filtering to Year 11 expects to find it. Numbering counts every row
 * the subject map lists, including ones not written yet, so "Y11 · 4" means the same
 * thing on both screens.
 *
 * Rows with no topic behind them are dropped after counting: there is nothing to assign.
 *
 * With no year, a topic appearing in more than one year is kept once, under the latest —
 * two rows resolving to the same assignment would be a puzzle rather than a choice.
 */
export function pickableTopics(subjectId: SubjectId, state: ProgressState, year?: number): PickableTopic[] {
  const counted = new Map<number, number>()
  const rows: PickableTopic[] = []
  for (const block of SYLLABUS[subjectId] ?? []) {
    for (const entry of block.topics) {
      const n = (counted.get(block.year) ?? 0) + 1
      counted.set(block.year, n)
      if (!entry.topicId) continue
      const written = titleOf.get(entry.topicId)
      rows.push({
        id: entry.topicId,
        title: entry.title,
        topicTitle: written && written !== entry.title ? written : undefined,
        year: block.year,
        number: n,
        label: `Y${block.year} · ${n}`,
        history: historyFor(entry.topicId, state),
      })
    }
  }
  const wanted = year ? rows.filter((r) => r.year === year) : rows
  const byTopic = new Map<string, PickableTopic>()
  for (const r of wanted) byTopic.set(r.id, r)
  return [...byTopic.values()]
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

/** Matches on the title, on "Y11", on a bare number, and on "11 4" for year and number. */
export function filterTopics(all: PickableTopic[], query: string): PickableTopic[] {
  const q = norm(query)
  if (!q) return all
  const words = q.split(' ')
  return all.filter((t) => {
    const hay = `${norm(t.title)} ${norm(t.topicTitle ?? '')} y${t.year} year ${t.year} ${t.year} ${t.number}`
    return words.every((w) => hay.includes(w))
  })
}

export function TopicPicker({
  subjectId, state, kind, level, year, value, onChange,
}: {
  subjectId: SubjectId
  state: ProgressState
  kind: Assignment['kind']
  level?: 'core' | 'higher' | 'advanced'
  /** Narrow to one school year. Undefined shows every year. */
  year?: number
  value: string
  onChange: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  // Numbering is worked out across the whole subject first, so a topic keeps the same
  // number whether or not the year filter is on.
  const shown = useMemo(() => pickableTopics(subjectId, state, year), [subjectId, state, year])
  const hits = useMemo(() => filterTopics(shown, query).slice(0, 60), [shown, query])
  const chosen = shown.find((t) => t.id === value)

  useEffect(() => {
    function away(e: MouseEvent) { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])
  useEffect(() => setActive(0), [query, subjectId, year])

  const pick = (t: PickableTopic) => { onChange(t.id); setQuery(''); setOpen(false) }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, hits.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && open && hits[active]) { e.preventDefault(); pick(hits[active]) }
  }

  return (
    <div ref={boxRef} className="relative flex flex-col gap-1 text-sm">
      <span className="font-bold">Topic</span>
      <input
        role="combobox" aria-label="Topic" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        value={open ? query : chosen ? `${chosen.label} · ${chosen.title}` : ''}
        onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => { setQuery(''); setOpen(true) }}
        onKeyDown={onKeyDown}
        placeholder={year ? `Search Year ${year} topics` : 'Search by name, or type a year and number'}
        className="h-11 w-full rounded-lg border border-rule bg-surface px-3"
      />
      {chosen && !open && <TopicDone history={chosen.history} kind={kind} level={level} />}
      {open && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-xl border border-rule bg-surface shadow-lg">
          {hits.length === 0 && <li className="px-3 py-2 text-sm text-ink-2">Nothing matches{year ? ` in Year ${year}` : ''}.</li>}
          {hits.map((t, i) => {
            const before = doneBefore(t.history, kind, level)
            return (
              <li key={t.id} role="option" aria-selected={i === active}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(t) }} onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left ${i === active ? 'bg-panel' : ''}`}>
                  <span className="w-16 shrink-0 text-xs font-bold tabular-nums text-ink-3">{t.label}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {t.title}
                    {t.topicTitle && <span className="text-ink-3"> · {t.topicTitle}</span>}
                  </span>
                  {before
                    ? <span className="shrink-0 text-xs font-bold text-status-secure">✓{before.pct === undefined ? '' : ` ${before.pct}%`}</span>
                    : t.history.untouched
                      ? <span className="shrink-0 text-xs text-ink-3">new</span>
                      : <span className="shrink-0 text-xs text-ink-2">started</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const WHEN = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

/**
 * What the student has already done for the exact activity being set. This is the line
 * that stops a parent setting work that was finished yesterday without meaning to — and
 * setting it anyway is a perfectly good thing to do, so it informs rather than blocks.
 */
function TopicDone({ history, kind, level }: { history: TopicHistory; kind: Assignment['kind']; level?: 'core' | 'higher' | 'advanced' }) {
  const before = doneBefore(history, kind, level)
  if (before) {
    return (
      <p className="text-xs text-ink-2">
        <span className="font-bold text-status-secure">Already done</span>
        {' '}on {WHEN(before.at)}{before.pct === undefined ? '' : `, scoring ${before.pct}%`}. Setting it again asks for another go.
      </p>
    )
  }
  if (history.untouched) return <p className="text-xs text-ink-3">Not started yet.</p>
  return <p className="text-xs text-ink-2">This topic has been started, but not this activity.</p>
}

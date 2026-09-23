import { useState } from 'react'
import { Link } from 'react-router'
import { SectionLabel } from '../../components/KindChip.tsx'
import { StatusChip } from '../../components/StatusChip.tsx'
import type { ProgressState, StudyKind } from '../../progress/store.ts'
import { STUDY_KINDS, STUDY_LABEL, subjectDetail, topicDays, type SubjectDetail as Detail, type TopicActivity } from '../../progress/subjectDetail.ts'
import { TopicBreakdown } from './TopicBreakdown.tsx'

/** One glyph per kind, shared with the dashboard's Recent work so the two read alike. */
export const STUDY_EMOJI: Record<StudyKind, string> = {
  quiz: '⚡', worksheet: '📝', lesson: '📖', flashcards: '🃏',
  'cheat-sheet': '📋', why: '🌍', 'exam-technique': '🎓',
}

/** Mid-tone fills that read on the light and the dark surface alike. */
const KIND_COLOUR: Record<StudyKind, string> = {
  lesson: '#3b82c4', quiz: '#d9822b', worksheet: '#8a5cc2', flashcards: '#2e9e6a',
  'cheat-sheet': '#c2475f', why: '#1f9bb0', 'exam-technique': '#7a7f8c',
}

const day = (iso: string) => new Date(iso.length > 10 ? iso : iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const weekday = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function formatMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`
}

/**
 * One subject, opened from its row on the dashboard: how long went on each kind of work,
 * and every topic touched, with what was done on it and a day-by-day log underneath.
 *
 * The question it answers is "what exactly did they spend the time on", which the
 * dashboard cannot: it counts topics and minutes across everything, and a parent who sees
 * forty minutes of Chemistry wants to know whether that was a quiz or a deck of cards.
 */
export function SubjectDetail({ state, subjectId, first }: { state: ProgressState; subjectId: string; first: string }) {
  const d = subjectDetail(state, subjectId)
  if (!d) return <p className="text-ink-2">There is no subject called {subjectId}. <Link to="/family" className="font-bold text-ink underline">Back to the dashboard</Link>.</p>
  return <SubjectBody d={d} state={state} first={first} />
}

function SubjectBody({ d, state, first }: { d: Detail; state: ProgressState; first: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const most = Math.max(1, ...d.byKind.map((k) => k.minutes))
  return (
    <div className="flex flex-col gap-6" style={{ '--subject': d.colour } as React.CSSProperties}>
      <div className="flex flex-col gap-1">
        {/* A link, not history.back(): a parent who arrived from a bookmark has no dashboard behind them. */}
        <Link to="/family" className="w-fit py-2 text-sm font-bold text-ink underline">← All subjects</Link>
        <h2 className="accent-ink text-2xl font-bold">{d.name}</h2>
        <p className="text-sm text-ink-2">
          {d.lastActive ? `${first} last worked on ${d.name} on ${day(d.lastActive)}.` : `${first} has not started ${d.name} yet.`}
        </p>
      </div>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Time recorded" value={formatMinutes(d.minutes)} note="Every topic and the exam technique page" />
        <Tile label="Topics started" value={`${d.topics.length} of ${d.total}`} note={`${d.topics.filter((t) => t.lesson?.done).length} lessons finished`} />
        <Tile label="Quizzes" value={`${d.quizCount}`} note={d.averageQuizPct === undefined ? 'None taken yet' : `Average ${d.averageQuizPct}%`} />
        <Tile label="Exam technique" value={d.examTechnique.days ? `${d.examTechnique.days} ${d.examTechnique.days === 1 ? 'day' : 'days'}` : '—'}
          note={d.examTechnique.last ? `${formatMinutes(d.examTechnique.minutes)} · last ${day(d.examTechnique.last)}` : 'Not opened yet'} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4">
        <SectionLabel colour="#2e8b57" emoji="⏱️">Where the time went</SectionLabel>
        {d.minutes === 0 ? (
          <p className="text-sm text-ink-2">No time recorded on {d.name} yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.byKind.map((k) => (
              <li key={k.kind} className={`grid grid-cols-[8.5rem_1fr_auto] items-center gap-3 text-sm ${k.minutes ? '' : 'text-ink-3'}`}>
                <span className="flex items-center gap-2"><span aria-hidden>{STUDY_EMOJI[k.kind]}</span>{STUDY_LABEL[k.kind]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-panel" aria-hidden>
                  <span className="block h-full rounded-full" style={{ width: `${(100 * k.minutes) / most}%`, background: KIND_COLOUR[k.kind] }} />
                </span>
                <span className="text-right tabular-nums font-bold">{k.minutes ? formatMinutes(k.minutes) : '—'}</span>
              </li>
            ))}
          </ul>
        )}
        {d.unsplitMinutes > 0 && (
          <p className="text-xs text-ink-3">
            Time is split by subject and activity from 23 September 2026. The {formatMinutes(d.unsplitMinutes)} studied before that counts towards the weekly totals on the dashboard but cannot be placed here.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel colour="#0f766e" emoji="📚">Topics worked on</SectionLabel>
        {d.topics.length === 0 ? (
          <p className="rounded-xl border border-rule bg-surface px-4 py-3 text-sm text-ink-2">Nothing opened in {d.name} yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {d.topics.map((t) => (
              <TopicRow key={t.topicId} t={t} state={state} open={open === t.topicId}
                onToggle={() => setOpen((cur) => (cur === t.topicId ? null : t.topicId))} />
            ))}
          </ul>
        )}
      </section>

      {d.notStarted.length > 0 && (
        <details className="rounded-xl border border-rule bg-surface">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 text-sm font-bold">
            Not started yet · {d.notStarted.length} {d.notStarted.length === 1 ? 'topic' : 'topics'}
          </summary>
          <ul className="flex flex-col gap-1 border-t border-rule px-4 py-3 text-sm text-ink-2">
            {d.notStarted.map((t) => <li key={t.topicId}>{t.title}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}

/** What was done on a topic, one short phrase per kind, only for the kinds actually used. */
export function doneList(t: TopicActivity): { kind: StudyKind; text: string }[] {
  const out: { kind: StudyKind; text: string }[] = []
  if (t.lesson) out.push({ kind: 'lesson', text: t.lesson.done ? 'Lesson finished' : `Lesson, step ${t.lesson.step} of ${t.lesson.steps}` })
  if (t.quizzes.count) {
    const q = t.quizzes
    out.push({ kind: 'quiz', text: q.count === 1 ? `1 quiz, ${q.latestPct}%` : `${q.count} quizzes, latest ${q.latestPct}%, best ${q.bestPct}%` })
  }
  for (const w of t.worksheets) {
    const name = `${w.level[0]!.toUpperCase()}${w.level.slice(1)} worksheet`
    out.push({ kind: 'worksheet', text: w.count === 1 ? `${name}, ${w.latestPct}%` : `${name} ×${w.count}, latest ${w.latestPct}%` })
  }
  if (t.flashcards.days) out.push({ kind: 'flashcards', text: `Flashcards on ${t.flashcards.days} ${t.flashcards.days === 1 ? 'day' : 'days'}${t.flashcards.cards ? `, ${t.flashcards.cards} cards` : ''}` })
  else if (t.byKind.flashcards) out.push({ kind: 'flashcards', text: 'Flashcards, deck not finished' })
  if (t.cheatSheet) out.push({ kind: 'cheat-sheet', text: `Cheat sheet on ${t.cheatSheet} ${t.cheatSheet === 1 ? 'day' : 'days'}` })
  if (t.why) out.push({ kind: 'why', text: `Where you meet it on ${t.why} ${t.why === 1 ? 'day' : 'days'}` })
  return out
}

function TopicRow({ t, state, open, onToggle }: { t: TopicActivity; state: ProgressState; open: boolean; onToggle: () => void }) {
  const done = doneList(t)
  // STUDY_KINDS order, not the stored order, so the bar reads the same way on every row.
  const split = STUDY_KINDS.flatMap((k) => (t.byKind[k] ? [[k, t.byKind[k]!] as const] : []))
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-rule bg-surface px-4 py-3">
      <span className="flex items-start justify-between gap-3">
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 py-1 text-left font-bold text-ink underline">{t.title}</button>
        <strong className="shrink-0 py-1 tabular-nums">{t.minutes ? formatMinutes(t.minutes) : ''}</strong>
      </span>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
        <StatusChip status={t.status} />
        {t.lastActive && <span>· last {day(t.lastActive)}</span>}
      </span>
      {done.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {done.map((x, i) => (
            <li key={i} className="flex items-center gap-1 rounded-full bg-panel px-2.5 py-1 text-xs">
              <span aria-hidden>{STUDY_EMOJI[x.kind]}</span>{x.text}
            </li>
          ))}
        </ul>
      )}
      {split.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* The same colours as "Where the time went", so the two can be read together. */}
          <div className="flex h-2 overflow-hidden rounded-full bg-panel" aria-hidden>
            {split.map(([k, m]) => <span key={k} style={{ width: `${(100 * m) / t.minutes}%`, background: KIND_COLOUR[k] }} />)}
          </div>
          <span className="text-xs text-ink-2">{split.map(([k, m]) => `${STUDY_LABEL[k]} ${formatMinutes(m)}`).join(' · ')}</span>
        </div>
      )}
      {open && (
        <div className="flex flex-col gap-3">
          <DayByDay state={state} topicId={t.topicId} />
          <TopicBreakdown topicId={t.topicId} state={state} />
        </div>
      )}
    </li>
  )
}

function DayByDay({ state, topicId }: { state: ProgressState; topicId: string }) {
  const days = topicDays(state, topicId)
  if (!days.length) return null
  return (
    <div className="flex flex-col gap-2 border-t border-rule pt-3">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink-3">Day by day</h3>
      <ol className="flex flex-col gap-2">
        {days.map(({ day: d, entries }) => (
          <li key={d} className="flex flex-col gap-1 rounded-lg bg-paper px-3 py-2 text-sm">
            <span className="font-bold">{weekday(d)}</span>
            <ul className="flex flex-col gap-0.5">
              {entries.map((e) => (
                <li key={e.kind} className="flex items-baseline justify-between gap-3 text-ink-2">
                  <span className="min-w-0">
                    <span aria-hidden className="mr-1.5">{STUDY_EMOJI[e.kind]}</span>
                    <span className="font-bold text-ink">{STUDY_LABEL[e.kind]}</span>
                    {e.results.length > 0 && <> · {e.results.join('; ')}</>}
                  </span>
                  {e.minutes ? <span className="shrink-0 tabular-nums">{formatMinutes(e.minutes)}</span> : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Tile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-rule bg-surface px-4 py-3">
      <span className="text-xs font-bold uppercase tracking-wide text-ink-3">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-ink-2">{note}</span>
    </div>
  )
}

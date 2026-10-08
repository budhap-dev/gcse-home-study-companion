import { generatorFor, getSubject, type WorksheetLevel } from '@study/shared'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ShareSheet } from '../../components/ShareSheet.tsx'
import { topicsForSubject } from '../../content/index.ts'
import { MIXED_COUNTS, MIXED_MIN_TOPICS, mixedPath, pickItems, type MixedSpec } from '../../content/mixedSheet.ts'
import { newSheetCode } from '../../content/sheetCode.ts'

const LEVELS: { id: WorksheetLevel; label: string; note: string }[] = [
  { id: 'core', label: 'Core', note: 'the basics' },
  { id: 'higher', label: 'Higher', note: 'exam style, grade 6 to 7' },
  { id: 'advanced', label: 'Advanced', note: 'grade 8 to 9' },
]

const CHIP = 'min-h-11 rounded-lg border px-3 text-sm font-bold'
const on = (yes: boolean) => (yes ? 'border-[color:var(--subject)] bg-[color:var(--subject)] text-white' : 'border-rule bg-surface')

/**
 * Make a worksheet (WKS-4): choose topics, a level and how many questions, then do it on
 * screen, print one or more versions, or send the link. Questions come from at least three
 * topics, so the topic no longer says which method a question needs. Everything chosen is
 * in the sheet's link; nothing is stored until it is done.
 */
export function MakeWorksheet() {
  const { subjectId = '' } = useParams()
  const subject = getSubject(subjectId)
  const topics = useMemo(() => topicsForSubject(subjectId), [subjectId])
  const units = (subject?.units ?? []).map((u) => ({ ...u, topics: topics.filter((t) => t.unitId === u.id) })).filter((u) => u.topics.length)
  // Opens on the first unit with enough topics to mix, all chosen, so the page starts ready to use.
  const [chosen, setChosen] = useState<Set<string>>(() => new Set((units.find((u) => u.topics.length >= MIXED_MIN_TOPICS) ?? units[0])?.topics.map((t) => t.id) ?? []))
  const [level, setLevel] = useState<WorksheetLevel>('higher')
  const [count, setCount] = useState<number>(10)
  const [versions, setVersions] = useState(1)
  const [code, setCode] = useState(newSheetCode)
  // One code per printed version; drawn once, so the print link does not change under the reader.
  const [more] = useState(() => [newSheetCode(), newSheetCode(), newSheetCode()])

  if (!subject) return <p>Unknown subject.</p>

  const spec: MixedSpec = { subjectId, topicIds: topics.filter((t) => chosen.has(t.id)).map((t) => t.id), level, count, code }
  const items = pickItems(spec, topics)
  const fresh = items.filter((m) => generatorFor(subjectId, m.topicId, m.questionId)).length
  const marks = items.reduce((s, m) => s + (topics.find((t) => t.id === m.topicId)?.questions.find((q) => q.id === m.questionId)?.marks ?? 0), 0)
  const fromTopics = new Set(items.map((m) => m.topicId)).size
  const ready = spec.topicIds.length >= MIXED_MIN_TOPICS && items.length > 0
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const setUnit = (ids: string[], all: boolean) => setChosen((s) => { const n = new Set(s); for (const id of ids) if (all) n.add(id); else n.delete(id); return n })

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{subject.name}</p>
        <h1 className="text-3xl font-bold leading-tight">Make a worksheet</h1>
        <p className="text-ink-2">Questions from several topics, mixed, so you have to decide which method each one needs. Do it on screen, print it, or send it to someone.</p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="mk-topics">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="mk-topics" className="text-lg font-bold">Topics</h2>
          <span className="text-sm text-ink-2">{spec.topicIds.length} chosen{spec.topicIds.length < MIXED_MIN_TOPICS ? ` · choose at least ${MIXED_MIN_TOPICS}` : ''}</span>
        </div>
        {units.map((u, i) => {
          const ids = u.topics.map((t) => t.id)
          const n = ids.filter((id) => chosen.has(id)).length
          return (
            <details key={u.id} open={i === 0 || n > 0} className="rounded-xl border border-rule bg-surface">
              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-4 py-2">
                <span className="font-bold">{u.name}</span>
                <span className="text-sm text-ink-2 tabular-nums">{n} of {ids.length}</span>
              </summary>
              <div className="flex flex-col gap-1 border-t border-rule px-4 py-3">
                <div className="flex gap-2 pb-1">
                  <button type="button" onClick={() => setUnit(ids, true)} className="min-h-9 rounded-md border border-rule px-3 text-sm font-bold">All</button>
                  <button type="button" onClick={() => setUnit(ids, false)} className="min-h-9 rounded-md border border-rule px-3 text-sm font-bold">None</button>
                </div>
                {u.topics.map((t) => (
                  <label key={t.id} className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px]">
                    <input type="checkbox" checked={chosen.has(t.id)} onChange={() => toggle(t.id)} className="h-5 w-5 shrink-0 accent-[color:var(--subject)]" />
                    <span className="min-w-0 flex-1">{t.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">Year {t.year}</span>
                  </label>
                ))}
              </div>
            </details>
          )
        })}
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="mk-level">
        <h2 id="mk-level" className="text-lg font-bold">Level</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mk-level">
          {LEVELS.map((l) => (
            <button key={l.id} type="button" aria-pressed={level === l.id} onClick={() => setLevel(l.id)} className={`${CHIP} ${on(level === l.id)}`}>
              {l.label} <span className="font-normal opacity-80">· {l.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="mk-count">
        <h2 id="mk-count" className="text-lg font-bold">How many questions</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mk-count">
          {MIXED_COUNTS.map((n) => (
            <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`${CHIP} min-w-11 tabular-nums ${on(count === n)}`}>{n}</button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="mk-versions">
        <h2 id="mk-versions" className="text-lg font-bold">Versions to print</h2>
        <p className="text-sm text-ink-2">Each version has its own questions and numbers, with its own answer sheet: one to practise, another as a test a week later.</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="mk-versions">
          {[1, 2, 3, 4].map((n) => (
            <button key={n} type="button" aria-pressed={versions === n} onClick={() => setVersions(n)} className={`${CHIP} min-w-11 tabular-nums ${on(versions === n)}`}>{n}</button>
          ))}
        </div>
      </section>

      {/* Pinned to the foot of the screen while the topic list scrolls, and its buttons are
          always there: with them hidden until three topics were ticked, a page with none
          ticked looked as if it had no way to make anything (8 October 2026). */}
      <section className="bottom-nav-clear sticky z-20 flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4 shadow-[0_-8px_30px_rgb(16_24_40/0.12)]" aria-label="Your worksheet">
        <p aria-live="polite" className="text-[15px]">
          {ready ? (
            <>
              <strong>{items.length} question{items.length === 1 ? '' : 's'}</strong> from {fromTopics} topics · {marks} marks
              {fresh > 0 && <> · {fresh} with new numbers</>} · sheet <strong className="font-mono">{code}</strong>
              {items.length < count && <span className="block text-sm text-ink-2">Only {items.length} questions at this level can be marked on screen across these topics; tick more topics for {count}.</span>}
            </>
          ) : (
            <strong>{spec.topicIds.length === 0 ? `Tick at least ${MIXED_MIN_TOPICS} topics above to make a worksheet.` : `Tick ${MIXED_MIN_TOPICS - spec.topicIds.length} more topic${MIXED_MIN_TOPICS - spec.topicIds.length === 1 ? '' : 's'} above: with fewer than ${MIXED_MIN_TOPICS}, the topic gives the method away.`}</strong>
          )}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ready ? (
            <>
              <Link to={mixedPath(spec)} className="flex h-12 items-center justify-center rounded-xl bg-[color:var(--subject)] px-3 text-center font-bold text-white">Do it on screen</Link>
              <Link to={mixedPath(spec, { codes: [code, ...more].slice(0, versions) })} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-3 text-center font-bold">
                {versions === 1 ? 'Print or save as PDF' : `Print ${versions} versions`}
              </Link>
            </>
          ) : (
            <>
              <button type="button" disabled className="h-12 rounded-xl bg-[color:var(--subject)] px-3 font-bold text-white opacity-40">Do it on screen</button>
              <button type="button" disabled className="h-12 rounded-xl border border-rule bg-surface px-3 font-bold opacity-40">Print or save as PDF</button>
            </>
          )}
        </div>
        {ready && (
          <div className="flex flex-wrap items-start gap-2">
            <ShareSheet small path={mixedPath(spec)} title={`${subject.name} · mixed worksheet ${code}`} />
            <button type="button" onClick={() => setCode(newSheetCode())} className="flex h-9 items-center rounded-lg border border-rule bg-surface px-3 text-sm font-bold">Different questions</button>
          </div>
        )}
      </section>
      <Link to={`/subjects/${subjectId}`} className="flex h-11 w-fit items-center rounded-lg border border-rule bg-surface px-4 font-bold">Back to {subject.name}</Link>
    </article>
  )
}

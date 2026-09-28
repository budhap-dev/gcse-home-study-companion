import { getSubject, STATUS_LABEL, SYLLABUS, TOPIC_STATUSES } from '@study/shared'
import type { Subject, SyllabusBlock } from '@study/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useParams, useSearchParams } from 'react-router'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { SpecNumber } from '../../components/SpecNumber.tsx'
import { topicsForSubject, yearsForSubject } from '../../content/index.ts'
import { evidenceFor, type ProgressState } from '../../progress/store.ts'
import { PART_LETTERS, partsDone, partsLabel, type PartsDone } from '../../progress/parts.ts'
import { useProgress } from '../../progress/useProgress.ts'
import { ResetProgress } from '../../components/ResetProgress.tsx'
import { MAP_LEVEL_LABEL, countLevels, isSecure, nextRung, square, unitGroups, type MapSquare } from '../../progress/map.ts'
import { MasteryLadder, TopicSquare } from '../../components/map/MapParts.tsx'
import { useWide } from '../../components/useWide.ts'

/**
 * A year's note, relative to the student's own year (UXI-10). These were fixed for a Year
 * 10 student: "This year's work" on Year 10 whoever was reading.
 */
function yearNote(year: number, mine: number): string | undefined {
  if (year < mine) return 'Taught in an earlier year. Kept as recap, because mocks and the final exams keep coming back to it.'
  if (year === mine) return 'This year’s work.'
  if (year === mine + 1) return 'Next year’s work.'
  return undefined
}

/**
 * A subject (Option C). A header with a ring of topics secure and the count at each level,
 * then two views of the same topics: the map, one square per topic grouped by unit, with the
 * picked topic opened in a panel beside it (a sheet from the bottom on a phone); and the
 * list, the school's plan year by year and term by term, as it was before the map. The
 * choice of view is in the address, so a link or the back button keeps it.
 */
export function TopicMap() {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const progress = useProgress()
  const [params, setParams] = useSearchParams()
  if (!subject) return <p>Unknown subject.</p>
  const written = topicsForSubject(subject.id)
  const squares = written.map((t) => square(t, progress))
  const view = params.get('view') === 'list' ? 'list' : 'map'
  /** Has the student done anything on any of these topics? Drives whether a reset is offered. */
  const studied = (ids: string[]) => ids.some((id) => progress.attempts.some((a) => a.topicId === id) || Boolean(progress.lessons[id]))
  const subjectTopicIds = written.map((t) => t.id)

  return (
    <article className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <p className="text-sm text-ink-2">
        <Link to="/subjects" className="-my-1 inline-block py-1 underline">Subjects</Link> <span aria-hidden>/</span> {subject.name}
      </p>
      <SubjectHeader subject={subject} squares={squares} year={progress.profile?.year} />

      <div role="group" aria-label="View" className="flex w-fit gap-1 rounded-xl bg-panel p-1">
        {(['map', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setParams(v === 'list' ? { view: 'list' } : {}, { replace: true })}
            className={`min-h-9 rounded-lg px-4 text-sm font-bold transition-colors ${view === v ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(30_35_48/0.12)]' : 'text-ink-2 hover:text-ink'}`}
          >
            {v === 'map' ? 'Map' : 'List by year'}
          </button>
        ))}
      </div>

      {view === 'map' ? <MapView subject={subject} progress={progress} /> : <ListView subject={subject} progress={progress} studied={studied} />}

      <ResetProgress
        label={`Reset all ${subject.name}`}
        what={`all of ${subject.name}`}
        topicIds={subjectTopicIds}
        hasProgress={studied(subjectTopicIds)}
      />
    </article>
  )
}

/** The subject's banner: a ring of topics secure, its name and board, and a count at each level. */
function SubjectHeader({ subject, squares, year }: { subject: Subject; squares: MapSquare[]; year?: number }) {
  const secure = squares.filter(isSecure).length
  const counts = countLevels(squares)
  const r = 42
  const c = 2 * Math.PI * r
  const years = yearsForSubject(subject.id)
  return (
    <header
      className="anim-rise flex flex-col gap-5 rounded-3xl border p-5 sm:p-6 xl:flex-row xl:items-center xl:gap-7"
      style={{ borderColor: 'color-mix(in srgb, var(--subject) 30%, var(--color-rule))', background: 'linear-gradient(120deg, color-mix(in srgb, var(--subject) 20%, var(--color-surface)), var(--color-surface) 55%, color-mix(in srgb, var(--hero-2) 10%, var(--color-surface)))' }}
    >
      <svg width="104" height="104" viewBox="0 0 104 104" role="img" aria-label={`${secure} of ${squares.length} topics secure`} className="shrink-0">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--color-rule)" strokeWidth="12" />
        <circle className="anim-ring" cx="52" cy="52" r={r} fill="none" stroke="var(--subject)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(c * secure) / Math.max(1, squares.length)} ${c}`} transform="rotate(-90 52 52)" />
        <text x="52" y="53" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial, sans-serif" fontSize="26" fontWeight="700" fill="var(--color-ink)">{secure}</text>
        <text x="52" y="71" textAnchor="middle" fontSize="12" fill="var(--color-ink-2)">of {squares.length} secure</text>
      </svg>
      <div className="flex min-w-0 flex-grow flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.12em] accent-ink">
          {subject.board}{years.length ? ` · Year${years.length > 1 ? 's' : ''} ${years[0]}${years.length > 1 ? ` to ${years.at(-1)}` : ''}` : ''}
        </p>
        <h1 className="text-[34px] font-bold leading-[1.05] sm:text-[42px]">{subject.name}</h1>
        <ul className="mt-2 flex flex-wrap gap-2">
          {[4, 3, 2, 1, 0].map((level) => (
            <li key={level} className="flex items-center gap-1.5 rounded-full border border-rule bg-surface px-3 py-1 text-[13px] font-bold">
              <span aria-hidden className={`map-sq map-l${level} inline-block h-3 w-3 rounded-[3px]`} />
              {counts[level]} {MAP_LEVEL_LABEL[level]!.toLowerCase()}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 xl:flex-col xl:gap-2">
        <Link to={`/subjects/${subject.id}/exam-technique`} className="lift flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rule bg-surface px-5 font-bold accent-ink">
          <span aria-hidden>✎</span> Exam technique guide
        </Link>
        {year && <span className="text-[13px] text-ink-2">You are in Year {year}</span>}
      </div>
    </header>
  )
}

/**
 * The map: every written topic as a square, grouped by unit, filterable by school year. The
 * picked topic opens in the panel. The first pick is the topic the student is most likely to
 * want: a lesson under way, then a topic begun and not yet secure, then the first not started.
 */
function MapView({ subject, progress }: { subject: Subject; progress: ProgressState }) {
  const years = yearsForSubject(subject.id)
  const [year, setYear] = useState<number | 'all'>('all')
  const all = topicsForSubject(subject.id)
  const groups = unitGroups(subject.id, year === 'all' ? all : all.filter((t) => t.year === year), progress)
  const flat = groups.flatMap((g) => g.squares)
  const underway = Object.values(progress.lessons)
    .filter((l) => !l.completedAt && all.some((t) => t.id === l.topicId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.topicId
  const [picked, setPicked] = useState<string | undefined>(
    underway ?? flat.find((s) => s.level === 1 || s.level === 2)?.topic.id ?? flat.find((s) => s.level === 0)?.topic.id ?? flat[0]?.topic.id,
  )
  // On a phone the panel is a sheet, shut until a square is pressed; on a wide screen it is always open.
  const [sheet, setSheet] = useState(false)
  const pickedSquare = all.find((t) => t.id === picked)
  let n = 0

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22.5rem)] lg:items-start">
      <section className="flex flex-col gap-3" aria-labelledby="units-heading">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          <h2 id="units-heading" className="text-xl font-bold">By unit <span className="font-sans text-sm font-normal text-ink-2">· press any square</span></h2>
          {years.length > 1 && (
            <div role="group" aria-label="School year" className="flex w-fit flex-wrap gap-1 rounded-xl bg-panel p-1">
              {(['all', ...years] as const).map((y) => (
                <button key={y} type="button" aria-pressed={year === y} onClick={() => setYear(y)}
                  className={`min-h-9 rounded-lg px-3 text-sm font-bold transition-colors ${year === y ? 'bg-surface text-ink shadow-[0_1px_2px_rgb(30_35_48/0.12)]' : 'text-ink-2 hover:text-ink'}`}>
                  {y === 'all' ? 'All years' : `Year ${y}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          {groups.map((g, gi) => (
            <section key={g.id} className="anim-rise flex flex-col gap-2.5 rounded-2xl border border-rule bg-surface p-4" style={{ '--d': `${(0.1 + gi * 0.05).toFixed(2)}s` } as React.CSSProperties}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-sans text-base font-bold leading-snug">{g.name}</h3>
                <span className="shrink-0 text-[13px] text-ink-2">{g.squares.filter(isSecure).length} of {g.squares.length} secure</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.squares.map((s) => (
                  <TopicSquare key={s.topic.id} square={s} picked={s.topic.id === picked} delay={`${(0.2 + Math.min(n++, 100) * 0.008).toFixed(3)}s`}
                    onPick={() => { setPicked(s.topic.id); setSheet(true) }} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {pickedSquare && <TopicPanel key={pickedSquare.id} square={square(pickedSquare, progress)} progress={progress} open={sheet} onClose={() => setSheet(false)} />}
    </div>
  )
}

/**
 * The picked topic: where it sits, what it holds, its place on the ladder, what moves it up
 * one rung, and the way in. A sticky card beside the map on a wide screen; on a phone a sheet
 * that slides up above the menu bar when a square is pressed, and slides away again when it is
 * swiped down or shut with its button or Escape.
 */
function TopicPanel({ square: s, progress, open, onClose }: { square: MapSquare; progress: ProgressState; open: boolean; onClose: () => void }) {
  const t = s.topic
  const subject = getSubject(t.subjectId)!
  const lesson = progress.lessons[t.id]
  const steps = t.lesson.steps.length
  const heading = useRef<HTMLHeadingElement>(null)
  const sheet = useRef<HTMLElement>(null)
  const wide = useWide()
  // Shutting slides the sheet down first and hides it when the slide ends; `onClose` alone
  // would hide it on the spot, with no frame left for the slide to play in.
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    if (wide || !motionOn()) onClose()
    else setClosing(true)
  }, [wide, onClose])
  const closed = () => {
    const el = sheet.current
    if (el) { el.style.transform = ''; el.style.transition = '' }
    setClosing(false)
    onClose()
  }
  // A transition that never starts (the tab hidden mid-slide, say) must not leave it half shut.
  useEffect(() => {
    if (!closing) return
    const fallback = setTimeout(closed, 500)
    return () => clearTimeout(fallback)
  })
  useEffect(() => {
    if (!open) return
    heading.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])
  useSwipeDown(sheet, open && !wide, close)
  const base = `/subjects/${t.subjectId}/topics/${t.id}`
  const status = s.level > 0 ? TOPIC_STATUSES[s.level - 1] : undefined

  const panel = (
    <aside
      ref={sheet}
      aria-label="Topic"
      onTransitionEnd={(e) => { if (closing && e.target === e.currentTarget && e.propertyName === 'transform') closed() }}
      // Set here as well as by SubjectTheme, because on a phone the sheet is rendered outside it.
      style={{ '--subject': subject.colour } as React.CSSProperties}
      className={wide
        ? 'card-top sticky top-24 flex flex-col gap-3.5 rounded-3xl border border-rule bg-surface p-5 shadow-[0_8px_28px_rgb(16_24_40/0.08)]'
        // A card floating just above the menu dock, like the dock itself: full width on a
        // phone, in the corner on a tablet.
        : `${open ? 'flex' : 'hidden'} ${closing ? 'sheet-closing' : ''} sheet-up card-top bottom-nav-clear fixed inset-x-3 z-40 max-h-[65dvh] flex-col gap-3.5 overflow-y-auto overscroll-contain rounded-3xl border border-rule bg-surface p-5 shadow-[0_-12px_40px_rgb(16_24_40/0.22)] md:left-auto md:right-6 md:w-[25rem]`}
    >
      {!wide && <span aria-hidden className="-mb-2 -mt-2 h-1.5 w-10 shrink-0 self-center rounded-full bg-rule" />}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-2">{subject.units.find((u) => u.id === t.unitId)?.name} · Year {t.year}</span>
        <button type="button" onClick={close} className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-ink-2 hover:bg-panel lg:hidden" aria-label="Close">×</button>
      </div>
      <div key={t.id} className="anim-fade-up flex flex-col gap-3.5">
        <span className="flex w-fit items-center gap-1.5 rounded-full bg-panel px-2.5 py-1 text-[13px] font-bold">
          <span aria-hidden className={`map-sq map-l${s.level} inline-block h-3 w-3 rounded-[3px]`} />
          {status ? STATUS_LABEL[status] : 'Not started'}
        </span>
        <h2 ref={heading} tabIndex={-1} className="text-[26px] font-bold leading-[1.1] outline-none">
          <SpecNumber code={t.specCode} /> {t.title}
        </h2>
        <p className="text-sm text-ink-2">
          Lesson of {steps} steps · Core, Higher and Advanced sheets of {t.worksheets.core.questionIds.length}, {t.worksheets.higher.questionIds.length} and {t.worksheets.advanced.questionIds.length} questions · a quiz of {t.quiz.sampleSize}
        </p>
        {lesson && !lesson.completedAt && (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] text-ink-2">Lesson: step {lesson.stepIndex + 1} of {steps}</span>
            <span className="h-2 overflow-hidden rounded-full bg-panel"><span className="anim-grow-x block h-full rounded-full" style={{ width: `${Math.round(((lesson.stepIndex + 1) / steps) * 100)}%`, background: 'var(--subject)' }} /></span>
          </div>
        )}
        <MasteryLadder level={s.level} />
        <p className="rounded-2xl px-3.5 py-3 text-sm leading-snug" style={{ background: 'color-mix(in srgb, var(--color-status-developing) 16%, var(--color-surface))' }}>
          <strong>Next:</strong> {nextRung(s, Boolean(lesson && !lesson.completedAt))}
        </p>
        <div className="flex gap-2.5">
          <Link to={base} className="hero-gradient lift flex min-h-12 flex-grow items-center justify-center gap-2 rounded-2xl px-4 font-bold shadow-[0_8px_20px_rgb(47_95_184/0.25)]">
            Open topic <span aria-hidden>→</span>
          </Link>
          <Link to={s.level === 0 || (lesson && !lesson.completedAt) ? `${base}/lesson` : `${base}/quiz`} className="lift flex min-h-12 items-center justify-center rounded-2xl border border-rule px-4 font-bold">
            {s.level === 0 ? 'Start lesson' : lesson && !lesson.completedAt ? 'Resume lesson' : 'Quiz'}
          </Link>
        </div>
      </div>
    </aside>
  )
  // On a phone the sheet goes straight into the body: the page's entrance animation leaves a
  // transform on an ancestor, and a transform makes `position: fixed` fix to that ancestor
  // instead of the window, which put the sheet 444px down the page under the menu bar.
  return wide ? panel : createPortal(panel, document.body)
}

/** Whether animations are on: the Settings switch, and the device's reduce-motion preference. */
function motionOn(): boolean {
  return document.documentElement.dataset.motion !== 'off' && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Lets a sheet be dragged down and let go to shut, as a phone's own sheets are. The drag
 * starts only from the top of the sheet's scroll, so a sheet with more below still scrolls,
 * and a swipe on a sheet with nothing to scroll is kept from moving the page behind it.
 */
function useSwipeDown(ref: React.RefObject<HTMLElement | null>, on: boolean, close: () => void) {
  const shut = useRef(close)
  shut.current = close
  useEffect(() => {
    const el = ref.current
    if (!on || !el) return
    let startY = 0
    let dy = 0
    // Recent positions, for the speed at the moment of letting go: a flick is fast at the end.
    let trail: { y: number; at: number }[] = []
    let atTop = true
    let dragging = false
    const start = (e: TouchEvent) => {
      startY = e.touches[0]!.clientY
      trail = [{ y: startY, at: e.timeStamp }]
      dy = 0
      atTop = el.scrollTop <= 0
      dragging = false
    }
    const move = (e: TouchEvent) => {
      dy = e.touches[0]!.clientY - startY
      trail = [...trail.filter((p) => e.timeStamp - p.at < 100), { y: e.touches[0]!.clientY, at: e.timeStamp }]
      if (!dragging && atTop && dy > 6) {
        dragging = true
        el.style.transition = 'none'
      }
      if (dragging) {
        e.preventDefault()
        el.style.transform = `translateY(${Math.max(0, dy)}px)`
      } else if (el.scrollHeight <= el.clientHeight + 1) {
        e.preventDefault()
      }
    }
    const end = () => {
      if (!dragging) return
      dragging = false
      const first = trail[0]!
      const last = trail.at(-1)!
      const flick = dy > 30 && (last.y - first.y) / Math.max(1, last.at - first.at) > 0.5
      if (dy > 90 || flick) {
        shut.current()
      } else {
        el.style.transition = 'transform 0.2s ease-out'
        el.style.transform = ''
      }
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
    }
  }, [ref, on])
}

/**
 * The list: the school's plan, year by year and term by term, every row either a written
 * topic or marked Coming soon, so the whole scope is visible (it was the subject page before
 * the map). One accordion per year; the student's own year starts open.
 */
function ListView({ subject, progress, studied }: { subject: Subject; progress: ProgressState; studied: (ids: string[]) => boolean }) {
  const written = topicsForSubject(subject.id)
  const blocks: SyllabusBlock[] = SYLLABUS[subject.id] ?? []
  const years = [...new Set(blocks.map((b) => b.year))].sort((a, b) => a - b)
  // The student's own year opens first when they have said it; otherwise the latest year with topics.
  const mine = progress.profile?.year
  const current = mine && years.includes(mine) ? mine : years.filter((y) => blocks.some((b) => b.year === y && b.topics.some((t) => t.topicId))).pop() ?? years[0]
  // Where the board numbers its sections, the number goes in front of the title.
  const specCodes = new Map(written.map((t) => [t.id, t.specCode]))

  return (
    <section className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {TOPIC_STATUSES.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <StatusIcon status={s} size={12} />
            {STATUS_LABEL[s]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full border border-dashed border-ink-3" />
          Coming soon
        </li>
      </ul>

      {/*
        One accordion per school year, holding the whole syllabus for that year as a
        list. Native details and summary, so it opens without JavaScript and a keyboard
        reaches it. The year in progress starts open; recap and future years start shut.
      */}
      {years.map((year) => {
        const inYear = blocks.filter((b) => b.year === year)
        const total = inYear.reduce((n, b) => n + b.topics.length, 0)
        const done = inYear.reduce((n, b) => n + b.topics.filter((t) => t.topicId).length, 0)
        const yearTopicIds = inYear.flatMap((b) => b.topics.map((t) => t.topicId).filter((id): id is string => Boolean(id)))
        return (
          <details key={year} open={year === current} className="accordion group rounded-xl border border-rule bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="text-ink-3 transition-transform group-open:rotate-90">▶</span>
              <span className="text-lg font-bold">Year {year}</span>
              <span className="ml-auto shrink-0 text-sm text-ink-2">{done} of {total} available</span>
            </summary>

            {/* The clipped box carries no border or padding of its own: a border on it
                would still paint a hairline when the row has collapsed to nothing. */}
            <div className="accordion-panel">
              <div className="flex flex-col gap-5 border-t border-rule px-4 pb-4 pt-3">
              {yearNote(year, mine ?? 10) && <p className="text-sm text-ink-3">{yearNote(year, mine ?? 10)}</p>}
              {inYear.map((block) => (
                <div key={`${year}-${block.term}`} className="flex flex-col gap-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">{block.term}</h3>
                  <ul className="flex flex-col">
                    {block.topics.map((entry) =>
                      entry.topicId ? (
                        <li key={entry.topicId} className="border-b border-rule/60 last:border-b-0">
                          <Link
                            to={`/subjects/${subject.id}/topics/${entry.topicId}`}
                            className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-panel"
                          >
                            <StatusIcon status={evidenceFor(entry.topicId, progress).status} />
                            <SpecNumber code={specCodes.get(entry.topicId)} />
                            <span>{entry.title}</span>
                            <Parts done={partsDone(entry.topicId, progress)} />
                          </Link>
                        </li>
                      ) : (
                        <li key={entry.title} className="border-b border-rule/60 last:border-b-0">
                          <span className="flex min-h-11 items-center gap-3 px-2 py-2 text-sm text-ink-3">
                            <span aria-hidden className="inline-block h-4 w-4 shrink-0 rounded-full border border-dashed border-ink-3" />
                            <span>{entry.title}</span>
                            <span className="ml-auto shrink-0 rounded-full bg-panel px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-3">
                              Coming soon
                            </span>
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
              <ResetProgress
                label={`Reset Year ${year}`}
                what={`Year ${year} ${subject.name}`}
                topicIds={yearTopicIds}
                hasProgress={studied(yearTopicIds)}
              />
              </div>
            </div>
          </details>
        )
      })}
    </section>
  )
}

/**
 * Which of the topic's five parts are done, as five small letters at the end of the row:
 * lesson, Core, Higher, Advanced and quiz, filled once done. The status icon says how well
 * the topic is known; this says what is left to do in it (LRN-1).
 */
function Parts({ done }: { done: PartsDone }) {
  return (
    <span className="ml-auto flex shrink-0 gap-0.5" role="img" aria-label={partsLabel(done)}>
      {PART_LETTERS.map(([key, letter]) => (
        <span key={key} aria-hidden
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold ${done[key] ? 'bg-[color:var(--subject)] text-white' : 'border border-rule text-ink-3'}`}>
          {letter}
        </span>
      ))}
    </span>
  )
}

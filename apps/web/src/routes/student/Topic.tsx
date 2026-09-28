import { getSubject, STATUS_LABEL, WORKSHEET_LEVELS } from '@study/shared'
import { Smiley } from '../../components/Smiley.tsx'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { termsForTopic } from '../../content/glossary.ts'
import { StatusIcon } from '../../components/StatusChip.tsx'
import { summaryById, totalMarks } from '../../content/index.ts'
import { nextRung, square } from '../../progress/map.ts'
import { MasteryLadder } from '../../components/map/MapParts.tsx'
import { useProgress } from '../../progress/useProgress.ts'
import { decayNote, evidenceFor } from '../../progress/store.ts'
import { ResetProgress } from '../../components/ResetProgress.tsx'
import { suggestedLevel } from '../../progress/level.ts'
import { openSession, quizKey, worksheetKey } from '../../progress/inProgress.ts'
import { useTopic } from '../../content/load.ts'
import { TopicLoading } from '../../components/TopicLoading.tsx'
import type { Topic as TopicRecord } from '@study/shared'
import { SubjectTile, useRandomIcon } from '../../components/SubjectTile.tsx'

/**
 * A short preview of a rich-text body, cut on a sentence end that is outside any
 * maths span. A blind slice splits `$E_e = \tfrac{1}{2}ke^2$` down the middle and the
 * card shows the raw LaTeX, which is what four topics used to do.
 */
export function previewOf(body: string, max = 150): string {
  // Bold is tracked the same way as maths: a cut inside `**…**` leaves a literal pair
  // of asterisks on the card, which the frequency trees note did until 16 September.
  let maths = 0
  let bold = 0
  let cut = 0
  for (let i = 0; i < body.length && i < max; i++) {
    if (body[i] === '$') { maths = maths === 0 ? 1 : 0; continue }
    if (body.startsWith('**', i)) { bold = bold === 0 ? 1 : 0; i++; continue }
    if (maths || !(body[i] === '.' || body[i] === '!' || body[i] === '?')) continue
    if (bold === 0 && body[i + 1] === ' ') cut = i + 1
    // A sentence that ends inside bold — "…its parent.** Fill" — ends after the bold closes.
    else if (bold === 1 && body.startsWith('**', i + 1) && (body[i + 3] === ' ' || i + 3 >= body.length)) cut = i + 3
  }
  if (cut > 0) return body.slice(0, cut)
  // No sentence ended in range: fall back to the whole body if it is short, else
  // the longest prefix that closes every maths span and every bold it opens.
  if (body.length <= max) return body
  let safe = 0
  maths = 0
  bold = 0
  for (let i = 0; i < max; i++) {
    if (body[i] === '$') { maths = maths === 0 ? 1 : 0; continue }
    if (body.startsWith('**', i)) { bold = bold === 0 ? 1 : 0; i++; continue }
    if (maths === 0 && bold === 0 && body[i] === ' ') safe = i
  }
  if (safe) return body.slice(0, safe) + '…'
  // Nowhere safe to cut: a span opened at the start and runs past the limit. Cut at the
  // limit and close whatever is still open, so the card never shows a stray delimiter.
  const end = body[max - 1] === '*' && body[max] === '*' ? max - 1 : max
  return body.slice(0, end) + (maths ? '$' : '') + (bold ? '**' : '') + '…'
}

const LEVEL_LABEL = { core: 'Core', higher: 'Higher', advanced: 'Advanced' } as const
const LEVEL_NOTE = {
  core: 'Prerequisites only. Short, done once.',
  higher: 'Exam-style questions on the main ideas.',
  advanced: 'Multi-step problems in unfamiliar contexts. Show that, and explain.',
} as const

/**
 * A topic (Option C). A banner with why the topic exists and the way back in; the lesson's
 * steps, ticked as far as the student has gone, with the current one pulsing; beside them
 * the mastery ladder, what moves it up a rung, the three worksheets and the quiz, and the
 * quick revision tools. Tips, key terms and practice links follow.
 */
function TopicBody({ topic }: { topic: TopicRecord }) {
  const { subjectId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const progress = useProgress()
  if (!subject || !topic) return <p>Unknown topic.</p>
  const evidence = evidenceFor(topic.id, progress)
  const lesson = progress.lessons[topic.id]
  const summary = summaryById(topic.id)
  const sq = summary ? square(summary, progress) : undefined
  const steps = topic.lesson.steps
  const underway = Boolean(lesson && !lesson.completedAt)
  const unit = subject.units.find((u) => u.id === topic.unitId)?.name
  const fmt = (v?: number) => (v === undefined ? 'not yet' : `${Math.round(v)}%`)
  // The two most recent quiz scores, so the stat can show the direction of travel.
  const quizzes = progress.attempts.filter((a) => a.topicId === topic.id && a.kind === 'quiz').sort((a, b) => b.completedAt.localeCompare(a.completedAt))
  const pct = (a: { marksScored: number; marksAvailable: number }) => Math.round((100 * a.marksScored) / a.marksAvailable)
  const quizNote = quizzes.length >= 2 ? (() => { const d = pct(quizzes[0]!) - pct(quizzes[1]!); return d === 0 ? `same as last time` : `${d > 0 ? 'up' : 'down'} from ${pct(quizzes[1]!)}%` })() : undefined
  // The banner's main button: back into the lesson, into it for the first time, or on to the quiz.
  const primary = underway
    ? { to: `lesson?step=${lesson!.stepIndex + 1}`, label: `Carry on: step ${lesson!.stepIndex + 1} of ${steps.length}` }
    : lesson?.completedAt ? { to: 'quiz', label: evidence.quizPct === undefined ? 'Take the quiz' : 'Quiz again' } : { to: 'lesson', label: 'Start the lesson' }
  const stepsDone = evidence.lessonDone ? steps.length : lesson ? lesson.stepIndex : 0

  return (
    <article className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <p className="text-sm text-ink-2">
        <Link to="/subjects" className="-my-1 inline-block py-1 underline">Subjects</Link> <span aria-hidden>/</span>{' '}
        <Link to={`/subjects/${subject.id}`} className="-my-1 inline-block py-1 underline">{subject.name}</Link> <span aria-hidden>/</span> {topic.title}
      </p>

      <section className="hero-gradient anim-rise relative flex items-center gap-8 overflow-hidden rounded-[26px] p-5 shadow-[0_16px_40px_rgb(47_95_184/0.28)] sm:p-8">
        <span className="hero-shine" aria-hidden />
        <div className="relative flex min-w-0 max-w-3xl flex-grow flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.12em]">{subject.name}{unit ? ` · ${unit}` : ''} · Year {topic.year}</p>
          <h1 className="text-[32px] font-bold leading-[1.05] sm:text-[44px]">
            {topic.specCode && <span className="opacity-80">{topic.specCode} </span>}
            {topic.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-bold">
              <StatusIcon status={evidence.status} size={12} colour="currentColor" />
              {sq?.level === 0 ? 'Not started' : STATUS_LABEL[evidence.status]}
            </span>
            {/* The ring's place below laptop width, where there is no room beside the text. */}
            <span className="flex w-fit items-center gap-1.5 rounded-full bg-white/20 py-1 pl-1.5 pr-3 text-[13px] font-bold lg:hidden">
              <LessonRing done={stepsDone} total={steps.length} small />
              {stepsDone}/{steps.length} steps
            </span>
          </div>
          {topic.why && <RichText source={topic.why.matters} className="text-[15px] leading-relaxed sm:text-base" />}
          <div className="mt-1 flex flex-wrap gap-3">
            <Link to={primary.to} className="lift flex min-h-12 items-center gap-2 rounded-2xl bg-white px-5 font-bold text-[#2a2f9e] shadow-[0_8px_20px_rgb(0_0_0/0.2)]">
              {primary.label} <span aria-hidden>→</span>
            </Link>
            {/* Orientation, so it comes before the lesson: what the idea is for and where it turns up. */}
            {topic.why && topic.why.examples.length > 0 && (
              <Link to="why" className="lift flex min-h-12 items-center rounded-2xl border-[1.5px] border-white/70 px-5 font-bold">Where you meet it</Link>
            )}
          </div>
        </div>
        <HeroPicture subject={subject} done={stepsDone} total={steps.length} />
      </section>

      {/* Three blocks in the order a phone reads them: the lesson, then mastery and practice,
          then tips and terms. On a wide screen the middle block stands to the right of the other two. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:grid-rows-[auto_1fr] lg:items-start">
          <section aria-labelledby="lesson-heading" className="anim-rise card-top flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4 shadow-[0_1px_2px_rgb(16_24_40/0.05),0_8px_24px_rgb(16_24_40/0.05)] sm:p-5 lg:col-start-1 lg:row-start-1" style={{ '--d': '0.08s' } as React.CSSProperties}>
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="tint flex h-9 w-9 items-center justify-center rounded-xl text-lg"><Smiley>📖</Smiley></span>
              <h2 id="lesson-heading" className="flex-grow text-[22px] font-bold">Lesson</h2>
              <span className="text-sm text-ink-2"><strong className="text-ink">{stepsDone} of {steps.length}</strong> steps · one idea each</span>
            </div>
            <span className="h-2 overflow-hidden rounded-full bg-panel" aria-hidden>
              <span className="anim-grow-x block h-full rounded-full" style={{ width: `${Math.round((stepsDone / steps.length) * 100)}%`, backgroundImage: 'linear-gradient(90deg, var(--subject), color-mix(in srgb, var(--subject) 55%, #fff))' }} />
            </span>
            <ol className="grid grid-cols-1 gap-x-4 md:grid-cols-2 md:[grid-auto-flow:column]" style={{ gridTemplateRows: `repeat(${Math.ceil(steps.length / 2)}, auto)` }}>
              {steps.map((st, i) => {
                const done = i < stepsDone
                const current = underway && i === lesson!.stepIndex
                return (
                  <li key={st.id}>
                    <Link to={`lesson?step=${i + 1}`} aria-current={current ? 'step' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-panel ${current ? 'tint font-bold' : ''}`}>
                      <span aria-hidden className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'map-sq map-l4 map-on-l4' : current ? 'anim-here bg-surface text-ink ring-2 ring-[color:var(--subject)]' : 'border border-rule text-ink-3'}`}>
                        {done ? '✓' : i + 1}
                      </span>
                      <span className={`leading-snug ${done || current ? 'text-ink' : 'text-ink-2'}`}>{st.title}</span>
                      <span className="sr-only">{done ? ', done' : current ? ', you are here' : ''}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>

        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section aria-labelledby="mastery-heading" className="anim-rise flex flex-col gap-3 rounded-2xl border border-rule bg-surface p-4" style={{ '--d': '0.12s' } as React.CSSProperties}>
            <h2 id="mastery-heading" className="font-sans text-sm font-bold text-ink-2">Mastery</h2>
            {sq && <MasteryLadder level={sq.level} />}
            {decayNote(evidence) && <p className="text-sm text-ink-2">{decayNote(evidence)}</p>}
            {sq && (
              <p className="rounded-xl px-3 py-2.5 text-sm leading-snug" style={{ background: 'color-mix(in srgb, var(--color-status-developing) 16%, var(--color-surface))' }}>
                <strong>Next:</strong> {nextRung(sq, underway)}
              </p>
            )}
            <dl className="grid grid-cols-3 gap-2 text-sm">
              {[
                ['Last quiz', fmt(evidence.quizPct), quizNote],
                ['Higher sheet', fmt(evidence.higherPct)],
                ['Advanced sheet', fmt(evidence.advancedPct)],
              ].map(([label, value, note]) => (
                <div key={label} className="flex flex-col-reverse gap-0.5 rounded-lg bg-panel px-2.5 py-2">
                  {note && <span className="order-first text-[11px] text-ink-2">{note}</span>}
                  <dt className="text-[11px] text-ink-2">{label}</dt>
                  <dd className="font-bold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <nav aria-label="Practise" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {WORKSHEET_LEVELS.map((level, i) => {
              const sheet = topic.worksheets[level]
              // One level is suggested from the topic's status (Advanced once Secure); the
              // others stay open, because the app recommends and never blocks.
              const suggested = level === suggestedLevel(evidence.status)
              const open = openSession(worksheetKey(topic.id, level))
              return (
                <PracticeCard
                  key={level}
                  to={`worksheet/${level}`}
                  n={i + 1}
                  colour={LEVEL_COLOUR[level]}
                  title={`${LEVEL_LABEL[level]} worksheet`}
                  note={`${open ? `Started: on question ${open.index + 1} of ${sheet.questionIds.length}. ` : suggested ? 'Suggested for where you are. ' : ''}${sheet.questionIds.length} questions · ${totalMarks(topic, sheet.questionIds)} marks · about ${sheet.suggestedMinutes} min. ${LEVEL_NOTE[level]}`}
                  action={open ? 'Resume' : suggested ? 'Start here' : 'Open'}
                  highlight={suggested}
                  delay={0.16 + i * 0.05}
                />
              )
            })}
            {(() => {
              // An unfinished quiz is kept on the device, so the card offers to carry on with it.
              const open = openSession(quizKey(topic.id))
              return <PracticeCard to="quiz" n={4} colour="#b5451b" title="Quiz" note={open ? `Started: on question ${open.index + 1} of ${open.total}. Your answers so far are kept.` : `${topic.quiz.sampleSize} questions drawn from ${topic.quiz.questionIds.length}, marked instantly`} action={open ? 'Resume' : 'Start'} delay={0.31} />
            })()}
          </nav>

          <nav aria-label="Revise" className="anim-rise grid grid-cols-3 gap-2" style={{ '--d': '0.36s' } as React.CSSProperties}>
            {[
              ['flashcards', 'Flashcards', '🃏', 'Tap to flip'],
              ['cheatsheet', 'Cheat sheet', '📋', 'One page, prints'],
              [`/subjects/${subject.id}/exam-technique`, 'Exam technique', '🎓', previewOf(topic.examTechnique.body, 60)],
            ].map(([to, title, emoji, note]) => (
              <Link key={title} to={to!} title={note} className="lift tint flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-center text-sm font-bold">
                <Smiley>{emoji!}</Smiley>
                {title}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-6 lg:col-start-1 lg:row-start-2">
          {topic.tips && topic.tips.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="chip w-fit" style={{ '--chip': '#c27a00' } as React.CSSProperties}><Smiley>💡</Smiley>Tips and tricks</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {topic.tips.map((tip, i) => (
                  <li key={i} className="anim-rise flex flex-col gap-1 rounded-2xl border border-rule bg-surface px-4 py-3" style={{ '--d': `${(0.15 + i * 0.05).toFixed(2)}s` } as React.CSSProperties}>
                    <span className="flex items-center gap-2">
                      <Smiley>{TIP_EMOJI[tip.kind]}</Smiley>
                      <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{TIP_LABEL[tip.kind]}</span>
                    </span>
                    <span className="font-bold">{tip.title}</span>
                    <RichText source={tip.body} className="text-sm" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {termsForTopic(topic.id).length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="chip w-fit" style={{ '--chip': '#6B4E9B' } as React.CSSProperties}><Smiley>📖</Smiley>Key terms</h2>
              <ul className="flex flex-wrap gap-2">
                {termsForTopic(topic.id).map((term) => (
                  <li key={term.slug}>
                    <Link to={`/glossary?term=${term.slug}`} className="lift inline-flex min-h-9 items-center rounded-full border border-rule bg-surface px-3 text-sm hover:border-[color:var(--subject)]">
                      {term.term}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topic.resources && topic.resources.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="chip w-fit" style={{ '--chip': '#1f3a93' } as React.CSSProperties}><Smiley>💻</Smiley>Practise</h2>
              {topic.resources.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="lift flex items-center justify-between gap-3 rounded-2xl border border-rule bg-surface px-4 py-3">
                  <span className="flex flex-col"><span className="font-bold">{r.label}</span>{r.note && <span className="text-sm text-ink-2">{r.note}</span>}</span>
                  <span className="shrink-0 rounded-lg bg-[color:var(--subject)] px-4 py-2 text-sm font-bold text-white">Open</span>
                </a>
              ))}
            </section>
          )}
        </div>
      </div>

      <section className="flex flex-col gap-2 border-t border-rule pt-5">
        <ResetProgress
          label="Reset this topic"
          what="this topic"
          topicIds={[topic.id]}
          hasProgress={progress.attempts.some((a) => a.topicId === topic.id) || Boolean(progress.lessons[topic.id])}
        />
      </section>
    </article>
  )
}

/**
 * The banner's right-hand side on a laptop: the ring of lesson steps, with three of the
 * subject's pictures drifting round it, different ones on each visit. It takes the width the
 * text leaves, rather than sitting beside the text and leaving a gap at the end.
 */
function HeroPicture({ subject, done, total }: { subject: { id: string; colour: string }; done: number; total: number }) {
  const first = useRandomIcon(subject.id)
  const spots = ['-translate-x-[130px] -translate-y-[92px]', 'translate-x-[118px] translate-y-[8px]', '-translate-x-[112px] translate-y-[84px]']
  return (
    <div aria-hidden className="relative hidden min-w-80 flex-1 items-center justify-center self-stretch lg:flex">
      {spots.map((spot, i) => (
        <span key={i} className={`absolute left-1/2 top-1/2 -ml-[26px] -mt-[26px] ${spot}`}>
          <SubjectTile subjectId={subject.id} colour={subject.colour} variant={first + i} i={i} big />
        </span>
      ))}
      <LessonRing done={done} total={total} />
    </div>
  )
}

/** A ring of the lesson's steps, filling as far as the student has gone. */
function LessonRing({ done, total, small = false }: { done: number; total: number; small?: boolean }) {
  const r = 58
  const c = 2 * Math.PI * r
  const fill = done > 0 && <circle className="anim-ring" cx="80" cy="80" r={r} fill="none" stroke="#fff" strokeWidth={small ? 22 : 12} strokeLinecap="round" strokeDasharray={`${(c * done) / total} ${c}`} transform="rotate(-90 80 80)" />
  if (small) {
    return (
      <svg width="22" height="22" viewBox="0 0 160 160" aria-hidden className="shrink-0">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="22" />
        {fill}
      </svg>
    )
  }
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" aria-hidden className="anim-drift relative shrink-0" style={{ '--r': '0deg' } as React.CSSProperties}>
      <circle cx="80" cy="80" r="70" fill="rgb(255 255 255 / 0.12)" />
      <circle cx="80" cy="80" r={r} fill="none" stroke="rgb(255 255 255 / 0.25)" strokeWidth="12" />
      {fill}
      <text x="80" y="82" textAnchor="middle" fontFamily="Bricolage Grotesque, Arial, sans-serif" fontSize="34" fontWeight="700" fill="#fff">{done}/{total}</text>
      <text x="80" y="104" textAnchor="middle" fontSize="13" fill="#fff">steps</text>
    </svg>
  )
}

/** Four kinds of tip: how to remember it, how to spot it, a faster route, a way to check. */
const TIP_EMOJI: Record<string, string> = { remember: '🧠', spot: '🔍', shortcut: '⚡', check: '✅' }
const TIP_LABEL: Record<string, string> = { remember: 'Remember it', spot: 'Spot it', shortcut: 'Quicker way', check: 'Check it' }

/** The worksheets run from light to dark in the colour of their difficulty; the quiz is its own colour. */
const LEVEL_COLOUR = { core: '#237a4d', higher: '#1f3a93', advanced: '#6b4e9b' } as const

/** A worksheet or the quiz: a numbered card with its colour along the top. */
function PracticeCard({ to, n, colour, title, note, action, highlight = false, delay }: { to: string; n: number; colour: string; title: string; note: string; action: string; highlight?: boolean; delay: number }) {
  return (
    <Link to={to} style={{ '--subject': colour, '--d': `${delay.toFixed(2)}s` } as React.CSSProperties}
      className={`anim-rise lift card-top flex flex-col gap-2 rounded-2xl bg-surface p-3.5 ${highlight ? 'border-2 border-[color:var(--subject)]' : 'border border-rule'}`}>
      <span className="flex items-center gap-2">
        <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold text-white" style={{ background: colour }}>{n}</span>
        <span className="flex-grow font-bold leading-tight">{title}</span>
      </span>
      <RichText source={note} inline className="text-xs text-ink-2" />
      <span className="mt-auto w-fit rounded-lg bg-[color:var(--subject)] px-3 py-1.5 text-sm font-bold text-white">{action}</span>
    </Link>
  )
}

/** Fetches the topic's full content, then shows the page (OPS-1). */
export function Topic() {
  const { subjectId, topicId } = useParams()
  const topic = useTopic(subjectId, topicId)
  if (topic === undefined) return <TopicLoading />
  if (topic === null) return <p>Unknown topic.</p>
  return <TopicBody key={topic.id} topic={topic} />
}

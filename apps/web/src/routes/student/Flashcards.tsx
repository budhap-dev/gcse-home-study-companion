import { getSubject, seededShuffle, type Question } from '@study/shared'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { RichText } from '../../components/RichText.tsx'
import { Smiley } from '../../components/Smiley.tsx'
import { Confetti } from '../../components/Confetti.tsx'
import { usePref } from '../../theme/prefs.ts'
import { getTopic } from '../../content/index.ts'
import { recordActivity } from '../../progress/store.ts'
import { useActivityTimer } from '../../progress/useActivityTimer.ts'

/**
 * What to say at the end. Keyed to how the deck actually went rather than always
 * congratulating: a student who needed three passes knows they needed three passes, and
 * being told "perfect!" anyway is how an app stops being believed.
 */
export function wellDone(cards: number, turns: number): { emoji: string; line: string } {
  const extra = turns - cards
  if (extra === 0) return { emoji: '\u{1F31F}', line: 'Every card first time. That is the whole deck known.' }
  if (extra <= 2) return { emoji: '\u{1F389}', line: 'Nearly clean — only a couple came back round.' }
  if (extra <= cards) return { emoji: '\u{1F4AA}', line: 'You worked for that one. The cards that came back are the ones worth another look.' }
  return { emoji: '\u{1F9E0}', line: 'A hard deck. Worth running again tomorrow rather than now.' }
}

export interface Card {
  id: string
  front: string
  back: string
  kind: 'fact' | 'question'
}

/**
 * Split one summary bullet into a prompt and an answer.
 *
 * Summary bullets are written as a bold cue followed by the detail — "**Oxygen debt** the
 * oxygen needed afterwards to break down the lactic acid" — so the bold run is the front
 * of the card. Where there is no bold lead, a small set of separators finds the break.
 * Splitting on punctuation alone used to fail on most bullets, because the "**" markers sit
 * between the full stop and the space.
 */
function cueAndDetail(bullet: string): { front: string; back: string } | null {
  const text = bullet.trim()

  const lead = /^\*\*(.+?)\*\*[\s,:—-]*(.+)$/s.exec(text)
  if (lead) {
    const front = lead[1]!.replace(/\*\*/g, '').replace(/[.:,]\s*$/, '').trim()
    const back = lead[2]!.trim()
    if (front.length >= 6 && front.length < 70 && back.length >= 8) return { front, back }
  }

  const plain = text.replace(/\*\*/g, '').trim()
  for (const sep of [/:\s/, / — /, /;\s/, /\.\s/, /,\s(?=because|which|so\b)/]) {
    const at = sep.exec(plain)
    if (!at) continue
    const front = plain.slice(0, at.index).trim()
    const back = plain.slice(at.index + at[0].length).trim()
    if (front.length >= 8 && front.length < 70 && back.length >= 8) return { front, back }
  }
  return null
}

/** Cards come from the topic itself: its summary points, its questions, and its exam technique note. */
export function buildCards(topic: NonNullable<ReturnType<typeof getTopic>>): Card[] {
  const cards: Card[] = []
  const summary = topic.lesson.steps.find((s) => s.kind === 'summary')
  if (summary) {
    summary.body.split('\n').filter((l) => l.trim().startsWith('- ')).forEach((l, i) => {
      const cue = cueAndDetail(l.trim().slice(2))
      // A bullet with no cue in it makes no card. It used to make one headed
      // "Key point 7 of ...", which asks the reader nothing: 56% of the summary cards in
      // the pack were that. A shorter deck of real prompts is worth more than a long one.
      if (cue) cards.push({ id: `s${i}`, front: cue.front, back: cue.back, kind: 'fact' })
    })
  }
  const answer = (q: Question): string | null => {
    switch (q.type) {
      case 'multiple-choice': return q.correct.map((i) => q.options[i]).join(', ')
      case 'numeric': return `${q.answer}${q.units ? ` ${q.units}` : ''}`
      case 'short-text': return q.accepted[0]!
      default: return null
    }
  }
  for (const q of topic.questions) {
    const a = answer(q)
    if (!a || q.prompt.length >= 220) continue
    // A multiple-choice prompt says "which of these", so the card has to carry the
    // options too. Without them the front is a question the reader cannot answer.
    const front = q.type === 'multiple-choice' ? `${q.prompt}\n\n${q.options.map((o) => `- ${o}`).join('\n')}` : q.prompt
    cards.push({ id: q.id, front, back: `**${a}**\n\n${q.solution}`, kind: 'question' })
  }
  topic.examTechnique.examinerErrors.slice(0, 3).forEach((e, i) => cards.push({ id: `e${i}`, front: `Examiner trap ${i + 1}: what do students get wrong?`, back: e, kind: 'fact' }))
  return cards
}

/**
 * Flip cards for quick recall. Tap to flip, then say whether you knew it. Cards
 * you did not know come back at the end of the deck until you do.
 */
export function Flashcards() {
  const { subjectId, topicId } = useParams()
  const subject = subjectId ? getSubject(subjectId) : undefined
  const topic = subjectId && topicId ? getTopic(subjectId, topicId) : undefined
  const deck = useMemo(() => (topic ? seededShuffle(buildCards(topic), String(Date.now() % 100000)) : []), [topic])
  const [queue, setQueue] = useState<Card[]>(() => deck)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState(0)
  const [seen, setSeen] = useState(0)
  const [run, setRun] = useState(0)
  const [leaving, setLeaving] = useState<'known' | 'again' | null>(null)
  const motion = usePref('motion')
  // Only while cards are left: the well-done screen at the end is not revision.
  useActivityTimer(topic && { subjectId: topic.subjectId, topicId: topic.id, kind: 'flashcards' }, queue.length > 0)

  /**
   * A finished deck is the one thing here worth recording: it is real revision, and until
   * now it left no trace at all, so an evening of flashcards showed up on the parent's
   * Recent work as nothing.
   *
   * On the queue emptying rather than in `answer`, so "Go again" records the second run
   * too; the store keeps one entry per topic per day and takes the fuller run of them. The
   * ref stops React's development double-mount writing the same finish twice.
   */
  const recorded = useRef('')
  useEffect(() => {
    if (!topic || deck.length === 0 || queue.length > 0) return
    const run = `${topic.id}:${deck.length}:${seen}`
    if (recorded.current === run) return
    recorded.current = run
    recordActivity({ subjectId: topic.subjectId, topicId: topic.id }, 'flashcards', { cards: deck.length, turns: seen })
  }, [topic, deck.length, queue.length, seen])

  if (!subject || !topic) return <p>Unknown topic.</p>
  const backTo = `/subjects/${subject.id}/topics/${topic.id}`
  const card = queue[0]

  const answer = (knew: boolean) => {
    if (leaving) return
    setSeen((n) => n + 1)
    if (knew) setKnown((n) => n + 1)
    setRun((n) => (knew ? n + 1 : 0))
    const advance = () => {
      setFlipped(false)
      setLeaving(null)
      setQueue((q) => (knew ? q.slice(1) : [...q.slice(1), q[0]!]))
    }
    // With motion off there is no animation to wait for, so the card must not sit there.
    if (!motion) { advance(); return }
    setLeaving(knew ? 'known' : 'again')
    setTimeout(advance, 320)
  }
  const restart = () => { setQueue(deck); setKnown(0); setSeen(0); setRun(0); setFlipped(false); setLeaving(null) }

  if (!card) {
    const praise = wellDone(deck.length, seen)
    return (
      <article className="mx-auto flex w-full max-w-xl flex-col gap-5 py-6 text-center">
        <Confetti />
        <p className="text-6xl leading-none"><Smiley bounce>{praise.emoji}</Smiley></p>
        <p className="text-xs font-bold uppercase tracking-[0.08em] accent-ink">Deck finished</p>
        <h1 className="text-3xl font-bold">{topic.title}</h1>
        <p className="text-lg font-bold">{praise.line}</p>
        <p className="text-ink-2">{deck.length} cards, {seen} turns. {seen > deck.length ? `${seen - deck.length} came back round before you knew them.` : 'Every card known first time.'}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={restart} className="h-12 rounded-xl bg-[color:var(--subject)] px-5 font-bold text-white">Go again</button>
          <Link to={`${backTo}/quiz`} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Take the quiz</Link>
          <Link to={backTo} className="flex h-12 items-center justify-center rounded-xl border border-rule bg-surface px-5 font-bold">Back to topic</Link>
        </div>
      </article>
    )
  }

  return (
    <article className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="flex items-center gap-3">
        <Link to={backTo} aria-label="Back to topic" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule bg-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
        </Link>
        <div className="flex flex-grow flex-col">
          <span className="text-xs font-bold uppercase tracking-[0.06em] accent-ink">{subject.name} · Flashcards</span>
          <span className="font-bold">{topic.title}</span>
        </div>
        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-ink-2 tabular-nums">
          {run >= 3 && (
            <span className="anim-streak rounded-full bg-[#ffe9dc] px-2 py-0.5 text-xs font-bold text-[#8a3b12]">
              <Smiley>🔥</Smiley> {run} in a row
            </span>
          )}
          {known} known · {queue.length} left
        </span>
      </header>

      {/* How far through the deck, which a shrinking pile alone does not make precise. */}
      <div className="flex items-center gap-2">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
          <span className="block h-full rounded-full bg-[color:var(--subject)] transition-[width] duration-300"
            style={{ width: `${Math.round((100 * known) / Math.max(1, deck.length))}%` }} />
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-3">{known} of {deck.length}</span>
      </div>

      <div className="relative">
        {/* The rest of the pile, so the deck visibly shrinks as it is worked through. */}
        {queue.length > 1 && <span aria-hidden className="card-stack card-stack-1" />}
        {queue.length > 2 && <span aria-hidden className="card-stack card-stack-2" />}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        className={`flashcard relative block min-h-72 w-full rounded-2xl text-left [perspective:1200px] ${leaving === 'known' ? 'is-leaving-known' : leaving === 'again' ? 'is-leaving-again' : ''}`}
      >
        <div className={`flashcard-inner relative min-h-72 w-full ${flipped ? 'is-flipped' : ''}`}>
          <div className="flashcard-face flex flex-col gap-3 rounded-2xl border-2 border-[color:var(--subject)] bg-surface p-5"
            style={{ backgroundImage: 'linear-gradient(160deg, color-mix(in srgb, var(--subject) 9%, transparent), transparent 55%)' }}>
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">{card.kind === 'question' ? 'Question' : 'Recall'}</span>
            <RichText source={card.front} className="text-[17px] leading-relaxed" />
            <span className="mt-auto flex items-center gap-1.5 text-xs text-ink-2"><Smiley>👆</Smiley> Tap to flip</span>
          </div>
          <div className="flashcard-face flashcard-back flex flex-col gap-3 rounded-2xl border-2 border-rule bg-panel p-5">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Answer</span>
            <RichText source={card.back} className="text-[16px] leading-relaxed" />
          </div>
        </div>
      </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => answer(false)} disabled={!flipped || Boolean(leaving)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-rule bg-surface font-bold disabled:opacity-40">
          <Smiley>🔁</Smiley> Again
        </button>
        <button type="button" onClick={() => answer(true)} disabled={!flipped || Boolean(leaving)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[color:var(--subject)] font-bold text-white disabled:opacity-40">
          <Smiley>✅</Smiley> Got it
        </button>
      </div>
    </article>
  )
}

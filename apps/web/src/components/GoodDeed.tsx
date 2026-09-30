import { useEffect } from 'react'
import { CharacterIcon } from './characterIcons.tsx'
import { Smiley } from './Smiley.tsx'
import { answerDeed, isoDate, noteDeedSeen } from '../progress/store.ts'
import { useProgress } from '../progress/useProgress.ts'
import { deedPrompt, deedsDone, recentDeeds, type DeedDay, type DeedPrompt } from '../progress/deeds.ts'

/** The deed card's accent: a warm rose, the same in every theme, clamped by the chip like any accent. */
const ACCENT = '#c8501f'

/**
 * The good deed for the day, on Home. In the morning it says what to do; from teatime it
 * asks whether it was done, and it asks about yesterday's first if that was never answered.
 * The answer is recorded against the day, so the parent's dashboard can see it and the
 * running count on the card climbs.
 */
export function GoodDeed({ now = new Date() }: { now?: Date }) {
  const progress = useProgress()
  const prompt = deedPrompt(progress, now)
  // Shown today, so it can be asked about; yesterday's is already on record.
  useEffect(() => {
    if (!prompt.yesterday) noteDeedSeen(prompt.day, prompt.deed.id)
  }, [prompt.day, prompt.deed.id, prompt.yesterday])
  return (
    <DeedCard
      prompt={prompt}
      count={deedsDone(progress)}
      days={recentDeeds(progress, isoDate(now))}
      onAnswer={(done) => answerDeed(prompt.day, prompt.deed.id, done)}
    />
  )
}

/** The card itself, from a prompt: rendered and tested without the store. */
export function DeedCard({ prompt, count, days, onAnswer }: { prompt: DeedPrompt; count: number; days: DeedDay[]; onAnswer: (done: boolean) => void }) {
  const { deed, phase, yesterday } = prompt
  const done = prompt.record?.done
  const label = yesterday ? 'Yesterday’s good deed' : 'Good deed for today'
  return (
    <section
      className="anim-rise relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-4"
      style={{ '--subject': ACCENT, '--d': '0.16s', borderColor: 'color-mix(in srgb, var(--subject) 45%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--subject) 14%, var(--color-surface)), var(--color-surface) 70%)' } as React.CSSProperties}
      aria-labelledby="deed-heading"
    >
      <div className="flex items-center gap-2">
        <h2 id="deed-heading" className="chip" style={{ '--chip': ACCENT } as React.CSSProperties}><Smiley>🌱</Smiley>{label}</h2>
        {count > 0 && <span className="text-xs font-bold accent-ink tabular-nums">{count} done</span>}
      </div>

      <div className="flex items-start gap-3">
        {/* The deed's picture, on a tile of the accent; it pops when the deed is done. */}
        <span key={phase === 'answered' && done ? 'done' : 'deed'} className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white ${phase === 'answered' && done ? 'anim-pop' : ''}`} style={{ background: 'var(--subject)' }} aria-hidden>
          <CharacterIcon name={phase === 'answered' && done ? 'shield' : deed.icon} size={32} />
        </span>
        <p className="flex-grow text-[17px] font-bold leading-snug [text-wrap:pretty]">{deed.text}</p>
      </div>

      {phase === 'show' && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">This evening the app will ask whether you did it.</p>
          <button type="button" onClick={() => onAnswer(true)} className="press min-h-11 rounded-full border border-rule bg-surface px-4 text-sm font-bold">Done it already</button>
        </div>
      )}

      {phase === 'ask' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-bold">{yesterday ? 'Did you manage it yesterday?' : 'Did you do it today?'}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAnswer(true)} className="press flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--subject)] px-3 font-bold text-white"><Smiley>✅</Smiley> Yes, I did</button>
            <button type="button" onClick={() => onAnswer(false)} className="press flex min-h-11 items-center justify-center rounded-xl border border-rule bg-surface px-3 font-bold">{yesterday ? 'Not that day' : 'Not today'}</button>
          </div>
        </div>
      )}

      {phase === 'answered' && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">
            {done
              ? <><strong>Done. Nice one.</strong> {count === 1 ? 'Your first good deed on record.' : `That makes ${count}.`}</>
              : <><strong>Not this time.</strong> There is another tomorrow.</>}
          </p>
          <DeedDots days={days} />
        </div>
      )}
    </section>
  )
}

/** The last seven days as dots: done, not done, or the app was not opened. */
function DeedDots({ days }: { days: DeedDay[] }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="The last seven days">
      {days.map((d) => {
        const weekday = new Date(d.day + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
        const state = d.done === true ? 'done' : d.done === false ? 'not done' : d.deed ? 'not answered' : 'not opened'
        return (
          <li key={d.day} className="flex flex-col items-center gap-0.5" title={d.deed ? `${weekday}: ${d.deed.text} ${state}` : `${weekday}: ${state}`}>
            <span aria-hidden className={`block h-3 w-3 rounded-full ${d.done === true ? 'bg-[color:var(--subject)]' : d.done === false ? 'bg-panel ring-1 ring-rule' : 'bg-panel'}`} />
            <span className="text-[11px] text-ink-3">{weekday[0]}</span>
            <span className="sr-only">{weekday}: {state}</span>
          </li>
        )
      })}
    </ol>
  )
}

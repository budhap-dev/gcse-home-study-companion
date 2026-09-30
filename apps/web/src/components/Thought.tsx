import { useState } from 'react'
import { THEMES, quoteOfTheDay, type Quote } from '@study/shared'
import { CharacterIcon } from './characterIcons.tsx'

/**
 * The thought for the day: a saying on dedication, discipline or one of their relatives,
 * with who said it and where. A new one each day, and another on request, like the fact.
 */
export function Thought({ now = new Date() }: { now?: Date }) {
  const [offset, setOffset] = useState(0)
  return <ThoughtCard quote={quoteOfTheDay(now, offset)} onAnother={() => setOffset((n) => n + 1)} key={offset} />
}

export function ThoughtCard({ quote, onAnother }: { quote: Quote; onAnother?: () => void }) {
  const theme = THEMES[quote.theme]
  return (
    <section
      className="anim-fade-up relative flex flex-col gap-3 overflow-hidden rounded-2xl border p-5"
      style={{ '--subject': theme.colour, borderColor: 'color-mix(in srgb, var(--subject) 45%, transparent)', background: 'linear-gradient(135deg, color-mix(in srgb, var(--subject) 16%, var(--color-surface)), var(--color-surface) 70%)' } as React.CSSProperties}
      aria-labelledby="thought-heading"
    >
      {/* A big quotation mark behind the words, the way the fact card has its bulb. */}
      <span className="pointer-events-none absolute -right-2 -top-8 font-display text-[9rem] leading-none opacity-15 accent-ink" aria-hidden>{'”'}</span>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="thought-heading" className="chip" style={{ '--chip': theme.colour } as React.CSSProperties}>Thought for today</h2>
        <span className="flex items-center gap-1 text-xs font-bold accent-ink"><CharacterIcon name={theme.icon} size={14} />{theme.label}</span>
      </div>
      <blockquote className="relative flex flex-col gap-2">
        <p className="font-display text-[19px] font-semibold leading-snug [text-wrap:pretty]">{quote.text}</p>
        <footer className="text-sm text-ink-2"><span className="font-bold text-ink">{quote.by}</span> · {quote.source}</footer>
      </blockquote>
      {onAnother && (
        <button type="button" onClick={onAnother} className="press relative w-fit min-h-9 rounded-full bg-[color:var(--subject)] px-4 py-1.5 text-sm font-bold text-white">
          Another one <span aria-hidden>→</span>
        </button>
      )}
    </section>
  )
}

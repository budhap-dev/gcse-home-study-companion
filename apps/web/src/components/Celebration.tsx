import { useEffect } from 'react'
import { Smiley } from './Smiley.tsx'
import { Confetti } from './Confetti.tsx'

/**
 * A short burst of confetti behind a card. Respects reduced motion by showing
 * the card alone. Mount it when something worth celebrating has just happened.
 */
export function Celebration({ title, detail, emoji = '🎉', onDone }: { title: string; detail?: string; emoji?: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-live="polite" role="status">
      <Confetti />
      <div className="anim-pop pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-rule bg-surface px-6 py-5 text-center shadow-xl">
        <Smiley bounce className="text-4xl">{emoji}</Smiley>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Well done</span>
        <span className="text-2xl font-bold">{title}</span>
        {detail && <span className="text-sm text-ink-2">{detail}</span>}
      </div>
    </div>
  )
}

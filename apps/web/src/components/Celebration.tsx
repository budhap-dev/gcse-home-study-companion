import { useEffect, useState } from 'react'

/**
 * A short burst of confetti behind a card. Respects reduced motion by showing
 * the card alone. Mount it when something worth celebrating has just happened.
 */
export function Celebration({ title, detail, onDone }: { title: string; detail?: string; onDone: () => void }) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  const pieces = reduced ? [] : Array.from({ length: 36 }, (_, i) => i)
  const colours = ['#0E7A86', '#5A4BD1', '#D25B3B', '#D9A21B', '#2E8B57']
  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center" aria-live="polite" role="status">
      {pieces.map((i) => (
        <span
          key={i}
          className="confetti absolute top-0 block h-3 w-2 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colours[i % colours.length], animationDelay: `${(i % 9) * 0.12}s`, animationDuration: `${2.2 + (i % 5) * 0.25}s` }}
        />
      ))}
      <div className="pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-rule bg-surface px-6 py-5 text-center shadow-xl">
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">Well done</span>
        <span className="text-2xl font-bold">{title}</span>
        {detail && <span className="text-sm text-ink-2">{detail}</span>}
      </div>
    </div>
  )
}

import { useState } from 'react'

const COLOURS = ['#0E7A86', '#5A4BD1', '#D25B3B', '#D9A21B', '#2E8B57']

/**
 * A burst of falling confetti behind whatever is on screen.
 *
 * Renders nothing at all under reduced motion, rather than a still version: confetti
 * frozen in mid-air is not a decoration, it is a page that looks broken. Purely
 * decorative and inert, so it is hidden from screen readers and takes no pointer events.
 */
export function Confetti({ pieces = 36 }: { pieces?: number }) {
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  if (reduced) return null
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {Array.from({ length: pieces }, (_, i) => (
        <span
          key={i}
          className="confetti absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLOURS[i % COLOURS.length],
            animationDelay: `${(i % 9) * 0.12}s`,
            animationDuration: `${2.2 + (i % 5) * 0.25}s`,
          }}
        />
      ))}
    </div>
  )
}

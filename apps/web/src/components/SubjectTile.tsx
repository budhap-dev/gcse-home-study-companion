import { useState } from 'react'
import { SubjectIcon, subjectIconCount } from './SubjectIcon.tsx'

/**
 * A subject's icon on a white tile, drifting and tilted a little, for the banners. `i` puts
 * each tile out of step with the one before. The tile is white in every theme, so the icon
 * keeps the subject's light-page colour.
 */
export function SubjectTile({ subjectId, colour, variant, i = 0, big = false }: { subjectId: string; colour: string; variant: number; i?: number; big?: boolean }) {
  return (
    <span
      className={`anim-drift light-ground accent-ink flex items-center justify-center bg-white/95 shadow-[0_10px_24px_rgb(0_0_0/0.2)] ${big ? 'h-[52px] w-[52px] rounded-[15px]' : 'h-10 w-10 rounded-xl'}`}
      style={{ '--r': `${[-6, 5, -3, 4, -5, 6][i % 6]}deg`, '--d': `${-i * 0.7}s`, '--subject': colour } as React.CSSProperties}
    >
      <SubjectIcon subjectId={subjectId} variant={variant} width={big ? 26 : 21} height={big ? 26 : 21} />
    </span>
  )
}

/** A random starting picture for a subject, fixed for as long as the page is open. */
export function useRandomIcon(subjectId: string): number {
  const [variant] = useState(() => Math.floor(Math.random() * subjectIconCount(subjectId)))
  return variant
}

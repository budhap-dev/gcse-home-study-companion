import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePref } from '../theme/prefs.ts'

/**
 * A floating jump back to the top, for the pages long enough to need one. It clears the
 * phone's bottom bar, and it respects both the app's motion setting and the operating
 * system's, because a smooth scroll over several thousand pixels is exactly the kind of
 * movement someone turns those off to avoid.
 *
 * `bottom-nav-clear` is a media-query class, so the button clears the phone's bottom
 * bar and sits low on desktop without reading the window width during render.
 *
 * It renders through a portal to the body. The shell wraps each page in an element that
 * animates its transform, and any non-none transform makes that element the containing
 * block for `position: fixed` descendants — which pinned the button to the bottom of the
 * document instead of the viewport.
 */
export function BackToTop({ after = 600, label = 'Back to top' }: { after?: number; label?: string }) {
  const [show, setShow] = useState(false)
  const motion = usePref('motion')

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > after)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [after])

  if (!show) return null

  const reduced = !motion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  return createPortal(
    <button
      type="button"
      aria-label={label}
      onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
      className="anim-fade-up press bottom-nav-clear fixed right-4 z-30 flex h-12 items-center gap-2 rounded-full border border-rule bg-surface px-4 text-sm font-bold shadow-lg md:right-8"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 19V5M6 11l6-6 6 6" />
      </svg>
      Top
    </button>,
    document.body,
  )
}

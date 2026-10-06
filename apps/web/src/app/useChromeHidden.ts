import { useEffect, useState } from 'react'

/** Within this distance of the top the chrome always shows, so a page opens with its menu. */
export const SHOW_NEAR_TOP = 80
/** Scrolling less than this either way changes nothing: a finger resting on glass jitters. */
export const JITTER = 8

export interface ChromeScroll { y: number; hidden: boolean }

/**
 * The next state from a new scroll position. Down hides, up shows, near the top always shows,
 * and a movement smaller than JITTER keeps the last position as the reference, so a slow
 * scroll still adds up to a decision.
 */
export function nextChrome(prev: ChromeScroll, y: number): ChromeScroll {
  if (y <= SHOW_NEAR_TOP) return { y, hidden: false }
  const moved = y - prev.y
  if (Math.abs(moved) < JITTER) return prev
  return { y, hidden: moved > 0 }
}

/**
 * Whether the band and dock should step aside. Only on a focus screen (`on`), and they come
 * back the moment anything inside them takes focus, so a keyboard user tabbing into the menu
 * never lands on something off screen. A change of page shows them again.
 */
export function useChromeHidden(on: boolean, pathname: string): [boolean, () => void] {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    setHidden(false)
    if (!on) return
    let state: ChromeScroll = { y: window.scrollY, hidden: false }
    let frame = 0
    const read = () => {
      frame = 0
      const next = nextChrome(state, window.scrollY)
      if (next === state) return
      state = next
      setHidden(next.hidden)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(read) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [on, pathname])
  return [hidden, () => setHidden(false)]
}

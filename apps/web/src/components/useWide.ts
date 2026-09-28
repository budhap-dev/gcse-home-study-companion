import { useSyncExternalStore } from 'react'

const WIDE = '(min-width: 1024px)'

/**
 * True at laptop width, where the layout gains its side column: the topic panel sits beside
 * the map rather than rising as a sheet, and Home moves the set tasks below the map.
 */
export function useWide(): boolean {
  return useSyncExternalStore(
    (fn) => { const m = matchMedia(WIDE); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn) },
    () => matchMedia(WIDE).matches,
    () => true,
  )
}

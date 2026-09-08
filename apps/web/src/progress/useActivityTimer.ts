import { useEffect } from 'react'
import { addStudyMinutes } from './store.ts'

/** Adds a study minute for each minute a learning screen stays open and visible. */
export function useActivityTimer(active = true) {
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') addStudyMinutes(1)
    }, 60_000)
    return () => clearInterval(id)
  }, [active])
}

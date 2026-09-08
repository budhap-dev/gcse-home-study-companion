import { useSyncExternalStore } from 'react'

const KEYS = { motion: 'study-companion.motion', smileys: 'study-companion.smileys' } as const
type Pref = keyof typeof KEYS
const listeners = new Set<() => void>()

function read(pref: Pref): boolean {
  try {
    return localStorage.getItem(KEYS[pref]) !== 'off'
  } catch {
    return true
  }
}

export function setPref(pref: Pref, on: boolean) {
  try {
    localStorage.setItem(KEYS[pref], on ? 'on' : 'off')
  } catch {
    // no storage
  }
  applyPrefs()
  listeners.forEach((fn) => fn())
}

/** Stamps the document so CSS can switch animations off without touching every component. */
export function applyPrefs() {
  document.documentElement.dataset.motion = read('motion') ? 'on' : 'off'
  document.documentElement.dataset.smileys = read('smileys') ? 'on' : 'off'
}

export function usePref(pref: Pref): boolean {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => read(pref),
    () => true,
  )
}

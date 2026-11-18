import { useSyncExternalStore } from 'react'

const KEYS = { motion: 'study-companion.motion', smileys: 'study-companion.smileys' } as const
const PEN_KEY = 'study-companion.pen'

/** The pen the student's own answers are written in, in the Notebook theme (section 16). */
export type Pen = 'blue' | 'black'
export const PENS: { id: Pen; name: string }[] = [{ id: 'blue', name: 'Blue pen' }, { id: 'black', name: 'Black pen' }]

function readPen(): Pen {
  try {
    return localStorage.getItem(PEN_KEY) === 'black' ? 'black' : 'blue'
  } catch {
    return 'blue'
  }
}

export function setPen(pen: Pen) {
  try {
    localStorage.setItem(PEN_KEY, pen)
  } catch {
    // no storage
  }
  applyPrefs()
  listeners.forEach((fn) => fn())
}

export function usePen(): Pen {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    readPen,
    () => 'blue',
  )
}
/**
 * The order topics are shown in: the school's plan (school years, the school's order inside a
 * unit), or the exam board's specification (numbered, no school years), for a teacher or a
 * student at another school. A device setting, like the theme: the plan a page follows is a
 * choice about the reader, not about the student's progress.
 */
export type TopicOrder = 'school' | 'spec'
const ORDER_KEY = 'study-companion.order'

export function readTopicOrder(): TopicOrder {
  try {
    return localStorage.getItem(ORDER_KEY) === 'spec' ? 'spec' : 'school'
  } catch {
    return 'school'
  }
}

export function setTopicOrder(order: TopicOrder) {
  try {
    localStorage.setItem(ORDER_KEY, order)
  } catch {
    // no storage
  }
  listeners.forEach((fn) => fn())
}

export function useTopicOrder(): TopicOrder {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    readTopicOrder,
    readTopicOrder,
  )
}

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
  document.documentElement.dataset.pen = readPen()
}

export function usePref(pref: Pref): boolean {
  return useSyncExternalStore(
    (fn) => { listeners.add(fn); return () => listeners.delete(fn) },
    () => read(pref),
    () => true,
  )
}

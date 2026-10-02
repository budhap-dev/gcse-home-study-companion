import { lazy, useSyncExternalStore, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * The screens that are fetched when first opened, not with the app.
 *
 * Home, the subject list, a subject's map, Progress and Settings come with the first
 * download. The rest come in four groups: the screens reached from a topic (the lesson,
 * the quiz, a worksheet), which carry every question type and every diagram between them;
 * the glossary and the search page, which are the first to set maths and bring the library
 * that does it; the reference pages, with their own drawings and tables; and the parent's
 * page. Together that is most of the app's code, and none of it is needed to show Home. A
 * group is fetched when one of its screens is opened, and all four quietly once the app is
 * idle, so that opening one later waits for nothing.
 */
type Load = () => Promise<Record<string, unknown>>

const loaders: Load[] = []
const RELOADED = 'study-companion.reloaded-for'

/**
 * A screen's file is named from its contents, and a deploy replaces the lot. A tab opened
 * before the deploy then asks for a file that is no longer there. The cure is the one the
 * "newer version" banner offers, taken here because there is nothing to show otherwise:
 * load the page again, once for an address, at the address being opened. Offline, or still
 * failing after that, the fault goes to the router's error page.
 */
export function staleBuild(error: unknown): Promise<never> {
  let again = false
  try {
    again = navigator.onLine !== false && sessionStorage.getItem(RELOADED) !== window.location.href
    if (again) sessionStorage.setItem(RELOADED, window.location.href)
  } catch {
    // Storage blocked: no way to tell a first failure from a second, so do not loop.
  }
  if (!again) throw error
  window.location.reload()
  // Never settles: the page is leaving, and settling would flash the error page first.
  return new Promise<never>(() => {})
}

/** A screen that arrives ends the matter, so a later deploy gets its own reload at the same address. */
function arrived(): void {
  try {
    sessionStorage.removeItem(RELOADED)
  } catch {
    // Storage blocked: nothing was recorded either.
  }
}

/** A screen fetched on demand: `load` imports its module, `name` is the component it exports. */
export function screen<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K): LazyExoticComponent<ComponentType> {
  if (!loaders.includes(load)) loaders.push(load)
  return lazy(() => {
    opening(1)
    return load().then((m) => { arrived(); return { default: m[name] } }, staleBuild).finally(() => opening(-1))
  })
}

/**
 * Whether a screen has been on its way for long enough to say so. The page being left stays
 * on the screen until the next one is ready, which on a slow connection, in the first
 * moments after the app opens, would leave a press looking as if it had done nothing.
 */
let waiting = 0
let slow = false
let timer: ReturnType<typeof setTimeout> | undefined
const watchers = new Set<() => void>()

function opening(change: 1 | -1): void {
  waiting += change
  const set = (value: boolean) => {
    if (slow === value) return
    slow = value
    watchers.forEach((tell) => tell())
  }
  clearTimeout(timer)
  if (waiting > 0) timer = setTimeout(() => set(true), 300)
  else set(false)
}

export function useScreenOpening(): boolean {
  return useSyncExternalStore((tell) => { watchers.add(tell); return () => watchers.delete(tell) }, () => slow, () => false)
}

/**
 * Fetches every on-demand screen in the background, one after another, once the browser has
 * nothing better to do. It gives way to a screen being opened: opened straight onto a
 * lesson, the app would otherwise fetch the other groups alongside the one being waited
 * for, and on a slow connection that made the lesson later, not sooner. Skipped where the
 * reader has asked the browser to save data. A failure here is ignored: the screen is
 * fetched again, and the failure dealt with, when it is opened.
 */
export function warmScreens(): void {
  const saving = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
  if (saving) return
  const run = async () => {
    for (const load of loaders) {
      while (waiting > 0) await new Promise((r) => setTimeout(r, 250))
      await load().catch(() => undefined)
    }
  }
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => void run(), { timeout: 4000 })
  else setTimeout(() => void run(), 2000)
}

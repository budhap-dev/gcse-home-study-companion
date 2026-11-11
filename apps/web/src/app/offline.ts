import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * Studying without a signal (UXI-5): the service worker, whether the device is online, the
 * install prompt, and saving subjects for offline. The worker itself is sw-worker.js, built
 * into /sw.js by swPlugin.ts.
 */

/** Registers the worker on a built copy of the app. Not in development, where files have no fingerprint. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // After the page has loaded, so installing the worker never competes with the first paint.
  const go = () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  if (document.readyState === 'complete') go()
  else window.addEventListener('load', go, { once: true })
}

function subscribeOnline(tell: () => void): () => void {
  window.addEventListener('online', tell)
  window.addEventListener('offline', tell)
  return () => { window.removeEventListener('online', tell); window.removeEventListener('offline', tell) }
}

/** Whether the browser thinks it has a connection. A false "online" is possible; a false "offline" is not. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine !== false, () => true)
}

// ---- Install ----------------------------------------------------------------------------

interface InstallPromptEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

let deferred: InstallPromptEvent | null = null
const installWatchers = new Set<() => void>()
const tellInstall = () => installWatchers.forEach((fn) => fn())

// Chrome and Edge offer installing once, early, and only to a listener already in place.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as InstallPromptEvent; tellInstall() })
  window.addEventListener('appinstalled', () => { deferred = null; tellInstall() })
}

/** Whether the app is already running as an installed app rather than in a browser tab. */
export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** An iPhone or iPad, where Safari has no install button and the Share menu does it. */
export function isAppleMobile(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints): boolean {
  // iPadOS asks for desktop sites and so calls itself a Mac; touch gives it away.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)
}

export type InstallWay = 'installed' | 'prompt' | 'apple' | 'none'

export function useInstall(): { way: InstallWay; install: () => Promise<void> } {
  const way = useSyncExternalStore(
    (fn) => { installWatchers.add(fn); return () => installWatchers.delete(fn) },
    (): InstallWay => (isStandalone() ? 'installed' : deferred ? 'prompt' : isAppleMobile() ? 'apple' : 'none'),
    (): InstallWay => 'none',
  )
  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice.catch(() => undefined)
    deferred = null
    tellInstall()
  }
  return { way, install }
}

// ---- Saving subjects for offline --------------------------------------------------------

export interface OfflineStatus {
  /** Topic files on the device for each subject, out of how many it has. */
  subjects: Record<string, { saved: number; total: number }>
  /** Whether the search text is on the device. */
  extras: boolean
  /** Subjects the student chose to save, kept up to date after each deploy. */
  chosen: string[]
}

type WorkerMessage = ({ type: 'status' } & OfflineStatus) | { type: 'progress'; done: number; total: number } | { type: 'failed' }

/**
 * What the worker has saved, and a way to ask it to save more. `ready` is false where no
 * worker controls the page: the first visit, a development server, or a browser without one.
 */
export function useOfflineStore() {
  const [status, setStatus] = useState<OfflineStatus | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(() => Boolean(navigator.serviceWorker?.controller))

  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    const onMessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data
      if (m?.type === 'status') { setStatus({ subjects: m.subjects, extras: m.extras, chosen: m.chosen }); setProgress(null) }
      else if (m?.type === 'progress') setProgress({ done: m.done, total: m.total })
      else if (m?.type === 'failed') setFailed(true)
    }
    const ask = () => { setReady(Boolean(sw.controller)); sw.controller?.postMessage({ type: 'status' }) }
    sw.addEventListener('message', onMessage)
    sw.addEventListener('controllerchange', ask)
    ask()
    return () => { sw.removeEventListener('message', onMessage); sw.removeEventListener('controllerchange', ask) }
  }, [])

  const send = (msg: object) => { setFailed(false); navigator.serviceWorker?.controller?.postMessage(msg) }
  return {
    ready,
    status,
    progress,
    failed,
    save: (subjects: string[], extras = false) => { setProgress({ done: 0, total: 1 }); send({ type: 'save', subjects, extras }) },
    forget: (subjects: string[]) => send({ type: 'forget', subjects }),
  }
}

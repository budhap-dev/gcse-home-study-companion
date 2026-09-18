import { useEffect, useState } from 'react'

/**
 * The script tags the page was loaded with, as an identity for this build.
 *
 * Vite fingerprints every asset, so the set of script URLs changes on any deploy that
 * changes the code — which, since the content pack is compiled into the bundle, includes
 * every deploy that adds a topic.
 */
export function loadedScripts(doc: Document = document): string {
  return [...doc.querySelectorAll('script[src]')]
    .map((s) => (s as HTMLScriptElement).getAttribute('src') ?? '')
    .filter((src) => src.includes('/assets/'))
    .sort()
    .join(' ')
}

/** The same identity, read out of freshly fetched HTML rather than the live document. */
export function scriptsInHtml(html: string): string {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((m) => m[1]!)
    .filter((src) => src.includes('/assets/'))
    .sort()
    .join(' ')
}

/**
 * True once the server is serving a different build from the one this page is running.
 *
 * It matters here more than in most apps: the content pack is bundled into the JavaScript
 * and moving between topics is client-side routing, so a tab left open across a deploy
 * keeps serving the old content indefinitely and reports a newly added topic as unknown.
 * Nothing forces a reload — a student mid-quiz should not be interrupted — it only offers.
 *
 * Checked when the tab regains focus rather than on a timer, because that is when someone
 * has come back to it, and a background tab nobody is looking at needs no network traffic.
 */
export function useNewBuild(): boolean {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    const mine = loadedScripts()
    // No fingerprinted scripts means the dev server, where this cannot be judged.
    if (!mine) return
    let live = true

    const check = async () => {
      if (!live || stale || document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const theirs = scriptsInHtml(await res.text())
        if (live && theirs && theirs !== mine) setStale(true)
      } catch {
        // Offline, or the check was blocked. Staying quiet is the right failure here.
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    // And once an hour for a tab that is never left, which is exactly the case that bites.
    const timer = setInterval(() => void check(), 60 * 60 * 1000)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
      clearInterval(timer)
    }
  }, [stale])

  return stale
}

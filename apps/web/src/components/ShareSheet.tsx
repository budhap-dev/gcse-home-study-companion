import { useState } from 'react'

/**
 * Shares a generated worksheet's link: the phone's share sheet where there is one, the
 * clipboard otherwise, and the link itself on screen if both are refused, so it can always be
 * copied by hand. Whoever opens it gets the same questions; the app's sign-in still decides
 * who can open it at all.
 */
export function ShareSheet({ path, title }: { path: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle')
  // Built on the press, not in render: there is no location while the page is pre-rendered.
  const url = () => `${location.origin}${path}`
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, url: url() }); return }
      await navigator.clipboard.writeText(url())
      setState('copied')
    } catch (e) {
      // Closing the share sheet is a choice, not a failure.
      if (e instanceof DOMException && e.name === 'AbortError') return
      setState('shown')
    }
  }
  return (
    <span className="flex flex-col gap-1">
      <button type="button" onClick={() => void share()} className="flex h-11 items-center rounded-lg border border-rule bg-surface px-4 font-bold">
        {state === 'copied' ? 'Link copied' : 'Share this sheet'}
      </button>
      {state === 'shown' && <span className="select-all break-all text-xs text-ink-2">{url()}</span>}
    </span>
  )
}

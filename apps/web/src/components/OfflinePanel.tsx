import { SUBJECTS } from '@study/shared'
import { useInstall, useOfflineStore } from '../app/offline.ts'

/**
 * Settings' "Use without a signal" (UXI-5): installing the app, and saving subjects so their
 * topics open on a train. The app's own code is kept after the first visit by itself; this is
 * only for the topics, which are most of the download.
 */
export function OfflinePanel() {
  const { way, install } = useInstall()
  const store = useOfflineStore()
  const subjects = SUBJECTS.filter((s) => store.status?.subjects[s.id])
  const busy = store.progress !== null
  const unsaved = subjects.filter((s) => { const n = store.status!.subjects[s.id]!; return n.saved < n.total }).map((s) => s.id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Install the app</h3>
        {way === 'installed' && <p className="text-sm text-ink-2">Installed: you are using it as an app now.</p>}
        {way === 'prompt' && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-2">Adds the app to your home screen, with its own icon and no browser bar.</p>
            <button type="button" onClick={() => void install()} className="h-11 shrink-0 rounded-xl bg-ink px-4 font-bold text-surface">Install</button>
          </div>
        )}
        {way === 'apple' && (
          <p className="text-sm text-ink-2">In Safari, tap the Share button, then <strong>Add to Home Screen</strong>. The app then opens from its own icon, with no browser bar.</p>
        )}
        {way === 'none' && <p className="text-sm text-ink-2">Open the app in Chrome, Edge or Safari on a phone or tablet to add it to the home screen.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold">Save subjects for offline</h3>
        {!store.ready ? (
          <p className="text-sm text-ink-2">Ready after the app has been opened once more with a signal: the first visit sets this up.</p>
        ) : !store.status ? (
          <p className="text-sm text-ink-2">Checking what is on this device…</p>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              The app itself already works without a signal, with every topic you have opened. Save a subject to have all its topics on the device too. A saved subject stays up to date when the app changes. Saving everything adds the search too.
            </p>
            {store.failed && <p className="text-sm font-bold text-status-not-secure">The signal dropped before everything was saved. Press Save again to finish.</p>}
            {busy && store.progress && (
              <p role="status" className="text-sm font-bold">Saving… {store.progress.done} of {store.progress.total} files</p>
            )}
            <ul className="flex flex-col divide-y divide-rule rounded-xl border border-rule">
              {subjects.map((s) => {
                const n = store.status!.subjects[s.id]!
                const all = n.saved >= n.total
                const chosen = store.status!.chosen.includes(s.id)
                return (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="flex min-w-0 flex-col">
                      <span className="font-bold">{s.name}</span>
                      <span className="text-xs text-ink-2">{all ? `All ${n.total} topics saved` : `${n.saved} of ${n.total} topics on this device`}</span>
                    </span>
                    {all && chosen ? (
                      <button type="button" disabled={busy} onClick={() => store.forget([s.id])} className="h-10 shrink-0 rounded-lg border border-rule px-3 text-sm font-bold disabled:opacity-50">Remove</button>
                    ) : (
                      <button type="button" disabled={busy} onClick={() => store.save([s.id])} className="h-10 shrink-0 rounded-lg bg-ink px-3 text-sm font-bold text-surface disabled:opacity-50">Save</button>
                    )}
                  </li>
                )
              })}
            </ul>
            {(unsaved.length > 0 || !store.status.extras) && (
              <button type="button" disabled={busy} onClick={() => store.save(subjects.map((s) => s.id), true)} className="h-11 w-fit rounded-xl border border-rule bg-surface px-4 font-bold disabled:opacity-50">
                Save everything (about 6 MB)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

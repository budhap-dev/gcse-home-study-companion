import { Link } from 'react-router'
import { useOnline } from '../app/offline.ts'

/**
 * Shown for the moment a topic's content is being fetched (OPS-1): a topic opened before
 * appears at once. With no signal (UXI-5) a topic not on the device never comes, so the wait
 * says why instead of reading "Loading…" for ever.
 */
export function TopicLoading() {
  const online = useOnline()
  if (!online) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center text-ink-2" role="status">
        <p>Waiting for a signal: some of these questions come from topics not saved on this device.</p>
        <Link to="/settings#offline" className="font-bold underline">Save subjects for offline</Link>
      </div>
    )
  }
  return <p className="py-12 text-center text-ink-2" role="status">Loading…</p>
}

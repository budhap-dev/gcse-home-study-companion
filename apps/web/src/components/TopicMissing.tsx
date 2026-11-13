import { Link, useParams } from 'react-router'
import { topicExists } from '../content/load.ts'
import { useOnline } from '../app/offline.ts'

/**
 * What a topic screen shows when the topic did not come: no such topic, or, more often since
 * the app works without a signal (UXI-5), a topic that is not on this device yet. The second
 * is told apart by the pack knowing the topic, so it never reads as "unknown".
 */
export function TopicMissing({ label = 'topic' }: { label?: string }) {
  const { subjectId = '', topicId = '' } = useParams()
  const online = useOnline()
  if (!topicExists(subjectId, topicId)) return <p>Unknown {label}.</p>
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-3 py-8">
      <h1 className="text-2xl font-bold">{online ? 'This topic did not load' : 'This topic is not saved on this device'}</h1>
      <p className="text-ink-2">
        {online
          ? 'The connection dropped while it was on its way. Try again in a moment.'
          : 'With no signal, the app shows the topics opened before and the subjects saved for offline. Open this one again with a signal, or save its subject in Settings before a journey.'}
      </p>
      <div className="flex flex-wrap gap-2">
        {online && <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">Try again</button>}
        <Link to="/settings#offline" className="btn btn-secondary">Save subjects for offline</Link>
      </div>
    </article>
  )
}

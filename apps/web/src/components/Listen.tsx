import type { Topic } from '@study/shared'
import { Smiley } from './Smiley.tsx'

type Recording = NonNullable<Topic['listen']>

/**
 * Where to hear a set work. The app ships no audio, since the recordings are in copyright,
 * and a link to one upload can be taken down; a search for the named recording cannot rot.
 * The card names performers, album and track so the student can tell the right result from
 * a cover or a live version.
 */
export const listenLinks = (r: Recording) => {
  const q = encodeURIComponent(r.search)
  return [
    { label: 'YouTube', url: `https://www.youtube.com/results?search_query=${q}` },
    { label: 'Spotify', url: `https://open.spotify.com/search/${q}` },
  ]
}

export function Listen({ recording: r }: { recording: Recording }) {
  return (
    <section aria-label="Listen" className="flex flex-col gap-2">
      <h2 className="chip w-fit" style={{ '--chip': '#a1286a' } as React.CSSProperties}><Smiley>🎧</Smiley>Listen</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-rule bg-surface px-4 py-3">
        <p className="flex flex-col gap-0.5">
          <span className="font-bold">{r.work}</span>
          <span className="text-sm text-ink-2">{r.performers} · <cite>{r.album}</cite>, {r.track}</span>
        </p>
        <p className="text-sm text-ink-2">The recording Pearson names for the exam. Others differ in speed and detail, so pick the result by these performers.</p>
        <div className="flex flex-wrap gap-2">
          {listenLinks(r).map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="lift flex min-h-11 items-center rounded-lg bg-[color:var(--subject)] px-4 text-sm font-bold text-white">
              Search {l.label}<span className="sr-only"> (opens in a new tab)</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}

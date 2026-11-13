import { useState } from 'react'
import { Link } from 'react-router'
import { Smiley } from './Smiley.tsx'
import { pastPapersFor, pastUses } from '../content/pastPapers.ts'

const SHOWN = 6

/**
 * "In past papers" on a topic page (section 14, box 2): every question on the board's own
 * papers that tests this topic, newest first, each opening the board's question paper. Loaded
 * on demand (React.lazy), so the index stays out of the topic page's own chunk. Nothing is
 * shown for a subject whose papers are not tagged yet.
 */
export default function InPastPapers({ subjectId, topicId }: { subjectId: string; topicId: string }) {
  const [all, setAll] = useState(false)
  const uses = pastUses(subjectId, topicId)
  const tagged = pastPapersFor(subjectId)?.series.some((s) => s.papers.some((p) => p.questions))
  if (!tagged) return null
  // The oldest sitting, not a specimen paper: "since Sample papers" says nothing.
  const first = uses.filter((u) => /^\d{4}-/.test(u.seriesId)).at(-1)
  const shown = all ? uses : uses.slice(0, SHOWN)
  return (
    <section aria-labelledby="past-heading" className="flex flex-col gap-2">
      <h2 id="past-heading" className="chip w-fit" style={{ '--chip': '#7a4b00' } as React.CSSProperties}><Smiley>📝</Smiley>In past papers</h2>
      {uses.length === 0 ? (
        <p className="text-sm text-ink-2">Not asked on any of the board’s papers listed here.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Asked {uses.length === 1 ? 'once' : `${uses.length} times`} on the board’s papers listed here{first ? ` since ${first.series}` : ''}. Each opens the board’s question paper: find the question by its number, then mark it with the mark scheme on the{' '}
            <Link to={`/subjects/${subjectId}/past-papers`} className="font-bold underline">Past papers</Link> page.
          </p>
          <ul className="flex flex-col divide-y divide-rule rounded-2xl border border-rule bg-surface">
            {shown.map((u) => (
              <li key={`${u.seriesId}-${u.paper}-${u.n}`}>
                <a href={u.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm hover:bg-panel">
                  <span>
                    <span className="font-bold">{u.series} · {u.paper} · Q{u.n}</span>
                    <span className="text-ink-2"> · {u.marks} {u.marks === 1 ? 'mark' : 'marks'}{u.main ? '' : ' · with another topic'}</span>
                  </span>
                  <span aria-hidden className="text-xs text-ink-2">↗</span>
                  <span className="sr-only">(opens the board’s PDF)</span>
                </a>
              </li>
            ))}
          </ul>
          {uses.length > SHOWN && (
            <button type="button" className="btn btn-secondary btn-sm w-fit" onClick={() => setAll((v) => !v)} aria-expanded={all}>
              {all ? 'Show fewer' : `Show all ${uses.length}`}
            </button>
          )}
        </>
      )}
    </section>
  )
}

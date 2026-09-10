import { searchTerms } from '../search/index.ts'

/** Wraps each matching word in a mark, so the reader can see why a result matched. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = searchTerms(query)
  if (terms.length === 0) return <>{text}</>
  const pattern = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(pattern).map((part, i) =>
        terms.includes(part.toLowerCase()) ? (
          <mark key={i} className="rounded-sm bg-[color:var(--highlight)] px-0.5 text-ink">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

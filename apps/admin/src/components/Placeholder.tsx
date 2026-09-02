import { STORIES } from '@study/shared'

interface PlaceholderProps {
  /** Which part of the app this screen belongs to. */
  area: string
  title: string
  /** One or two sentences on what the screen will do, from the PRD. */
  description: string
  /** Story IDs from docs/stories.md that this screen delivers. */
  stories?: string[]
  /** Blocks the finished screen will contain, in order. */
  blocks?: string[]
  children?: React.ReactNode
}

const PRIORITY_CLASS: Record<string, string> = {
  Must: 'bg-[#f6e3da] text-[#b5451b]',
  Should: 'bg-[#dcebf0] text-[#155a70]',
  Could: 'bg-panel text-ink-2',
}

/**
 * Stand-in for a screen that has not been built yet. Every route renders one of
 * these until the real screen replaces it, so the navigation can be walked end to end.
 */
export function Placeholder({ area, title, description, stories = [], blocks = [], children }: PlaceholderProps) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.08em] text-[color:var(--subject)]">{area}</p>
        <h1 className="text-3xl font-bold leading-tight">{title}</h1>
        <p className="max-w-[65ch] text-base leading-relaxed text-ink-2">{description}</p>
      </header>

      {stories.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Delivers</h2>
          <ul className="flex flex-wrap gap-2">
            {stories.map((id) => {
              const story = STORIES[id]
              return (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-rule bg-surface px-3 py-1.5 text-sm">
                  <span className="font-mono text-xs text-ink-3">{id}</span>
                  <span>{story?.title ?? id}</span>
                  {story && (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${PRIORITY_CLASS[story.priority]}`}>{story.priority}</span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {blocks.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Planned blocks</h2>
          <ol className="flex flex-col gap-2">
            {blocks.map((block, i) => (
              <li key={block} className="flex gap-3 rounded-xl border border-dashed border-rule bg-surface/60 px-4 py-3 text-sm">
                <span className="font-mono text-xs text-ink-3">{i + 1}</span>
                <span>{block}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {children}
    </article>
  )
}

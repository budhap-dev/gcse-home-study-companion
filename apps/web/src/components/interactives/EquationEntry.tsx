import { useState } from 'react'
import { RichText } from '../RichText.tsx'

/**
 * A worked example the student walks through one line at a time rather than reading
 * whole. Each line is hidden until they have had a go at it in their head, which is
 * the point: seeing the finished chain teaches much less than predicting each step.
 *
 * Config: `stages`, the lines of working in order, and `target`, the answer the last
 * line should reach. The `fallback` text is always readable underneath, so the step
 * still works for a screen reader or if the JavaScript never runs.
 */
export function EquationEntry({ config, alt }: { config: Record<string, unknown>; alt: string }) {
  const stages = Array.isArray(config.stages) ? (config.stages as unknown[]).map(String) : []
  const target = config.target === undefined ? undefined : String(config.target)
  // The first line is the problem as given, so it starts visible.
  const [shown, setShown] = useState(1)
  const done = shown >= stages.length

  if (stages.length === 0) return <RichText source={alt} className="text-sm" />

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-rule bg-surface p-4">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="chip" style={{ '--chip': 'var(--subject)' } as React.CSSProperties}>Line by line</span>
        <span className="text-xs text-ink-2 tabular-nums">{Math.min(shown, stages.length)} of {stages.length}</span>
      </figcaption>

      <ol className="flex flex-col gap-2">
        {stages.map((stage, i) => {
          const visible = i < shown
          const last = i === stages.length - 1
          return (
            <li
              key={i}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${visible ? '' : 'border-dashed'}`}
              style={{
                borderColor: visible && last ? 'var(--color-status-secure)' : 'var(--color-rule)',
                background: visible && last ? 'color-mix(in srgb, var(--color-status-secure) 12%, var(--color-surface))' : 'var(--color-surface)',
              }}
            >
              <span className="w-4 shrink-0 text-xs text-ink-3 tabular-nums">{i + 1}</span>
              {visible ? (
                <Maths text={stage} />
              ) : (
                <span className="text-sm text-ink-3">Work this line out, then reveal it.</span>
              )}
            </li>
          )
        })}
      </ol>

      {done && target !== undefined && (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          Answer: <Maths text={target} />
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!done && (
          <button type="button" onClick={() => setShown((n) => n + 1)} className="press h-11 rounded-lg bg-[color:var(--subject)] px-4 text-sm font-bold text-white">
            Show the next line
          </button>
        )}
        {shown > 1 && (
          <button type="button" onClick={() => setShown(1)} className="h-11 rounded-lg border border-rule bg-surface px-4 text-sm font-bold">
            Start again
          </button>
        )}
      </div>

      <RichText source={alt} className="sr-only" />
    </figure>
  )
}

/**
 * The stage strings are written the way a student writes on paper, not as LaTeX:
 * `4x^10`, `x^-4`, `6+2√5`. Only the carets need turning into real superscripts.
 */
function Maths({ text }: { text: string }) {
  const parts = text.split(/(\^\(?-?[0-9a-z+\-]+\)?)/g).filter(Boolean)
  return (
    <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
      {parts.map((part, i) =>
        part.startsWith('^') ? (
          <sup key={i} className="text-[0.65em]">{part.slice(1).replace(/^\(|\)$/g, '')}</sup>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  )
}

import { useMemo, useState } from 'react'
import { RichText } from '../RichText.tsx'
import { SpeakButton, useFrenchVoice } from '../Speak.tsx'

interface Word {
  fr: string
  en: string
  /** A gender, an irregular part, or a false-friend warning. */
  note?: string
}

/**
 * A vocabulary list you can hear and then test yourself on. Hiding the English is the
 * point: reading a list front to back feels like learning and mostly is not, so the
 * list starts covered and each word is revealed on request, with a count of how many
 * are still hidden.
 *
 * Config: `words` (fr, en, optional note) and an optional `title`.
 */
export function VocabList({ config, alt }: { config: Record<string, unknown>; alt: string }) {
  const words = useMemo(() => (Array.isArray(config.words) ? (config.words as Word[]) : []), [config.words])
  const title = config.title ? String(config.title) : 'Vocabulary'
  const [shown, setShown] = useState<Set<number>>(new Set())
  const voice = useFrenchVoice()

  if (words.length === 0) return <RichText source={alt} className="text-sm" />
  const all = shown.size === words.length

  return (
    <figure className="flex flex-col gap-3 rounded-xl border border-rule bg-surface p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="chip" style={{ '--chip': 'var(--subject)' } as React.CSSProperties}>{title}</span>
        <span className="text-xs text-ink-2 tabular-nums">{shown.size} of {words.length} revealed</span>
      </figcaption>

      <ul className="flex flex-col divide-y divide-rule">
        {words.map((word, i) => {
          const open = shown.has(i)
          return (
            <li key={i} className="flex items-center gap-2 py-2">
              <SpeakButton text={word.fr} />
              <span className="flex flex-grow flex-col gap-0.5">
                <span className="font-bold" lang="fr">{word.fr}</span>
                {word.note && <span className="text-xs text-ink-3">{word.note}</span>}
              </span>
              {open ? (
                <span className="text-right text-sm">{word.en}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShown((s) => new Set(s).add(i))}
                  className="rounded-lg border border-dashed border-rule px-3 py-1.5 text-xs font-bold text-ink-2"
                >
                  Reveal
                </button>
              )}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShown(all ? new Set() : new Set(words.map((_, i) => i)))}
          className="h-10 rounded-lg border border-rule bg-surface px-3 text-sm font-bold"
        >
          {all ? 'Hide them all' : 'Reveal them all'}
        </button>
        {voice === null && <span className="self-center text-xs text-ink-3">No French voice on this device, so there is nothing to play.</span>}
      </div>
    </figure>
  )
}

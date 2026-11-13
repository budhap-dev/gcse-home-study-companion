import { useState } from 'react'
import { clearTopicProgress } from '../progress/store.ts'

/**
 * Forget the progress on a set of topics, after confirming.
 *
 * The same control serves one topic, a school year and a whole subject, because the only
 * thing that differs is which ids go in and what the warning says. It follows the pattern
 * already used by "Clear progress on this device" in Settings: the button swaps itself for
 * a yes-or-no pair rather than opening a dialog, so it works the same on a phone and needs
 * no focus trapping.
 *
 * It renders nothing at all when there is no progress to clear, so the student is never
 * offered a reset that would do nothing.
 */
export function ResetProgress({ label, what, topicIds, hasProgress, onDone }: {
  label: string
  /** Named in the warning, e.g. "this topic" or "Year 10 Chemistry". */
  what: string
  topicIds: string[]
  hasProgress: boolean
  onDone?: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  if (!hasProgress) return null

  const count = topicIds.length
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <>
          <p className="text-sm text-ink-2">
            Clears every quiz, worksheet and lesson position for <strong className="text-ink">{what}</strong>
            {count > 1 ? <> — {count} topics</> : null}. Your study minutes, streak and badges are kept. Cannot be undone.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { clearTopicProgress(topicIds); setConfirming(false); onDone?.() }}
              className="btn btn-danger"
            >
              Yes, reset {what}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn btn-secondary">
              Keep it
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="btn btn-secondary btn-sm w-fit text-ink-2">
          {label}
        </button>
      )}
    </div>
  )
}

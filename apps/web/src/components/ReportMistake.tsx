import { useState } from 'react'
import { useAuth } from '../auth/useAuth.ts'
import { sendReport, type MistakeReport } from '../auth/reports.ts'

/**
 * "Report a mistake" under a question or a lesson step. It opens a short note box and sends
 * the note with the item's exact address (topic, question or step id, where it was seen),
 * so a report can be found and fixed without guessing which question was meant.
 *
 * Reports are written as the signed-in account, so the link only appears when someone is
 * signed in; a device-only build has nowhere to send them.
 */
export function ReportMistake({ item }: { item: Omit<MistakeReport, 'note'> }) {
  const auth = useAuth()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  if (auth.status !== 'allowed') return null

  if (state === 'sent') {
    return <p className="text-sm text-ink-2" role="status">Thanks. Your report was sent and will be checked.</p>
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm text-ink-3 underline underline-offset-2">
        Report a mistake
      </button>
    )
  }
  const send = async () => {
    setState('sending')
    setState((await sendReport({ ...item, note })) ? 'sent' : 'failed')
  }
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-rule bg-surface p-3">
      <label htmlFor={`report-${item.itemId}`} className="text-sm font-bold">What looks wrong?</label>
      <textarea
        id={`report-${item.itemId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="For example: the answer says 5 but I think it is 6, because…"
        className="rounded-lg border border-rule bg-paper p-2 text-[15px]"
      />
      {state === 'failed' && <p className="text-sm" style={{ color: 'var(--color-status-not-secure)' }}>It could not be sent just now. Try again in a moment.</p>}
      <div className="flex gap-2">
        <button type="button" onClick={send} disabled={!note.trim() || state === 'sending'} className="h-10 rounded-lg bg-ink px-4 text-sm font-bold text-surface disabled:opacity-40">
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setState('idle') }} className="h-10 rounded-lg border border-rule px-4 text-sm font-bold">
          Cancel
        </button>
      </div>
    </div>
  )
}

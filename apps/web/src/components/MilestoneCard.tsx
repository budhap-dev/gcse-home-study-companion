import { useState } from 'react'
import { Confetti } from './Confetti.tsx'
import { Smiley } from './Smiley.tsx'
import type { Milestone } from '../progress/milestones.ts'

/**
 * A topic mastered or a unit finished (MTV-3). Bigger than a badge, so it stays until the
 * student closes it rather than fading after three seconds, and it can be shared. It is
 * kept either way: every milestone is listed on the Progress page.
 */
export function MilestoneCard({ milestone: m, onDone }: { milestone: Milestone; onDone: () => void }) {
  const [shared, setShared] = useState<'idle' | 'copied'>('idle')
  const text = m.kind === 'mastered' ? `I've mastered ${m.title} (GCSE ${m.detail.replace('Mastered in ', '')}).` : `I've finished the ${m.title} unit: ${m.detail.split(': ')[1] ?? ''}.`
  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: 'GCSE milestone', text }); return }
      await navigator.clipboard.writeText(text)
      setShared('copied')
    } catch {
      // Sharing was cancelled or is not allowed here; nothing to do.
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4" role="dialog" aria-modal="true" aria-labelledby="milestone-title">
      <Confetti />
      <div className="anim-pop flex w-full max-w-sm flex-col items-center gap-2 rounded-2xl border border-rule bg-surface px-6 py-6 text-center shadow-xl">
        <Smiley bounce className="text-5xl">{m.kind === 'mastered' ? '⭐' : '🏆'}</Smiley>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-ink-2">{m.kind === 'mastered' ? 'Topic mastered' : 'Unit finished'}</span>
        <span id="milestone-title" className="text-2xl font-bold leading-tight">{m.title}</span>
        <span className="text-sm text-ink-2">{m.detail}</span>
        <span className="text-xs text-ink-3">Kept on your Progress page.</span>
        <div className="mt-2 flex w-full gap-2">
          <button type="button" onClick={() => void share()} className="h-11 flex-1 rounded-xl border border-rule font-bold">{shared === 'copied' ? 'Copied' : 'Share'}</button>
          <button type="button" onClick={onDone} className="h-11 flex-1 rounded-xl bg-ink font-bold text-surface" autoFocus>Close</button>
        </div>
      </div>
    </div>
  )
}

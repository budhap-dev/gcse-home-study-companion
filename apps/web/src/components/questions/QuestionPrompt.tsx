import type { Question } from '@study/shared'
import { RichText } from '../RichText.tsx'
import { Visual } from '../Visual.tsx'

/**
 * What a question asks: for a part of a multi-part question, its stem first (the context, its
 * table or drawing) under "Part (b) of 3", then the part's own drawing and prompt. Every
 * screen that shows a question uses it, so a part met alone, in a recap or a unit test, still
 * carries every figure it needs. `stem={false}` leaves the stem out where a list has just
 * printed it above an earlier part.
 */
export function QuestionPrompt({ question, size = 'large', stem = true }: {
  question: Pick<Question, 'prompt' | 'visual' | 'stem'>
  size?: 'large' | 'medium' | 'small'
  stem?: boolean
}) {
  const text = size === 'large' ? 'text-[17px] leading-relaxed' : size === 'medium' ? 'text-[15px] leading-relaxed' : 'text-sm'
  const s = question.stem
  return (
    <>
      {s && stem && <StemBlock stem={s} size={size} />}
      {s && <p className="text-xs font-bold uppercase tracking-wide text-ink-2">{partLabel(s)}</p>}
      {question.visual && <Visual visual={question.visual} />}
      <RichText source={question.prompt} className={text} />
    </>
  )
}

/** "Part (b) of 3". */
export function partLabel(stem: NonNullable<Question['stem']>): string {
  return `Part (${stem.part}) of ${stem.parts}`
}

/** A multi-part question's stem, set apart from the part beneath it. */
export function StemBlock({ stem, size = 'large' }: { stem: NonNullable<Question['stem']>; size?: 'large' | 'medium' | 'small' }) {
  const text = size === 'large' ? 'text-[16px] leading-relaxed' : size === 'medium' ? 'text-[15px] leading-relaxed' : 'text-sm'
  return (
    <div className="flex flex-col gap-3 rounded-xl border-l-4 border-[color:var(--subject)] bg-panel p-3">
      <RichText source={stem.body} className={text} />
      {stem.visual && <Visual visual={stem.visual} />}
    </div>
  )
}

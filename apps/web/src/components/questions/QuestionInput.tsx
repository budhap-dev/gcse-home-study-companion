import { seededShuffle, type Question } from '@study/shared'
import { useId, useState } from 'react'
import { RichText } from '../RichText.tsx'

export type Answer = number[] | string | number | Record<string, string>

interface Props {
  question: Question
  /** Locked after submission. */
  disabled?: boolean
  onSubmit: (answer: Answer) => void
}

/**
 * One input per question type, shared by lesson checks, quizzes, and worksheets.
 * Ordering and labelling get simple keyboard-friendly versions here; drag-and-drop
 * arrives with the interactive step work.
 */
export function QuestionInput({ question, disabled = false, onSubmit }: Props) {
  switch (question.type) {
    case 'multiple-choice':
      return <MultipleChoice question={question} disabled={disabled} onSubmit={onSubmit} />
    case 'numeric':
    case 'short-text':
      return <Typed question={question} disabled={disabled} onSubmit={onSubmit} />
    case 'ordering':
      return <Ordering question={question} disabled={disabled} onSubmit={onSubmit} />
    case 'extended':
      return <Extended question={question} disabled={disabled} onSubmit={onSubmit} />
    case 'labelling':
      return <p className="text-sm text-ink-2">Labelling questions arrive with the diagram library.</p>
  }
}

function MultipleChoice({ question, disabled, onSubmit }: Props & { question: Extract<Question, { type: 'multiple-choice' }> }) {
  const [chosen, setChosen] = useState<number[]>([])
  const multi = question.correct.length > 1
  const toggle = (i: number) => setChosen((c) => (multi ? (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]) : [i]))
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role={multi ? 'group' : 'radiogroup'}>
        {question.options.map((opt, i) => {
          const on = chosen.includes(i)
          return (
            <button
              key={i}
              type="button"
              role={multi ? 'checkbox' : 'radio'}
              aria-checked={on}
              disabled={disabled}
              onClick={() => toggle(i)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left text-[15px] ${on ? 'border-2 border-[color:var(--subject)] font-bold' : 'border-rule'} bg-surface disabled:opacity-70`}
            >
              <RichText source={opt} inline />
            </button>
          )
        })}
      </div>
      {!disabled && <SubmitButton disabled={chosen.length === 0} onClick={() => onSubmit(chosen)} />}
    </div>
  )
}

function Typed({ question, disabled, onSubmit }: Props & { question: Extract<Question, { type: 'numeric' | 'short-text' }> }) {
  const [value, setValue] = useState('')
  const id = useId()
  const units = question.type === 'numeric' ? question.units : undefined
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSubmit(value)
      }}
    >
      <label htmlFor={id} className="sr-only">Your answer</label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          inputMode={question.type === 'numeric' ? 'decimal' : 'text'}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={question.type === 'numeric' ? 'Number' : 'Answer'}
          className="h-12 flex-grow rounded-lg border border-rule bg-surface px-3 text-lg focus:border-[color:var(--subject)] disabled:opacity-70"
        />
        {units && <span className="text-ink-2">{units}</span>}
      </div>
      {!disabled && <SubmitButton disabled={!value.trim()} />}
    </form>
  )
}

function Ordering({ question, disabled, onSubmit }: Props & { question: Extract<Question, { type: 'ordering' }> }) {
  // Shuffle once with a stable seed so a retake looks different but a re-render does not.
  const [order, setOrder] = useState<number[]>(() => {
    const out = seededShuffle(question.items.map((_, i) => i), question.id)
    // never hand back the correct order as the starting state
    return out.every((v, i) => v === i) ? out.reverse() : out
  })
  const move = (from: number, dir: -1 | 1) => {
    const to = from + dir
    if (to < 0 || to >= order.length) return
    setOrder((o) => {
      const next = [...o]
      ;[next[from], next[to]] = [next[to]!, next[from]!]
      return next
    })
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {order.map((itemIndex, pos) => (
          <li key={itemIndex} className="flex items-center gap-2 rounded-lg border border-rule bg-surface px-3 py-2">
            <span className="w-5 font-mono text-xs text-ink-3">{pos + 1}</span>
            <span className="flex-grow"><RichText source={question.items[itemIndex]!} inline /></span>
            <button type="button" aria-label="Move up" disabled={disabled || pos === 0} onClick={() => move(pos, -1)} className="h-9 w-9 rounded-md border border-rule disabled:opacity-40">↑</button>
            <button type="button" aria-label="Move down" disabled={disabled || pos === order.length - 1} onClick={() => move(pos, 1)} className="h-9 w-9 rounded-md border border-rule disabled:opacity-40">↓</button>
          </li>
        ))}
      </ol>
      {!disabled && <SubmitButton onClick={() => onSubmit(order)} />}
    </div>
  )
}

function Extended({ question, disabled, onSubmit }: Props & { question: Extract<Question, { type: 'extended' }> }) {
  const [text, setText] = useState('')
  const [awarded, setAwarded] = useState<boolean[]>(() => question.criteria.map(() => false))
  const [revealed, setRevealed] = useState(false)
  const total = question.criteria.reduce((sum, c, i) => sum + (awarded[i] ? c.marks : 0), 0)
  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={text}
        disabled={disabled || revealed}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder={`Write your answer. About ${question.suggestedMinutes} minutes.`}
        className="rounded-lg border border-rule bg-surface p-3 text-[15px] focus:border-[color:var(--subject)] disabled:opacity-70"
      />
      {!revealed && !disabled && (
        <button type="button" onClick={() => setRevealed(true)} className="h-11 rounded-lg bg-[color:var(--subject)] px-4 font-bold text-white">
          Show the mark scheme
        </button>
      )}
      {revealed && (
        <div className="flex flex-col gap-3 rounded-xl border border-rule bg-surface p-4">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Model answer</p>
          <RichText source={question.modelAnswer} className="text-sm" />
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-3">Tick what your answer includes</p>
          <ul className="flex flex-col gap-2">
            {question.criteria.map((c, i) => (
              <li key={i}>
                <label className="flex min-h-11 cursor-pointer items-start gap-3">
                  <input type="checkbox" disabled={disabled} checked={awarded[i]} onChange={(e) => setAwarded((a) => a.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-1 h-5 w-5" />
                  <span className="flex-grow text-sm"><RichText source={c.text} inline /></span>
                  <span className="text-xs text-ink-2">{c.marks} mark{c.marks > 1 ? 's' : ''}</span>
                </label>
              </li>
            ))}
          </ul>
          {!disabled && <SubmitButton label={`Record ${total} of ${question.marks} marks`} onClick={() => onSubmit(total)} />}
        </div>
      )}
    </div>
  )
}

function SubmitButton({ label = 'Check answer', disabled = false, onClick }: { label?: string; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type={onClick ? 'button' : 'submit'} onClick={onClick} disabled={disabled} className="h-12 rounded-xl bg-[color:var(--subject)] px-4 text-base font-bold text-white disabled:opacity-40">
      {label}
    </button>
  )
}

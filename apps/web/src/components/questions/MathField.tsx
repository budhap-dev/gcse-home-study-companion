import { useEffect, useRef, useState } from 'react'
import type { MathfieldElement } from 'mathlive'
import { KEYBOARD_LAYOUTS, type KeypadKind } from './keyboardLayouts.ts'

/** Loaded once, on first use, so the 210KB only arrives for a student who types maths. */
let loading: Promise<typeof import('mathlive')> | undefined
function mathlive() {
  loading ??= import('mathlive')
  return loading
}

/**
 * A maths answer box where the answer is built as **maths**, not as a line of characters:
 * a fraction is drawn with a horizontal bar and the cursor moves between numerator and
 * denominator with the up and down arrows.
 *
 * It wraps MathLive's `<math-field>`. Two things are configured away from the defaults:
 *
 * **The keyboard is a single custom layer**, not MathLive's four tabbed pages. Which keys
 * appear is counted from this pack's own answers rather than taken from the general
 * purpose default, which gives prime space to θ, ≤ and ⁿ√ — none of which appear in any
 * answer here.
 *
 * **The keyboard is docked inline**, into a container under the field, rather than pinned
 * across the bottom of the window where it would cover the question and the Check button.
 *
 * The value handed back is ASCIIMath, which is the plain form the marker reads: a fraction
 * comes out as `(3)/(4)`, a root as `sqrt(3)`, and normaliseText folds both to the same
 * thing as the answer written by hand.
 */
export function MathField({
  kind,
  value,
  onChange,
  onEnter,
  disabled,
}: {
  kind: KeypadKind
  value: string
  onChange: (asciiMath: string) => void
  onEnter?: () => void
  disabled?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const keyboardSlot = useRef<HTMLDivElement>(null)
  const field = useRef<MathfieldElement>(null)
  const [ready, setReady] = useState(false)
  /**
   * The callbacks are fresh objects on every render, so holding them in refs keeps the
   * effect below stable. With them in its dependency list the field was destroyed and
   * rebuilt on every keystroke, which dropped focus after the first character.
   */
  const handlers = useRef({ onChange, onEnter })
  handlers.current = { onChange, onEnter }
  /** The last value the field itself emitted, so its own edits are never echoed back. */
  const fromField = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    void mathlive().then(() => {
      if (cancelled || !host.current) return
      setReady(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!ready || !host.current || field.current) return
    const el = document.createElement('math-field') as MathfieldElement
    el.setAttribute('math-virtual-keyboard-policy', 'manual')
    el.style.width = '100%'
    el.style.fontSize = '22px'
    el.style.padding = '10px 12px'
    el.addEventListener('input', () => {
      const next = el.getValue('ascii-math')
      fromField.current = next
      handlers.current.onChange(next)
    })
    el.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); handlers.current.onEnter?.() }
    })
    // The keyboard opens as soon as the field is focused, docked in the slot below it.
    el.addEventListener('focusin', () => {
      window.mathVirtualKeyboard.container = keyboardSlot.current
      window.mathVirtualKeyboard.layouts = [KEYBOARD_LAYOUTS[kind]]
      window.mathVirtualKeyboard.show()
    })
    host.current.appendChild(el)
    field.current = el
    return () => { el.remove(); field.current = null }
  }, [ready, kind])

  /**
   * Only ever push a value *into* the field, never echo back what it just emitted. Writing
   * on every input event rebuilt the field mid-edit and threw the cursor out of it, so
   * typing 3 / 4 put the 3 in the fraction and the 4 in the page's search box.
   */
  useEffect(() => {
    const el = field.current
    if (!el) return
    // Echoing the field's own value back would rebuild it mid-edit and throw the cursor
    // out, which sent every character after the first to the page's search box.
    if (value === fromField.current) return
    if (el.getValue('ascii-math') !== value) el.setValue(value, { format: 'ascii-math' })
  }, [value])

  useEffect(() => {
    if (field.current) field.current.readOnly = Boolean(disabled)
  }, [disabled])

  return (
    <div className="flex flex-col gap-2">
      <div ref={host} className="math-field-host rounded-lg border border-rule bg-surface" />
      <div ref={keyboardSlot} className="math-keyboard-slot" />
    </div>
  )
}

/**
 * Custom virtual-keyboard layouts for the maths answer field.
 *
 * MathLive's own default is four tabbed pages — Main, ABC, Funcs, Symbs — which costs a
 * tap and a hunt every time. These are single layers instead, with the keys counted from
 * this pack's own answers rather than taken from a general-purpose default.
 *
 * Across the short Maths answers here: x appears 120 times, + 66, − 62, = 62, brackets 49,
 * a fraction 40, a power 26, a comma 23, < 20, √ 13, then r 12, a 8, n 7, b 5. θ, ≤, ⁿ√ and
 * e are prominent on the default layout and appear in **no** answer in this pack.
 *
 * `latex` on a keycap is both the label and what gets inserted, so `\frac{#0}{#?}` draws a
 * real fraction bar and drops the cursor into the numerator, with the denominator waiting
 * as a placeholder the down arrow moves to. That is the whole point of using a maths field
 * rather than a text box: the answer is built as maths, and a fraction never appears as a
 * slash.
 */

import type { VirtualKeyboardLayout } from 'mathlive'

const BACKSPACE = { label: '&#8630;', command: 'deleteBackward', class: 'action' } as const
const LEFT = { label: '&#8592;', command: 'moveToPreviousChar', class: 'action' } as const
const RIGHT = { label: '&#8594;', command: 'moveToNextChar', class: 'action' } as const
const UP = { label: '&#8593;', command: 'moveUp', class: 'action', tooltip: 'move to the numerator' } as const
const DOWN = { label: '&#8595;', command: 'moveDown', class: 'action', tooltip: 'move to the denominator' } as const

/** A fraction, entered as a fraction: a bar, a numerator, and a denominator to move down to. */
const FRACTION = { latex: '\\frac{#0}{#?}', tooltip: 'fraction' } as const
const POWER = { latex: '#0^{#?}', tooltip: 'to the power of' } as const
const SQUARED = { latex: '#0^2', tooltip: 'squared' } as const
const ROOT = { latex: '\\sqrt{#0}', tooltip: 'square root' } as const
const TIMES_TEN = { latex: '\\times 10^{#?}', tooltip: 'times ten to the power of' } as const

const DIGITS = [
  ['7', '8', '9', BACKSPACE],
  ['4', '5', '6', { latex: '-', tooltip: 'minus' }],
]

export type KeypadKind = 'number' | 'number-plus' | 'algebra'

export const KEYBOARD_LAYOUTS: Record<KeypadKind, VirtualKeyboardLayout> = {
  /** Plain values: 61% of everything typed in this pack is a number and nothing more. */
  number: {
    label: 'Number',
    tooltip: 'numbers',
    displayEditToolbar: false,
    rows: [
      ...DIGITS,
      ['1', '2', '3', FRACTION],
      ['0', '.', LEFT, RIGHT],
    ],
  },
  /** Adds standard form, which is how Physics and Chemistry write their larger numbers. */
  'number-plus': {
    label: 'Number',
    tooltip: 'numbers and standard form',
    displayEditToolbar: false,
    rows: [
      ...DIGITS,
      ['1', '2', '3', FRACTION],
      ['0', '.', TIMES_TEN, SQUARED],
      [{ latex: '(' }, { latex: ')' }, LEFT, RIGHT],
      [UP, DOWN],
    ],
  },
  /** Expressions: every letter and sign the Maths answers in this pack use. */
  algebra: {
    label: 'Maths',
    tooltip: 'expressions',
    displayEditToolbar: false,
    rows: [
      ...DIGITS,
      ['1', '2', '3', { latex: '+' }],
      ['0', '.', FRACTION, POWER],
      [{ latex: 'x' }, { latex: 'y' }, { latex: 'n' }, SQUARED],
      [{ latex: 'a' }, { latex: 'b' }, { latex: 'r' }, ROOT],
      [{ latex: '(' }, { latex: ')' }, { latex: ',' }, { latex: '=' }],
      [{ latex: '\\pi' }, { latex: '<' }, LEFT, RIGHT],
      [UP, DOWN],
    ],
  },
}

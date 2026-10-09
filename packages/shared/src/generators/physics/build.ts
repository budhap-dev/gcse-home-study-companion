import type { Question } from '../../content/questions.ts'
import { grouped, show } from '../format.ts'
import { int, type Rng } from '../random.ts'
import { scheme } from '../scheme.ts'
import type { Check, Draft } from '../types.ts'
import { sci } from './format.ts'

/**
 * What every Physics generator file needs to write a numeric question: numbers in prose and
 * in maths, the end of a worked solution, and the Draft with the mark scheme's last line as
 * the written questions print it.
 */

/** Gravitational field strength as the content states it. */
export const G = 9.8
/** The two ways the written prompts state g. */
export const G_STATED = ['Gravitational field strength is 9.8 N/kg.', 'Take $g = 9.8$ N/kg.']

export const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(a))
/** Whether x has at most `dp` decimal places, allowing for binary residue. */
export const atMost = (x: number, dp: number) => Math.abs(x * 10 ** dp - Math.round(x * 10 ** dp)) < 1e-6
/** A value from lo to hi in steps: 0.2, 0.3, … 2 or 900, 950, … 1600. */
export const stepped = (r: Rng, lo: number, hi: number, step: number) => Number(show(lo + step * int(r, 0, Math.round((hi - lo) / step))))
export const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1)
/** A number in prose: 12 000 from five digits. */
export const prose = (x: number) => grouped(Number(show(x)))
/** Significant figures a whole number carries: 675000 has three. */
export const figures = (x: number) => show(x).replace('.', '').replace(/^0+/, '').replace(/0+$/, '').length

/** A number inside $…$: 12\,000 from five digits, never residue. */
export function tex(x: number): string {
  const [whole, frac] = show(Math.abs(x)).split('.')
  const w = Number(whole) >= 10000 ? whole!.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : whole!
  return `${x < 0 ? '-' : ''}${w}${frac ? `.${frac}` : ''}`
}

/** Standard form with exactly the figures the number has: 675000 is 6.75 × 10⁵, 180000 is 1.8 × 10⁵. */
export const sciExact = (x: number) => sci(x, Math.max(2, figures(x)))

/**
 * The end of a worked solution. Under five digits the maths runs to the answer. From five
 * digits the maths stops at the last product and the answer follows in the digits the answer
 * box prints, with its standard form beside it: 180\,000 in the maths would not be the
 * 180000 the release check looks for, and the bold figure is the one the student sees marked.
 */
export function closes(expr: string, answer: number, unit: string): string {
  if (Math.abs(answer) < 10000) return `$${expr} = ${show(answer)}$ ${unit}.`
  return `$${expr}$, which is **${answer} ${unit}** ($${sciExact(answer)}$ ${unit}).`
}

export interface Built {
  prompt: string
  solution: string
  method: string[]
  answer: number
  tolerance?: number
  units?: string
  /** The mark scheme's last line, when it is not the answer with its unit. */
  line?: string
}

/** A numeric draft: the mark scheme's last line is the answer with its unit, as the written ones print it. */
export function numeric(slot: Question, b: Built, check: Check, values: Draft['values']): Draft {
  const line = b.line ?? (b.units === '%' ? `${show(b.answer)}%` : b.units ? `${prose(b.answer)} ${b.units}` : show(b.answer))
  return {
    question: {
      type: 'numeric',
      prompt: b.prompt,
      solution: b.solution,
      markScheme: scheme(slot, b.method, line),
      answer: b.answer,
      tolerance: b.tolerance ?? 0,
      ...(b.units ? { units: b.units } : {}),
    },
    check,
    values,
  }
}

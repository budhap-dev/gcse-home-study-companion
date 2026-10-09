/**
 * Numbers as Physics prints them: significant figures with their trailing zero, standard
 * form in TeX, and the room a rounded answer leaves for marking. The Maths helpers in
 * ../format.ts (show, fixed, roundTo, grouped) still apply; these are the ones Maths never
 * needed.
 */

import { show } from '../format.ts'

/** x to n significant figures, as a number: sigFigs(52.915, 3) is 52.9. */
export function sigFigs(x: number, n: number): number {
  return x === 0 ? 0 : Number(x.toPrecision(n))
}

/**
 * x to n significant figures as the content prints it, keeping a trailing zero and never
 * in e-notation: "0.25", "3.00", "52.9", "300000".
 */
export function sigText(x: number, n: number): string {
  if (x === 0) return '0'
  const p = x.toPrecision(n)
  return /e/.test(p) ? String(Number(p)) : p
}

/** The power of ten of the last of n significant figures of x: for 52.9 and 3 it is -1. */
function lastPlace(x: number, n: number): number {
  return Math.floor(Math.log10(Math.abs(x))) - (n - 1)
}

/**
 * The marking room a rounded answer leaves: half a unit in the last significant figure, and
 * never more than 2% of the answer (the release check's limit; the cap sits at 1.9% so the
 * figure, cleaned of binary residue, cannot land a hair above the line). A student who
 * rounds the same way lands on the number itself; this covers one who kept a different
 * intermediate.
 */
export function sfTolerance(answer: number, n: number): number {
  if (answer === 0) return 0
  return Number(Math.min(0.5 * 10 ** lastPlace(answer, n), Math.abs(answer) * 0.019).toPrecision(10))
}

/**
 * The room a decimal answer leaves when the prompt asks for no precision: half a unit in
 * the last decimal place printed (0.05 for 333.2 J, 0.005 for 8.75 W), capped at 1.9% as
 * sfTolerance is, and none for a whole number, which a student has no reason to round.
 */
export function dpTolerance(answer: number): number {
  const text = show(answer)
  const dp = text.includes('.') ? text.split('.')[1]!.length : 0
  if (dp === 0) return 0
  return Number(Math.min(0.5 * 10 ** -dp, Math.abs(answer) * 0.019).toPrecision(10))
}

/**
 * Whether rounding x to n significant figures is clear of a half-way case, so two students
 * rounding correctly cannot land on different numbers. Draw again when it is not.
 */
export function clearAtSigFigs(x: number, n: number, margin = 0.02): boolean {
  if (x === 0) return true
  const scaled = Math.abs(x) / 10 ** lastPlace(x, n)
  const frac = scaled - Math.floor(scaled)
  return Math.abs(frac - 0.5) > margin
}

/** Standard form in TeX, for inside $…$: sci(300000000, 2) is "3.0 \times 10^{8}"; sci(0.00025, 2) is "2.5 \times 10^{-4}". */
export function sci(x: number, n = 2): string {
  if (x === 0) return '0'
  let exp = Math.floor(Math.log10(Math.abs(x)))
  let mantissa = sigText(x / 10 ** exp, n)
  if (Math.abs(Number(mantissa)) >= 10) {
    exp += 1
    mantissa = sigText(x / 10 ** exp, n)
  }
  return `${mantissa} \\times 10^{${exp}}`
}

/** Unit prefixes as factors, for a value printed with one: 2.5 kW is 2.5 × PREFIX.k W. */
export const PREFIX = { G: 1e9, M: 1e6, k: 1e3, c: 1e-2, m: 1e-3, µ: 1e-6, n: 1e-9 } as const

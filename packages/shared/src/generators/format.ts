/**
 * Numbers as the content prints them. A generator computes its figures, and printing a
 * computed figure without rounding it writes the binary residue (2.4000000000000004) into
 * the text a student reads: see float-residue.test.ts.
 */

/** A number with no residue and no trailing zeros: 3.5, 42, 0.12. */
export function show(x: number): string {
  const s = String(Number(x.toFixed(10)))
  return s === '-0' ? '0' : s
}

export function roundTo(x: number, dp: number): number {
  const f = 10 ** dp
  return Math.round(x * f) / f
}

/** Rounded and printed to exactly `dp` places, as a mark scheme gives it: 14.00. */
export function fixed(x: number, dp: number): string {
  return roundTo(x, dp).toFixed(dp)
}

/**
 * Whether `x` is safe to round to `dp` places: not within `margin` of a half in the last
 * place. A value like 6.884999… rounds one way by one method and the other way by another,
 * and a student keying the calculation differently would be marked wrong for it.
 */
export function clearOfHalf(x: number, dp: number, margin = 0.02): boolean {
  const scaled = Math.abs(x) * 10 ** dp
  return Math.abs(scaled - Math.floor(scaled) - 0.5) > margin
}

/** Pounds as the pack prints them: £60, £2318.55, £57.60. */
export function money(x: number): string {
  const v = roundTo(x, 2)
  return Number.isInteger(v) ? `£${v}` : `£${v.toFixed(2)}`
}

/** The same amount as a number in maths, without the sign: 2318.55, 60, 57.60. */
export function pounds(x: number): string {
  return money(x).slice(1)
}

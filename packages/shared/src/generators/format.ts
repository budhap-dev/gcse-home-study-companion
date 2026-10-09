/**
 * Numbers as the content prints them. A generator computes its figures, and printing a
 * computed figure without rounding it writes the binary residue (2.4000000000000004) into
 * the text a student reads: see float-residue.test.ts.
 */

/** A number with no residue and no trailing zeros: 3.5, 42, 0.12. */
export function show(x: number): string {
  // Twelve significant figures first: 750 × 9.8 × 47 is 345450.00000000006, which ten
  // decimal places alone would keep as 345450.0000000001.
  const s = String(Number(Number(x.toPrecision(12)).toFixed(10)))
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
  const [whole, pence] = (Number.isInteger(v) ? String(v) : v.toFixed(2)).split('.')
  return `£${grouped(Number(whole))}${pence ? `.${pence}` : ''}`
}

/** 10 000 as the content prints it in prose: a space between groups of three, from five digits. Inside maths, write 10\,000 instead. */
export function grouped(x: number): string {
  return Math.abs(x) >= 10000 ? String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : String(x)
}

/** The same amount as a number in maths, without the sign: 2318.55, 60, 57.60. */
export function pounds(x: number): string {
  return money(x).slice(1)
}

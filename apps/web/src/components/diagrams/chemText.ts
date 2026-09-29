const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉'

/**
 * A molecular formula as a chemist writes it, with its counts set low: C₂H₅OH, not
 * C2H5OH. Content writes the plain digits, which is what a keyboard gives, and every
 * caption under a displayed formula was printing them at full height.
 *
 * Only a run of element symbols with a count in it is touched, so "150 °C" and "Step 2"
 * are left alone. So is the number in front of a formula, which counts molecules (2H₂O),
 * and an ion's charge: in Fe2+ the 2 is a charge, not a count.
 */
export function chemText(text: string): string {
  return text.replace(/(?<![A-Za-z])(?:[A-Z][a-z]?\d*|\(|\)\d*)+(?![+−\-A-Za-z0-9])/g, (word) =>
    /\d/.test(word) ? word.replace(/(?<=[A-Za-z)])\d+/g, (n) => [...n].map((d) => SUBSCRIPT[Number(d)]).join('')) : word,
  )
}

/**
 * Where a formula may break across lines on a narrow screen.
 *
 * KaTeX lets inline maths break after any relation or binary operator at its outermost
 * level, and a bracket written with plain ( ) is still the outermost level. So on a phone
 * the factor theorem broke as "(x −" and "a)", and a probability rule ended a line on its
 * minus sign. A formula reads in sides, so it should break between them: after the equals
 * sign, or after the comma between two formulae that share a line.
 *
 * KaTeX never breaks inside a pair of braces, so each side that holds an operator is
 * wrapped in one. Braces draw nothing, which is why this can be done to the source.
 */

/** After these a line may end: the next line then starts a fresh side. */
const RELATIONS = new Set([
  '=', '<', '>', '\\le', '\\leq', '\\ge', '\\geq', '\\ne', '\\neq', '\\approx', '\\equiv', '\\propto',
  '\\iff', '\\implies', '\\Rightarrow', '\\Leftrightarrow', '\\rightarrow', '\\to',
])
const BINARY = new Set(['+', '-', '*', '\\times', '\\div', '\\pm', '\\mp', '\\cdot'])

/** The source as commands, single characters and runs of spaces. */
function tokens(tex: string): string[] {
  return tex.match(/\\[a-zA-Z]+|\\[^a-zA-Z]|\s+|[^\\\s]/g) ?? []
}

/**
 * Roughly how many characters a piece of source puts on screen: the words inside \text{},
 * one for each command, and none for the braces, carets and underscores that draw nothing.
 */
export function drawnLength(tex: string): number {
  return tex
    .replace(/\\(?:text|mathrm|mathbf)\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, 'x')
    .replace(/\\./g, ' ')
    .replace(/[{}^_\s]/g, '').length
}

/**
 * One maths span, with every side that could break inside itself wrapped in braces. With
 * a `limit`, only sides that draw that many characters or fewer: a side held together
 * cannot wrap, so in running text, where nothing sets a formula again if it does not fit,
 * only a side short enough for any line is held.
 */
export function keepSidesTogether(tex: string, limit = Infinity): string {
  let out = ''
  let side = ''
  let breakable = false
  // Inside braces, a \left ... \right pair or an environment nothing is the outermost level.
  let depth = 0
  const close = () => {
    const body = side.trim()
    out += breakable && body && drawnLength(body) <= limit ? `${side.match(/^\s*/)![0]}{${body}}${side.match(/\s*$/)![0]}` : side
    side = ''
    breakable = false
  }
  for (const t of tokens(tex)) {
    if (t === '{' || t === '\\left' || t === '\\begin') depth++
    else if (t === '}' || t === '\\right' || t === '\\end') depth--
    else if (depth === 0 && (RELATIONS.has(t) || t === ',')) {
      close()
      out += t
      continue
    } else if (depth === 0 && BINARY.has(t) && side.trim()) breakable = true
    // A sign that opens a side, as in "= -1", has nothing before it to break away from.
    side += t
  }
  close()
  return out
}

/** A formula as written in a resource: words with maths between dollar signs. */
export function keepFormulaTogether(source: string, limit = Infinity): string {
  return source.replace(/(?<!\\)\$([^$\n]+?)\$/g, (_, tex: string) => `$${keepSidesTogether(tex, limit)}$`)
}

/** The longest side held together in running text: about half a phone's line. */
export const SHORT_SIDE = 22

/**
 * Running text with a sum in it. "has fallen by 20/80 × 100 = 25%" ended a line on its
 * times sign and began the next with the 100; with the short side held, the line ends
 * before the sum or after its equals sign. Display maths has a line to itself and is left.
 */
export function keepSumsTogether(source: string): string {
  return source.split(/(\$\$[\s\S]+?\$\$)/).map((part, i) => (i % 2 ? part : keepFormulaTogether(part, SHORT_SIDE))).join('')
}

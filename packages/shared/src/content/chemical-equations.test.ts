import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every chemical equation a Chemistry topic asserts as correct must balance: the same
 * count of each element on both sides, and the same total charge once electrons are
 * counted. Nothing else in the suite can see this. The schema does not read equations,
 * the marker round-trip only checks that an accepted answer marks itself correct, and a
 * reviewer reading prose will not reliably count oxygens across twenty-five topics.
 *
 * Equations that are *meant* not to balance are excluded by where they sit rather than
 * by an allow-list, so a new one never has to be registered: a question `prompt` may
 * carry a blank to fill in, `options` are distractors, `examinerErrors` quote answers
 * that are wrong on purpose, a worked example's `problem` and `steps` pose and work
 * through the unbalanced starting point, a 'your turn' step is the worksheet whose
 * equations the student has to balance, and a table column headed *Weak* holds the
 * answer being argued against. What is left is every place the content
 * claims an equation is right — lesson bodies, solutions, model answers, mark schemes
 * and the accepted-answer lists — which is exactly where a slip would be believed.
 */
const ROOT = join(import.meta.dirname, '../../../../supabase/seed/content/chemistry')

/** Keys whose subtrees deliberately hold unbalanced equations. */
const DELIBERATE = new Set(['prompt', 'options', 'examinerErrors', 'problem'])

/** A "your turn" step is a worksheet: its equations are the ones the student has to balance. */
const WORKSHEET = 'your-turn'

/**
 * Some tables set a wrong answer beside a right one, so a cell is excluded by the column
 * it sits under rather than by its key. The headings are the content's own words for the
 * losing side of that comparison.
 */
const WRONG_ANSWER_COLUMN = /\bweak\b|\bwrong\b|mistake|what students write|\berror/i

const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
const SUP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }

/**
 * One species: an optional multiplier, a formula with subscripts and bracket groups, and
 * an optional charge. Charges are written both ways in the content — `Cu²⁺` in prose and
 * `Cu2+` in the accepted lists, because that is what a student types — so both are read.
 * A free electron is `e⁻`, `e-`, or the bare `e` a student types.
 */
const TERM = String.raw`\d*\s*(?:e(?![a-z])[⁻-]?|[A-Z][a-z]?(?:[₀-₉0-9]|\([A-Z][a-z]?[₀-₉0-9]*\)[₀-₉0-9]*|[A-Z][a-z]?)*(?:[⁰¹²³⁴⁵⁶⁷⁸⁹]*[⁺⁻]|\d*[+-](?=\s|$|→))?)(?:\s*\((?:s|l|g|aq)\))?`
const SIDE = String.raw`${TERM}(?:[ \t]*[+\-][ \t]*${TERM})*`
const EQUATION = new RegExp(String.raw`${SIDE}[ \t]*→[ \t]*${SIDE}`, 'g')

/**
 * Lesson bodies write their equations as LaTeX and the tables and accepted lists write
 * them as Unicode, so both have to be read. An earlier version of this file matched only
 * the Unicode arrow and silently skipped every equation in a lesson body — the fifty-odd
 * that matter most, since those are the ones the lesson teaches from.
 */
function fromLatex(text: string): string {
  let out = text
  for (let pass = 0; pass < 3; pass++) out = out.replace(/\\(?:mathrm|mathbf|textbf|text)\{([^{}]*)\}/g, '$1')
  return out
    .replace(/\\(?:long)?rightarrow|\\to(?![a-z])/g, '→')
    .replace(/[_^]\{([^{}]*)\}/g, '$1')
    .replace(/[_^]/g, '')
    .replace(/\\[,;!:>]|\\ /g, ' ')
    .replace(/\$/g, '')
}

type Amounts = { atoms: Record<string, number>; charge: number }

function parseSpecies(raw: string): Amounts {
  let s = raw.trim().replace(/\s*\((?:s|l|g|aq)\)\s*$/, '')
  for (const [from, to] of Object.entries(SUB)) s = s.split(from).join(to)

  const coefficient = s.match(/^(\d+)/)
  const multiplier = coefficient ? Number(coefficient[1]) : 1
  if (coefficient) s = s.slice(coefficient[0].length)

  if (/^e$/.test(s.replace(/[⁻-]$/, ''))) return { atoms: {}, charge: -multiplier }

  let charge = 0
  const ascii = s.match(/(\d*)([+-])$/)
  const superscript = s.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/)
  if (superscript) {
    const size = superscript[1] ? Number([...superscript[1]].map((c) => SUP[c]).join('')) : 1
    charge = superscript[2] === '⁺' ? size : -size
    s = s.slice(0, superscript.index)
  } else if (ascii) {
    charge = (ascii[2] === '+' ? 1 : -1) * (ascii[1] ? Number(ascii[1]) : 1)
    s = s.slice(0, ascii.index)
  }

  // A bracket group repeats everything inside it, so expand before counting: Ca(OH)2 -> CaOHOH.
  s = s.replace(/\(([^()]*)\)(\d*)/g, (_, inner: string, n: string) => inner.repeat(n ? Number(n) : 1))
  const atoms: Record<string, number> = {}
  for (const [, element, count] of s.matchAll(/([A-Z][a-z]?)(\d*)/g)) {
    if (!element) continue
    atoms[element] = (atoms[element] ?? 0) + multiplier * (count ? Number(count) : 1)
  }
  return { atoms, charge: multiplier * charge }
}

/**
 * Sum one side. The terms are re-matched rather than split on '+', because in the ASCII
 * notation the charge sits exactly where the separator would be and `4H+ + 4e-` would
 * otherwise tear in two. A '-' before a term subtracts it, which is how the accepted
 * lists write "sodium minus an electron": Na - e⁻ → Na⁺.
 */
function sumSide(text: string): Amounts {
  const atoms: Record<string, number> = {}
  let charge = 0
  for (const match of text.matchAll(new RegExp(TERM, 'g'))) {
    const sign = /-\s*$/.test(text.slice(0, match.index)) ? -1 : 1
    const { atoms: theirs, charge: theirCharge } = parseSpecies(match[0])
    for (const [element, n] of Object.entries(theirs)) atoms[element] = (atoms[element] ?? 0) + sign * n
    charge += sign * theirCharge
  }
  return { atoms, charge }
}

/** Every string that asserts a correct equation, with a path so a failure can be found. */
function claims(node: unknown, path: string, found: [string, string][] = []): [string, string][] {
  if (typeof node === 'string') found.push([path, node])
  else if (Array.isArray(node)) node.forEach((child, i) => claims(child, `${path}[${i}]`, found))
  else if (node && typeof node === 'object') {
    if ((node as { kind?: string }).kind === WORKSHEET) return found
    const table = node as { columns?: unknown; rows?: unknown }
    if (Array.isArray(table.columns) && Array.isArray(table.rows)) {
      const skip = table.columns.map((c) => typeof c === 'string' && WRONG_ANSWER_COLUMN.test(c))
      table.rows.forEach((row, r) => {
        if (!Array.isArray(row)) return claims(row, `${path}.rows[${r}]`, found)
        row.forEach((cell, c) => {
          if (!skip[c]) claims(cell, `${path}.rows[${r}][${c}]`, found)
        })
      })
      for (const [key, child] of Object.entries(node)) {
        if (key !== 'rows' && key !== 'columns' && !DELIBERATE.has(key)) claims(child, `${path}.${key}`, found)
      }
      return found
    }
    const isWorkedExample = (node as { type?: string }).type === 'worked-example'
    for (const [key, child] of Object.entries(node)) {
      if (DELIBERATE.has(key)) continue
      if (isWorkedExample && key === 'steps') continue
      claims(child, `${path}.${key}`, found)
    }
  }
  return found
}

const topics = readdirSync(ROOT)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(join(ROOT, f), 'utf8'))] as const)

describe('chemical equations asserted as correct', () => {
  it('found the Chemistry topics', () => {
    expect(topics.length).toBeGreaterThan(20)
  })

  it('balances for atoms and for charge', () => {
    const unbalanced: string[] = []
    let checked = 0
    for (const [file, topic] of topics) {
      for (const [path, text] of claims(topic, '')) {
        for (const match of fromLatex(text).matchAll(EQUATION)) {
          const [left, right] = match[0].split('→')
          const from = sumSide(left)
          const to = sumSide(right)
          const elements = new Set([...Object.keys(from.atoms), ...Object.keys(to.atoms)])
          const off = [...elements].filter((e) => (from.atoms[e] ?? 0) !== (to.atoms[e] ?? 0))
          if (off.length) unbalanced.push(`${file}${path}: ${match[0].trim()} — ${off.join(', ')} differ`)
          else if (from.charge !== to.charge) unbalanced.push(`${file}${path}: ${match[0].trim()} — charge ${from.charge} becomes ${to.charge}`)
          checked++
        }
      }
    }
    expect(unbalanced).toEqual([])
    // A floor on the count, because the way this test fails silently is by matching
    // nothing: when it read only the Unicode arrow it passed while skipping every
    // equation written as LaTeX. Raise this as Chemistry grows; never lower it.
    expect(checked).toBeGreaterThan(170)
  })
})

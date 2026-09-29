import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ResourceFile } from '../resources.ts'

const ROOT = join(import.meta.dirname, '../../../../supabase/seed')
const physics = ResourceFile.parse(JSON.parse(readFileSync(join(ROOT, 'resources/physics.json'), 'utf8')))
const sheet = physics.resources.find((r) => r.id === 'equation-sheet')!
const formulae = sheet.blocks.flatMap((b) => (b.kind === 'formulae' ? b.groups.flatMap((g) => g.items) : []))

/** Every string in a topic, with where it is, so a failure names the step. */
function strings(value: unknown, path: string, out: { path: string; text: string }[] = []) {
  if (typeof value === 'string') out.push({ path, text: value })
  else if (Array.isArray(value)) value.forEach((v, i) => strings(v, `${path}/${i}`, out))
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) strings(v, `${path}/${k}`, out)
  return out
}

describe('the Physics equation sheet', () => {
  /**
   * AQA's sheet for 2027 prints every equation in the specification's Appendix A: the 23
   * it lists to recall and the 12 to select and apply. Ofqual's decision of 5 May 2026
   * keeps it, unchanged, for exams from 2028, and lists these as equations students "are
   * not required to memorise".
   */
  it('carries all 35 equations, six of them Higher tier', () => {
    expect(formulae).toHaveLength(35)
    expect(formulae.filter((f) => f.higher)).toHaveLength(6)
  })

  /**
   * The lessons were written to the specification's split, and fourteen topics told the
   * student that V = IR, v = fλ, p = mv, p = F/A and the power equations were "not on the
   * equation sheet". A student sitting in 2028 would have learned the wrong thing about
   * their own paper, and one quiz question marked the true answer wrong. With every
   * equation on the sheet, any such claim about an Appendix A equation is false.
   */
  it('is never said to leave an equation off, anywhere in the Physics content', () => {
    // A multiple-choice distractor is false on purpose, so the options are not scanned.
    const FALSE_CLAIM = /not(?:\*\*)? on the (?:AQA )?(?:physics )?(?:equation )?sheet|neither is on the sheet|on the recall list|does not give it on|must be recalled|has to be recalled|not given in the exam|had not been confirmed/i
    const dir = join(ROOT, 'content/physics')
    const found = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => strings(JSON.parse(readFileSync(join(dir, f), 'utf8')), f.replace('.json', '')))
      .filter((s) => !/\/questions\/\d+\/options\//.test(s.path) && FALSE_CLAIM.test(s.text))
      .map((s) => `${s.path}: ${s.text.match(FALSE_CLAIM)![0]}`)
    expect(found).toEqual([])
  })

  it('catches the phrasings it was written for', () => {
    const FALSE_CLAIM = /not(?:\*\*)? on the (?:AQA )?(?:physics )?(?:equation )?sheet|neither is on the sheet|on the recall list|does not give it on|must be recalled|has to be recalled|not given in the exam|had not been confirmed/i
    for (const s of ['This equation is **not** on the AQA equation sheet.', 'it is not on the sheet', 'v = fλ must be recalled', 'both on the recall list']) expect(FALSE_CLAIM.test(s), s).toBe(true)
    expect(FALSE_CLAIM.test('It is on the equation sheet, marked HT.')).toBe(false)
  })
})

/**
 * The sheet's summary promises "what every symbol stands for and its unit". On a laptop a
 * group reads as one card, but on a phone each formula is its own, and 21 of the 35 left
 * a letter unexplained: P = V I said only "P power (W)".
 */
describe('what the letters mean', () => {
  /** The letters a formula is written with: single letters, with a subscript where they have one, and Greek ones. */
  const letters = (formula: string) => {
    const tex = formula.replace(/\\text\{[^}]*\}/g, ' ').replace(/\\(?:dfrac|tfrac|times|Delta|,)/g, ' ')
    return [...new Set(tex.match(/\\(?:rho|lambda|theta)|[A-Za-z](?:_[a-z])?/g) ?? [])]
  }
  const named = (letter: string, symbols: string) => [...symbols.matchAll(/\$([^$]+)\$/g)].some((m) => m[1]!.includes(letter))

  it('reads the letters out of a formula', () => {
    expect(letters('$E_k = \\tfrac{1}{2}\\,m\\,v^2$').sort()).toEqual(['E_k', 'm', 'v'])
    expect(letters('$\\Delta E = m\\,c\\,\\Delta\\theta$').sort()).toEqual(['E', '\\theta', 'c', 'm'])
    expect(letters('$\\text{efficiency} = \\dfrac{\\text{useful power output}}{\\text{total power input}}$')).toEqual([])
  })

  it('names every letter of every formula beside it', () => {
    const missing: string[] = []
    let checked = 0
    for (const f of formulae) {
      for (const letter of letters(f.formula)) {
        checked++
        // The transformer equations name V, I and n once for both coils, and say what p and s stand for.
        const bare = /^[VIn]_[ps]$/.test(letter) ? [letter, letter[0]!] : [letter]
        if (!bare.some((l) => named(l, f.symbols ?? ''))) missing.push(`${f.name}: ${letter}`)
      }
    }
    expect(checked).toBeGreaterThan(90)
    expect(missing).toEqual([])
  })

  /** "the unit every quantity on the equation sheet is measured in": ten had no row. */
  it('has a row in the units table for every unit the sheet names', () => {
    const units = physics.resources.find((r) => r.id === 'units-and-prefixes')!
    const table = units.blocks.find((b) => b.kind === 'table' && b.title === 'Quantities and their units')
    const listed = new Set(table?.kind === 'table' ? table.rows.map((r) => r[3]) : [])
    const used = new Set(formulae.flatMap((f) => [...(f.symbols ?? '').matchAll(/\(((?:[A-Za-zΩ°³²]+(?:[ /][A-Za-zΩ°³²]+)*))\)/g)].map((m) => m[1]!)))
    // Not units: what a bracket holds in a sentence.
    for (const word of ['delta', 'HT']) used.delete(word)
    expect(used.size).toBeGreaterThan(20)
    expect([...used].filter((u) => !listed.has(u))).toEqual([])
  })

  /** Energy supplied does not make bonds: bonding gives energy out. The specification explains a change of state by internal energy. */
  it('explains a change of state by internal energy, not by making bonds', () => {
    const state = formulae.find((f) => f.name === 'Change of state')!
    expect(state.symbols).toContain('internal energy')
    expect(state.symbols).not.toMatch(/makes? bonds/)
  })
})
